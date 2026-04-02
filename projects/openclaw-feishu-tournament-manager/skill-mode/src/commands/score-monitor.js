/**
 * 比分监听与自动顺延 - Skill 模式
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID, CHAT_ID } from '../config/tables.js';
import { sendCheckinText } from '../messaging/checkin-text.js';
import { debouncedScoreUpdate } from '../utils/debounce.js';
import { logger } from '../utils/logger.js';

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
 * 检查比分变化并触发顺延（带防抖）
 * @param {Object} params - { matchId, newScoreA, newScoreB }
 */
export async function checkScoreAndTriggerRolling({ matchId, newScoreA, newScoreB }) {
  // 使用防抖机制，5秒内多次更新只处理最后一次
  return debouncedScoreUpdate(TOURNAMENT_ID, matchId, async () => {
    return await doCheckScoreAndTriggerRolling({ matchId, newScoreA, newScoreB });
  });
}

/**
 * 实际执行比分检查和顺延触发
 */
async function doCheckScoreAndTriggerRolling({ matchId, newScoreA, newScoreB }) {
  logger.info('score-monitor', '执行比分检查和顺延触发', { matchId, newScoreA, newScoreB });
  
  // 1. 查询当前场次
  const matchResult = await feishu_bitable_app_table_record({
    action: 'list',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'MatchID', operator: 'is', value: [matchId] },
        { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
      ],
    },
  });

  if (!matchResult || matchResult.records.length === 0) {
    return { ok: false, message: '未找到场次记录' };
  }

  const match = matchResult.records[0];
  const oldScoreA = match.fields.A大分 || 0;
  const oldScoreB = match.fields.B大分 || 0;
  const threshold = match.fields.赛点阈值 || 2;
  const alreadyTriggered = match.fields['是否已触发顺延'];

  // 2. 更新比分
  await feishu_bitable_app_table_record({
    action: 'update',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    record_id: match.record_id,
    fields: {
      'A大分': newScoreA,
      'B大分': newScoreB,
    },
  });

  // 3. 检查是否达到赛点
  const isMatchPoint = newScoreA >= threshold || newScoreB >= threshold;

  if (!isMatchPoint || alreadyTriggered) {
    return {
      ok: true,
      message: '比分已更新，未触发顺延',
      triggered: false,
    };
  }

  // 4. 查询赛事配置，检查顺延开关
  const configResult = await feishu_bitable_app_table_record({
    action: 'list',
    app_token: APP_TOKEN,
    table_id: TABLES.tournamentConfig,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
      ],
    },
  });

  if (!configResult || configResult.records.length === 0) {
    return { ok: false, message: '未找到赛事配置' };
  }

  const config = configResult.records[0];
  if (config.fields['顺延开关'] !== true) {
    return {
      ok: true,
      message: '顺延开关已关闭，不触发顺延',
      triggered: false,
    };
  }

  // 5. 查询下一场
  const nextMatchId = normalizeField(match.fields['下一场MatchID']);
  if (!nextMatchId) {
    return {
      ok: true,
      message: '当前场次是顺延链尾，不触发顺延',
      triggered: false,
    };
  }

  const nextMatchResult = await feishu_bitable_app_table_record({
    action: 'list',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'MatchID', operator: 'is', value: [nextMatchId] },
      ],
    },
  });

  if (!nextMatchResult || nextMatchResult.records.length === 0) {
    return { ok: false, message: '未找到下一场记录' };
  }

  const nextMatch = nextMatchResult.records[0];

  // 6. 更新当前场次为已触发顺延
  await feishu_bitable_app_table_record({
    action: 'update',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    record_id: match.record_id,
    fields: {
      '是否已触发顺延': true,
      'MatchStatus': '已结束',
    },
  });

  // 7. 更新下一场为待签到
  await feishu_bitable_app_table_record({
    action: 'update',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    record_id: nextMatch.record_id,
    fields: {
      'MatchStatus': '待签到',
    },
  });

  // 8. 发送顺延签到通知
  const nextSeq = nextMatch.fields.场次序号;
  const teamA = '战队A'; // 需要从关联表获取
  const teamB = '战队B';
  const captainA = '';
  const captainB = '';

  await sendCheckinText({
    matchIndex: nextSeq,
    teamA,
    teamB,
    captainA,
    captainB,
  });

  return {
    ok: true,
    message: `已触发顺延，第 ${nextSeq} 场签到已下发`,
    triggered: true,
    nextMatchId,
  };
}

/**
 * 手动录入比分（管理员使用）
 * @param {Object} params - { operatorOpenId, matchIndex, scoreA, scoreB }
 */
export async function updateScore({ operatorOpenId, matchIndex, scoreA, scoreB }) {
  // 1. 查询场次
  const matchResult = await feishu_bitable_app_table_record({
    action: 'list',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: '场次序号', operator: 'is', value: [String(matchIndex)] },
        { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
      ],
    },
  });

  if (!matchResult || matchResult.records.length === 0) {
    return { ok: false, message: '未找到场次记录' };
  }

  const match = matchResult.records[0];
  const matchId = normalizeField(match.fields.MatchID);

  // 2. 检查比分变化并触发顺延
  const result = await checkScoreAndTriggerRolling({
    matchId,
    newScoreA: scoreA,
    newScoreB: scoreB,
  });

  return result;
}
