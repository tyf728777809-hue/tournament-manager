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
  batchCreateRecords,
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

const {
  buildInitialSoloConquestState,
  normalizeSoloConquestState,
  validateSoloGameResultInput,
  applySoloGameResult,
  deriveSoloConquestState,
  getAvailableClassesForSide,
  buildSoloMatchResultText,
} = require('./solo-conquest-utils');

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
  resultReports: process.env.HS_RESULT_REPORTS_TABLE_ID || null,

  // 卡组与流程中心
  deckSubmissions: 'tblEEtx8k1AzYy4j',
  decks: 'tblraWTd0mgs5Bgu',
  announcements: 'tbloMMt0CwQsTDpM',
  bpRounds: 'tblgfufpxvYjKNte',
  bpActions: 'tbl9nSeXjV8mvHVr',
  matchGames: process.env.HS_MATCH_GAMES_TABLE_ID || null,
  matchClassStates: process.env.HS_MATCH_CLASS_STATES_TABLE_ID || null,
};

const BITABLE_UTILS = {
  CONFIG: { apps: CONFIG.bitable.apps },
  TABLES,
  queryRecord,
  getRecord,
  updateRecord,
  createRecord,
  batchCreateRecords,
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
    if (requiresAdminPermission(action)) {
      await checkPermission(context.operatorOpenId, params.tournament_uid, action);
    } else {
      await checkParticipantPermission(action, params, context);
    }

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
      case 'submit_player_registration_form':
        return await submitPlayerRegistrationForm(params, context);
      case 'submit_player_deck_form':
        return await submitPlayerDeckForm(params, context);
      case 'record_solo_game_result':
        return await recordSoloGameResult(params, context);
      case 'submit_match_result_report':
        return await submitMatchResultReport(params, context);
      case 'confirm_match_result_report':
        return await confirmMatchResultReport(params, context);
      case 'reject_match_result_report':
        return await rejectMatchResultReport(params, context);
      case 'admin_confirm_match_result_report':
        return await adminConfirmMatchResultReport(params, context);

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
      'record_solo_game_result', 'admin_confirm_match_result_report',
      'approve_ai_recommendation', 'custom_ruling',
      'list_pending_registrations', 'list_pending_decks', 'list_pending_disputes',
    ],
    admin: [
      'approve_registration', 'reject_registration', 'request_registration_info',
      'approve_deck_submission', 'reject_deck_submission',
      'record_solo_game_result', 'admin_confirm_match_result_report',
      'list_pending_registrations', 'list_pending_decks', 'list_pending_disputes',
    ],
    judge: [
      'record_solo_game_result',
      'approve_ai_recommendation', 'custom_ruling',
      'list_pending_disputes',
    ],
  };

  return actionMap[role] || [];
}

function requiresAdminPermission(action) {
  return ![
    'submit_player_deck_form',
    'submit_player_registration_form',
    'submit_match_result_report',
    'confirm_match_result_report',
    'reject_match_result_report',
  ].includes(action);
}

async function checkParticipantPermission(action, params, context = {}) {
  if (action === 'submit_player_registration_form') {
    const operatorOpenId = context.operatorOpenId || params.operator_open_id;
    if (!operatorOpenId) {
      throw new Error('缺少 operatorOpenId');
    }
    return true;
  }

  if (action === 'submit_player_deck_form') {
    const operatorOpenId = context.operatorOpenId || params.operator_open_id;
    if (!operatorOpenId) {
      throw new Error('缺少 operatorOpenId');
    }

    const playerUid = params.player_uid || params.entity_uid;
    const player = await getEntityRecord('player', playerUid);
    const playerOpenId = getFieldValue(player, ['feishu_open_id', 'user_open_id', 'open_id']);

    if (!playerOpenId || playerOpenId !== operatorOpenId) {
      throw new Error('当前用户无权提交该选手卡组');
    }
  }

  if (['submit_match_result_report', 'confirm_match_result_report', 'reject_match_result_report'].includes(action)) {
    const operatorOpenId = context.operatorOpenId || params.operator_open_id;
    const matchUid = params.match_uid || params.match_id;

    if (!operatorOpenId || !matchUid) {
      throw new Error('缺少 operatorOpenId / match_uid');
    }

    const match = await resolveRecordReference(
      CONFIG.bitable.apps.operation,
      TABLES.matches,
      matchUid,
      ['match_uid']
    );

    if (!match) {
      throw new Error('对局不存在');
    }

    const sideContext = await getSoloMatchSideContext(match);
    const allOpenIds = [sideContext.sideAOpenId, sideContext.sideBOpenId].filter(Boolean);
    if (!allOpenIds.includes(operatorOpenId)) {
      throw new Error('当前用户不是该对局参赛选手');
    }

    if (action === 'submit_match_result_report') {
      return true;
    }

    const reportUid = params.result_report_uid || params.report_uid;
    const report = await resolveResultReportReference(reportUid, matchUid);
    if (!report) {
      throw new Error('赛果上报记录不存在');
    }

    const reporterOpenId = getFieldValue(report, ['reporter_open_id']);
    const expectedConfirmerOpenId = reporterOpenId === sideContext.sideAOpenId ? sideContext.sideBOpenId : sideContext.sideAOpenId;

    if (action === 'confirm_match_result_report' || action === 'reject_match_result_report') {
      if (operatorOpenId !== expectedConfirmerOpenId) {
        throw new Error('仅对手方可确认或拒绝该赛果');
      }
    }
  }

  return true;
}

