import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';

async function findTournamentRecord(bitable, tournamentId) {
  const result = await bitable.listRecords('tournamentConfig', (record) => record.fields.TournamentID === tournamentId);
  if (!result.ok || result.records.length === 0) {
    return null;
  }
  return result.records[0];
}

export async function pauseRolling({ context, bitable, payload = {} }) {
  const operatorOpenId = payload.operatorOpenId;
  const auth = await assertAdminAccess({
    bitable,
    tournamentId: context.tournamentId,
    operatorOpenId
  });

  if (!auth.ok) {
    await writeAuditLog({
      bitable,
      tournamentId: context.tournamentId,
      actionType: '更新比分',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message
    });
    return auth;
  }

  const record = await findTournamentRecord(bitable, context.tournamentId);
  if (!record) {
    return { ok: false, message: '未找到赛事配置记录。' };
  }

  const before = JSON.stringify({ rollingEnabled: record.fields.顺延开关 });
  const updateResult = await bitable.updateRecord('tournamentConfig', record.recordId, { 顺延开关: false });
  const after = JSON.stringify({ rollingEnabled: false });

  await writeAuditLog({
    bitable,
    tournamentId: context.tournamentId,
    actionType: '更新比分',
    targetType: '系统',
    operator: operatorOpenId,
    before,
    after,
    result: updateResult.ok ? '成功' : '失败',
    error: updateResult.ok ? '' : updateResult.message
  });

  if (!updateResult.ok) {
    return { ok: false, message: '暂停顺延失败，请稍后重试。' };
  }

  return {
    ok: true,
    message: '已暂停本赛事自动顺延，后续比分变化将不再自动触发下一场签到。',
    record: updateResult.record
  };
}

export async function resumeRolling({ context, bitable, payload = {} }) {
  const operatorOpenId = payload.operatorOpenId;
  const auth = await assertAdminAccess({
    bitable,
    tournamentId: context.tournamentId,
    operatorOpenId
  });

  if (!auth.ok) {
    await writeAuditLog({
      bitable,
      tournamentId: context.tournamentId,
      actionType: '更新比分',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message
    });
    return auth;
  }

  const record = await findTournamentRecord(bitable, context.tournamentId);
  if (!record) {
    return { ok: false, message: '未找到赛事配置记录。' };
  }

  const before = JSON.stringify({ rollingEnabled: record.fields.顺延开关 });
  const updateResult = await bitable.updateRecord('tournamentConfig', record.recordId, { 顺延开关: true });
  const after = JSON.stringify({ rollingEnabled: true });

  await writeAuditLog({
    bitable,
    tournamentId: context.tournamentId,
    actionType: '更新比分',
    targetType: '系统',
    operator: operatorOpenId,
    before,
    after,
    result: updateResult.ok ? '成功' : '失败',
    error: updateResult.ok ? '' : updateResult.message
  });

  if (!updateResult.ok) {
    return { ok: false, message: '恢复顺延失败，请稍后重试。' };
  }

  return {
    ok: true,
    message: '已恢复本赛事自动顺延。历史漏发场次如需补发，请使用 /手动签到。',
    record: updateResult.record
  };
}
