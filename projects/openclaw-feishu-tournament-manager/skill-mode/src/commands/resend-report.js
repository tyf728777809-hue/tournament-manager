/**
 * 重发战报 - Skill 模式
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID } from '../config/tables.js';
import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';
import { sendReportMessage } from '../messaging/report-message.js';

/**
 * 归一化富文本字段
 */
function normalizeField(value) {
  if (Array.isArray(value) && value.length > 0 && value[0].text !== undefined) {
    return value[0].text;
  }
  return value;
}

/**
 * 解析场次
 */
function resolveMatch(records, matchIndex) {
  if (!matchIndex) {
    return null;
  }

  return records.find((record) => {
    const matchId = normalizeField(record.fields.MatchID);
    const seq = String(record.fields.场次序号);
    return matchId === matchIndex || seq === String(matchIndex);
  }) || null;
}

/**
 * 渲染战报文本
 */
function renderTextReport(match) {
  const seq = match.fields.场次序号;
  const matchId = normalizeField(match.fields.MatchID);
  const aScore = match.fields.A大分 || 0;
  const bScore = match.fields.B大分 || 0;
  const details = normalizeField(match.fields.小局明细) || '暂无';

  return [
    '【赛果播报】',
    `第 ${seq} 场：${matchId}`,
    `最终比分：${aScore} : ${bScore}`,
    `小局记录：${details}`,
  ].join('\n');
}

/**
 * 重发战报
 */
export async function resendReport({ operatorOpenId, matchIndex }) {
  // 1. 验证管理员权限
  const auth = await assertAdminAccess({
    operatorOpenId,
    tournamentId: TOURNAMENT_ID,
  });

  if (!auth.ok) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '重发战报',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message,
    });
    return auth;
  }

  // 2. 查询场次数据
  const matchResult = await feishu_bitable_app_table_record({
    action: 'list',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
      ],
    },
  });

  if (!matchResult) {
    return {
      ok: false,
      message: '读取场次数据失败。',
    };
  }

  // 3. 查找目标场次
  const targetMatch = resolveMatch(matchResult.records || [], matchIndex);
  if (!targetMatch) {
    return {
      ok: false,
      message: '未找到对应场次，请检查场次序号或 MatchID。',
    };
  }

  const matchStatus = normalizeField(targetMatch.fields.MatchStatus);
  if (matchStatus !== '已结束') {
    return {
      ok: false,
      message: '该场次尚未结束，暂时不能重发战报。',
    };
  }

  // 4. 渲染战报并更新状态
  const reportText = renderTextReport(targetMatch);
  const before = JSON.stringify({ reportStatus: normalizeField(targetMatch.fields.战报发送状态) || '未发送' });
  const seq = targetMatch.fields.场次序号;

  const updateResult = await feishu_bitable_app_table_record({
    action: 'update',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    record_id: targetMatch.record_id,
    fields: {
      '战报发送状态': '已发送',
    },
  });

  const after = JSON.stringify({ reportStatus: '已发送' });

  // 5. 记录审计日志
  await writeAuditLog({
    tournamentId: TOURNAMENT_ID,
    actionType: '重发战报',
    targetType: '场次',
    targetId: normalizeField(targetMatch.fields.MatchID),
    operator: operatorOpenId,
    before,
    after,
    result: updateResult ? '成功' : '失败',
    error: updateResult ? '' : '更新失败',
  });

  if (!updateResult) {
    return {
      ok: false,
      message: '重发战报失败，请稍后重试。',
    };
  }

  // 6. 发送战报到群聊
  const teamA = normalizeField(targetMatch.fields.战队A名称) || '战队A';
  const teamB = normalizeField(targetMatch.fields.战队B名称) || '战队B';
  const scoreA = targetMatch.fields.A大分 || 0;
  const scoreB = targetMatch.fields.B大分 || 0;
  const details = normalizeField(targetMatch.fields.小局明细) || '暂无';

  const messageResult = await sendReportMessage({
    matchIndex: seq,
    teamA,
    teamB,
    scoreA,
    scoreB,
    details,
  });

  if (!messageResult.ok) {
    console.error('[ResendReport] 发送战报失败:', messageResult.message);
  }

  return {
    ok: true,
    message: `已重发第 ${seq} 场战报。`,
    reportText,
    messageSent: messageResult.ok,
  };
}
