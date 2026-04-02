/**
 * 状态机测试脚本
 */

import {
  getStateMachine,
  MatchStatus,
  PlayerProfileStatus,
  TeamStatus,
  DeckReviewStatus,
} from './src/utils/state-machine.js';

console.log('========================================');
console.log('状态机测试');
console.log('========================================\n');

// 测试1: 场次状态机
console.log('【测试1】场次状态机');
const matchSM = getStateMachine('match');

// 测试允许的状态转换
const allowedFromNotStarted = matchSM.getAllowedTransitions(MatchStatus.NOT_STARTED);
console.log(`从"${MatchStatus.NOT_STARTED}"可以转换到:`, allowedFromNotStarted);

const allowedFromInProgress = matchSM.getAllowedTransitions(MatchStatus.IN_PROGRESS);
console.log(`从"${MatchStatus.IN_PROGRESS}"可以转换到:`, allowedFromInProgress);

// 测试状态转换校验
const canTransition1 = matchSM.canTransition(MatchStatus.NOT_STARTED, MatchStatus.PENDING_CHECKIN);
console.log(`"未开启" -> "待签到": ${canTransition1 ? '✅ 允许' : '❌ 不允许'}`);

const canTransition2 = matchSM.canTransition(MatchStatus.NOT_STARTED, MatchStatus.ENDED);
console.log(`"未开启" -> "已结束": ${canTransition2 ? '✅ 允许' : '❌ 不允许'}`);

// 测试状态转换
const result1 = matchSM.transition(MatchStatus.NOT_STARTED, MatchStatus.PENDING_CHECKIN, { matchId: 'TEST_001' });
console.log('转换结果:', result1.success ? '✅ 成功' : '❌ 失败', result1.message);

const result2 = matchSM.transition(MatchStatus.NOT_STARTED, MatchStatus.ENDED, { matchId: 'TEST_001' });
console.log('转换结果:', result2.success ? '✅ 成功' : '❌ 失败', result2.message);

console.log('\n----------------------------------------\n');

// 测试2: 选手档案状态机
console.log('【测试2】选手档案状态机');
const playerSM = getStateMachine('player');

const playerAllowed = playerSM.getAllowedTransitions(PlayerProfileStatus.UNREGISTERED);
console.log(`从"${PlayerProfileStatus.UNREGISTERED}"可以转换到:`, playerAllowed);

const playerResult = playerSM.transition(
  PlayerProfileStatus.UNREGISTERED,
  PlayerProfileStatus.CREATED_INCOMPLETE,
  { playerId: 'TEST_PLAYER_001' }
);
console.log('转换结果:', playerResult.success ? '✅ 成功' : '❌ 失败', playerResult.message);

console.log('\n----------------------------------------\n');

// 测试3: 战队状态机
console.log('【测试3】战队状态机');
const teamSM = getStateMachine('team');

const teamAllowed = teamSM.getAllowedTransitions(TeamStatus.PENDING_FORMATION);
console.log(`从"${TeamStatus.PENDING_FORMATION}"可以转换到:`, teamAllowed);

console.log('\n----------------------------------------\n');

// 测试4: 卡组审核状态机
console.log('【测试4】卡组审核状态机');
const deckSM = getStateMachine('deck');

const deckAllowed = deckSM.getAllowedTransitions(DeckReviewStatus.NOT_SUBMITTED);
console.log(`从"${DeckReviewStatus.NOT_SUBMITTED}"可以转换到:`, deckAllowed);

// 测试驳回后重新提交
const deckResult = deckSM.transition(
  DeckReviewStatus.REJECTED,
  DeckReviewStatus.SUBMITTED_PENDING_REVIEW,
  { deckId: 'TEST_DECK_001' }
);
console.log('驳回后重新提交:', deckResult.success ? '✅ 允许' : '❌ 不允许', deckResult.message);

console.log('\n========================================');
console.log('状态机测试完成');
console.log('========================================');
