/**
 * 暂停/恢复顺延 - Skill 模式
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID } from '../config/tables.js';
import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';

/**
 * 查找赛事配置记录
 */
async function findTournamentRecord(tournamentId) {
  const result = await feishu_bitable_app_table_record({
    action: 'list',
    app_token: APP_TOKEN,
    table_id: TABLES.tournamentConfig,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [tournamentId] },
      ],
    },
  });

  if (!result || result.records.length === 0) {
    return null;
  }

  // 处理富文本字段
  const record = result.records[0];
  if (record.fields.TournamentID && Array.isArray(record.fields.TournamentID)) {
    record.fields.TournamentID = record.fields.TournamentID[0]?.text || '';
  }

  return record;
}

/**
 * 暂停顺延
 */
export async function pauseRolling({ operatorOpenId }) {
  // 1. 验证管理员权限
  const auth = await assertAdminAccess({
    operatorOpenId,
    tournamentId: TOURNAMENT_ID,
  });

  if (!auth.ok) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '暂停顺延',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message,
    });
    return auth;
  }

  // 2. 查找赛事记录
  const record = await findTournamentRecord(TOURNAMENT_ID);
  if (!record) {
    return { ok: false, message: '未找到赛事配置记录。' };
  }

  // 3. 更新顺延开关
  const before = JSON.stringify({ rollingEnabled: record.fields['顺延开关'] });

  const updateResult = await feishu_bitable_app_table_record({
    action: 'update',
    app_token: APP_TOKEN,
    table_id: TABLES.tournamentConfig,
    record_id: record.record_id,
    fields: {
      '顺延开关': false,
    },
  });

  const after = JSON.stringify({ rollingEnabled: false });

  // 4. 记录审计日志
  await writeAuditLog({
    tournamentId: TOURNAMENT_ID,
    actionType: '暂停顺延',
    targetType: '系统',
    operator: operatorOpenId,
    before,
    after,
    result: updateResult ? '成功' : '失败',
    error: updateResult ? '' : '更新失败',
  });

  if (!updateResult) {
    return { ok: false, message: '暂停顺延失败，请稍后重试。' };
  }

  return {
    ok: true,
    message: '已暂停本赛事自动顺延，后续比分变化将不再自动触发下一场签到。',
  };
}

/**
 * 恢复顺延
 */
export async function resumeRolling({ operatorOpenId }) {
  // 1. 验证管理员权限
  const auth = await assertAdminAccess({
    operatorOpenId,
    tournamentId: TOURNAMENT_ID,
  });

  if (!auth.ok) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '恢复顺延',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message,
    });
    return auth;
  }

  // 2. 查找赛事记录
  const record = await findTournamentRecord(TOURNAMENT_ID);
  if (!record) {
    return { ok: false, message: '未找到赛事配置记录。' };
  }

  // 3. 更新顺延开关
  const before = JSON.stringify({ rollingEnabled: record.fields['顺延开关'] });

  const updateResult = await feishu_bitable_app_table_record({
    action: 'update',
    app_token: APP_TOKEN,
    table_id: TABLES.tournamentConfig,
    record_id: record.record_id,
    fields: {
      '顺延开关': true,
    },
  });

  const after = JSON.stringify({ rollingEnabled: true });

  // 4. 记录审计日志
  await writeAuditLog({
    tournamentId: TOURNAMENT_ID,
    actionType: '恢复顺延',
    targetType: '系统',
    operator: operatorOpenId,
    before,
    after,
    result: updateResult ? '成功' : '失败',
    error: updateResult ? '' : '更新失败',
  });

  if (!updateResult) {
    return { ok: false, message: '恢复顺延失败，请稍后重试。' };
  }

  return {
    ok: true,
    message: '已恢复本赛事自动顺延。历史漏发场次如需补发，请使用 /手动签到。',
  };
}