// ============================================
// 状态校验
// ============================================

async function checkState(action, params) {
  const { registration_id, submission_id, dispute_id, match_uid, match_id, result_report_uid, report_uid } = params;

  if (action.includes('registration') && action !== 'submit_player_registration_form') {
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

  if (action.includes('deck') && action !== 'submit_player_deck_form') {
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

  if (action === 'record_solo_game_result') {
    const match = await resolveRecordReference(
      CONFIG.bitable.apps.operation,
      TABLES.matches,
      match_uid || match_id,
      ['match_uid']
    );

    if (!match) {
      throw new Error('对局不存在');
    }

    const status = getFieldValue(match, ['match_status', 'status']) || 'ready';
    if (!['ready', 'in_game', 'result_pending_confirmation'].includes(status)) {
      throw new Error(`当前对局状态(${status})不允许录入个人赛小局结果`);
    }
  }

  if (['submit_match_result_report', 'confirm_match_result_report', 'reject_match_result_report', 'admin_confirm_match_result_report'].includes(action)) {
    const match = await resolveRecordReference(
      CONFIG.bitable.apps.operation,
      TABLES.matches,
      match_uid || match_id,
      ['match_uid']
    );

    if (!match) {
      throw new Error('对局不存在');
    }

    const report = ['confirm_match_result_report', 'reject_match_result_report', 'admin_confirm_match_result_report'].includes(action)
      ? await resolveResultReportReference(result_report_uid || report_uid, match_uid || match_id)
      : null;

    if ((action === 'confirm_match_result_report' || action === 'reject_match_result_report' || action === 'admin_confirm_match_result_report') && !report) {
      throw new Error('赛果上报记录不存在');
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

async function submitPlayerRegistrationForm(params, context = {}) {
  const timestamp = Date.now();
  const tournamentUid = params.tournament_uid;
  const operatorOpenId = context.operatorOpenId || params.operator_open_id;

  if (!tournamentUid || !operatorOpenId) {
    throw new Error('缺少 tournament_uid / operatorOpenId');
  }

  validatePlayerRegistrationPayload(params);

  const tournament = await resolveRecordReference(
    CONFIG.bitable.apps.operation,
    TABLES.tournaments,
    tournamentUid,
    ['tournament_uid']
  );

  validateRegistrationWindow(tournament, timestamp);

  const player = await resolveOrCreatePlayerByOpenId(operatorOpenId, params, timestamp);
  const playerUid = getFieldValue(player, ['player_uid']) || params.player_uid || buildPlayerUid(tournamentUid, operatorOpenId);

  if (!getFieldValue(player, ['player_uid'])) {
    await safeUpdateRecord(
      CONFIG.bitable.apps.basic,
      TABLES.players,
      player.record_id,
      { player_uid: playerUid }
    );
  }

  const existingRegistration = await queryRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'tournament_uid', operator: 'is', value: [tournamentUid] },
          { field_name: 'entity_type', operator: 'is', value: ['player'] },
          { field_name: 'entity_uid', operator: 'is', value: [playerUid] },
        ],
      },
      pageSize: 1,
    }
  );

  if (existingRegistration?.length) {
    throw new Error('你已经提交过本赛事报名');
  }

  const registrationUid = buildRegistrationUid(tournamentUid, playerUid);
  const createdRegistration = await createRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    {
      registration_uid: registrationUid,
      tournament_uid: tournamentUid,
      entity_type: 'player',
      entity_uid: playerUid,
      player_uid: playerUid,
      registration_status: 'submitted',
      review_status: 'pending_review',
      snapshot_slogan: params.snapshot_slogan || params.slogan || '',
      submitted_at: timestamp,
      source_type: params.source_type || 'manual_form',
    }
  );

  await notifyMany(
    [operatorOpenId],
    '✅ 已收到你的个人赛报名信息。\n当前状态：已提交，等待审核。\n下一步：审核通过后，你将收到卡组提交入口。\n如需补充资料，我会继续私聊你。'
  );

  return {
    success: true,
    message: '个人赛报名已提交',
    data: {
      player_uid: playerUid,
      registration_uid: registrationUid,
      registration_record_id: createdRegistration?.record?.record_id || createdRegistration?.record_id,
    },
  };
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

