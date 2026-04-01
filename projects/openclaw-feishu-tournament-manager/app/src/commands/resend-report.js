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

function renderTextReport(match) {
  return [
    '【赛果播报】',
    `第 ${match.fields.场次序号} 场：${match.fields.MatchID}`,
    `最终比分：${match.fields.A大分} : ${match.fields.B大分}`,
    `小局记录：${match.fields.小局明细 || '暂无'}`
  ].join('\n');
}

export async function resendReport({ context, bitable, payload = {} }) {
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
      actionType: '发战报',
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

  if (targetMatch.fields.MatchStatus !== '已结束') {
    return {
      ok: false,
      message: '该场次尚未结束，暂时不能重发战报。'
    };
  }

  const reportText = renderTextReport(targetMatch);
  const before = JSON.stringify({ reportStatus: targetMatch.fields.战报发送状态 || '未发送' });
  const updateResult = await bitable.updateRecord('matchResults', targetMatch.recordId, {
    战报发送状态: '已发送'
  });
  const after = JSON.stringify({ reportStatus: '已发送' });

  await writeAuditLog({
    bitable,
    tournamentId: context.tournamentId,
    actionType: '发战报',
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
      message: '重发战报失败，请稍后重试。'
    };
  }

  return {
    ok: true,
    message: `已重发第 ${targetMatch.fields.场次序号} 场战报。`,
    reportText,
    record: updateResult.record
  };
}
