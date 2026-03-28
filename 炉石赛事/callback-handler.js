/**
 * 炉石赛事自动化系统 - 回调处理主程序
 * 版本: v1.1 | 日期: 2026-03-28
 *
 * 本文件提供可直接落地的回调处理主入口，覆盖：
 * - 回调路由分发
 * - 权限校验
 * - 状态机校验
 * - 数据写回
 * - 通知发送
 */

const {
  queryRecord,
  getRecord,
  updateRecord,
  createRecord,
} = require('./bitable-api-utils');

const {
  sendNotification,
  sendGroupMessageByTournament,
  pushDeckSubmissionEntry,
  generatePublishConfirmation,
  createAnnouncement,
  notifyDisputeParties,
  notifyAdmin,
} = require('./notification-utils');

// ============================================
// 配置与常量
// ============================================

const CONFIG = {
  feishu: {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
  },
  bitable: {
    baseUrl: 'https://open.feishu.cn/open-apis/bitable/v1',
    apps: {
      basic: 'KSyvbZIb1af98gsLJ7wcKmtEn9Q',
      operation: 'KL3TbTEJIa5oytspkGGcf50rnpc',
      deck: 'SXg4bBhrhajJgdsRNCzcycOrnbe',
    },
  },
  admin: {
    openId: 'ou_914e6141a81eb6da2602875aee631269',
  },
};

const TABLES = {
  // 基础资料中心
  players: 'tblaQYWnDvPb7aGA',
  teams: 'tblEgSf4nhxwfTwo',
  teamMembers: 'tblHfGsGy1hLETqO',

  // 运营中心
  tournaments: 'tbl0a6HI2ugcbkqW',
  tournamentAdmins: 'tblBB5Xqw4RPQ177',
  registrations: 'tbldzij0kXhmy2N0',
  registrationMembers: 'tblVABsgGsLTJ3yD',
  matches: 'tblgnkqFLhTUkY4c',
  disputes: 'tblf8gkNy4SKgLJf',

  // 卡组与流程中心
  deckSubmissions: 'tblEEtx8k1AzYy4j',
  decks: 'tblraWTd0mgs5Bgu',
  announcements: 'tbloMMt0CwQsTDpM',
};

const BITABLE_UTILS = {
  CONFIG: { apps: CONFIG.bitable.apps },
  TABLES,
  queryRecord,
  getRecord,
  updateRecord,
  createRecord,
};

// ============================================
// 主入口
// ============================================

/**
 * 处理飞书卡片回调
 * @param {Object} callback
 * @param {Object} context
 */
async function handleCallback(callback, context = {}) {
  const { action, ...params } = callback || {};

  if (!action) {
    throw new Error('缺少 action');
  }

  console.log(`[Callback] Action: ${action}`, params);

  try {
    await checkPermission(context.operatorOpenId, params.tournament_uid, action);
    await checkState(action, params);

    switch (action) {
      // 报名审核
      case 'approve_registration':
        return await approveRegistration(params);
      case 'reject_registration':
        return await rejectRegistration(params);
      case 'request_registration_info':
        return await requestRegistrationInfo(params);

      // 卡组审核
      case 'approve_deck_submission':
        return await approveDeckSubmission(params);
      case 'reject_deck_submission':
        return await rejectDeckSubmission(params);
      case 'publish_decks':
        return await publishDecks(params);

      // 争议处理
      case 'approve_ai_recommendation':
        return await approveAIRecommendation(params);
      case 'custom_ruling':
        return await customRuling(params);

      // 工作台查询
      case 'list_pending_registrations':
        return await listPendingRegistrations(params);
      case 'list_pending_decks':
        return await listPendingDecks(params);
      case 'list_pending_disputes':
        return await listPendingDisputes(params);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`[Callback Error] ${action}:`, error);
    await notifyAdmin(`处理失败: ${action}\n错误: ${error.message}`, CONFIG.admin.openId);
    throw error;
  }
}

// ============================================
// 权限校验
// ============================================

async function checkPermission(operatorOpenId, tournamentUid, action) {
  if (!tournamentUid) {
    // 查询类动作若没有赛事上下文，直接拒绝，避免误操作
    throw new Error('缺少 tournament_uid');
  }

  if (!operatorOpenId) {
    throw new Error('缺少 operatorOpenId');
  }

  const admins = await queryRecord(
    CONFIG.bitable.apps.operation,
    TABLES.tournamentAdmins,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'tournament_uid', operator: 'is', value: [tournamentUid] },
          { field_name: 'user_open_id', operator: 'is', value: [operatorOpenId] },
          { field_name: 'status', operator: 'is', value: ['active'] },
        ],
      },
    }
  );

  if (!admins || admins.length === 0) {
    throw new Error('无权限操作该赛事');
  }

  const role = admins[0].fields.role;
  const allowedActions = getAllowedActions(role);

  if (!allowedActions.includes(action)) {
    throw new Error(`当前角色(${role})无权执行此操作`);
  }

  return true;
}