async function submitPlayerDeckForm(params, context = {}) {
  const timestamp = Date.now();
  const tournamentUid = params.tournament_uid;
  const registrationUid = params.registration_uid;
  const playerUid = params.player_uid || params.entity_uid;

  if (!tournamentUid || !registrationUid || !playerUid) {
    throw new Error('缺少 tournament_uid / registration_uid / player_uid');
  }

  const registration = await resolveRecordReference(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registrationUid,
    ['registration_uid']
  );

  if (!registration) {
    throw new Error('报名记录不存在');
  }

  if (registration.fields.registration_status !== 'approved') {
    throw new Error('当前报名状态未通过审核，无法提交卡组');
  }

  const registrationPlayerUid = getFieldValue(registration, ['player_uid', 'entity_uid']);
  if (registrationPlayerUid && registrationPlayerUid !== playerUid) {
    throw new Error('报名记录与当前选手不匹配');
  }

  const tournament = await resolveRecordReference(
    CONFIG.bitable.apps.operation,
    TABLES.tournaments,
    tournamentUid,
    ['tournament_uid']
  );

  validateDeckDeadline(tournament, timestamp);

  const normalizedDecks = normalizePlayerDeckPayload(params);
  validateSoloDecks(normalizedDecks);

  const previousSubmissions = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'registration_uid', operator: 'is', value: [registrationUid] },
        ],
      },
      sort: [{ field_name: 'submitted_at', desc: true }],
    }
  );

  const nextVersion = getNextSubmissionVersion(previousSubmissions);
  const submissionUid = buildSubmissionUid(tournamentUid, playerUid, nextVersion);
  const player = await getEntityRecord('player', playerUid);

  const createdSubmission = await createRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    {
      deck_submission_uid: submissionUid,
      registration_uid: registrationUid,
      tournament_uid: tournamentUid,
      entity_type: 'player',
      entity_uid: playerUid,
      player_uid: playerUid,
      submission_version: nextVersion,
      submission_reason: params.submission_reason || (previousSubmissions.length ? 'resubmission' : 'initial_submission'),
      submission_status: 'submitted',
      secrecy_status: 'sealed',
      public_publish_status: 'not_published',
      submitted_at: timestamp,
      submitted_by: context.operatorOpenId || getFieldValue(player, ['feishu_open_id', 'user_open_id', 'open_id']),
      is_current_effective_version: false,
      submitted_deck_count: normalizedDecks.length,
    }
  );

  await batchCreateRecords(
    CONFIG.bitable.apps.deck,
    TABLES.decks,
    normalizedDecks.map((deck, index) => ({
      fields: {
        deck_submission_uid: submissionUid,
        tournament_uid: tournamentUid,
        entity_type: 'player',
        entity_uid: playerUid,
        player_uid: playerUid,
        class_name: deck.class_name,
        deck_name: deck.deck_name,
        deck_code: deck.deck_code,
        deck_image: deck.deck_image,
        deck_order: index + 1,
        opponent_visibility: 'hidden',
        public_visibility: 'hidden',
        created_at: timestamp,
      },
    }))
  );

  const notifyOpenIds = await getEntityNotifyOpenIds('player', playerUid);
  await notifyMany(
    notifyOpenIds,
    '✅ 已收到你的4套卡组。\n当前状态：已提交，正在检查与审核。\n下一步：审核通过后进入保密存档；如有问题会私聊通知你修改。'
  );

  return {
    success: true,
    message: '个人赛卡组已提交',
    data: {
      submission_record_id: createdSubmission?.record?.record_id || createdSubmission?.record_id,
      submission_uid: submissionUid,
      submission_version: nextVersion,
      deck_count: normalizedDecks.length,
    },
  };
}

