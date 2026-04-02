/**
 * 手动签到 - Skill 模式
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID } from '../config/tables.js';
import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';
import { sendCheckinCard } from '../messaging/checkin-card.js';

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
 * 手动签到
 */
export async function manualCheckin({ operatorOpenId, matchIndex }) {
  // 1. 验证管理员权限
  const auth = await assertAdminAccess({
    operatorOpenId,
    tournamentId: TOURNAMENT_ID,
  });

  if (!auth.ok) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '手动签到',
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
  if (matchStatus === '已结束') {
    return {
      ok: false,
      message: '该场次已结束，无法再次下发签到卡片。',
    };
  }

  // 4. 更新场次状态
  const before = JSON.stringify({ status: matchStatus });
  const seq = targetMatch.fields.场次序号;

  const updateResult = await feishu_bitable_app_table_record({
    action: 'update',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    record_id: targetMatch.record_id,
    fields: {
      'MatchStatus': '待签到',
    },
  });

  const after = JSON.stringify({ status: '待签到' });

  // 5. 记录审计日志
  await writeAuditLog({
    tournamentId: TOURNAMENT_ID,
    actionType: '手动签到',
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
      message: '手动签到下发失败，请稍后重试。',
    };
  }

  // 6. 发送签到卡片到群聊
  const teamA = normalizeField(targetMatch.fields.战队A名称) || '战队A';
  const teamB = normalizeField(targetMatch.fields.战队B名称) || '战队B';
  const captainA = normalizeField(targetMatch.fields.战队A队长OpenID) || '';
  const captainB = normalizeField(targetMatch.fields.战队B队长OpenID) || '';

  const messageResult = await sendCheckinCard({
    matchIndex: seq,
    teamA,
    teamB,
    captainA,
    captainB,
  });

  if (!messageResult.ok) {
    console.error('[ManualCheckin] 发送签到卡片失败:', messageResult.message);
  }

  return {
    ok: true,
    message: `已手动下发第 ${seq} 场签到卡片。`,
    messageSent: messageResult.ok,
  };
}
