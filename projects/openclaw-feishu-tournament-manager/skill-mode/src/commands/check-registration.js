/**
 * 检查注册 - Skill 模式
 */

import { TABLES, APP_TOKEN, TOURNAMENT_ID } from '../config/tables.js';
import { assertAdminAccess } from './admin-auth.js';
import { writeAuditLog } from './audit-log.js';

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
function groupByTeam(teams, players) {
  return teams.map((team) => {
    const teamId = normalizeField(team.fields.TeamID);
    const members = players.filter((player) => {
      const playerTeamId = normalizeField(player.fields.所属战队ID);
      return playerTeamId === teamId;
    });

    const incompleteMembers = members.filter((player) => {
      const status = normalizeField(player.fields.档案状态);
      return status !== '已完成';
    });

    return {
      teamId,
      teamName: normalizeField(team.fields.战队名称),
      captainOpenId: normalizeField(team.fields['队长OpenID']),
      members,
      incompleteMembers,
    };
  });
}

/**
 * 渲染提醒摘要
 */
function renderReminderSummary(groupedTeams) {
  const lines = [];

  for (const team of groupedTeams) {
    if (team.incompleteMembers.length === 0) {
      continue;
    }

    const memberNames = team.incompleteMembers
      .map((player) => {
        const name = normalizeField(player.fields.选手姓名);
        const status = normalizeField(player.fields.档案状态);
        return `${name}（${status}）`;
      })
      .join('、');

    lines.push(`@${team.captainOpenId} ${team.teamName} 仍有未完成注册项：${memberNames}`);
  }

  if (lines.length === 0) {
    return '注册检查完成，当前未发现需补充的战队信息。';
  }

  return `注册检查完成，已按战队汇总未完成项：\n${lines.join('\n')}`;
}

/**
 * 检查注册
 */
export async function checkRegistration({ operatorOpenId }) {
  // 1. 验证管理员权限
  const auth = await assertAdminAccess({
    operatorOpenId,
    tournamentId: TOURNAMENT_ID,
  });

  if (!auth.ok) {
    await writeAuditLog({
      tournamentId: TOURNAMENT_ID,
      actionType: '检查注册',
      targetType: '系统',
      operator: operatorOpenId || 'unknown',
      result: '失败',
      error: auth.message,
    });
    return auth;
  }

  // 2. 查询战队和选手数据
  const [teamResult, playerResult] = await Promise.all([
    feishu_bitable_app_table_record({
      action: 'list',
      app_token: APP_TOKEN,
      table_id: TABLES.teamMaster,
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
      table_id: TABLES.playerMaster,
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'TournamentID', operator: 'is', value: [TOURNAMENT_ID] },
        ],
      },
    }),
  ]);

  if (!teamResult || !playerResult) {
    return {
      ok: false,
      message: '注册检查失败：读取战队或选手数据失败。',
    };
  }

  // 3. 处理数据
  const grouped = groupByTeam(teamResult.records || [], playerResult.records || []);
  const summary = renderReminderSummary(grouped);

  // 4. 记录审计日志
  await writeAuditLog({
    tournamentId: TOURNAMENT_ID,
    actionType: '检查注册',
    targetType: '系统',
    operator: operatorOpenId,
    after: JSON.stringify({ teamCount: grouped.length }),
    result: '成功',
  });

  return {
    ok: true,
    message: summary,
    groupedTeams: grouped,
  };
}
