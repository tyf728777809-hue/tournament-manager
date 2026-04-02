/**
 * 数据表配置 - 生产环境
 * 
 * 使用前请修改以下配置为生产环境实际值
 */

// ============================================
// 生产环境配置（需要修改）
// ============================================

/**
 * Bitable App Token
 * 获取方式：飞书多维表格 → 设置 → 复制 App Token
 */
export const APP_TOKEN = 'YOUR_PRODUCTION_APP_TOKEN_HERE';

/**
 * 赛事ID
 * 格式：T_年份_序号，如 T_2026_001
 */
export const TOURNAMENT_ID = 'YOUR_TOURNAMENT_ID_HERE';

/**
 * 群聊ID
 * 获取方式：飞书群设置 → 群信息 → 群ID
 * 格式：oc_xxxxxxxxxxxxxxxx
 */
export const CHAT_ID = 'YOUR_CHAT_ID_HERE';

// ============================================
// 数据表ID（需要修改）
// ============================================

/**
 * 数据表ID映射
 * 获取方式：飞书多维表格 → 数据表 → 设置 → 复制 Table ID
 */
export const TABLES = {
  // 赛事配置表
  tournamentConfig: 'YOUR_TOURNAMENT_CONFIG_TABLE_ID',
  
  // 战队主档案库
  teamMaster: 'YOUR_TEAM_MASTER_TABLE_ID',
  
  // 选手主档案库
  playerMaster: 'YOUR_PLAYER_MASTER_TABLE_ID',
  
  // 赛事对阵与赛果表
  matchResults: 'YOUR_MATCH_RESULTS_TABLE_ID',
  
  // 卡组提交与审核表
  deckSubmission: 'YOUR_DECK_SUBMISSION_TABLE_ID',
  
  // 管理员白名单
  adminWhitelist: 'YOUR_ADMIN_WHITELIST_TABLE_ID',
  
  // 审计日志表
  auditLog: 'YOUR_AUDIT_LOG_TABLE_ID',
};

// ============================================
// 其他配置（可选修改）
// ============================================

/**
 * 默认签到超时时间（分钟）
 */
export const DEFAULT_CHECKIN_TIMEOUT_MINUTES = 10;

/**
 * 日志级别
 * 可选：debug, info, warn, error
 */
export const LOG_LEVEL = 'info';

/**
 * 重试次数
 */
export const MAX_RETRY_ATTEMPTS = 3;

/**
 * 重试延迟（毫秒）
 */
export const RETRY_DELAY_MS = 1000;

// ============================================
// 配置验证
// ============================================

/**
 * 验证配置是否已修改
 */
export function validateConfig() {
  const required = [
    { key: 'APP_TOKEN', value: APP_TOKEN, placeholder: 'YOUR_PRODUCTION_APP_TOKEN_HERE' },
    { key: 'TOURNAMENT_ID', value: TOURNAMENT_ID, placeholder: 'YOUR_TOURNAMENT_ID_HERE' },
    { key: 'CHAT_ID', value: CHAT_ID, placeholder: 'YOUR_CHAT_ID_HERE' },
  ];
  
  const missing = required.filter(item => 
    !item.value || item.value === item.placeholder
  );
  
  if (missing.length > 0) {
    throw new Error(
      `生产环境配置未完善，请修改以下配置：\n` +
      missing.map(item => `- ${item.key}`).join('\n')
    );
  }
  
  // 检查表ID
  const tableIds = Object.entries(TABLES);
  const missingTables = tableIds.filter(([key, value]) => 
    !value || value.startsWith('YOUR_')
  );
  
  if (missingTables.length > 0) {
    throw new Error(
      `表ID配置未完善，请修改以下表ID：\n` +
      missingTables.map(([key]) => `- ${key}`).join('\n')
    );
  }
  
  console.log('✅ 生产环境配置验证通过');
  return true;
}