function getAllowedActions(role) {
  const actionMap = {
    owner: [
      'approve_registration', 'reject_registration', 'request_registration_info',
      'approve_deck_submission', 'reject_deck_submission', 'publish_decks',
      'approve_ai_recommendation', 'custom_ruling',
      'list_pending_registrations', 'list_pending_decks', 'list_pending_disputes',
    ],
    admin: [
      'approve_registration', 'reject_registration', 'request_registration_info',
      'approve_deck_submission', 'reject_deck_submission',
      'list_pending_registrations', 'list_pending_decks', 'list_pending_disputes',
    ],
    judge: [
      'approve_ai_recommendation', 'custom_ruling',
      'list_pending_disputes',
    ],
  };

  return actionMap[role] || [];
}

// ============================================
// 状态校验
// ============================================

async function checkState(action, params) {
  const { registration_id, submission_id, dispute_id } = params;

  if (action.includes('registration')) {
    const registration = await resolveRecordReference(
      CONFIG.bitable.apps.operation,
      TABLES.registrations,
      registration_id,
      ['registration_uid']
    );

    if (!registration) {
      throw new Error('报名记录不存在');
    }

    const status = registration.fields.registration_status;

    if (action === 'approve_registration' && status !== 'submitted') {
      throw new Error(`当前状态(${status})不允许审核通过`);
    }

    if (action === 'reject_registration' && !['submitted', 'under_review'].includes(status)) {
      throw new Error(`当前状态(${status})不允许驳回`);
    }
  }

  if (action.includes('deck')) {
    const submission = await resolveRecordReference(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      submission_id,
      ['deck_submission_uid', 'submission_uid']
    );

    if (!submission) {
      throw new Error('卡组提交记录不存在');
    }

    const status = submission.fields.submission_status;

    if (action === 'approve_deck_submission' && status !== 'submitted') {
      throw new Error(`当前状态(${status})不允许审核通过`);
    }

    if (action === 'reject_deck_submission' && !['submitted', 'auto_failed', 'under_review'].includes(status)) {
      throw new Error(`当前状态(${status})不允许驳回`);
    }
  }

  if (action.includes('dispute')) {
    const dispute = await resolveRecordReference(
      CONFIG.bitable.apps.operation,
      TABLES.disputes,
      dispute_id,
      ['dispute_uid']
    );

    if (!dispute) {
      throw new Error('争议记录不存在');
    }
  }

  return true;
}

// ============================================
// 报名审核
// ============================================

async function approveRegistration(params) {
  const { registration_id, entity_type, entity_uid, admin_open_id, tournament_uid } = params;
  const timestamp = Date.now();

  const registration = await resolveRecordReference(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registration_id,
    ['registration_uid']
  );

  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registration.record_id,
    {
      registration_status: 'approved',
      review_status: 'approved',
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );

  const notifyOpenIds = await getEntityNotifyOpenIds(entity_type, entity_uid);
  const entityRecord = await getEntityRecord(entity_type, entity_uid);

  if (entity_type === 'team' && entityRecord) {
    await safeUpdateRecord(
      CONFIG.bitable.apps.basic,
      TABLES.teams,
      entityRecord.record_id,
      { team_status: 'active' }
    );
  } else if (entity_type === 'player' && entityRecord) {
    await safeUpdateRecord(
      CONFIG.bitable.apps.basic,
      TABLES.players,
      entityRecord.record_id,
      { verified_status: 'verified' }
    );
  }

  await notifyMany(notifyOpenIds, '✅ 您的报名已通过审核！');

  await pushDeckSubmissionEntry(entity_type, entity_uid, tournament_uid, BITABLE_UTILS);

  return { success: true, message: '报名审核通过' };
}

async function rejectRegistration(params) {
  const { registration_id, entity_type, entity_uid, reject_reason, admin_open_id } = params;
  const timestamp = Date.now();

  const registration = await resolveRecordReference(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registration_id,
    ['registration_uid']
  );

  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registration.record_id,
    {
      registration_status: 'rejected',
      review_status: 'rejected',
      review_note: reject_reason,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );

  const notifyOpenIds = await getEntityNotifyOpenIds(entity_type, entity_uid);
  await notifyMany(notifyOpenIds, `❌ 您的报名被驳回\n原因：${reject_reason || '未填写'}`);

  return { success: true, message: '报名已驳回' };
}

