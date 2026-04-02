/**
 * 提醒相关定时任务
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID, CHAT_ID } from '../config/tables.js';
import { logger } from '../utils/logger.js';

/**
 * 检查签到超时
 * 
 * 逻辑：
 * 1. 查询所有待签到的场次
 * 2. 检查签到下发时间
 * 3. 如果超过超时时间且未双边签到，发送提醒
 */
export async function checkCheckinTimeout() {
  logger.debug('reminder-jobs', '检查签到超时');

  // 1. 查询赛事配置，获取超时时间
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
    return;
  }

  const config = configResult.records[0];
  const timeoutMinutes = config.fields['默认签到超时分钟数'] || 10;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  // 2. 查询所有待签到的场次
  const matchesResult = await feishu_bitable_app_table_record({
    action: 'list',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
        { field_name: 'MatchStatus', operator: 'is', value: ['待签到'] },
      ],
    },
  });

  if (!matchesResult || matchesResult.records.length === 0) {
    logger.debug('reminder-jobs', '没有待签到的场次');
    return;
  }

  const now = Date.now();

  // 3. 检查每个场次是否超时
  for (const match of matchesResult.records) {
    // 检查是否已双边签到
    const aSigned = match.fields['A队签到'] === true;
    const bSigned = match.fields['B队签到'] === true;

    if (aSigned && bSigned) {
      continue; // 已双边签到，跳过
    }

    // 检查是否已提醒过
    if (match.fields['已发送超时提醒'] === true) {
      continue; // 已提醒过，跳过
    }

    // TODO: 获取签到下发时间，检查是否超时
    // 这里需要记录签到下发时间，当前数据表没有这个字段

    // 如果超时，发送提醒
    const matchIndex = match.fields['场次序号'];
    const unsignedTeams = [];
    if (!aSigned) unsignedTeams.push('战队A');
    if (!bSigned) unsignedTeams.push('战队B');

    if (unsignedTeams.length > 0) {
      // 发送超时提醒
      await sendTimeoutReminder(matchIndex, unsignedTeams);

      // 标记已提醒
      await feishu_bitable_app_table_record({
        action: 'update',
        app_token: APP_TOKEN,
        table_id: TABLES.matchResults,
        record_id: match.record_id,
        fields: {
          '已发送超时提醒': true,
        },
      });

      logger.info('reminder-jobs', `第 ${matchIndex} 场超时提醒已发送`);
    }
  }
}

/**
 * 发送超时提醒
 * @param {number} matchIndex - 场次序号
 * @param {string[]} unsignedTeams - 未签到的战队列表
 */
async function sendTimeoutReminder(matchIndex, unsignedTeams) {
  const teamsText = unsignedTeams.join('、');
  const text = `⏰ **第 ${matchIndex} 场签到超时提醒**

${teamsText} 尚未完成签到，请尽快联系队长完成签到。

如无法按时签到，请联系管理员处理。`;

  try {
    await message({
      action: 'send',
      channel: 'feishu',
      accountId: 'hs-esports',
      target: `chat:${CHAT_ID}`,
      message: text,
    });
  } catch (error) {
    logger.error('reminder-jobs', '发送超时提醒失败', error);
  }
}