async function recordSoloGameResult(params, context = {}) {
  const timestamp = Date.now();
  const matchUid = params.match_uid || params.match_id;

  if (!matchUid) {
    throw new Error('缺少 match_uid');
  }

  const match = await resolveRecordReference(
    CONFIG.bitable.apps.operation,
    TABLES.matches,
    matchUid,
    ['match_uid']
  );

  const conquestState = await getOrBuildSoloConquestState(match);
  const nextState = applySoloGameResult(conquestState, {
    gameNo: params.game_no || params.gameNo,
    sideAClass: params.side_a_class || params.sideAClass,
    sideBClass: params.side_b_class || params.sideBClass,
    winnerSide: params.winner_side || params.winnerSide,
    endedAt: params.ended_at || params.endedAt || timestamp,
    note: params.note || params.internal_note || '',
  });

  const sideAName = getFieldValue(match, ['side_a_entity_name', 'side_a_name', 'player_a_name', 'side_a_display_name']) || 'A方';
  const sideBName = getFieldValue(match, ['side_b_entity_name', 'side_b_name', 'player_b_name', 'side_b_display_name']) || 'B方';
  const resultText = buildSoloMatchResultText(nextState, sideAName, sideBName);

  await safeUpdateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.matches,
    match.record_id,
    {
      match_status: nextState.matchStatus,
      current_game_no: nextState.currentGameNo,
      current_score: nextState.finalScore,
      final_result_text: nextState.matchStatus === 'completed' ? resultText : '',
      winner_side: nextState.winnerSide || '',
      conquest_state_json: JSON.stringify(nextState),
      last_game_result_json: JSON.stringify(nextState.games[nextState.games.length - 1] || {}),
      updated_at: timestamp,
      completed_at: nextState.matchStatus === 'completed' ? timestamp : null,
    }
  );

  await writeSoloGameProjection(match, nextState, timestamp);

  if (nextState.matchStatus === 'completed') {
    await sendGroupMessageByTournament(
      getFieldValue(match, ['tournament_uid']) || params.tournament_uid,
      `✅ 个人赛结果已确认\n${resultText}`,
      BITABLE_UTILS
    ).catch(() => null);
  }

  return {
    success: true,
    message: nextState.matchStatus === 'completed' ? '个人赛已完成并写回结果' : '个人赛小局结果已记录',
    data: {
      match_uid: getFieldValue(match, ['match_uid']) || matchUid,
      match_status: nextState.matchStatus,
      current_score: nextState.finalScore,
      current_game_no: nextState.currentGameNo,
      winner_side: nextState.winnerSide,
      final_result_text: nextState.matchStatus === 'completed' ? resultText : '',
      next_side_a_available: nextState.matchStatus === 'completed' ? [] : getAvailableClassesForSide(nextState, 'side_a'),
      next_side_b_available: nextState.matchStatus === 'completed' ? [] : getAvailableClassesForSide(nextState, 'side_b'),
      last_game: nextState.games[nextState.games.length - 1] || null,
      operator_open_id: context.operatorOpenId || params.operator_open_id || null,
    },
  };
}

// ============================================
// 争议处理
// ============================================

async function submitMatchResultReport(params, context = {}) {
  const timestamp = Date.now();
  const matchUid = params.match_uid || params.match_id;
  const operatorOpenId = context.operatorOpenId || params.operator_open_id;

  const match = await resolveRecordReference(
    CONFIG.bitable.apps.operation,
    TABLES.matches,
    matchUid,
    ['match_uid']
  );

  const sideContext = await getSoloMatchSideContext(match);
  const reporterSide = operatorOpenId === sideContext.sideAOpenId ? 'side_a' : 'side_b';
  const opponentOpenId = reporterSide === 'side_a' ? sideContext.sideBOpenId : sideContext.sideAOpenId;
  const reportUid = params.result_report_uid || `RPT-${matchUid}-${timestamp}`;
  const finalResultText = params.final_result_text || getFieldValue(match, ['final_result_text']) || buildSoloMatchResultText(await getOrBuildSoloConquestState(match), sideContext.sideAName, sideContext.sideBName);

  await safeUpsertByUid(
    CONFIG.bitable.apps.operation,
    TABLES.resultReports,
    'result_report_uid',
    reportUid,
    {
      result_report_uid: reportUid,
      tournament_uid: getFieldValue(match, ['tournament_uid']) || '',
      match_uid: matchUid,
      reporter_open_id: operatorOpenId,
      reporter_side: reporterSide,
      report_status: 'awaiting_opponent_confirmation',
      opponent_confirmation_status: 'pending',
      final_result_text: finalResultText,
      final_applied_to_match: false,
      submitted_at: timestamp,
      internal_note: params.note || params.internal_note || '',
    }
  );

  await safeUpdateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.matches,
    match.record_id,
    {
      result_status: 'pending_opponent_confirmation',
      match_status: 'result_pending_confirmation',
      latest_result_report_uid: reportUid,
      updated_at: timestamp,
    }
  );

  if (opponentOpenId) {
    await sendNotification(
      opponentOpenId,
      `对手刚刚提交了本场赛果：\n${finalResultText}\n\n请确认：\n- confirm_match_result_report\n- reject_match_result_report`
    ).catch(() => null);
  }

  return {
    success: true,
    message: '赛果已提交，等待对手确认',
    data: {
      result_report_uid: reportUid,
      match_uid: matchUid,
      final_result_text: finalResultText,
      reporter_side: reporterSide,
      opponent_open_id: opponentOpenId || null,
    },
  };
}

