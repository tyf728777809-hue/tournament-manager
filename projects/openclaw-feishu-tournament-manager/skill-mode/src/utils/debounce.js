/**
 * 防抖工具
 * 
 * 用于比分更新等场景，防止短时间内多次触发
 */

import { logger } from './logger.js';

// 存储防抖状态的 Map
const debounceMap = new Map();

/**
 * 防抖包装器
 * @param {string} key - 防抖键（如 TournamentID + MatchID）
 * @param {Function} fn - 要执行的函数
 * @param {number} delay - 防抖延迟（毫秒）
 * @returns {Promise<any>}
 */
export async function debounce(key, fn, delay = 5000) {
  // 如果已有定时器，清除它
  if (debounceMap.has(key)) {
    const { timer } = debounceMap.get(key);
    clearTimeout(timer);
    logger.debug('debounce', `清除已有定时器: ${key}`);
  }

  // 返回 Promise，在延迟后执行
  return new Promise((resolve, reject) => {
    const timer = setTimeout(async () => {
      try {
        logger.debug('debounce', `执行防抖函数: ${key}`);
        const result = await fn();
        debounceMap.delete(key);
        resolve(result);
      } catch (error) {
        debounceMap.delete(key);
        reject(error);
      }
    }, delay);

    // 存储定时器
    debounceMap.set(key, { timer, startTime: Date.now() });
    logger.debug('debounce', `设置防抖定时器: ${key}, 延迟: ${delay}ms`);
  });
}

/**
 * 带防抖的比分更新处理
 * @param {string} tournamentId - 赛事ID
 * @param {string} matchId - 场次ID
 * @param {Function} updateFn - 更新函数
 */
export async function debouncedScoreUpdate(tournamentId, matchId, updateFn) {
  const key = `score:${tournamentId}:${matchId}`;
  return debounce(key, updateFn, 5000); // 5秒防抖
}

/**
 * 检查是否正在防抖中
 * @param {string} key - 防抖键
 * @returns {boolean}
 */
export function isDebouncing(key) {
  return debounceMap.has(key);
}

/**
 * 获取防抖剩余时间
 * @param {string} key - 防抖键
 * @returns {number} - 剩余毫秒数，0表示不在防抖中
 */
export function getDebounceRemainingTime(key) {
  if (!debounceMap.has(key)) {
    return 0;
  }

  const { startTime } = debounceMap.get(key);
  const elapsed = Date.now() - startTime;
  return Math.max(0, 5000 - elapsed);
}

/**
 * 清除所有防抖定时器
 */
export function clearAllDebounces() {
  for (const [key, { timer }] of debounceMap) {
    clearTimeout(timer);
    logger.debug('debounce', `清除定时器: ${key}`);
  }
  debounceMap.clear();
  logger.info('debounce', '已清除所有防抖定时器');
}
