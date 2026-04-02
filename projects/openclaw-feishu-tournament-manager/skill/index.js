/**
 * Tournament Manager Skill - OpenClaw 封装
 * 
 * 直接使用 feishu_bitable_* 工具操作多维表格
 * 复用 OpenClaw 飞书插件的用户授权
 */

import { loadTournamentContext } from './context.js';
import { checkAdminPermission } from './auth.js';
import { 
  listRecords, 
  updateRecord, 
  createRecord,
  normalizeFields 
} from './bitable-helpers.js';

// ============================================
// 赛事管理核心功能
// ============================================

/**
 * 检查赛事注册状态
 * @param {Object} params - { appToken, tables, tournamentId }
 * @returns {Promise<Object>}
 */
export async function checkRegistration(params) {
  const { appToken, tables, tournamentId } = params;
  
  // 1. 查询赛事配置
  const configResult = await listRecords({
    app_token: appToken,
    table_id: tables.tournamentConfig,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [tournamentId] }
      ]
    }
  });
  
  if (!configResult.ok || configResult.records.length === 0) {
    return { ok: false, message: '赛事配置不存在' };
  }
  
  // 2. 查询所有战队
  const teamsResult = await listRecords({
    app_token: appToken,
    table_id: tables.teamMaster
  });
  
  // 3. 查询所有选手
  const playersResult = await listRecords({
    app_token: appToken,
    table_id: tables.playerMaster
  });
  
  return {
    ok: true,
    message: `注册检查完成，当前共有 ${teamsResult.records?.length || 0} 支战队，${playersResult.records?.length || 0} 名选手。`,
    data: {
      tournament: configResult.records[0],
      teams: teamsResult.records || [],
      players: playersResult.records || []
    }
  };
}

/**
 * 暂停顺延
 * @param {Object} params - { appToken, tables, tournamentId, operatorOpenId }
 * @returns {Promise<Object>}
 */
export async function pauseRolling(params) {
  const { appToken, tables, tournamentId, operatorOpenId } = params;
  
  // 1. 查询赛事配置
  const configResult = await listRecords({
    app_token: appToken,
    table_id: tables.tournamentConfig,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [tournamentId] }
      ]
    }
  });
  
  if (!configResult.ok || configResult.records.length === 0) {
    return { ok: false, message: '赛事配置不存在' };
  }
  
  const record = configResult.records[0];
  
  // 2. 更新顺延开关为 false
  const updateResult = await updateRecord({
    app_token: appToken,
    table_id: tables.tournamentConfig,
    record_id: record.recordId,
    fields: {
      '顺延开关': false
    }
  });
  
  if (!updateResult.ok) {
    return { ok: false, message: '暂停顺延失败，请稍后重试' };
  }
  
  // 3. 记录审计日志
  await createRecord({
    app_token: appToken,
    table_id: tables.auditLog,
    fields: {
      '操作类型': '暂停顺延',
      '操作人OpenID': operatorOpenId,
      '目标赛事ID': tournamentId,
      '操作时间': Date.now(),
      '操作详情': JSON.stringify({ previousValue: record.fields['顺延开关'] })
    }
  });
  
  return {
    ok: true,
    message: '已暂停本赛事自动顺延，后续比分变化将不再自动触发下一场签到。'
  };
}

/**
 * 恢复顺延
 * @param {Object} params - { appToken, tables, tournamentId, operatorOpenId }
 * @returns {Promise<Object>}
 */
export async function resumeRolling(params) {
  const { appToken, tables, tournamentId, operatorOpenId } = params;
  
  // 1. 查询赛事配置
  const configResult = await listRecords({
    app_token: appToken,
    table_id: tables.tournamentConfig,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [tournamentId] }
      ]
    }
  });
  
  if (!configResult.ok || configResult.records.length === 0) {
    return { ok: false, message: '赛事配置不存在' };
  }
  
  const record = configResult.records[0];
  
  // 2. 更新顺延开关为 true
  const updateResult = await updateRecord({
    app_token: appToken,
    table_id: tables.tournamentConfig,
    record_id: record.recordId,
    fields: {
      '顺延开关': true
    }
  });
  
  if (!updateResult.ok) {
    return { ok: false, message: '恢复顺延失败，请稍后重试' };
  }
  
  // 3. 记录审计日志
  await createRecord({
    app_token: appToken,
    table_id: tables.auditLog,
    fields: {
      '操作类型': '恢复顺延',
      '操作人OpenID': operatorOpenId,
      '目标赛事ID': tournamentId,
      '操作时间': Date.now(),
      '操作详情': JSON.stringify({ previousValue: record.fields['顺延开关'] })
    }
  });
  
  return {
    ok: true,
    message: '已恢复本赛事自动顺延。历史漏发场次如需补发，请使用 /手动签到。'
  };
}