async function confirmMatchResultReport(params, context = {}) {
  const timestamp = Date.now();
  const matchUid = params.match_uid || params.match_id;
  const reportUid = params.result_report_uid || params.report_uid;
  const report = await resolveResultReportReference(reportUid, matchUid);
  const match = await resolveRecordReference(CONFIG.bitable.apps.operation, TABLES.matches, matchUid, ['match_uid']);
  const sideContext = await getSoloMatchSideContext(match);
  const resultText = getFieldValue(report, ['final_result_text']) || getFieldValue(match, ['final_result_text']) || '';
  const reporterSide = getFieldValue(report, ['reporter_side']);
  const winnerSide = inferWinnerSideFromResultText(resultText, sideContext);

  await safeUpdateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.resultReports,
    report.record_id,
    {
      report_status: 'opponent_confirmed',
      opponent_confirmation_status: 'confirmed',
      confirmer_open_id: context.operatorOpenId || params.operator_open_id || '',
      confirmed_at: timestamp,
      final_applied_to_match: true,
      applied_at: timestamp,
    }
  );

  await safeUpdateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.matches,
    match.record_id,
    {
      result_status: 'confirmed',
      match_status: 'completed',
      winner_side: winnerSide || getFieldValue(match, ['winner_side']) || '',
      final_result_text: resultText,
      completed_at: timestamp,
      updated_at: timestamp,
    }
  );

  await sendGroupMessageByTournament(
    getFieldValue(match, ['tournament_uid']) || params.tournament_uid,
    `✅ 赛果已确认\n${resultText}`,
    BITABLE_UTILS
  ).catch(() => null);

  return {
    success: true,
    message: '已确认赛果并写回',
    data: {
      result_report_uid: getFieldValue(report, ['result_report_uid']) || reportUid,
      match_uid: matchUid,
      winner_side: winnerSide || null,
      final_result_text: resultText,
      reporter_side: reporterSide || null,
    },
  };
}

async function rejectMatchResultReport(params, context = {}) {
  const timestamp = Date.now();
  const matchUid = params.match_uid || params.match_id;
  const reportUid = params.result_report_uid || params.report_uid;
  const report = await resolveResultReportReference(reportUid, matchUid);
  const match = await resolveRecordReference(CONFIG.bitable.apps.operation, TABLES.matches, matchUid, ['match_uid']);

  await safeUpdateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.resultReports,
    report.record_id,
    {
      report_status: 'opponent_rejected',
      opponent_confirmation_status: 'rejected',
      confirmer_open_id: context.operatorOpenId || params.operator_open_id || '',
      confirmed_at: timestamp,
      rejection_reason: params.reject_reason || params.reason || '',
    }
  );

  await safeUpdateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.matches,
    match.record_id,
    {
      result_status: 'disputed',
      match_status: 'disputed',
      updated_at: timestamp,
    }
  );

  return {
    success: true,
    message: '已拒绝该赛果，比赛进入 disputed',
    data: {
      result_report_uid: getFieldValue(report, ['result_report_uid']) || reportUid,
      match_uid: matchUid,
      rejection_reason: params.reject_reason || params.reason || '',
    },
  };
}

async function adminConfirmMatchResultReport(params) {
  const timestamp = Date.now();
  const matchUid = params.match_uid || params.match_id;
  const reportUid = params.result_report_uid || params.report_uid;
  const report = await resolveResultReportReference(reportUid, matchUid);
  const match = await resolveRecordReference(CONFIG.bitable.apps.operation, TABLES.matches, matchUid, ['match_uid']);
  const sideContext = await getSoloMatchSideContext(match);
  const resultText = getFieldValue(report, ['final_result_text']) || getFieldValue(match, ['final_result_text']) || '';
  const winnerSide = inferWinnerSideFromResultText(resultText, sideContext);

  await safeUpdateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.resultReports,
    report.record_id,
    {
      report_status: 'admin_confirmed',
      opponent_confirmation_status: 'skipped',
      final_applied_to_match: true,
      applied_at: timestamp,
      reviewed_by: params.admin_open_id || '',
      reviewed_at: timestamp,
    }
  );

  await safeUpdateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.matches,
    match.record_id,
    {
      result_status: 'confirmed',
      match_status: 'completed',
      winner_side: winnerSide || getFieldValue(match, ['winner_side']) || '',
      final_result_text: resultText,
      completed_at: timestamp,
      updated_at: timestamp,
    }
  );

  return {
    success: true,
    message: '管理员已确认赛果',
    data: {
      result_report_uid: getFieldValue(report, ['result_report_uid']) || reportUid,
      match_uid: matchUid,
      winner_side: winnerSide || null,
      final_result_text: resultText,
    },
  };
}

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

async function resolveResultReportReference(reportUid, matchUid) {
  if (!TABLES.resultReports) {
    return null;
  }

  if (reportUid) {
    const byUid = await resolveRecordReference(
      CONFIG.bitable.apps.operation,
      TABLES.resultReports,
      reportUid,
      ['result_report_uid']
    );
    if (byUid) {
      return byUid;
    }
  }

  if (matchUid) {
    const latest = await queryRecord(
      CONFIG.bitable.apps.operation,
      TABLES.resultReports,
      {
        filter: {
          conjunction: 'and',
          conditions: [
            { field_name: 'match_uid', operator: 'is', value: [matchUid] },
          ],
        },
        sort: [{ field_name: 'submitted_at', desc: true }],
        pageSize: 1,
      }
    ).catch(() => []);

    if (latest?.length) {
      return latest[0];
    }
  }

  return null;
}

