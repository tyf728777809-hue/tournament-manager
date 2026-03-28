/**
 * 炉石赛事自动化系统 - 个人赛 BO5 征服状态引擎
 * 版本: v1.0 | 日期: 2026-03-28
 *
 * 目标：
 * 1. 用纯函数管理个人赛 BO5 征服状态
 * 2. 不依赖飞书 Bitable 字段是否已经补齐
 * 3. 后续可直接接入 callback-handler / result-report / match writeback
 */

const MATCH_STATUS = {
  WAITING_BP: 'waiting_bp',
  READY: 'ready',
  IN_GAME: 'in_game',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  ABORTED: 'aborted',
};

const SIDE = {
  A: 'side_a',
  B: 'side_b',
};

function uniq(values = []) {
  return [...new Set((values || []).filter(Boolean).map(v => String(v).trim()))];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组`);
  }
}

function buildInitialSoloConquestState({
  sideAClasses = [],
  sideBClasses = [],
  sideABannedClasses = [],
  sideBBannedClasses = [],
  targetWins = 3,
  currentGameNo = 1,
} = {}) {
  assertArray(sideAClasses, 'sideAClasses');
  assertArray(sideBClasses, 'sideBClasses');
  assertArray(sideABannedClasses, 'sideABannedClasses');
  assertArray(sideBBannedClasses, 'sideBBannedClasses');

  const normalizedA = uniq(sideAClasses);
  const normalizedB = uniq(sideBClasses);
  const bannedA = uniq(sideABannedClasses);
  const bannedB = uniq(sideBBannedClasses);

  if (normalizedA.length < targetWins) {
    throw new Error(`A方可用职业不足，至少需要 ${targetWins} 个职业`);
  }
  if (normalizedB.length < targetWins) {
    throw new Error(`B方可用职业不足，至少需要 ${targetWins} 个职业`);
  }

  const availableA = normalizedA.filter(cls => !bannedA.includes(cls));
  const availableB = normalizedB.filter(cls => !bannedB.includes(cls));

  if (availableA.length < targetWins) {
    throw new Error(`A方 ban 后可用职业不足，至少需要 ${targetWins} 个职业`);
  }
  if (availableB.length < targetWins) {
    throw new Error(`B方 ban 后可用职业不足，至少需要 ${targetWins} 个职业`);
  }

  return {
    mode: 'BO5_CONQUEST',
    targetWins,
    matchStatus: MATCH_STATUS.READY,
    currentGameNo,
    winnerSide: null,
    finalScore: null,
    sideA: {
      allClasses: normalizedA,
      bannedClasses: bannedA,
      availableClasses: availableA,
      conqueredClasses: [],
      wins: 0,
    },
    sideB: {
      allClasses: normalizedB,
      bannedClasses: bannedB,
      availableClasses: availableB,
      conqueredClasses: [],
      wins: 0,
    },
    games: [],
  };
}

function normalizeSoloConquestState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('缺少 state');
  }

  const normalized = clone(state);
  normalized.mode = normalized.mode || 'BO5_CONQUEST';
  normalized.targetWins = Number(normalized.targetWins || 3);
  normalized.matchStatus = normalized.matchStatus || MATCH_STATUS.READY;
  normalized.currentGameNo = Number(normalized.currentGameNo || 1);
  normalized.games = Array.isArray(normalized.games) ? normalized.games : [];

  for (const sideKey of ['sideA', 'sideB']) {
    normalized[sideKey] = normalized[sideKey] || {};
    normalized[sideKey].allClasses = uniq(normalized[sideKey].allClasses || []);
    normalized[sideKey].bannedClasses = uniq(normalized[sideKey].bannedClasses || []);
    normalized[sideKey].availableClasses = uniq(normalized[sideKey].availableClasses || []);
    normalized[sideKey].conqueredClasses = uniq(normalized[sideKey].conqueredClasses || []);
    normalized[sideKey].wins = Number(normalized[sideKey].wins || normalized[sideKey].conqueredClasses.length || 0);
  }

  return normalized;
}

function validateSoloGameResultInput(state, result = {}) {
  const normalized = normalizeSoloConquestState(state);
  const gameNo = Number(result.gameNo || normalized.currentGameNo || normalized.games.length + 1);
  const winnerSide = result.winnerSide;
  const sideAClass = String(result.sideAClass || result.side_a_class || '').trim();
  const sideBClass = String(result.sideBClass || result.side_b_class || '').trim();

  if (![SIDE.A, SIDE.B].includes(winnerSide)) {
    throw new Error('winnerSide 必须是 side_a 或 side_b');
  }
  if (!sideAClass) {
    throw new Error('缺少 sideAClass');
  }
  if (!sideBClass) {
    throw new Error('缺少 sideBClass');
  }
  if (normalized.matchStatus === MATCH_STATUS.COMPLETED) {
    throw new Error('整场比赛已结束，不能继续写入小局结果');
  }
  if (gameNo !== normalized.currentGameNo) {
    throw new Error(`当前应录入第 ${normalized.currentGameNo} 局，收到第 ${gameNo} 局`);
  }
  if (!normalized.sideA.availableClasses.includes(sideAClass)) {
    throw new Error(`A方职业不可用：${sideAClass}`);
  }
  if (!normalized.sideB.availableClasses.includes(sideBClass)) {
    throw new Error(`B方职业不可用：${sideBClass}`);
  }

  return {
    gameNo,
    winnerSide,
    sideAClass,
    sideBClass,
    endedAt: result.endedAt || result.ended_at || Date.now(),
    note: result.note || result.internal_note || '',
  };
}

function applySoloGameResult(state, result = {}) {
  const normalized = normalizeSoloConquestState(state);
  const input = validateSoloGameResultInput(normalized, result);
  const next = clone(normalized);

  next.matchStatus = MATCH_STATUS.IN_GAME;

  const winnerNode = input.winnerSide === SIDE.A ? next.sideA : next.sideB;
  const loserNode = input.winnerSide === SIDE.A ? next.sideB : next.sideA;
  const winnerClass = input.winnerSide === SIDE.A ? input.sideAClass : input.sideBClass;
  const loserClass = input.winnerSide === SIDE.A ? input.sideBClass : input.sideAClass;

  winnerNode.availableClasses = winnerNode.availableClasses.filter(cls => cls !== winnerClass);
  if (!winnerNode.conqueredClasses.includes(winnerClass)) {
    winnerNode.conqueredClasses.push(winnerClass);
  }
  winnerNode.wins = winnerNode.conqueredClasses.length;
  loserNode.wins = loserNode.conqueredClasses.length;

  next.games.push({
    gameNo: input.gameNo,
    sideAClass: input.sideAClass,
    sideBClass: input.sideBClass,
    winnerSide: input.winnerSide,
    winnerClass,
    loserClass,
    endedAt: input.endedAt,
    note: input.note,
  });

  const sideAWins = next.sideA.conqueredClasses.length;
  const sideBWins = next.sideB.conqueredClasses.length;

  if (sideAWins >= next.targetWins || sideBWins >= next.targetWins) {
    next.matchStatus = MATCH_STATUS.COMPLETED;
    next.winnerSide = sideAWins >= next.targetWins ? SIDE.A : SIDE.B;
    next.finalScore = `${sideAWins}:${sideBWins}`;
  } else {
    next.currentGameNo = input.gameNo + 1;
    next.finalScore = `${sideAWins}:${sideBWins}`;
  }

  return next;
}

function deriveSoloConquestState(config = {}, gameResults = []) {
  const initial = buildInitialSoloConquestState(config);
  return (gameResults || []).reduce((state, result) => applySoloGameResult(state, result), initial);
}

function getAvailableClassesForSide(state, side) {
  const normalized = normalizeSoloConquestState(state);
  if (side === SIDE.A) return [...normalized.sideA.availableClasses];
  if (side === SIDE.B) return [...normalized.sideB.availableClasses];
  throw new Error('side 必须是 side_a 或 side_b');
}

function buildSoloMatchResultText(state, sideANickname = 'A方', sideBNickname = 'B方') {
  const normalized = normalizeSoloConquestState(state);
  const score = normalized.finalScore || `${normalized.sideA.conqueredClasses.length}:${normalized.sideB.conqueredClasses.length}`;

  if (normalized.matchStatus !== MATCH_STATUS.COMPLETED || !normalized.winnerSide) {
    return `${sideANickname} vs ${sideBNickname} 当前比分 ${score}`;
  }

  const winnerName = normalized.winnerSide === SIDE.A ? sideANickname : sideBNickname;
  const loserName = normalized.winnerSide === SIDE.A ? sideBNickname : sideANickname;
  return `${winnerName} ${score} ${loserName}`;
}

module.exports = {
  MATCH_STATUS,
  SIDE,
  buildInitialSoloConquestState,
  normalizeSoloConquestState,
  validateSoloGameResultInput,
  applySoloGameResult,
  deriveSoloConquestState,
  getAvailableClassesForSide,
  buildSoloMatchResultText,
};
