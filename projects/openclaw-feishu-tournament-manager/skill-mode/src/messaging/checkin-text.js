/**
 * 纯文本签到消息 - Skill 模式
 */

import { CHAT_ID } from '../config/tables.js';

/**
 * 发送纯文本签到通知
 * @param {Object} params - { matchIndex, teamA, teamB, captainA, captainB }
 */
export async function sendCheckinText({ matchIndex, teamA, teamB, captainA, captainB }) {
  const mentions = [];
  if (captainA) mentions.push(`<at id="${captainA}"></at>`);
  if (captainB && captainB !== captainA) mentions.push(`<at id="${captainB}"></at>`);

  const text = `【第 ${matchIndex} 场签到】

对阵：${teamA} vs ${teamB}

队长：${mentions.join(' ')}

请回复"签到"完成签到

⏰ 签到截止时间：10分钟后`;

  try {
    const result = await message({
      action: 'send',
      channel: 'feishu',
      accountId: 'hs-esports',
      target: `chat:${CHAT_ID}`,
      message: text,
    });

    return {
      ok: true,
      message: `签到通知已发送到群聊`,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: `发送签到通知失败: ${error.message}`,
    };
  }
}

/**
 * 发送签到确认消息
 * @param {Object} params - { teamName, captainName }
 */
export async function sendCheckinConfirmation({ teamName, captainName }) {
  const text = `✅ ${teamName} 已完成签到`;

  try {
    const result = await message({
      action: 'send',
      channel: 'feishu',
      accountId: 'hs-esports',
      target: `chat:${CHAT_ID}`,
      message: text,
    });

    return {
      ok: true,
      message: `签到确认已发送`,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: `发送签到确认失败: ${error.message}`,
    };
  }
}

/**
 * 发送签到超时提醒
 * @param {Object} params - { matchIndex, teamName }
 */
export async function sendCheckinTimeout({ matchIndex, teamName }) {
  const text = `⚠️ 第 ${matchIndex} 场签到超时

${teamName} 未在规定时间内完成签到，请尽快联系管理员。`;

  try {
    const result = await message({
      action: 'send',
      channel: 'feishu',
      accountId: 'hs-esports',
      target: `chat:${CHAT_ID}`,
      message: text,
    });

    return {
      ok: true,
      message: `超时提醒已发送`,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: `发送超时提醒失败: ${error.message}`,
    };
  }
}