async function getSoloMatchSideContext(match) {
  const sideAUid = getFieldValue(match, ['side_a_entity_uid', 'side_a_uid', 'player_a_uid', 'side_a_player_uid']);
  const sideBUid = getFieldValue(match, ['side_b_entity_uid', 'side_b_uid', 'player_b_uid', 'side_b_player_uid']);
  const sideAPlayer = sideAUid ? await getEntityRecord('player', sideAUid) : null;
  const sideBPlayer = sideBUid ? await getEntityRecord('player', sideBUid) : null;

  return {
    sideAUid,
    sideBUid,
    sideAOpenId: getFieldValue(sideAPlayer, ['feishu_open_id', 'user_open_id', 'open_id']) || null,
    sideBOpenId: getFieldValue(sideBPlayer, ['feishu_open_id', 'user_open_id', 'open_id']) || null,
    sideAName: getFieldValue(match, ['side_a_entity_name', 'side_a_name', 'player_a_name', 'side_a_display_name']) || getFieldValue(sideAPlayer, ['nickname', 'real_name']) || 'A方',
    sideBName: getFieldValue(match, ['side_b_entity_name', 'side_b_name', 'player_b_name', 'side_b_display_name']) || getFieldValue(sideBPlayer, ['nickname', 'real_name']) || 'B方',
  };
}

function inferWinnerSideFromResultText(resultText, sideContext) {
  if (!resultText) {
    return null;
  }

  if (sideContext.sideAName && resultText.includes(sideContext.sideAName)) {
    return 'side_a';
  }
  if (sideContext.sideBName && resultText.includes(sideContext.sideBName)) {
    return 'side_b';
  }

  return null;
}

async function getOrBuildSoloConquestState(match) {
  const stored = getFieldValue(match, ['conquest_state_json', 'solo_conquest_state_json', 'state_json']);
  if (stored) {
    try {
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
      return normalizeSoloConquestState(parsed);
    } catch (error) {
      console.warn('[getOrBuildSoloConquestState] parse failed, fallback rebuild:', error.message);
    }
  }

  const sideASubmissionUid = getFieldValue(match, ['side_a_submission_uid', 'side_a_deck_submission_uid']);
  const sideBSubmissionUid = getFieldValue(match, ['side_b_submission_uid', 'side_b_deck_submission_uid']);

  if (!sideASubmissionUid || !sideBSubmissionUid) {
    throw new Error('缺少双方卡组提交 UID，无法初始化征服状态');
  }

  const [sideAClasses, sideBClasses, sideABannedClasses, sideBBannedClasses] = await Promise.all([
    getSubmissionDeckClasses(sideASubmissionUid),
    getSubmissionDeckClasses(sideBSubmissionUid),
    getBannedClassesByMatch(getFieldValue(match, ['match_uid']), 'side_a'),
    getBannedClassesByMatch(getFieldValue(match, ['match_uid']), 'side_b'),
  ]);

  return buildInitialSoloConquestState({
    sideAClasses,
    sideBClasses,
    sideABannedClasses,
    sideBBannedClasses,
    targetWins: 3,
    currentGameNo: 1,
  });
}

async function getSubmissionDeckClasses(submissionUid) {
  const decks = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.decks,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'deck_submission_uid', operator: 'is', value: [submissionUid] },
        ],
      },
      sort: [{ field_name: 'deck_order', desc: false }],
    }
  );

  return uniq((decks || []).map(deck => getFieldValue(deck, ['class_name', 'hero_class'])));
}

async function getBannedClassesByMatch(matchUid, sideLabel) {
  if (!matchUid) {
    return [];
  }

  const actions = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.bpActions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'bp_round_uid', operator: 'contains', value: [matchUid] },
          { field_name: 'side_label', operator: 'is', value: [sideLabel] },
        ],
      },
    }
  ).catch(() => []);

  return uniq((actions || []).map(action => getFieldValue(action, ['banned_deck_class', 'class_name'])));
}

