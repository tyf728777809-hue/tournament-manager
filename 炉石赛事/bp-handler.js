/**
 * 炉石赛事自动化系统 - BP处理模块
 * 版本: v1.0 | 日期: 2026-03-28
 * 
 * 本模块实现战队赛BP流程（ban/pick阶段管理）
 * 流程：ban1 → protect1 → ban2 → 选择出阵职业
 */

const {
  queryRecord,
  getRecord,
  updateRecord,
  createRecord,
} = require('./bitable-api-utils');

const {
  sendNotification,
  sendCardMessage,
  sendGroupMessage,
} = require('./notification-utils');

// ============================================
// 配置
// ============================================

const CONFIG = {
  bitable: {
    apps: {
      basic: 'KSyvbZIb1af98gsLJ7wcKmtEn9Q',
      operation: 'KL3TbTEJIa5oytspkGGcf50rnpc',
      deck: 'SXg4bBhrhajJgdsRNCzcycOrnbe',
    }
  },
};

const TABLES = {
  players: 'tblaQYWnDvPb7aGA',
  teams: 'tblEgSf4nhxwfTwo',
  deckSubmissions: 'tblEEtx8k1AzYy4j',
  decks: 'tblraWTd0mgs5Bgu',
};

const TABLES_BP = {
  bpRounds: 'tblgfufpxvYjKNte',
  bpActions: 'tbl9nSeXjV8mvHVr',
};

// ============================================
// 1. 初始化BP轮次
// ============================================

/**
 * 初始化BP轮次
 * @param {Object} params - 参数
 * @param {string} params.match_uid - 对局UID
 * @param {string} params.side_a_uid - A方战队UID
 * @param {string} params.side_b_uid - B方战队UID
 * @param {string} params.tournament_uid - 赛事UID
 * @param {string} params.admin_open_id - 管理员open_id
 */
async function initBPRound(params) {
  const { match_uid, side_a_uid, side_b_uid, tournament_uid } = params;
  const timestamp = Date.now();
  
  // 1. 查询双方卡组提交
  const sideASubmission = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'team_uid', operator: 'is', value: [side_a_uid] },
          { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
          { field_name: 'submission_status', operator: 'is', value: ['approved'] },
        ]
      }
    }
  );
  
  const sideBSubmission = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.deckSubmissions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'team_uid', operator: 'is', value: [side_b_uid] },
          { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
          { field_name: 'submission_status', operator: 'is', value: ['approved'] },
        ]
      }
    }
  );
  
  if (!sideASubmission.length || !sideBSubmission.length) {
    throw new Error('双方卡组未审核通过，无法启动BP');
  }
  
  // 2. 获取战队信息
  const sideA = await getRecord(CONFIG.bitable.apps.basic, TABLES.teams, side_a_uid);
  const sideB = await getRecord(CONFIG.bitable.apps.basic, TABLES.teams, side_b_uid);
  
  // 3. 创建BP轮次
  const bpRoundUid = `BP-${match_uid}-${timestamp}`;
  await createRecord(
    CONFIG.bitable.apps.deck,
    TABLES_BP.bpRounds,
    {
      bp_round_uid: bpRoundUid,
      tournament_uid: tournament_uid,
      match_uid: match_uid,
      side_a_entity_name: sideA.fields.team_name,
      side_b_entity_name: sideB.fields.team_name,
      side_a_submission_uid: sideASubmission[0].fields.deck_submission_uid,
      side_b_submission_uid: sideBSubmission[0].fields.deck_submission_uid,
      bp_status: 'ban1_phase',
      deadline_at: timestamp + 3 * 60 * 1000, // 3分钟
    }
  );
  
  // 4. 发送BP通知给双方队长
  await sendBPPrivateMessage(bpRoundUid, 'side_a', sideA.fields.captain_player_uid, 'ban1');
  await sendBPPrivateMessage(bpRoundUid, 'side_b', sideB.fields.captain_player_uid, 'ban1');
  
  return { success: true, message: 'BP轮次已初始化', bp_round_uid: bpRoundUid };
}

// ============================================
// 2. 发送BP私聊消息
// ============================================

/**
 * 发送BP私聊消息
 * @param {string} bpRoundUid - BP轮次ID
 * @param {string} sideLabel - side_a / side_b
 * @param {string} captainPlayerUid - 队长player_uid
 * @param {string} phase - ban1 / protect1 / ban2 / lineup
 */
