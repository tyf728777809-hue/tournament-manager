import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';

function findTournamentRecord(records, tournamentId) {
  return records.find((record) => record.fields.TournamentID === tournamentId) || null;
}

function groupValidDecksByTeam(records) {
  const grouped = new Map();

  for (const record of records) {
    const teamId = record.fields.TeamID;
    if (!teamId) {
      continue;
    }

    const current = grouped.get(teamId) || [];
    current.push(record);
    grouped.set(teamId, current);
  }

  return grouped;
}

function renderPublicSummary(records) {
  const lines = records.map((record) => {
    const version = record.fields.版本号 || '-';
    const status = record.fields.审核状态 || '未知';
    const teamId = record.fields.TeamID || 'UNKNOWN_TEAM';
    return `- ${teamId}｜版本 v${version}｜${status}`;
  });

  return ['【卡组公示】', ...lines].join('\n');
}

export async function publishDecks({ context, bitable, payload = {} }) {
  const operatorOpenId = payload.operatorOpenId;
  const auth = await assertAdminAccess({
    bitable,
    tournamentId: context.tournamentId,
    operatorOpenId
  });

  if (!auth.ok) {
    await writeAuditLog({
      bitable,
      tournamentId: context.tournamentId,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message
    });
    return auth;
  }

  const [tournamentResult, deckResult] = await Promise.all([
    bitable.listRecords('tournamentConfig', (record) => record.fields.TournamentID === context.tournamentId),
    bitable.listRecords('deckSubmission', (record) => record.fields.TournamentID === context.tournamentId)
  ]);

  if (!tournamentResult.ok || !deckResult.ok) {
    return {
      ok: false,
      message: '读取赛事配置或卡组数据失败。'
    };
  }

  const tournamentRecord = findTournamentRecord(tournamentResult.records, context.tournamentId);
  if (!tournamentRecord) {
    return {
      ok: false,
      message: '未找到赛事配置记录。'
    };
  }

  if (tournamentRecord.fields.公示开关 !== true) {
    await writeAuditLog({
      bitable,
      tournamentId: context.tournamentId,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: '公示开关未开启'
    });
    return {
      ok: false,
      message: '当前未开启卡组公示，请先确认赛事配置中的公示开关。'
    };
  }

  const pendingRecords = deckResult.records.filter((record) => record.fields.审核状态 === '待审核');
  if (pendingRecords.length > 0) {
    await writeAuditLog({
      bitable,
      tournamentId: context.tournamentId,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: `仍有 ${pendingRecords.length} 条待审核记录`
    });
    return {
      ok: false,
      message: '当前仍有队伍卡组处于待审核状态，暂不能公示。'
    };
  }

  const validRecords = deckResult.records.filter((record) => {
    return record.fields.审核状态 === '通过'
      && record.fields.是否当前有效版本 === true;
  });

  if (validRecords.length === 0) {
    await writeAuditLog({
      bitable,
      tournamentId: context.tournamentId,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: '无可公示卡组'
    });
    return {
      ok: false,
      message: '当前暂无可公示的卡组版本，请先确认审核状态。'
    };
  }

  const grouped = groupValidDecksByTeam(validRecords);
  const duplicatedTeams = [...grouped.entries()].filter(([, records]) => records.length > 1);
  if (duplicatedTeams.length > 0) {
    await writeAuditLog({
      bitable,
      tournamentId: context.tournamentId,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: `存在 ${duplicatedTeams.length} 支战队拥有多个有效版本`
    });
    return {
      ok: false,
      message: '检测到同一战队存在多个当前有效版本，请先整理卡组版本后再公示。'
    };
  }

  const updateResults = await Promise.all(validRecords.map((record) => {
    const nextStatus = record.fields.审核状态 === '已公示' ? '已公示' : '已公示';
    return bitable.updateRecord('deckSubmission', record.recordId, {
      是否已公示: true,
      审核状态: nextStatus
    });
  }));

  const failedUpdate = updateResults.find((item) => !item.ok);
  if (failedUpdate) {
    await writeAuditLog({
      bitable,
      tournamentId: context.tournamentId,
      actionType: '公示卡组',
      targetType: '系统',
      operator: operatorOpenId,
      result: '失败',
      error: failedUpdate.message || '更新卡组公示状态失败'
    });
    return {
      ok: false,
      message: '卡组状态更新失败，请稍后重试。'
    };
  }

  const summary = renderPublicSummary(validRecords);

  await writeAuditLog({
    bitable,
    tournamentId: context.tournamentId,
    actionType: '公示卡组',
    targetType: '系统',
    operator: operatorOpenId,
    before: JSON.stringify({ publishedCount: 0 }),
    after: JSON.stringify({ publishedCount: validRecords.length }),
    result: '成功'
  });

  return {
    ok: true,
    message: '卡组已公示。',
    publicText: summary,
    records: updateResults.map((item) => item.record)
  };
}