async function requestRegistrationInfo(params) {
  const { entity_type, entity_uid, request_note } = params;
  const notifyOpenIds = await getEntityNotifyOpenIds(entity_type, entity_uid);

  await notifyMany(notifyOpenIds, `💬 管理员要求补充资料\n${request_note || ''}`.trim());

  return { success: true, message: '已发送补充资料请求' };
}

// ============================================
// 卡组审核
// ============================================

async function approveDeckSubmission(params) {
  const { submission_id, registration_id, entity_type, entity_uid, admin_open_id, tournament_uid } = params;
  const timestamp = Date.now();

  const submission = await resolveRecordReference(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    submission_id,
    ['deck_submission_uid', 'submission_uid']
  );

  const submissionUid = getFieldValue(submission, ['deck_submission_uid', 'submission_uid']) || submission_id;
  const registrationUid = submission?.fields?.registration_uid || registration_id;

  await updateRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    submission.record_id,
    {
      submission_status: 'approved',
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
      is_current_effective_version: true,
    }
  );

  const oldVersions = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'registration_uid', operator: 'is', value: [registrationUid] },
          { field_name: 'submission_status', operator: 'is', value: ['approved'] },
          { field_name: 'deck_submission_uid', operator: 'isNot', value: [submissionUid] },
        ],
      },
    }
  );

  for (const old of oldVersions || []) {
    await updateRecord(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      old.record_id,
      {
        is_current_effective_version: false,
        submission_status: 'superseded',
      }
    );
  }

  await updateDecksVisibility(submissionUid, 'visible_for_bp');

  const notifyOpenIds = await getEntityNotifyOpenIds(entity_type, entity_uid);
  await notifyMany(notifyOpenIds, '✅ 您的卡组已通过审核！');

  const tournament = await resolveRecordReference(
    CONFIG.bitable.apps.operation,
    TABLES.tournaments,
    tournament_uid,
    ['tournament_uid']
  );

  if (tournament?.fields?.public_deck_publish_mode === 'manual_publish') {
    await generatePublishConfirmation(submissionUid, tournament_uid, BITABLE_UTILS, CONFIG.admin.openId);
  }

  return { success: true, message: '卡组审核通过' };
}

async function rejectDeckSubmission(params) {
  const { submission_id, entity_type, entity_uid, reject_reason, admin_open_id } = params;
  const timestamp = Date.now();

  const submission = await resolveRecordReference(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    submission_id,
    ['deck_submission_uid', 'submission_uid']
  );

  await updateRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    submission.record_id,
    {
      submission_status: 'rejected',
      validation_note: reject_reason,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );

  const notifyOpenIds = await getEntityNotifyOpenIds(entity_type, entity_uid);
  await notifyMany(notifyOpenIds, `❌ 您的卡组被驳回\n原因：${reject_reason || '未填写'}`);

  return { success: true, message: '卡组已驳回' };
}

async function publishDecks(params) {
  const { tournament_uid, submission_ids = [], admin_open_id } = params;
  const timestamp = Date.now();

  for (const submission_id of submission_ids) {
    const submission = await resolveRecordReference(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      submission_id,
      ['deck_submission_uid', 'submission_uid']
    );
    const submissionUid = getFieldValue(submission, ['deck_submission_uid', 'submission_uid']) || submission_id;

    await updateRecord(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      submission.record_id,
      {
        public_publish_status: 'published',
        secrecy_status: 'public',
      }
    );

    await updateDecksVisibility(submissionUid, 'published', timestamp);
  }

  await createAnnouncement(
    tournament_uid,
    {
      type: 'deck_publication',
      title: '卡组公示',
      content: `本次公示共 ${submission_ids.length} 支参赛主体卡组`,
      published_by: admin_open_id,
      published_at: timestamp,
    },
    BITABLE_UTILS
  );

  await sendGroupMessageByTournament(
    tournament_uid,
    `📢 卡组公示已发布\n共 ${submission_ids.length} 支参赛主体`,
    BITABLE_UTILS
  );

  return { success: true, message: '卡组已公示' };
}

// ============================================
// 争议处理
// ============================================

async function approveAIRecommendation(params) {
  const { dispute_id, ai_recommendation, admin_open_id } = params;
  const timestamp = Date.now();

  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.disputes,
    dispute_id,
    {
      status: 'resolved',
      final_ruling: ai_recommendation,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );

  await notifyDisputeParties(dispute_id, '争议已裁决', ai_recommendation, BITABLE_UTILS);

  return { success: true, message: '已采纳AI建议并裁决' };
}

async function customRuling(params) {
  const { dispute_id, ruling, admin_open_id } = params;
  const timestamp = Date.now();

  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.disputes,
    dispute_id,
    {
      status: 'resolved',
      final_ruling: ruling,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );

  await notifyDisputeParties(dispute_id, '争议已裁决', ruling, BITABLE_UTILS);

  return { success: true, message: '已自定义裁决' };
}

