import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';

function resolveMatch(records, payload = {}) {
  const [firstArg] = payload.args || [];
  if (!firstArg) {
    return null;
  }

  return records.find((record) => {
    return record.fields.MatchID === firstArg
      || String(record.fields.场次序号) === String(firstArg);
  }) || null;
}

export async function manualCheckin({ context, bitable, payload = {} }) {
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
      actionType: '发签到卡',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message
    });
    return auth;
  }

  const matchResult = await bitable.listRecords('matchResults', (record) => {
    return record.fields.TournamentID === context.tournamentId;
  });

  if (!matchResult.ok) {
    return {
      ok: false,
      message: '读取场次数据失败。'
    };
  }

  const targetMatch = resolveMatch(matchResult.records, payload);
  if (!targetMatch) {
    return {
      ok: false,
      message: '未找到对应场次，请检查场次序号或 MatchID。'
    };
  }

  if (targetMatch.fields.MatchStatus === '已结束') {
    return {
      ok: false,
      message: '该场次已结束，无法再次下发签到卡片。'
    };
  }

  const before = JSON.stringify({ status: targetMatch.fields.MatchStatus });
  const updateResult = await bitable.updateRecord('matchResults', targetMatch.recordId, {
    MatchStatus: '待签到'
  });
  const after = JSON.stringify({ status: '待签到' });

  await writeAuditLog({
    bitable,
    tournamentId: context.tournamentId,
    actionType: '发签到卡',
    targetType: '场次',
    targetId: targetMatch.fields.MatchID,
    operator: operatorOpenId,
    before,
    after,
    result: updateResult.ok ? '成功' : '失败',
    error: updateResult.ok ? '' : updateResult.message
  });

  if (!updateResult.ok) {
    return {
      ok: false,
      message: '手动签到下发失败，请稍后重试。'
    };
  }

  return {
    ok: true,
    message: `已手动下发第 ${targetMatch.fields.场次序号} 场签到卡片。`,
    record: updateResult.record
  };
}
