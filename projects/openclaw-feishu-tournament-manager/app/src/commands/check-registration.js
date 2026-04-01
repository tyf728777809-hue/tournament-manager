import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';

function groupByTeam(teams, players) {
  return teams.map((team) => {
    const members = players.filter((player) => player.fields.所属战队 === team.fields.TeamID);
    const incompleteMembers = members.filter((player) => player.fields.档案状态 !== '已完成');
    return {
      teamId: team.fields.TeamID,
      teamName: team.fields.战队名称,
      captainOpenId: team.fields['队长飞书 UserID'],
      members,
      incompleteMembers
    };
  });
}

function renderReminderSummary(groupedTeams) {
  const lines = [];

  for (const team of groupedTeams) {
    if (team.incompleteMembers.length === 0) {
      continue;
    }

    const memberNames = team.incompleteMembers
      .map((player) => `${player.fields.报名姓名}（${player.fields.档案状态}）`)
      .join('、');

    lines.push(`@${team.captainOpenId} ${team.teamName} 仍有未完成注册项：${memberNames}`);
  }

  if (lines.length === 0) {
    return '注册检查完成，当前未发现需补充的战队信息。';
  }

  return `注册检查完成，已按战队汇总未完成项：\n${lines.join('\n')}`;
}

export async function checkRegistration({ context, bitable, payload = {} }) {
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
      actionType: '检查注册',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message
    });
    return auth;
  }

  const [teamResult, playerResult] = await Promise.all([
    bitable.listRecords('teamMaster', (record) => record.fields.TournamentID === context.tournamentId),
    bitable.listRecords('playerMaster', (record) => record.fields.TournamentID === context.tournamentId)
  ]);

  if (!teamResult.ok || !playerResult.ok) {
    return {
      ok: false,
      message: '注册检查失败：读取战队或选手数据失败。'
    };
  }

  const grouped = groupByTeam(teamResult.records, playerResult.records);
  const summary = renderReminderSummary(grouped);

  await writeAuditLog({
    bitable,
    tournamentId: context.tournamentId,
    actionType: '检查注册',
    targetType: '系统',
    operator: operatorOpenId,
    after: JSON.stringify({ teamCount: grouped.length }),
    result: '成功'
  });

  return {
    ok: true,
    message: summary,
    groupedTeams: grouped
  };
}