// ============================================
// 工作台查询
// ============================================

async function listPendingRegistrations(params) {
  const { tournament_uid } = params;

  const records = await queryRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
          { field_name: 'registration_status', operator: 'is', value: ['submitted'] },
        ],
      },
      sort: [{ field_name: 'submitted_at', desc: false }],
    }
  );

  return { success: true, count: records.length, data: records };
}

async function listPendingDecks(params) {
  const { tournament_uid } = params;

  const records = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
          { field_name: 'submission_status', operator: 'is', value: ['submitted'] },
        ],
      },
      sort: [{ field_name: 'submitted_at', desc: false }],
    }
  );

  return { success: true, count: records.length, data: records };
}

async function listPendingDisputes(params) {
  const { tournament_uid } = params;

  const records = await queryRecord(
    CONFIG.bitable.apps.operation,
    TABLES.disputes,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
          { field_name: 'status', operator: 'is', value: ['admin_review'] },
        ],
      },
      sort: [{ field_name: 'created_at', desc: false }],
    }
  );

  return { success: true, count: records.length, data: records };
}

// ============================================
// 辅助函数
// ============================================

async function getEntityNotifyOpenIds(entityType, entityUid) {
  if (!entityType || !entityUid) {
    return [];
  }

  if (entityType === 'team') {
    const team = await getEntityRecord('team', entityUid);
    const captainUid = getFieldValue(team, ['captain_player_uid', 'captain_uid']);
    if (!captainUid) {
      return [];
    }
    const captain = await getEntityRecord('player', captainUid);
    const captainOpenId = getFieldValue(captain, ['feishu_open_id', 'user_open_id', 'open_id']);
    return captainOpenId ? [captainOpenId] : [];
  }

  if (entityType === 'player') {
    const player = await getEntityRecord('player', entityUid);
    const playerOpenId = getFieldValue(player, ['feishu_open_id', 'user_open_id', 'open_id']);
    return playerOpenId ? [playerOpenId] : [];
  }

  return [];
}

async function notifyMany(openIds, message) {
  for (const openId of openIds || []) {
    await sendNotification(openId, message);
  }
}

async function safeUpdateRecord(appToken, tableId, recordId, fields) {
  try {
    return await updateRecord(appToken, tableId, recordId, fields);
  } catch (error) {
    console.warn('[safeUpdateRecord] skipped:', error.message);
    return null;
  }
}

async function updateDecksVisibility(submissionId, visibility, timestamp) {
  const decks = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.decks,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'deck_submission_uid', operator: 'is', value: [submissionId] },
        ],
      },
    }
  );

  for (const deck of decks || []) {
    const fields = { opponent_visibility: visibility };
    if (visibility === 'published') {
      fields.public_visibility = 'published';
      if (timestamp) {
        fields.published_at = timestamp;
      }
    }

    await updateRecord(
      CONFIG.bitable.apps.deck,
      TABLES.decks,
      deck.record_id,
      fields
    );
  }
}

function getFieldValue(record, candidateFields = []) {
  if (!record?.fields) {
    return undefined;
  }

  for (const fieldName of candidateFields) {
    const value = record.fields[fieldName];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

async function resolveRecordReference(appToken, tableId, idOrUid, candidateFields = []) {
  if (!idOrUid) {
    return null;
  }

  try {
    const record = await getRecord(appToken, tableId, idOrUid);
    if (record) {
      return record;
    }
  } catch (error) {
    // ignore and fallback to field-based lookup
  }

  for (const fieldName of candidateFields) {
    const records = await queryRecord(appToken, tableId, {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: fieldName, operator: 'is', value: [idOrUid] },
        ],
      },
      pageSize: 1,
    });

    if (records?.length) {
      return records[0];
    }
  }

  return null;
}

async function getEntityRecord(entityType, entityUid) {
  if (entityType === 'team') {
    return await resolveRecordReference(
      CONFIG.bitable.apps.basic,
      TABLES.teams,
      entityUid,
      ['team_uid']
    );
  }

  if (entityType === 'player') {
    return await resolveRecordReference(
      CONFIG.bitable.apps.basic,
      TABLES.players,
      entityUid,
      ['player_uid']
    );
  }

  return null;
}

// ============================================
// 导出
// ============================================

module.exports = {
  CONFIG,
  TABLES,
  handleCallback,
  checkPermission,
  checkState,
  approveRegistration,
  rejectRegistration,
  requestRegistrationInfo,
  approveDeckSubmission,
  rejectDeckSubmission,
  publishDecks,
  approveAIRecommendation,
  customRuling,
  listPendingRegistrations,
  listPendingDecks,
  listPendingDisputes,
  updateDecksVisibility,
};