async function sendBPPrivateMessage(bpRoundUid, sideLabel, captainPlayerUid, phase) {
  const captain = await getRecord(CONFIG.bitable.apps.basic, TABLES.players, captainPlayerUid);
  
  const phaseConfig = {
    'ban1': { 
      title: '🎯 BP Phase 1/4 - Ban 1 职业', 
      desc: '请选择要 Ban 的 1 个职业\n\n被 Ban 职业双方都不能使用' 
    },
    'protect1': { 
      title: '🛡️ BP Phase 2/4 - Protect 1 职业', 
      desc: '请选择要 Protect 的 1 个职业\n\n被 Protect 职业对方不能 Ban，但你可以使用' 
    },
    'ban2': { 
      title: '🎯 BP Phase 3/4 - Ban 2 职业', 
      desc: '请选择要 Ban 的 2 个职业\n\n累计 Ban 3 个职业' 
    },
    'lineup': { 
      title: '⚔️ BP Phase 4/4 - 选择出阵职业', 
      desc: '请按出场顺序选择前6个职业\n\nKOF规则：败者职业锁定，胜者继续' 
    },
  };
  
  const config = phaseConfig[phase];
  
  const card = {
    config: { wide_screen_mode: true },
    header: {
      template: 'blue',
      title: { tag: 'plain_text', content: config.title },
    },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: config.desc + '\n\n⏰ 剩余时间：3分钟',
        },
      },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            type: 'primary',
            text: { tag: 'plain_text', content: '提交选择' },
            value: {
              action: `submit_${phase}`,
              bp_round_uid: bpRoundUid,
              side_label: sideLabel,
            },
          },
        ],
      },
    ],
  };
  
  await sendCardMessage(captain.fields.feishu_open_id, card);
}

// ============================================
// 3. 提交Ban
// ============================================

/**
 * 提交Ban
 * @param {Object} params - 参数
 * @param {string} params.bp_round_uid - BP轮次ID
 * @param {string} params.side_label - side_a / side_b
 * @param {Array} params.banned_classes - 被ban职业列表
 * @param {string} params.actor_open_id - 操作人open_id
 */
async function submitBan(params) {
  const { bp_round_uid, side_label, banned_classes, actor_open_id } = params;
  const timestamp = Date.now();
  
  // 1. 获取BP轮次
  const bpRound = await getRecord(
    CONFIG.bitable.apps.deck,
    TABLES_BP.bpRounds,
    bp_round_uid
  );
  
  if (!bpRound) {
    throw new Error('BP轮次不存在');
  }
  
  // 2. 确定是ban1还是ban2阶段
  const currentStatus = bpRound.fields.bp_status;
  const isBan1 = currentStatus === 'ban1_phase' || currentStatus === 'waiting_both';
  const expectedCount = isBan1 ? 1 : 2;
  
  if (banned_classes.length !== expectedCount) {
    throw new Error(`Ban阶段错误：需要选择${expectedCount}个职业`);
  }
  
  // 3. 创建ban动作记录
  for (const bannedClass of banned_classes) {
    const actionUid = `BPA-${bp_round_uid}-${side_label}-${timestamp}-${bannedClass}`;
    await createRecord(
      CONFIG.bitable.apps.deck,
      TABLES_BP.bpActions,
      {
        bp_action_uid: actionUid,
        bp_round_uid: bp_round_uid,
        side_label: side_label,
        actor_open_id: actor_open_id,
        banned_deck_class: bannedClass,
        action_status: 'submitted',
        submitted_at: timestamp,
      }
    );
  }
  
  // 4. 检查双方是否都已提交
  const otherSide = side_label === 'side_a' ? 'side_b' : 'side_a';
  const otherSideActions = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES_BP.bpActions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'bp_round_uid', operator: 'is', value: [bp_round_uid] },
          { field_name: 'side_label', operator: 'is', value: [otherSide] },
          { field_name: 'action_status', operator: 'is', value: ['submitted'] },
        ]
      }
    }
  );
  
  const thisSideActions = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES_BP.bpActions,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'bp_round_uid', operator: 'is', value: [bp_round_uid] },
          { field_name: 'side_label', operator: 'is', value: [side_label] },
          { field