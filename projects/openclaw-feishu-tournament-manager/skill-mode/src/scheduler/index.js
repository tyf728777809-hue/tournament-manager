/**
 * 定时任务调度器
 * 
 * 管理所有定时任务：
 * - 首场签到自动开启
 * - 签到超时提醒
 * - 其他定时任务
 */

import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { checkAndTriggerFirstMatchCheckin } from './checkin-jobs.js';
import { checkCheckinTimeout } from './reminder-jobs.js';

// 存储所有定时任务
const jobs = [];

/**
 * 初始化定时任务
 */
export function initScheduler() {
  logger.info('scheduler', '初始化定时任务调度器');

  // 任务1：每分钟检查首场签到
  // 格式：秒 分 时 日 月 周
  const firstCheckinJob = cron.schedule('* * * * *', async () => {
    logger.debug('scheduler', '执行首场签到检查');
    try {
      await checkAndTriggerFirstMatchCheckin();
    } catch (error) {
      logger.error('scheduler', '首场签到检查失败', error);
    }
  });
  jobs.push(firstCheckinJob);

  // 任务2：每5分钟检查签到超时
  const timeoutCheckJob = cron.schedule('*/5 * * * *', async () => {
    logger.debug('scheduler', '执行签到超时检查');
    try {
      await checkCheckinTimeout();
    } catch (error) {
      logger.error('scheduler', '签到超时检查失败', error);
    }
  });
  jobs.push(timeoutCheckJob);

  logger.info('scheduler', `已启动 ${jobs.length} 个定时任务`);
}

/**
 * 停止所有定时任务
 */
export function stopScheduler() {
  logger.info('scheduler', '停止所有定时任务');
  jobs.forEach(job => job.stop());
  jobs.length = 0;
}

/**
 * 获取定时任务状态
 */
export function getSchedulerStatus() {
  return {
    running: jobs.length > 0,
    jobCount: jobs.length,
  };
}