/**
 * 手动签到
 * @param {Object} params - { appToken, tables, tournamentId, matchIndex, operatorOpenId }
 * @returns {Promise<Object>}
 */
export async function manualCheckin(params) {
  const { appToken, tables, tournamentId, matchIndex, operatorOpenId } = params;
  
  // 1. 查询指定场次
  const matchResult = await listRecords({
    app_token: appToken,
    table_id: tables.matchResults,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [tournamentId] },
        { field_name: '场次序号', operator: 'is', value: [String(matchIndex)] }
      ]
    }
  });
  
  if (!matchResult.ok || matchResult.records.length === 0) {
    return { ok: false, message: `未找到第 ${matchIndex} 场对阵，请检查场次序号` };
  }
  
  const match = matchResult.records[0];
  
  // 2. 更新场次状态为已下发
  await updateRecord({
    app_token: appToken,
    table_id: tables.matchResults,
    record_id: match.recordId,
    fields: {
      '签到状态': '已下发'
    }
  });
  
  // 3. 记录审计日志
  await createRecord({
    app_token: appToken,
    table_id: tables.auditLog,
    fields: {
      '操作类型': '手动签到',
      '操作人OpenID': operatorOpenId,
      '目标赛事ID': tournamentId,
      '目标场次': matchIndex,
      '操作时间': Date.now()
    }
  });
  
  return {
    ok: true,
    message: `已手动下发第 ${matchIndex} 场签到卡片。`
  };
}

/**
 * 重发战报
 * @param {Object} params - { appToken, tables, tournamentId, matchIndex }
 * @returns {Promise<Object>}
 */
export async function resendReport(params) {
  const { appToken, tables, tournamentId, matchIndex } = params;
  
  // 1. 查询指定场次
  const matchResult = await listRecords({
    app_token: appToken,
    table_id: tables.matchResults,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [tournamentId] },
        { field_name: '场次序号', operator: 'is', value: [String(matchIndex)] }
      ]
    }
  });
  
  if (!matchResult.ok || matchResult.records.length === 0) {
    return { ok: false, message: '未找到对应场次，请检查场次序号或 MatchID' };
  }
  
  const match = matchResult.records[0];
  
  // 2. 检查场次是否已结束
  if (match.fields['场次状态'] !== '已结束') {
    return { ok: false, message: '该场次尚未结束，无法重发战报' };
  }
  
  return {
    ok: true,
    message: `已重新发送第 ${matchIndex} 场战报。`,
    data: { match }
  };
}

/**
 * 公示卡组
 * @param {Object} params - { appToken, tables, tournamentId }
 * @returns {Promise<Object>}
 */
export async function publishDecks(params) {
  const { appToken, tables, tournamentId } = params;
  
  // 1. 查询赛事配置
  const configResult = await listRecords({
    app_token: appToken,
    table_id: tables.tournamentConfig,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [tournamentId] }
      ]
    }
  });
  
  if (!configResult.ok || configResult.records.length === 0) {
    return { ok: false, message: '赛事配置不存在' };
  }
  
  const config = configResult.records[0];
  
  // 2. 检查公示开关
  if (!config.fields['公示开关']) {
    return { ok: false, message: '当前未开启卡组公示，请先确认赛事配置中的公示开关' };
  }
  
  // 3. 查询已审核通过的卡组
  const decksResult = await listRecords({
    app_token: appToken,
    table_id: tables.deckSubmission,
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'TournamentID', operator: 'is', value: [tournamentId] },
        { field_name: '