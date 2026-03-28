/**
 * 炉石赛事自动化系统 - 回调处理代码骨架
 * 版本: v1.0 | 日期: 2026-03-28
 * 
 * 本文件提供回调处理的代码框架，包含：
 * - 路由分发
 * - 权限校验
 * - 状态机校验
 * - 数据库写回
 * - 通知发送
 */

// ============================================
// 1. 配置与常量
// ============================================

const CONFIG = {
  // 飞书配置
  feishu: {
    appId: process.env.FEISHU_APP_ID,
    appSecret: process.env.FEISHU_APP_SECRET,
  },
  
  // 多维表格配置
  bitable: {
    baseUrl: 'https://open.feishu.cn/open-apis/bitable/v1',
    apps: {
      basic: 'KSyvbZIb1af98gsLJ7wcKmtEn9Q',      // 基础资料中心
      operation: 'KL3TbTEJIa5oytspkGGcf50rnpc',   // 运营中心
      deck: 'SXg4bBhrhajJgdsRNCzcycOrnbe',        // 卡组与流程中心
    }
  },
  
  // 管理员配置
  admin: {
    openId: 'ou_914e6141a81eb6da2602875aee631269',
  }
};

// 表ID映射
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

// ============================================
// 2. 主入口 - 回调路由分发
// ============================================

/**
 * 处理飞书卡片回调
 * @param {Object} callback - 飞书推送的回调数据
 * @param {Object} context - 上下文信息
 */
async function handleCallback(callback, context) {
  const { action, ...params } = callback;
  
  console.log(`[Callback] Action: ${action}`, params);
  
  try {
    // 2.1 权限校验
    await checkPermission(context.operatorOpenId, params.tournament_uid, action);
    
    // 2.2 状态校验
    await checkState(action, params);
    
    // 2.3 路由分发
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
    await notifyAdmin(`处理失败: ${action}\n错误: ${error.message}`);
    throw error;
  }
}

// ============================================
// 3. 权限校验
// ============================================

/**
 * 校验操作权限
 * @param {string} operatorOpenId - 操作人open_id
 * @param {string} tournamentUid - 赛事UID
 * @param {string} action - 操作类型
 */
async function checkPermission(operatorOpenId, tournamentUid, action) {
  // 3.1 查询赛事管理员
  const admin = await queryRecord(
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
  
  if (!admin || admin.length === 0) {
    throw new Error('无权限操作该赛事');
  }
  
  // 3.2 检查action是否在允许列表
  const role = admin[0].fields.role;
  const allowedActions = getAllowedActions(role);
  
  if (!allowedActions.includes(action)) {
    throw new Error(`当前角色(${role})无权执行此操作`);
  }
  
  return true;
}

/**
 * 获取角色允许的操作列表
 * @param {string} role - 角色
 */
function getAllowedActions(role) {
  const actionMap = {
    'owner': ['approve_registration', 'reject_registration', 'request_registration_info',
              'approve_deck_submission', 'reject_deck_submission', 'publish_decks',
              'approve_ai_recommendation', 'custom_ruling',
              'list_pending_registrations', 'list_pending_decks', 'list_pending_disputes'],
    'admin': ['approve_registration', 'reject_registration', 'request_registration_info',
              'approve_deck_submission', 'reject_deck_submission',
              'list_pending_registrations', 'list_pending_decks', 'list_pending_disputes'],
    'judge': ['approve_ai_recommendation', 'custom_ruling',
              'list_pending_disputes'],
  };
  return actionMap[role] || [];
}

// ============================================
// 4. 状态校验
// ============================================

/**
 * 校验操作状态
 * @param {string} action - 操作类型
 * @param {Object} params - 参数
 */
async function checkState(action, params) {
  const { registration_id, submission_id, dispute_id } = params;
  
  // 根据action类型校验对应记录的状态
  if (action.includes('registration')) {
    const registration = await getRecord(
      CONFIG.bitable.apps.operation,
      TABLES.registrations,
      registration_id
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
    const submission = await getRecord(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      submission_id
    );
    
    if (!submission) {
      throw new Error('卡组提交记录不存在');
    }
    
    const status = submission.fields.submission_status;
    
    if (action === 'approve_deck_submission' && status !== 'submitted') {
      throw new Error(`当前状态(${status})不允许审核通过`);
    }
  }
  
  return true;
}

// ============================================
// 5. 报名审核处理
// ============================================

/**
 * 审核通过报名
 * @param {Object} params - 参数
 */
async function approveRegistration(params) {
  const { registration_id, entity_type, entity_uid, admin_open_id } = params;
  const timestamp = Date.now();
  
  // 5.1 更新报名记录
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
  
  // 5.2 更新实体状态
  if (entity_type === 'team') {
    await updateRecord(
      CONFIG.bitable.apps.basic,
      TABLES.teams,
      entity_uid,
      { team_status: 'active' }
    );
  } else {
    await updateRecord(
      CONFIG.bitable.apps.basic,
      TABLES.players,
      entity_uid,
      { profile_status: 'active', verified_status: 'verified' }
    );
  }
  
  // 5.3 发送通知
  await sendNotification(entity_uid, '✅ 您的报名已通过审核！');
  
  // 5.4 推送卡组提交入口（如适用）
  if (entity_type === 'team') {
    await pushDeckSubmissionEntry(entity_uid, params.tournament_uid);
  }
  
  return { success: true, message: '报名审核通过' };
}

/**
 * 驳回报名
 * @param {Object} params - 参数
 */
async function rejectRegistration(params) {
  const { registration_id, reject_reason, admin_open_id