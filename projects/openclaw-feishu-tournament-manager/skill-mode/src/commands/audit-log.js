/**
 * 审计日志 - Skill 模式
 */

import { TABLES, APP_TOKEN } from '../config/tables.js';

/**
 * 写入审计日志
 * @param {Object} params
 */
export async function writeAuditLog({
  tournamentId,
  actionType,
  targetType,
  operator,
  before,
  after,
  result,
  error,
}) {
  try {
    await feishu_bitable_app_table_record({
      action: 'create',
      app_token: APP_TOKEN,
      table_id: TABLES.auditLog,
      fields: {
        '操作类型': actionType,
        '操作对象': targetType,
        '操作人OpenID': operator,
        '目标赛事ID': tournamentId,
        '变更前': before || '',
        '变更后': after || '',
        '操作结果': result,
        '错误信息': error || '',
        '操作时间': Date.now(),
      },
    });
  } catch (err) {
    console.error('[AuditLog] 写入失败:', err.message);
  }
}
