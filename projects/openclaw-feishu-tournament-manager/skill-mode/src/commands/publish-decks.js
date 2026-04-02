/**
 * 公示卡组 - Skill 模式
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID } from '../config/tables.js';
import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';
import { sendDeckPublication } from '../messaging/report-message.js';

/**
 * 归一化富文本字段
 */
function normalizeField(value) {
  if (Array.isArray(value) && value.length > 0 && value[0].text !== undefined) {
    return value[0].text;
  }
  return value;
}

/**
 * 按战队分组
 */
function groupValidDecksByTeam(records) {
  const grouped = new Map();

  for (const record of records) {
    const teamId = normalizeField(record.fields.所属战队ID);
    if (!teamId) {
      continue;
    }

    const current = grouped.get(teamId) || [];
    current.push(record);
    grouped.set(teamId, current);
  }

  return grouped;
}

/**
 * 渲染公示摘要
 */
function renderPublicSummary(records) {
  const lines = records.map((record) => {
    const version = record.fields.版本号 || '-';
    const status = normalizeField(record.fields.审核状态) || '未知';
    const teamId = normalizeField(record.fields.所属战队ID) || 'UNKNOWN_TEAM';
    return `- ${teamId}｜版本 v${version}｜${status}`;
  });

  return ['【卡组公示】', ...lines].join('\n');
}

/**
 * 公示卡组
 */
export async function publishDecks({ operatorOpenId }) {
  // 1. 验证管理员权限
  const auth = await assertAdminAccess({
    operatorOpenId,
    tournamentId: TOURNAMENT_ID,
  });

  if (!auth.ok) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message,
    });
    return auth;
  }

  // 2. 查询赛事配置和卡组数据
  const [tournamentResult, deckResult] = await Promise.all([
    feishu_bitable_app_table_record({
      action: 'list',
      app_token: APP_TOKEN,
      table_id: TABLES.tournamentConfig,
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
        ],
      },
    }),
    feishu_bitable_app_table_record({
      action: 'list',
      app_token: APP_TOKEN,
      table_id: TABLES.deckSubmission,
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
        ],
      },
    }),
  ]);

  if (!tournamentResult || !deckResult) {
    return {
      ok: false,
      message: '读取赛事配置或卡组数据失败。',
    };
  }

  // 3. 检查赛事配置
  const tournamentRecord = tournamentResult.records?.[0];
  if (!tournamentRecord) {
    return {
      ok: false,
      message: '未找到赛事配置记录。',
    };
  }

  if (tournamentRecord.fields['公示开关'] !== true) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: '公示开关未开启',
    });
    return {
      ok: false,
      message: '当前未开启卡组公示，请先确认赛事配置中的公示开关。',
    };
  }

  // 4. 检查待审核记录
  const deckRecords = deckResult.records || [];
  const pendingRecords = deckRecords.filter((record) => {
    const status = normalizeField(record.fields.审核状态);
    return status === '待审核';
  });

  if (pendingRecords.length > 0) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: `仍有 ${pendingRecords.length} 条待审核记录`,
    });
    return {
      ok: false,
      message: '当前仍有队伍卡组处于待审核状态，暂不能公示。',
    };
  }

  // 5. 筛选有效卡组
  const validRecords = deckRecords.filter((record) => {
    const status = normalizeField(record.fields.审核状态);
    const isValid = record.fields['是否当前有效版本'] === true;
    return status === '已通过' && isValid;
  });

  if (validRecords.length === 0) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: '无可公示卡组',
    });
    return {
      ok: false,
      message: '当前暂无可公示的卡组版本，请先确认审核状态。',
    };
  }

  // 6. 检查重复版本
  const grouped = groupValidDecksByTeam(validRecords);
  const duplicatedTeams = [...grouped.entries()].filter(([, records]) => records.length > 1);
  if (duplicatedTeams.length > 0) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: `存在 ${duplicatedTeams.length} 支战队拥有多个有效版本`,
    });
    return {
      ok: false,
      message: '检测到同一战队存在多个当前有效版本，请先整理卡组版本后再公示。',
    };
  }

  // 7. 更新卡组状态为已公示
  const updateResults = await Promise.all(
    validRecords.map((record) =>
      feishu_bitable_app_table_record({
        action: 'update',
        app_token: APP_TOKEN,
        table_id: TABLES.deckSubmission,
        record_id: record.record_id,
        fields: {
          '是否已公示': true,
          '审核状态': '已公示',
        },
      })
    )
  );

  const failedUpdate = updateResults.find((item) => !item);
  if (failedUpdate) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: '更新卡组公示状态失败',
    });
    return {
      ok: false,
      message: '卡组状态更新失败，请稍后重试。',
    };
  }

  // 8. 生成公示摘要
  const summary = renderPublicSummary(validRecords);

  await writeAuditLog({
    tournamentId: TOURNAMENT_ID,
    actionType: '公示卡组',
    targetType: '系统',
    operator: operatorOpenId,
    after: JSON.stringify({ publishedCount: validRecords.length }),
    result: '成功',
  });

  // 9. 发送卡组公示到群聊
  const messageResult = await sendDeckPublication({
    deckCount: validRecords.length,
    decks: validRecords,
  });

  if (!messageResult.ok) {
    console.error('[PublishDecks] 发送卡组公示失败:', messageResult.message);
  }

  return {
    ok: true,
    message: `卡组已公示，共 ${validRecords.length} 套卡组。`,
    publicText: summary,
    messageSent: messageResult.ok,
  };
}
