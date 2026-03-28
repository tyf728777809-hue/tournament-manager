/**
 * 炉石赛事自动化系统 - 消息通知工具函数
 * 版本: v1.0 | 日期: 2026-03-28
 * 
 * 本文件实现消息通知相关的工具函数
 * 基于飞书开放平台 IM API
 */

const axios = require('axios');

// ============================================
// 1. 基础配置
// ============================================

const CONFIG = {
  baseUrl: 'https://open.feishu.cn/open-apis',
  getAccessToken: async () => {
    return process.env.FEISHU_ACCESS_TOKEN;
  },
};

// ============================================
// 2. 私聊通知
// ============================================

/**
 * 发送私聊通知给指定用户
 * @param {string} openId - 用户 open_id
 * @param {string} message - 消息内容
 * @param {string} msgType - 消息类型：text / interactive
 * @returns {Promise<Object>} 发送结果
 */
async function sendNotification(openId, message, msgType = 'text') {
  const token = await CONFIG.getAccessToken();
  
  let content;
  if (msgType === 'text') {
    content = { text: message };
  } else {
    content = message; // 假设已经是卡片 JSON
  }
  
  const response = await axios({
    method: 'POST',
    url: `${CONFIG.baseUrl}/im/v1/messages`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    params: {
      receive_id_type: 'open_id',
    },
    data: {
      receive_id: openId,
      msg_type: msgType,
      content: JSON.stringify(content),
    },
  });
  
  if (response.data.code !== 0) {
    throw new Error(`Send notification failed: ${response.data.msg}`);
  }
  
  return {
    success: true,
    messageId: response.data.data.message_id,
  };
}

/**
 * 批量发送私聊通知
 * @param {Array<string>} openIds - 用户 open_id 列表
 * @param {string} message - 消息内容
 * @returns {Promise<Array>} 发送结果列表
 */
async function batchSendNotification(openIds, message) {
  const results = [];
  
  for (const openId of openIds) {
    try {
      const result = await sendNotification(openId, message);
      results.push({ openId, success: true, messageId: result.messageId });
    } catch (error) {
      results.push({ openId, success: false, error: error.message });
    }
  }
  
  return results;
}

// ============================================
// 3. 群消息
// ============================================

/**
 * 发送群消息
 * @param {string} chatId - 群 chat_id
 * @param {string} message - 消息内容
 * @param {string} msgType - 消息类型：text / interactive
 * @returns {Promise<Object>} 发送结果
 */
async function sendGroupMessage(chatId, message, msgType = 'text') {
  const token = await CONFIG.getAccessToken();
  
  let content;
  if (msgType === 'text') {
    content = { text: message };
  } else {
    content = message;
  }
  
  const response = await axios({
    method: 'POST',
    url: `${CONFIG.baseUrl}/im/v1/messages`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    params: {
      receive_id_type: 'chat_id',
    },
    data: {
      receive_id: chatId,
      msg_type: msgType,
      content: JSON.stringify(content),
    },
  });
  
  if (response.data.code !== 0) {
    throw new Error(`Send group message failed: ${response.data.msg}`);
  }
  
  return {
    success: true,
    messageId: response.data.data.message_id,
  };
}

/**
 * 根据 tournament_uid 获取群 ID 并发送消息
 * @param {string} tournamentUid - 赛事 UID
 * @param {string} message - 消息内容
 * @param {Object} bitableUtils - 多维表格工具函数
 */
async function sendGroupMessageByTournament(tournamentUid, message, bitableUtils) {
  // 查询赛事配置获取群 ID
  const { CONFIG: BITABLE_CONFIG, TABLES } = require('./bitable-api-utils');
  
  const tournament = await bitableUtils.getRecord(
    BITABLE_CONFIG.apps.operation,
    TABLES.tournaments,
    tournamentUid
  );
  
  if (!tournament || !tournament.fields.player_group_chat_id) {
    throw new Error('赛事未配置群聊');
  }
  
  const chatId = tournament.fields.player_group_chat_id;
  return await sendGroupMessage(chatId, message);
}

// ============================================
// 4. 卡片消息
// ============================================

/**
 * 发送交互卡片消息（私聊）
 * @param {string} openId - 用户 open_id
 * @param {Object} card - 卡片 JSON 对象
 * @returns {Promise<Object>} 发送结果
 */
async function sendCardMessage(openId, card) {
  return await sendNotification(openId, card, 'interactive');
}

/**
 * 发送交互卡片消息（群聊）
 * @param {string} chatId - 群 chat_id
 * @param {Object} card - 卡片 JSON 对象
 * @returns {Promise<Object>} 发送结果
 */
async function sendGroupCardMessage(chatId, card) {
  return await sendGroupMessage(chatId, card, 'interactive');
}

// ============================================
// 5. 特定场景通知
// ============================================

/**
 * 推送卡组提交入口
 * @param {string} entityUid - 实体 UID（战队/个人）
 * @param {string} tournamentUid - 赛事 UID
 * @param {Object} bitableUtils - 多维表格工具
 */
