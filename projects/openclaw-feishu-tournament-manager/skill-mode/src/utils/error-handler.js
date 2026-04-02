/**
 * 错误处理工具
 */

import { logger } from './logger.js';

/**
 * 重试包装器
 * @param {Function} fn - 要执行的函数
 * @param {Object} options - { maxRetries, retryDelay, context }
 * @returns {Promise<any>}
 */
export async function withRetry(fn, options = {}) {
  const { maxRetries = 3, retryDelay = 1000, context = 'unknown' } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('retry', `Attempt ${attempt}/${maxRetries}`, { context });
      const result = await fn();
      logger.debug('retry', `Success on attempt ${attempt}`, { context });
      return result;
    } catch (error) {
      lastError = error;
      logger.warn('retry', `Failed on attempt ${attempt}`, { 
        context, 
        error: error.message,
        willRetry: attempt < maxRetries 
      });
      
      if (attempt < maxRetries) {
        await sleep(retryDelay * attempt); // 指数退避
      }
    }
  }
  
  logger.error('retry', `All ${maxRetries} attempts failed`, lastError);
  throw lastError;
}

/**
 * 安全执行包装器
 * @param {Function} fn - 要执行的函数
 * @param {Object} options - { defaultValue, context }
 * @returns {Promise<any>}
 */
export async function safeExecute(fn, options = {}) {
  const { defaultValue = null, context = 'unknown' } = options;
  
  try {
    return await fn();
  } catch (error) {
    logger.error('safeExecute', `Execution failed in ${context}`, error);
    return defaultValue;
  }
}

/**
 * Bitable 操作包装器
 * @param {Function} operation - Bitable 操作函数
 * @param {string} context - 操作上下文
 */
export async function withBitableErrorHandling(operation, context) {
  try {
    const result = await operation();
    
    // 检查飞书 API 返回的错误码
    if (result && result.code !== undefined && result.code !== 0) {
      throw new Error(`Bitable API error: ${result.msg} (code: ${result.code})`);
    }
    
    return result;
  } catch (error) {
    logger.error('bitable', `Operation failed: ${context}`, error);
    
    // 分类错误
    if (error.message.includes('91403')) {
      throw new Error('权限不足：请检查应用是否具有该操作权限');
    } else if (error.message.includes('1254045')) {
      throw new Error('字段不存在：请检查字段名是否正确');
    } else if (error.message.includes('1254064')) {
      throw new Error('日期格式错误：请使用毫秒时间戳');
    } else {
      throw error;
    }
  }
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 验证必需参数
 * @param {Object} params - 参数对象
 * @param {Array<string>} required - 必需参数列表
 */
export function validateParams(params, required) {
  const missing = required.filter(key => !params[key]);
  if (missing.length > 0) {
    throw new Error(`缺少必需参数: ${missing.join(', ')}`);
  }
}