async function writeSoloGameProjection(match, nextState, timestamp) {
  const matchUid = getFieldValue(match, ['match_uid']);
  if (!matchUid) {
    return;
  }

  const lastGame = nextState.games[nextState.games.length - 1];
  if (!lastGame) {
    return;
  }

  const winnerSide = lastGame.winnerSide;
  const loserSide = winnerSide === 'side_a' ? 'side_b' : 'side_a';
  const sideALockedClass = loserSide === 'side_a' ? lastGame.sideAClass : '';
  const sideBLockedClass = loserSide === 'side_b' ? lastGame.sideBClass : '';

  const projectionPayload = {
    match_game_uid: `MG-${matchUid}-${String(lastGame.gameNo).padStart(2, '0')}`,
    match_uid: matchUid,
    tournament_uid: getFieldValue(match, ['tournament_uid']) || '',
    game_number: lastGame.gameNo,
    side_a_class: lastGame.sideAClass,
    side_b_class: lastGame.sideBClass,
    winner_side: winnerSide,
    loser_side: loserSide,
    winner_class: lastGame.winnerClass,
    loser_class: lastGame.loserClass,
    result_status: 'done',
    ended_at: lastGame.endedAt,
    internal_note: lastGame.note || '',
  };

  await safeUpsertByUid(
    CONFIG.bitable.apps.operation,
    TABLES.matchGames,
    'match_game_uid',
    projectionPayload.match_game_uid,
    projectionPayload
  );

  await safeUpsertByUid(
    CONFIG.bitable.apps.operation,
    TABLES.matchClassStates,
    'match_class_state_uid',
    `MCS-${matchUid}-${String(lastGame.gameNo).padStart(2, '0')}`,
    {
      match_class_state_uid: `MCS-${matchUid}-${String(lastGame.gameNo).padStart(2, '0')}`,
      match_uid: matchUid,
      tournament_uid: getFieldValue(match, ['tournament_uid']) || '',
      game_number: lastGame.gameNo,
      side_a_locked_class: sideALockedClass,
      side_b_locked_class: sideBLockedClass,
      side_a_available_classes: JSON.stringify(nextState.sideA.availableClasses),
      side_b_available_classes: JSON.stringify(nextState.sideB.availableClasses),
      side_a_conquered_classes: JSON.stringify(nextState.sideA.conqueredClasses),
      side_b_conquered_classes: JSON.stringify(nextState.sideB.conqueredClasses),
      side_a_wins: nextState.sideA.wins,
      side_b_wins: nextState.sideB.wins,
      winner_side: winnerSide,
      locked_at: timestamp,
    }
  );
}

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
    if (!appToken || !tableId || !recordId) {
      return null;
    }
    return await updateRecord(appToken, tableId, recordId, fields);
  } catch (error) {
    console.warn('[safeUpdateRecord] skipped:', error.message);
    return null;
  }
}

async function safeCreateRecord(appToken, tableId, fields) {
  try {
    if (!appToken || !tableId) {
      return null;
    }
    return await createRecord(appToken, tableId, fields);
  } catch (error) {
    console.warn('[safeCreateRecord] skipped:', error.message);
    return null;
  }
}

async function safeUpsertByUid(appToken, tableId, uidField, uidValue, fields) {
  try {
    if (!appToken || !tableId || !uidField || !uidValue) {
      return null;
    }

    const existing = await queryRecord(appToken, tableId, {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: uidField, operator: 'is', value: [uidValue] },
        ],
      },
      pageSize: 1,
    });

    if (existing?.length) {
      return await updateRecord(appToken, tableId, existing[0].record_id, fields);
    }

    return await createRecord(appToken, tableId, fields);
  } catch (error) {
    console.warn('[safeUpsertByUid] skipped:', error.message);
    return null;
  }
}