async function pushDeckSubmissionEntry(entityUid, tournamentUid, bitableUtils) {
  const { CONFIG: BITABLE_CONFIG, TABLES, getRecord } = bitableUtils;
  
  // 查询实体信息
  const entity = await getRecord(
    BITABLE_CONFIG.apps.basic,
    TABLES.teams,
    entityUid
  );
  
  if (!entity) {
    throw new Error('实体不存在');
  }
  
  // 查询队长信息
  const captain = await getRecord(
    BITABLE_CONFIG.apps.basic,
    TABLES.players,
    entity.fields.captain_player_uid
  );
  
  if (!captain) {
    throw new Error('队长信息不存在');
  }
  
  // 构建卡片
  const card = {
    config: { wide_screen_mode: true },
    header: {
      template: 'orange',
      title: {
        tag: 'plain_text',
        content: '🎴 战队卡组提交入口',
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**战队：** ${entity.fields.team_name}\n**要求：** 11套卡组，覆盖11职业\n**说明：** 请由队长统一提交`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            type: 'primary',
            text: { tag: 'plain_text', content: '提交11套卡组' },
            value: {
              action: 'open_team_deck_form',
              tournament_uid: tournamentUid,
              entity_uid: entityUid,
            },
          },
        ],
      },
    ],
  };
  
  // 发送给队长
  return await sendCardMessage(captain.fields.feishu_open_id, card);
}

/**
 * 生成公示确认通知
 * @param {string} submissionId - 卡组提交 ID
 * @param {string} tournamentUid - 赛事 UID
 * @param {Object} bitableUtils - 多维表格工具
 */
async function generatePublishConfirmation(submissionId, tournamentUid, bitableUtils) {
  const { CONFIG: BITABLE_CONFIG, TABLES, getRecord, queryRecord } = bitableUtils;
  
  // 查询卡组提交信息
  const submission = await getRecord(
    BITABLE_CONFIG.apps.deck,
    TABLES.deckSubmissions,
    submissionId
  );
  
  // 查询战队信息
  const team = await getRecord(
    BITABLE_CONFIG.apps.basic,
    TABLES.teams,
    submission.fields.team_uid
  );
  
  // 查询赛事信息
  const tournament = await getRecord(
    BITABLE_CONFIG.apps.operation,
    TABLES.tournaments,
    tournamentUid
  );
  
  // 构建确认卡片（发送给管理员）
  const card = {
    config: { wide_screen_mode: true },
    header: {
      template: 'purple',
      title: {
        tag: 'plain_text',
        content: '📢 卡组公示确认',
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**赛事：** ${tournament.fields.tournament_name}\n**战队：** ${team.fields.team_name}\n**套数：** ${submission.fields.submitted_deck_count}套`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            type: 'primary',
            text: { tag: 'plain_text', content: '✅ 确认发布' },
            value: {
              action: 'publish_decks',
              tournament_uid: tournamentUid,
              submission_ids: [submissionId],
            },
          },
          {
            tag: 'button',
            type: 'default',
            text: { tag: 'plain_text', content: '✏️ 修改后再发' },
            value: {
              action: 'revise_publish_draft',
              tournament_uid: tournamentUid,
              submission_id: submissionId,
            },
          },
        ],
      },
    ],
  };
  
  // 发送给管理员
  const { CONFIG } = require('./callback-handler-skeleton');
  return await sendCardMessage(CONFIG.admin.openId, card);
}

/**
 * 创建公告
 * @param {string} tournamentUid - 赛事 UID
 * @param {Object} announcement - 公告内容
 * @param {Object} bitableUtils - 多维表格工具
 */
async function createAnnouncement(tournamentUid, announcement, bitableUtils) {
  const { CONFIG: BITABLE_CONFIG, TABLES, createRecord } = bitableUtils;
  
  const record = await createRecord(
    BITABLE_CONFIG.apps.deck,
    TABLES.announcements,
    {
      tournament_uid: tournamentUid,
      announcement_type: announcement.type,
      title: announcement.title,
      content: announcement.content,
      published_by: announcement.published_by,
      published_at: announcement.published_at,
      status: 'published',
    }
  );
  
  return record;
}

/**
 * 通知争议双方
 * @param {string} disputeId - 争议 ID
 * @param {string} title - 通知标题
 * @param {string} content - 通知内容
 * @param {Object} bitableUtils - 多维表格工具
 */
async function notifyDisputeParties(disputeId, title, content, bitableUtils) {
  const { CONFIG: BITABLE_CONFIG, TABLES, getRecord } = bitableUtils;
  
  // 查询争议信息
  const dispute = await getRecord(
    BITABLE_CONFIG.apps.operation,
    TABLES.disputes,
    disputeId
  );
  
  // 查询双方选手信息
  const plaintiff = await getRecord(
    BITABLE_CONFIG.apps.basic,
    TABLES.players,
    dispute.fields.plaintiff_player_uid
  );
  
  const defendant = await getRecord(
    BITABLE_CONFIG.apps.basic,
    TABLES.players,
    dispute.fields.defendant_player_uid
  );
  
  // 发送通知
  const message = `**${title}**\n\n${content}`;
  
  const results = await Promise.all([
    sendNotification(plaintiff.fields.feishu_open_id, message).catch(e => ({ success: false, error: e.message })),
    sendNotification(defendant.fields.feishu_open_id, message).catch(e => ({ success: false, error: e.message })),
  ]);
  
  return {
    plaintiff: results[0],
    defendant: results[1],
  };
}

/**
 * 通知管理员
 * @param {string} message - 通知内容
 */
async function notifyAdmin(message) {
  const { CONFIG } = require('./callback-handler-skeleton');
  return await sendNotification(CONFIG.admin.openId, `⚠️ 系统通知\n\n${message}`);
}

// ============================================
// 6. 导出
// ============================================

module.exports = {
  // 基础发送
  sendNotification,
  batchSendNotification,
  sendGroupMessage,
  sendGroupMessageByTournament,
  
  // 卡片消息
  sendCardMessage,
  sendGroupCardMessage,
  
  // 场景通知
  pushDeckSubmissionEntry,
  generatePublishConfirmation,
  createAnnouncement,
  notifyDisputeParties,
  notifyAdmin,
};
