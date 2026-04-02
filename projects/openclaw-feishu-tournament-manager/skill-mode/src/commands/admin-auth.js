/**
 * 管理员权限验证 - Skill 模式
 * 
 * 直接使用 feishu_bitable_app_table_record 工具
 */

import { TABLES, APP_TOKEN } from '../config/tables.js';
import { logger } from '../utils/logger.js';
import { withRetry, safeExecute } from '../utils/error-handler.js';

/**
 * 验证管理员权限
 * @param {Object} params - { operatorOpenId, tournamentId }
 * @returns {Promise<Object>}
 */
export async function assertAdminAccess({ operatorOpenId, tournamentId }) {
  logger.info('admin-auth', '验证管理员权限', { operatorOpenId, tournamentId });
  
  if (!operatorOpenId) {
    logger.warn('admin-auth', '操作人身份为空');
    return { ok: false, message: '无法识别操作人身份，请重试。' };
  }

  try {
    // 查询管理员白名单（带重试）
    const result = await withRetry(
      async () => feishu_bitable_app_table_record({
        action: 'list',
        app_token: APP_TOKEN,
        table_id: TABLES.adminWhitelist,
        filter: {
          conjunction: 'and',
          conditions: [
            { field_name: '飞书UserID', operator: 'is', value: [operatorOpenId] },
            { field_name: '是否启用', operator: 'is', value: ['true'] },
          ],
        },
      }),
      { context: 'admin-auth-query', maxRetries: 3 }
    );

    if (!result || result.records.length === 0) {
      logger.warn('admin-auth', '未找到管理员记录', { operatorOpenId });
      return { ok: false, message: '你没有管理员权限，请联系赛事主理人。' };
    }

    const adminRecord = result.records[0];
    const allowedTournaments = adminRecord.fields.TournamentID?.[0]?.text || '';

    // 检查是否有权限管理该赛事
    if (allowedTournaments && allowedTournaments !== tournamentId) {
      logger.warn('admin-auth', '无该赛事权限', { operatorOpenId, tournamentId, allowedTournaments });
      return { ok: false, message: '你没有该赛事的管理权限。' };
    }

    logger.info('admin-auth', '管理员权限验证通过', { operatorOpenId, tournamentId });
    return { ok: true, admin: adminRecord };
  } catch (error) {
    logger.error('admin-auth', '验证失败', error);
    return { ok: false, message: '权限验证失败，请稍后重试。' };
  }
}
