/**
 * 签到卡片消息 - Skill 模式
 */

import { CHAT_ID } from '../config/tables.js';

/**
 * 发送签到卡片
 * @param {Object} params - { matchIndex, teamA, teamB, captainA, captainB }
 * @returns {Promise<Object>}
 */
export async function sendCheckinCard({ matchIndex, teamA, teamB, captainA, captainB }) {
  const cardContent = {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: `第 ${matchIndex} 场签到`,
      },
      template: 'blue',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**对阵双方**\n${teamA} vs ${teamB}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**队长**\n<at id="${captainA}"></at> <at id="${captainB}"></at>`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: {
              tag: 'plain_text',
              content: '确认签到',
            },
            type: 'primary',
            value: {
              action: 'checkin',
              matchIndex,
            },
          },
        ],
      },
    ],
  };

  try {
    const result = await feishu_im_user_message({
      action: 'send',
      msg_type: 'interactive',
      receive_id_type: 'chat_id',
      receive_id: CHAT_ID,
      content: JSON.stringify(cardContent),
    });

    return {
      ok: true,
      message: `签到卡片已发送到群聊`,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: `发送签到卡片失败: ${error.message}`,
    };
  }
}

/**
 * 发送签到提醒（纯文本）
 * @param {Object} params - { matchIndex, teamA, teamB, captainA, captainB }
 */
export async function sendCheckinReminder({ matchIndex, teamA, teamB, captainA, captainB }) {
  const content = {
    text: `【第 ${matchIndex} 场签到】\n\n对阵：${teamA} vs ${teamB}\n\n<at id="${captainA}"></at> <at id="${captainB}"></at> 请确认签到`,
  };

  try {
    const result = await feishu_im_user_message({
      action: 'send',
      msg_type: 'text',
      receive_id_type: 'chat_id',
      receive_id: CHAT_ID,
      content: JSON.stringify(content),
    });

    return {
      ok: true,
      message: `签到提醒已发送`,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: `发送签到提醒失败: ${error.message}`,
    };
  }
}
