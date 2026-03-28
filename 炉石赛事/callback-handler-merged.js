/**
 * 炉石赛事自动化系统 - 回调处理主程序（已合并工具函数）
 * 版本: v1.0 | 日期: 2026-03-28
 * 
 * 使用方式:
 * 1. 确保 bitable-api-utils.js 和 notification-utils.js 在同一目录
 * 2. 运行: node callback-handler-merged.js
 * 
 * 本文件已完整集成:
 * - bitable-api-utils.js 中的所有函数
 * - notification-utils.js 中的所有函数
 * - 所有回调处理逻辑
 */

// ============================================
// 1. 导入工具函数
// ============================================

const bitableUtils = require('./bitable-api-utils');
const notificationUtils = require('./notification-utils');

const {
  queryRecord,
  getRecord,
  updateRecord,
  batchUpdateRecords,
  createRecord,
  batchCreateRecords,
} = bitableUtils;

const {
  sendNotification,
  batchSendNotification,
  sendGroupMessage,
  sendGroupMessageByTournament,
  sendCardMessage,
  sendGroupCardMessage,
  pushDeckSubmissionEntry,
  generatePublishConfirmation,
  createAnnouncement,
  notifyDisputeParties,
  notifyAdmin,
} = notificationUtils;

// ============================================
// 2. 配置与常量
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
    }
  },
  
  admin: {
    openId: 'ou_914e6141a81eb6da2602875aee631269',
  }
};

const TABLES = {
  players: 'tblaQYWnDvPb7aGA',
  teams: 'tblEgSf4nhxwfTwo',
  teamMembers: 'tblHfGsGy1hLETqO',
  tournaments: 'tbl0a6HI2ugcbkqW',
  tournamentAdmins: 'tblBB5Xqw4RPQ177',
  registrations: 'tbldzij0kXhmy2N0',
  registrationMembers: 'tblVABsgGsLTJ3yD',
  matches: 'tblgnkqFLhTUkY4c',
  disputes: 'tblf8gkNy4SKgLJf',
  deckSubmissions: 'tblEEtx8k1AzYy4j',
  decks: 'tblraWTd0mgs5Bgu',
  announcements: 'tbloMMt0CwQsTDpM',
};

// ============================================
// 3. 主入口
// ============================================

async function handleCallback(callback, context) {
  const { action, ...params } = callback;
  console.log(`[Callback] Action: ${action}`, params);
  
  try {
    await checkPermission(context.operatorOpenId, params.tournament_uid, action);
    await checkState(action, params);
    
    const handlers = {
      'approve_registration': approveRegistration,
      'reject_registration': rejectRegistration,
      'request_registration_info': requestRegistrationInfo,
      'approve_deck_submission': approveDeckSubmission,
      'reject_deck_submission': rejectDeckSubmission,
      'publish_decks': publishDecks,
      'approve_ai_recommendation': approveAIRecommendation,
      'custom_ruling': customRuling,
      'list_pending_registrations': listPendingRegistrations,
      'list_pending_decks': listPendingDecks,
      'list_pending_disputes': listPendingDisputes,
    };
    
    const handler = handlers[action];
    if (!handler) throw new Error(`Unknown action: ${action}`);
    
    return await handler(params);
  } catch (error) {
    console.error(`[Callback Error] ${action}:`, error);
    await notifyAdmin(`处理失败: ${action}\n错误: ${error.message}`);
    throw error;
  }
}

// ============================================
// 4. 权限与状态校验
// ============================================

async function checkPermission(operatorOpenId, tournamentUid, action) {
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
        ]
      }
    }
  );
  
  if (!admins || admins.length === 0) {
    throw new Error('无权限操作该赛事');
  }
  
  const role = admins[0].fields.role;
  const allowedActions = {
    'owner': ['approve_registration', 'reject_registration', 'request_registration_info',
              'approve_deck_submission', 'reject_deck_submission', 'publish_decks',
              'approve_ai_recommendation', 'custom_ruling',
              'list_pending_registrations', 'list_pending_decks', 'list_pending_disputes'],
    'admin': ['approve_registration', 'reject_registration', 'request_registration_info',
              'approve_deck_submission', 'reject_deck_submission',
              'list_pending_registrations', 'list_pending_decks', 'list_pending_disputes'],
    'judge': ['approve_ai_recommendation', 'custom_ruling', 'list_pending_disputes'],
  }[role] || [];
  
  if (!allowedActions.includes(action)) {
    throw new Error(`当前角色(${role})无权执行此操作`);
  }
}

async function checkState(action, params) {
  const { registration_id, submission_id } = params;
  
  if (action.includes('registration') && registration_id) {
    const registration = await getRecord(
      CONFIG.bitable.apps.operation,
      TABLES.registrations,
      registration_id
    );
    
    if (!registration) throw new Error('报名记录不存在');
    
    const status = registration.fields.registration_status;
    if (action === 'approve_registration' && status !== 'submitted') {
      throw new Error(`当前状态(${status})不允许审核通过`);
    }
  }
  
  if (action.includes('deck') && submission_id) {
    const submission = await getRecord(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      submission_id
    );
    
    if (!submission) throw new Error('卡组提交记录不存在');
    
    const status = submission.fields.submission_status;
    if (action === 'approve_deck_submission' && status !== 'submitted') {
      throw new Error(`当前状态(${status})不允许审核通过`);
    }
  }
}

// ============================================
// 5. 报名审核处理
// ============================================

async function approveRegistration(params) {
  const { registration_id, entity_type, entity_uid, admin_open_id, tournament_uid } = params;
  const timestamp = Date.now();
  
  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registration_id,
    {
      registration_status: 'approved',
      review_status: 'approved',
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );
  
  if (entity_type === 'team') {
    await updateRecord(
      CONFIG.bitable.apps.basic,
      TABLES.teams,
      entity_uid,
      { team_status: 'active' }
    );
    
    const team = await getRecord(CONFIG.bitable.apps.basic, TABLES.teams, entity_uid);
    const captain = await getRecord(CONFIG.bitable.apps.basic, TABLES.players, team.fields.captain_player_uid);
    
    await sendNotification(captain.fields.feishu_open_id, '✅ 您的战队报名已通过审核！');
    await pushDeckSubmissionEntry(entity_uid, tournament_uid, bitableUtils);
  } else {
    await updateRecord(
      CONFIG.bitable.apps.basic,
      TABLES.players,
      entity_uid,
      { profile_status: 'active', verified_status: 'verified' }
    );
    
    const player = await getRecord(CONFIG.bitable.apps.basic, TABLES.players, entity_uid);
    await sendNotification(player.fields.feishu_open_id, '✅ 您的报名已通过审核！');
  }
  
  return { success: true, message: '报名审核通过' };
}

async function rejectRegistration(params) {
  const { registration_id, reject_reason, admin_open_id, entity_uid } = params;
  const timestamp = Date.now();
  
  await updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registration_id,
    {
      registration_status: 'rejected',
      review_status: 'rejected',
      review_note: reject_reason,
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );
  
  const entity = await getRecord(
    CONFIG.bitable.apps.basic,
    params.entity_type === 'team' ? TABLES.teams