function uniq(values = []) {
  return [...new Set((values || []).filter(Boolean).map(v => String(v).trim()))];
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

function normalizePlayerDeckPayload(params = {}) {
  if (Array.isArray(params.decks) && params.decks.length) {
    return params.decks.map((deck, index) => ({
      class_name: deck.class_name || deck.class || deck.hero_class,
      deck_name: deck.deck_name || deck.name || '',
      deck_code: (deck.deck_code || deck.code || '').trim(),
      deck_image: deck.deck_image || deck.image || null,
      deck_order: deck.deck_order || index + 1,
    }));
  }

  const normalized = [];
  for (let i = 1; i <= 4; i++) {
    const className = params[`deck_${i}_class_name`] || params[`deck_${i}_class`] || params[`class_${i}`];
    const deckCode = params[`deck_${i}_deck_code`] || params[`deck_${i}_code`] || params[`code_${i}`];
    const deckName = params[`deck_${i}_deck_name`] || params[`name_${i}`] || '';
    const deckImage = params[`deck_${i}_deck_image`] || params[`image_${i}`] || null;

    if (className || deckCode || deckName || deckImage) {
      normalized.push({
        class_name: className,
        deck_name: deckName,
        deck_code: (deckCode || '').trim(),
        deck_image: deckImage,
        deck_order: i,
      });
    }
  }

  return normalized;
}

function validatePlayerRegistrationPayload(params = {}) {
  if (!String(params.real_name || '').trim()) {
    throw new Error('请填写真实姓名');
  }
  if (!String(params.player_id || '').trim()) {
    throw new Error('请填写选手ID');
  }
  if (!String(params.nickname || '').trim()) {
    throw new Error('请填写昵称/展示名');
  }
  if (!String(params.bnet_id || params.battle_net_id || '').trim()) {
    throw new Error('请填写战网ID');
  }
}

function validateRegistrationWindow(tournament, nowTs) {
  const deadline = getFieldValue(tournament, ['registration_deadline', 'signup_deadline', 'apply_deadline']);
  if (typeof deadline === 'number' && deadline > 0 && nowTs > deadline) {
    throw new Error('当前赛事暂不可报名');
  }
}

async function resolveOrCreatePlayerByOpenId(openId, params, timestamp) {
  const existing = await queryRecord(
    CONFIG.bitable.apps.basic,
    TABLES.players,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'feishu_open_id', operator: 'is', value: [openId] },
        ],
      },
      pageSize: 1,
    }
  );

  const playerFields = {
    real_name: String(params.real_name || '').trim(),
    player_id: String(params.player_id || '').trim(),
    nickname: String(params.nickname || '').trim(),
    bnet_id: String(params.bnet_id || params.battle_net_id || '').trim(),
    feishu_open_id: openId,
    honors: params.honors || '',
    portrait_image: params.portrait_image || null,
    updated_at: timestamp,
  };

  if (existing?.length) {
    await updateRecord(
      CONFIG.bitable.apps.basic,
      TABLES.players,
      existing[0].record_id,
      playerFields
    );
    return await getRecord(CONFIG.bitable.apps.basic, TABLES.players, existing[0].record_id);
  }

  const playerUid = params.player_uid || buildPlayerUid(params.tournament_uid, openId);
  const created = await createRecord(
    CONFIG.bitable.apps.basic,
    TABLES.players,
    {
      player_uid: playerUid,
      ...playerFields,
      verified_status: 'pending',
      created_at: timestamp,
    }
  );

  return created?.record || created;
}

function buildPlayerUid(tournamentUid, openId) {
  const suffix = String(openId || '').replace(/[^A-Za-z0-9]/g, '').slice(-8) || 'PLAYER';
  return `P-${String(tournamentUid || 'HS').replace(/[^A-Za-z0-9]/g, '').slice(0, 20)}-${suffix}`;
}

function buildRegistrationUid(tournamentUid, playerUid) {
  return `REG-${String(tournamentUid || 'HS').replace(/[^A-Za-z0-9]/g, '')}-${String(playerUid || 'PLAYER').replace(/[^A-Za-z0-9]/g, '')}`;
}

function validateSoloDecks(decks = []) {
  if (decks.length !== 4) {
    throw new Error('请提交4套卡组');
  }

  const classes = [];
  for (const [index, deck] of decks.entries()) {
    if (!deck.class_name) {
      throw new Error(`第${index + 1}套卡组缺少职业`);
    }
    if (!deck.deck_code) {
      throw new Error(`第${index + 1}套卡组缺少卡组代码`);
    }
    classes.push(deck.class_name.trim());
  }

  if (new Set(classes).size !== 4) {
    throw new Error('4套卡组职业不能重复');
  }
}

function validateDeckDeadline(tournament, nowTs) {
  const deadline = getFieldValue(tournament, ['deck_deadline', 'deck_submit_deadline', 'submission_deadline']);
  if (typeof deadline === 'number' && deadline > 0 && nowTs > deadline) {
    throw new Error('卡组提交已截止');
  }
}

function getNextSubmissionVersion(previousSubmissions = []) {
  let maxVersion = 0;

  for (const submission of previousSubmissions) {
    const rawVersion = getFieldValue(submission, ['submission_version']);
    if (typeof rawVersion === 'number') {
      maxVersion = Math.max(maxVersion, rawVersion);
      continue;
    }

    const matched = String(rawVersion || '').match(/(\d+)/);
    if (matched) {
      maxVersion = Math.max(maxVersion, Number(matched[1]));
    }
  }

  return `V${maxVersion + 1}`;
}

function buildSubmissionUid(tournamentUid, playerUid, version) {
  const versionSuffix = String(version || 'V1').replace(/[^A-Za-z0-9]/g, '');
  return `DECKSUB-${tournamentUid}-${playerUid}-${versionSuffix}`;
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
  submitPlayerRegistrationForm,
  submitPlayerDeckForm,
  recordSoloGameResult,
  submitMatchResultReport,
  confirmMatchResultReport,
  rejectMatchResultReport,
  adminConfirmMatchResultReport,
  approveAIRecommendation,
  customRuling,
  listPendingRegistrations,
  listPendingDecks,
  listPendingDisputes,
  updateDecksVisibility,
  buildInitialSoloConquestState,
  normalizeSoloConquestState,
  validateSoloGameResultInput,
  applySoloGameResult,
  deriveSoloConquestState,
  getAvailableClassesForSide,
  buildSoloMatchResultText,
};
