/**
 * 签到相关定时任务
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID } from '../config/tables.js';
import { logger } from '../utils/logger.js';
import { sendCheckinText } from '../messaging/checkin-text.js';

/**
 * 检查并触发首场签到
 * 
 * 逻辑：
 * 1. 查询赛事配置，检查是否设置了首场签到时间
 * 2. 检查当前时间是否已到首场签到时间
 * 3. 检查首场是否已下发
 * 4. 触发首场签到
 */
export async function checkAndTriggerFirstMatchCheckin() {
  logger.debug('checkin-jobs', '检查首场签到');

  // 1. 查询赛事配置
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
    logger.warn('checkin-jobs', '未找到赛事配置');
    return;
  }

  const config = configResult.records[0];
  
  // 2. 检查首场签到开启方式
  const firstCheckinMode = config.fields['首场签到开启方式'];
  if (firstCheckinMode !== '定时') {
    logger.debug('checkin-jobs', '首场签到非定时模式，跳过');
    return;
  }

  // 3. 检查首场签到时间
  const firstCheckinTime = config.fields['首场签到时间'];
  if (!firstCheckinTime) {
    logger.debug('checkin-jobs', '未设置首场签到时间');
    return;
  }

  // 4. 检查是否已到时间
  const now = Date.now();
  const checkinTimestamp = typeof firstCheckinTime === 'number' 
    ? firstCheckinTime 
    : new Date(firstCheckinTime).getTime();

  if (now < checkinTimestamp) {
    logger.debug('checkin-jobs', '首场签到时间未到');
    return;
  }

  // 5. 查询首场（场次序号=1）
  const matchResult = await feishu_bitable_app_table_record({
    action: 'list',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
        { field_name: '场次序号', operator: 'is', value: ['1'] },
      ],
    },
  });

  if (!matchResult || matchResult.records.length === 0) {
    logger.warn('checkin-jobs', '未找到首场记录');
    return;
  }

  const firstMatch = matchResult.records[0];

  // 6. 检查是否已下发
  if (firstMatch.fields['签到状态'] === '已下发' || firstMatch.fields['签到状态'] === '已签到') {
    logger.debug('checkin-jobs', '首场签到已下发或已完成');
    return;
  }

  // 7. 更新场次状态为待签到
  await feishu_bitable_app_table_record({
    action: 'update',
    app_token: APP_TOKEN,
    table_id: TABLES.matchResults,
    record_id: firstMatch.record_id,
    fields: {
      'MatchStatus': '待签到',
    },
  });

  // 8. 发送首场签到通知
  // TODO: 获取战队信息
  await sendCheckinText({
    matchIndex: 1,
    teamA: '战队A',
    teamB: '战队B',
    captainA: '',
    captainB: '',
  });

  logger.info('checkin-jobs', '首场签到已自动触发');
}
