/**
 * 状态服务
 * 
 * 封装状态机的实际业务调用
 * 与 Bitable 数据交互
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID } from '../config/tables.js';
import {
  getStateMachine,
  MatchStatus,
  PlayerProfileStatus,
  TeamStatus,
  DeckReviewStatus,
} from '../utils/state-machine.js';
import { logger } from '../utils/logger.js';

// ============================================
// 场次状态服务
// ============================================

/**
 * 更新场次状态
 * @param {Object} params - { matchId, fromStatus, toStatus, operatorOpenId }
 * @returns {Promise<Object>}
 */
export async function updateMatchStatus({ matchId, fromStatus, toStatus, operatorOpenId }) {
  const stateMachine = getStateMachine('match');

  // 1. 校验状态转换
  const result = stateMachine.transition(fromStatus, toStatus, {
    matchId,
    operatorOpenId,
  });

  if (!result.success) {
    logger.warn('state-service', '场次状态转换失败', { matchId, fromStatus, toStatus, message: result.message });
    return { ok: false, message: result.message };
  }

  // 2. 更新 Bitable
  try {
    await feishu_bitable_app_table_record({
      action: 'update',
      app_token: APP_TOKEN,
      table_id: TABLES.matchResults,
      record_id: matchId,
      fields: {
        'MatchStatus': toStatus,
      },
    });

    logger.info('state-service', '场次状态更新成功', { matchId, fromStatus, toStatus });
    return { ok: true, message: `场次状态已更新: ${fromStatus} -> ${toStatus}` };
  } catch (error) {
    logger.error('state-service', '场次状态更新失败', error);
    return { ok: false, message: '场次状态更新失败' };
  }
}

/**
 * 获取场次允许的状态转换
 * @param {string} currentStatus - 当前状态
 * @returns {string[]}
 */
export function getMatchAllowedTransitions(currentStatus) {
  const stateMachine = getStateMachine('match');
  return stateMachine.getAllowedTransitions(currentStatus);
}

// ============================================
// 选手档案状态服务
// ============================================

/**
 * 更新选手档案状态
 * @param {Object} params - { playerId, fromStatus, toStatus }
 */
export async function updatePlayerProfileStatus({ playerId, fromStatus, toStatus }) {
  const stateMachine = getStateMachine('player');

  const result = stateMachine.transition(fromStatus, toStatus, { playerId });

  if (!result.success) {
    return { ok: false, message: result.message };
  }

  try {
    await feishu_bitable_app_table_record({
      action: 'update',
      app_token: APP_TOKEN,
      table_id: TABLES.playerMaster,
      record_id: playerId,
      fields: {
        '档案状态': toStatus,
      },
    });

    return { ok: true, message: `选手档案状态已更新: ${fromStatus} -> ${toStatus}` };
  } catch (error) {
    logger.error('state-service', '选手档案状态更新失败', error);
    return { ok: false, message: '选手档案状态更新失败' };
  }
}

// ============================================
// 战队状态服务
// ============================================

/**
 * 更新战队状态
 * @param {Object} params - { teamId, fromStatus, toStatus }
 */
export async function updateTeamStatus({ teamId, fromStatus, toStatus }) {
  const stateMachine = getStateMachine('team');

  const result = stateMachine.transition(fromStatus, toStatus, { teamId });

  if (!result.success) {
    return { ok: false, message: result.message };
  }

  try {
    await feishu_bitable_app_table_record({
      action: 'update',
      app_token: APP_TOKEN,
      table_id: TABLES.teamMaster,
      record_id: teamId,
      fields: {
        '战队状态': toStatus,
      },
    });

    return { ok: true, message: `战队状态已更新: ${fromStatus} -> ${toStatus}` };
  } catch (error) {
    logger.error('state-service', '战队状态更新失败', error);
    return { ok: false, message: '战队状态更新失败' };
  }
}

// ============================================
// 卡组审核状态服务
// ============================================

/**
 * 更新卡组审核状态
 * @param {Object} params - { deckId, fromStatus, toStatus, reviewerId, rejectReason }
 */
export async function updateDeckReviewStatus({ deckId, fromStatus, toStatus, reviewerId, rejectReason }) {
  const stateMachine = getStateMachine('deck');

  const context = { deckId, reviewerId, rejectReason };
  const result = stateMachine.transition(fromStatus, toStatus, context);

  if (!result.success) {
    return { ok: false, message: result.message };
  }

  try {
    const updateFields = {
      '审核状态': toStatus,
    };

    if (toStatus === DeckReviewStatus.APPROVED) {
      updateFields['审核人'] = [{ id: reviewerId }];
      updateFields['审核时间'] = Date.now();
    } else if (toStatus === DeckReviewStatus.REJECTED) {
      updateFields['审核人'] = [{ id: reviewerId }];
      updateFields['审核时间'] = Date.now();
      updateFields['驳回原因'] = rejectReason;
    }

    await feishu_bitable_app_table_record({
      action: 'update',
      app_token: APP_TOKEN,
      table_id: TABLES.deckSubmission,
      record_id: deckId,
      fields: updateFields,
    });

    return { ok: true, message: `卡组审核状态已更新: ${fromStatus} -> ${toStatus}` };
  } catch (error) {
    logger.error('state-service', '卡组审核状态更新失败', error);
    return { ok: false, message: '卡组审核状态更新失败' };
  }
}

// ============================================
// 批量状态检查
// ============================================

/**
 * 检查是否可以锁定赛事（所有战队已锁定）
 * @returns {Promise<boolean>}
 */
export async function canLockTournament() {
  try {
    const result = await feishu_bitable_app_table_record({
      action: 'list',
      app_token: APP_TOKEN,
      table_id: TABLES.teamMaster,
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
          { field_name: '战队状态', operator: 'isNot', value: [TeamStatus.LOCKED] },
        ],
      },
    });

    const unLockedCount = result?.records?.length || 0;
    return unLockedCount === 0;
  } catch (error) {
    logger.error('state-service', '检查赛事锁定状态失败', error);
    return false;
  }
}

/**
 * 获取赛事统计信息
 * @returns {Promise<Object>}
 */
export async function getTournamentStats() {
  try {
    const [teamResult, playerResult, matchResult] = await Promise.all([
      feishu_bitable_app_table_record({
        action: 'list',
        app_token: APP_TOKEN,
        table_id: TABLES.teamMaster,
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] }],
        },
      }),
      feishu_bitable_app_table_record({
        action: 'list',
        app_token: APP_TOKEN,
        table_id: TABLES.playerMaster,
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] }],
        },
      }),
      feishu_bitable_app_table_record({
        action: 'list',
        app_token: APP_TOKEN,
        table_id: TABLES.matchResults,
        filter: {
          conjunction: 'and',
          conditions: [{ field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] }],
        },
      }),
    ]);

    const teams = teamResult?.records || [];
    const players = playerResult?.records || [];
    const matches = matchResult?.records || [];

    return {
      ok: true,
      stats: {
        totalTeams: teams.length,
        lockedTeams: teams.filter(t => t.fields['战队状态'] === TeamStatus.LOCKED).length,
        totalPlayers: players.length,
        completedProfiles: players.filter(p => p.fields['档案状态'] === PlayerProfileStatus.COMPLETED).length,
        totalMatches: matches.length,
        endedMatches: matches.filter(m => m.fields['MatchStatus'] === MatchStatus.ENDED).length,
        completionRate: matches.length > 0 
          ? Math.round((matches.filter(m => m.fields['MatchStatus'] === MatchStatus.ENDED).length / matches.length) * 100)
          : 0,
      },
    };
  } catch (error) {
