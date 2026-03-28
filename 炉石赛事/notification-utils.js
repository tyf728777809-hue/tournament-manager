/**
 * 炉石赛事自动化系统 - 消息通知工具函数
 * 版本: v1.1 | 日期: 2026-03-28
 *
 * 本文件实现消息通知相关的工具函数
 * 基于飞书开放平台 IM API
 */

async function httpRequest({ method = 'GET', url, headers = {}, params, data }) {
  const requestUrl = new URL(url);

  if (params) {
    const searchParams = params instanceof URLSearchParams
      ? params
      : new URLSearchParams(Object.entries(params).flatMap(([key, value]) => {
          if (value === undefined || value === null) return [];
          return [[key, typeof value === 'string' ? value : JSON.stringify(value)]];
        }));

    for (const [key, value] of searchParams.entries()) {
      requestUrl.searchParams.append(key, value);
    }
  }

  const response = await fetch(requestUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  const json = await response.json();
  return { data: json, status: response.status };
}

// ============================================
// 1. 基础配置
// ============================================

const CONFIG = {
  baseUrl: 'https://open.feishu.cn/open-apis',
  defaultAdminOpenId: process.env.FEISHU_ADMIN_OPEN_ID || 'ou_914e6141a81eb6da2602875aee631269',
  getAccessToken: async () => process.env.FEISHU_ACCESS_TOKEN,
};

// ============================================
// 2. 基础发送能力
// ============================================

async function sendNotification(openId, message, msgType = 'text') {
  const token = await CONFIG.getAccessToken();

  let content;
  if (msgType === 'text') {
    content = { text: message };
  } else {
    content = message;
  }

  const response = await httpRequest({
    method: 'POST',
    url: `${CONFIG.baseUrl}/im/v1/messages`,
    headers: {
      Authorization: `Bearer ${token}`,
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

async function sendGroupMessage(chatId, message, msgType = 'text') {
  const token = await CONFIG.getAccessToken();

  let content;
  if (msgType === 'text') {
    content = { text: message };
  } else {
    content = message;
  }

  const response = await httpRequest({
    method: 'POST',
    url: `${CONFIG.baseUrl}/im/v1/messages`,
    headers: {
      Authorization: `Bearer ${token}`,
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

async function sendGroupMessageByTournament(tournamentUid, message, bitableUtils) {
  const tournament = await resolveRecordReference(
    bitableUtils.CONFIG.apps.operation,
    bitableUtils.TABLES.tournaments,
    tournamentUid,
    ['tournament_uid'],
    bitableUtils
  );

  const chatId = getFieldValue(tournament, [
    'player_group_chat_id',
    'group_chat_id',
    'tournament_group_chat_id',
  ]);

  if (!chatId) {
    throw new Error('赛事未配置群聊');
  }

  return await sendGroupMessage(chatId, message);
}

// ============================================
// 3. 卡片消息
// ============================================

async function sendCardMessage(openId, card) {
  return await sendNotification(openId, card, 'interactive');
}

async function sendGroupCardMessage(chatId, card) {
  return await sendGroupMessage(chatId, card, 'interactive');
}

function buildMatchResultConfirmationCard({
  tournamentName = '当前赛事',
  matchUid,
  resultReportUid,
  reporterName = '对手',
  opponentName = '你',
  finalResultText = '',
  reporterSide = '',
  note = '',
  deadlineText = '',
} = {}) {
  const extraLines = [];
  if (deadlineText) extraLines.push(`**确认时限：** ${deadlineText}`);
  if (note) extraLines.push(`**备注：** ${note}`);

  return {
    config: { wide_screen_mode: true },
    header: {
      template: 'blue',
      title: {
        tag: 'plain_text',
        content: '🧾 对手赛果确认',
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: [
            `**赛事：** ${tournamentName}`,
            `**对局：** ${reporterName} vs ${opponentName}`,
            `**对手提交结果：** ${finalResultText || '未填写'}`,
            ...extraLines,
          ].join('\n'),
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            type: 'primary',
            text: { tag: 'plain_text', content: '✅ 确认赛果' },
            value: {
              action: 'confirm_match_result_report',
              match_uid: matchUid,
              result_report_uid: resultReportUid,
              reporter_side: reporterSide,
            },
          },
          {
            tag: 'button',
            type: 'danger',
            text: { tag: 'plain_text', content: '❌ 拒绝并发起争议' },
            value: {
              action: 'reject_match_result_report',
              match_uid: matchUid,
              result_report_uid: resultReportUid,
              reporter_side: reporterSide,
            },
          },
        ],
      },
    ],
  };
}

async function sendMatchResultConfirmationCard(openId, payload = {}) {
  return await sendCardMessage(openId, buildMatchResultConfirmationCard(payload));
}

function buildResultReportAdminEscalationCard({
  tournamentName = '当前赛事',
  matchUid,
  resultReportUid,
  sideAName = 'A方',
  sideBName = 'B方',
  finalResultText = '',
  reason = '对手超时未确认',
  disputeUid = '',
} = {}) {
  return {
    config: { wide_screen_mode: true },
    header: {
      template: 'red',
      title: {
        tag: 'plain_text',
        content: '⏰ 赛果待管理员处理',
      },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: [
            `**赛事：** ${tournamentName}`,
            `**对局：** ${sideAName} vs ${sideBName}`,
            `**当前赛果：** ${finalResultText || '未填写'}`,
            `**原因：** ${reason}`,
            disputeUid ? `**关联争议：** ${disputeUid}` : null,
          ].filter(Boolean).join('\n'),
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            type: 'primary',
            text: { tag: 'plain_text', content: '✅ 管理员确认赛果' },
            value: {
              action: 'admin_confirm_match_result_report',
              match_uid: matchUid,
              result_report_uid: resultReportUid,
            },
          },
        ],
      },
    ],
  };
}

async function sendResultReportAdminEscalationCard(openId, payload = {}) {
  return await sendCardMessage(openId, buildResultReportAdminEscalationCard(payload));
}

// ============================================
// 4. 特定场景通知
// ============================================

async function pushDeckSubmissionEntry(entityType, entityUid, tournamentUid, bitableUtils) {
  const tournament = await resolveRecordReference(
    bitableUtils.CONFIG.apps.operation,
    bitableUtils.TABLES.tournaments,
    tournamentUid,
    ['tournament_uid'],
    bitableUtils
  );
  const tournamentName = getFieldValue(tournament, ['tournament_name', 'name']) || '当前赛事';

  if (entityType === 'player') {
    const player = await resolvePlayerRecord(entityUid, bitableUtils);
    const playerOpenId = getFieldValue(player, ['feishu_open_id', 'user_open_id', 'open_id']);
    if (!playerOpenId) {
      throw new Error('选手未配置 feishu_open_id');
    }

    const nickname = getFieldValue(player, ['nickname', 'real_name', 'player_name']) || '选手';
    const card = {
      config: { wide_screen_mode: true },
      header: {
        template: 'orange',
        title: {
          tag: 'plain_text',
          content: '🎴 个人赛卡组提交入口',
        },
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**赛事：** ${tournamentName}\n**选手：** ${nickname}\n**要求：** 提交 4 套不同职业卡组\n**说明：** 审核通过前默认保密`,
          },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              type: 'primary',
              text: { tag: 'plain_text', content: '提交 4 套卡组' },
              value: {
                action: 'open_player_deck_form',
                tournament_uid: tournamentUid,
                entity_type: 'player',
                entity_uid: entityUid,
              },
            },
          ],
        },
      ],
    };

    return await sendCardMessage(playerOpenId, card);
  }

  const team = await resolveTeamRecord(entityUid, bitableUtils);
  const captainUid = getFieldValue(team, ['captain_player_uid', 'captain_uid']);
  const captain = await resolvePlayerRecord(captainUid, bitableUtils);
  const captainOpenId = getFieldValue(captain, ['feishu_open_id', 'user_open_id', 'open_id']);

  if (!captainOpenId) {
    throw new Error('队长未配置 feishu_open_id');
  }

  const teamName = getFieldValue(team, ['team_name', 'name']) || '战队';
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
          content: `**赛事：** ${tournamentName}\n**战队：** ${teamName}\n**要求：** 11 套卡组，覆盖 11 职业\n**说明：** 请由队长统一提交`,
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            type: 'primary',
            text: { tag: 'plain_text', content: '提交 11 套卡组' },
            value: {
              action: 'open_team_deck_form',
              tournament_uid: tournamentUid,
              entity_type: 'team',
              entity_uid: entityUid,
            },
          },
        ],
      },
    ],
  };

  return await sendCardMessage(captainOpenId, card);
}

async function generatePublishConfirmation(submissionId, tournamentUid, bitableUtils, adminOpenId = CONFIG.defaultAdminOpenId) {
  const submission = await resolveRecordReference(
    bitableUtils.CONFIG.apps.deck,
    bitableUtils.TABLES.deckSubmissions,
    submissionId,
    ['deck_submission_uid', 'submission_uid'],
    bitableUtils
  );

  const tournament = await resolveRecordReference(
    bitableUtils.CONFIG.apps.operation,
    bitableUtils.TABLES.tournaments,
    tournamentUid,
    ['tournament_uid'],
    bitableUtils
  );

  const entityType = getFieldValue(submission, ['entity_type']) || 'team';
  const teamUid = getFieldValue(submission, ['team_uid', 'entity_uid']);
  const playerUid = getFieldValue(submission, ['player_uid', 'entity_uid']);
  const entityLabel = entityType === 'player'
    ? getFieldValue(await resolvePlayerRecord(playerUid, bitableUtils), ['nickname', 'real_name', 'player_name']) || '选手'
    : getFieldValue(await resolveTeamRecord(teamUid, bitableUtils), ['team_name', 'name']) || '战队';

  const deckCount = getFieldValue(submission, ['submitted_deck_count', 'deck_count']) || (entityType === 'player' ? 4 : 11);
  const entityTitle = entityType === 'player' ? '选手' : '战队';

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
          content: `**赛事：** ${getFieldValue(tournament, ['tournament_name', 'name']) || tournamentUid}\n**${entityTitle}：** ${entityLabel}\n**套数：** ${deckCount} 套`,
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
              submission_ids: [getFieldValue(submission, ['deck_submission_uid', 'submission_uid']) || submissionId],
            },
          },
          {
            tag: 'button',
            type: 'default',
            text: { tag: 'plain_text', content: '✏️ 修改后再发' },
            value: {
              action: 'revise_publish_draft',
              tournament_uid: tournamentUid,
              submission_id: getFieldValue(submission, ['deck_submission_uid', 'submission_uid']) || submissionId,
            },
          },
        ],
      },
    ],
  };

  return await sendCardMessage(adminOpenId, card);
}

async function createAnnouncement(tournamentUid, announcement, bitableUtils) {
  return await bitableUtils.createRecord(
    bitableUtils.CONFIG.apps.deck,
    bitableUtils.TABLES.announcements,
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
}

async function notifyDisputeParties(disputeId, title, content, bitableUtils) {
  const dispute = await resolveRecordReference(
    bitableUtils.CONFIG.apps.operation,
    bitableUtils.TABLES.disputes,
    disputeId,
    ['dispute_uid'],
    bitableUtils
  );

  const directOpenId = getFieldValue(dispute, ['submitted_by_open_id']);
  const internalNote = String(getFieldValue(dispute, ['internal_note']) || '');
  const reporterUid = (internalNote.match(/reporter_uid=([^;]+)/) || [])[1] || '';
  const rejectorUid = (internalNote.match(/rejector_uid=([^;]+)/) || [])[1] || '';

  const reporter = reporterUid ? await resolvePlayerRecord(reporterUid, bitableUtils) : null;
  const rejector = rejectorUid ? await resolvePlayerRecord(rejectorUid, bitableUtils) : null;

  const message = `${title}\n\n${content}`;
  const targets = [...new Set([
    directOpenId,
    getFieldValue(reporter, ['feishu_open_id', 'user_open_id', 'open_id']),
    getFieldValue(rejector, ['feishu_open_id', 'user_open_id', 'open_id']),
  ].filter(Boolean))];

  const results = await Promise.all(
    targets.map(openId => sendNotification(openId, message).catch(error => ({ success: false, error: error.message })))
  );

  return results;
}

async function notifyAdmin(message, adminOpenId = CONFIG.defaultAdminOpenId) {
  return await sendNotification(adminOpenId, `⚠️ 系统通知\n\n${message}`);
}

// ============================================
// 5. 辅助函数
// ============================================

function getFieldValue(record, candidateFields = []) {
  if (!record?.fields) {
    return undefined;
  }

  for (const fieldName of candidateFields) {
    const value = record.fields[fieldName];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

async function resolveRecordReference(appToken, tableId, idOrUid, candidateFields = [], bitableUtils) {
  if (!idOrUid) {
    return null;
  }

  try {
    const record = await bitableUtils.getRecord(appToken, tableId, idOrUid);
    if (record) {
      return record;
    }
  } catch (error) {
    // ignore and fallback to field lookup
  }

  for (const fieldName of candidateFields) {
    const records = await bitableUtils.queryRecord(appToken, tableId, {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: fieldName, operator: 'is', value: [idOrUid] },
        ],
      },
      pageSize: 1,
    });

    if (records?.length) {
      return records[0];
    }
  }

  return null;
}

async function resolvePlayerRecord(playerIdOrUid, bitableUtils) {
  return await resolveRecordReference(
    bitableUtils.CONFIG.apps.basic,
    bitableUtils.TABLES.players,
    playerIdOrUid,
    ['player_uid'],
    bitableUtils
  );
}

async function resolveTeamRecord(teamIdOrUid, bitableUtils) {
  return await resolveRecordReference(
    bitableUtils.CONFIG.apps.basic,
    bitableUtils.TABLES.teams,
    teamIdOrUid,
    ['team_uid'],
    bitableUtils
  );
}

// ============================================
// 6. 导出
// ============================================

module.exports = {
  sendNotification,
  batchSendNotification,
  sendGroupMessage,
  sendGroupMessageByTournament,
  sendCardMessage,
  sendGroupCardMessage,
  sendMatchResultConfirmationCard,
  sendResultReportAdminEscalationCard,
  pushDeckSubmissionEntry,
  generatePublishConfirmation,
  createAnnouncement,
  notifyDisputeParties,
  notifyAdmin,
};
