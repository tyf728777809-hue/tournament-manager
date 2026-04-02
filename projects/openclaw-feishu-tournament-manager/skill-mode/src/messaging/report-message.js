/**
 * 战报消息 - Skill 模式
 */

import { CHAT_ID } from '../config/tables.js';

/**
 * 发送战报消息
 * @param {Object} params - { matchIndex, teamA, teamB, scoreA, scoreB, details }
 * @returns {Promise<Object>}
 */
export async function sendReportMessage({ matchIndex, teamA, teamB, scoreA, scoreB, details }) {
  const cardContent = {
    config: {
      wide_screen_mode: true,
    },
    header: {
      title: {
        tag: 'plain_text',
        content: `第 ${matchIndex} 场战报`,
      },
      template: 'green',
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**对阵结果**\n${teamA} ${scoreA} : ${scoreB} ${teamB}`,
        },
      },
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**小局记录**\n${details || '暂无'}`,
        },
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
      message: `战报已发送到群聊`,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: `发送战报失败: ${error.message}`,
    };
  }
}

/**
 * 发送卡组公示消息
 * @param {Object} params - { deckCount, decks }
 */
export async function sendDeckPublication({ deckCount, decks }) {
  const deckList = decks.map((deck) => {
    const teamId = deck.fields.所属战队ID?.[0]?.text || '未知战队';
    const version = deck.fields.版本号 || '-';
    return `- ${teamId} 版本 v${version}`;
  }).join('\n');

  const content = {
    text: `【卡组公示】\n\n本次公示共 ${deckCount} 套卡组：\n\n${deckList}`,
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
      message: `卡组公示已发送`,
      data: result,
    };
  } catch (error) {
    return {
      ok: false,
      message: `发送卡组公示失败: ${error.message}`,
    };
  }
}
