/**
 * 炉石赛事自动化系统 - BP处理模块（完整版）
 * 版本: v1.0 | 日期: 2026-03-28
 */

const {
  queryRecord, getRecord, updateRecord, createRecord,
} = require('./bitable-api-utils');

const { sendCardMessage, sendGroupMessage } = require('./notification-utils');

const CONFIG = {
  bitable: {
    apps: {
      basic: 'KSyvbZIb1af98gsLJ7wcKmtEn9Q',
      deck: 'SXg4bBhrhajJgdsRNCzcycOrnbe',
    }
  },
};

const TABLES = {
  players: 'tblaQYWnDvPb7aGA',
  teams: 'tblEgSf4nhxwfTwo',
  deckSubmissions: 'tblEEtx8k1AzYy4j',
};

const TABLES_BP = {
  bpRounds: 'tblgfufpxvYjKNte',
  bpActions: 'tbl9nSeXjV8mvHVr',
};

// ============================================
// BP核心函数
// ============================================

async function initBPRound(params) {
  const { match_uid, side_a_uid, side_b_uid, tournament_uid } = params;
  const timestamp = Date.now();
  
  const sideASub = await queryRecord(CONFIG.bitable.apps.deck, TABLES.deckSubmissions, {
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'team_uid', operator: 'is', value: [side_a_uid] },
        { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
        { field_name: 'submission_status', operator: 'is', value: ['approved'] },
      ]
    }
  });
  
  const sideBSub = await queryRecord(CONFIG.bitable.apps.deck, TABLES.deckSubmissions, {
    filter: {
      conjunction: 'and',
      conditions: [
        { field_name: 'team_uid', operator: 'is', value: [side_b_uid] },
        { field_name: 'tournament_uid', operator: 'is', value: [tournament_uid] },
        { field_name: 'submission_status', operator: 'is', value: ['approved'] },
      ]
    }
  });
  
  if (!sideASub.length || !sideBSub.length) {
    throw new Error('双方卡组未审核通过');
  }
  
  const sideA = await getRecord(CONFIG.bitable.apps.basic, TABLES.teams, side_a_uid);
  const sideB = await getRecord(CONFIG.bitable.apps.basic, TABLES.teams, side_b_uid);
  
  const bpRoundUid = `BP-${match_uid}-${timestamp}`;
  
  await createRecord(CONFIG.bitable.apps.deck, TABLES_BP.bpRounds, {
    bp_round_uid: bpRoundUid,
    tournament_uid: tournament_uid,
    match_uid: match_uid,
    side_a_entity_name: sideA.fields.team_name,
    side_b_entity_name: sideB.fields.team_name,
    side_a_submission_uid: sideASub[0].fields.deck_submission_uid,
    side_b_submission_uid: sideBSub[0].fields.deck_submission_uid,
    bp_status: 'ban1_phase',
    deadline_at: timestamp + 3 * 60 * 1000,
  });
  
  await sendBPCard(bpRoundUid, sideA.fields.captain_player_uid, 'ban1');
  await sendBPCard(bpRoundUid, sideB.fields.captain_player_uid, 'ban1');
  
  return { success: true, bp_round_uid: bpRoundUid };
}

async function sendBPCard(bpRoundUid, captainUid, phase) {
  const captain = await getRecord(CONFIG.bitable.apps.basic, TABLES.players, captainUid);
  
  const config = {
    ban1: { title: '🎯 BP Phase 1/4 - Ban 1 职业', desc: '请选择要 Ban 的 1 个职业' },
    protect1: { title: '🛡️ BP Phase 2/4 - Protect 1 职业', desc: '请选择要 Protect 的 1 个职业' },
    ban2: { title: '🎯 BP Phase 3/4 - Ban 2 职业', desc: '请选择要 Ban 的 2 个职业' },
    lineup: { title: '⚔️ BP Phase 4/4 - 选择出阵职业', desc: '请按出场顺序选择前6个职业' },
  }[phase];
  
  const card = {
    config: { wide_screen_mode: true },
    header: { template: 'blue', title: { tag: 'plain_text', content: config.title } },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: config.desc + '\n\n⏰ 剩余时间：3分钟' } },
      { tag: 'action', actions: [{ tag: 'button', type: 'primary', text: { tag: 'plain_text', content: '提交选择' }, value: { action: `submit_${phase}`, bp_round_uid: bpRoundUid } }] },
    ],
  };
  
  await sendCardMessage(captain.fields.feishu_open_id, card);
}

async function submitBan(params) {
  const { bp_round_uid, side_label, banned_classes, actor_open_id } = params;
  const timestamp = Date.now();
  
  const bpRound = await getRecord(CONFIG.bitable.apps.deck, TABLES_BP.bpRounds, bp_round_uid);
  if (!bpRound) throw new Error('BP轮次不存在');
  
  const isBan1 = bpRound.fields.bp_status === 'ban1_phase';
  const expectedCount = isBan1 ? 1 : 2;
  
  if (banned_classes.length !== expectedCount) {
    throw new Error(`需要选择${expectedCount}个职业`);
  }
  
  for (const cls of banned_classes) {
    await createRecord(CONFIG.bitable.apps.deck, TABLES_BP.bpActions, {
      bp_action_uid: `BPA-${bp_round_uid}-${side_label}-${timestamp}-${cls}`,
      bp_round_uid: bp_round_uid,
      side_label: side_label,
      actor_open_id: actor_open_id,
      banned_deck_class: cls,
      action_status: 'submitted',
      submitted_at: timestamp,
    });
  }
  
  return { success: true, message: 'Ban已提交' };
}

async function submitProtect(params) {
  const { bp_round_uid, side_label, protected_class, actor_open_id } = params;
  const timestamp = Date.now();
  
  await createRecord(CONFIG.bitable.apps.deck, TABLES_BP.bpActions, {
    bp_action_uid: `BPA-${bp_round_uid}-${side_label}-${timestamp}-protect-${protected_class}`,
    bp_round_uid: bp_round_uid,
    side_label: side_label,
    actor_open_id: actor_open_id,
    banned_deck_class: protected_class,
    action_status: 'submitted',
    submitted_at: timestamp,
  });
  
  return { success: true, message: 'Protect已提交' };
}

async function submitLineup(params) {
  const { bp_round_uid, side_label, lineup } = params;
  
  if (!lineup || lineup.length !== 6) {
    throw new Error('需要选择6个职业');
  }
  
  await updateRecord(CONFIG.bitable.apps.deck, TABLES_BP.bpRounds, bp_round_uid, {
    [`${side_label}_lineup`]: JSON.stringify(lineup),
  });
  
  return { success: true, message: '出阵已提交' };
}

async function publishBPResult(bp_round_uid) {
  const bpRound = await getRecord(CONFIG.bitable.apps.deck, TABLES_BP.bpRounds, bp_round_uid);
  
  const actions = await queryRecord(CONFIG.bitable.apps.deck, TABLES_BP.bpActions, {
    filter: { conjunction: 'and', conditions: [{ field_name: 'bp_round_uid', operator: 'is', value: [bp_round_uid] }] }
  });
  
  const sideABans = actions.filter(a => a.fields.side_label === 'side_a').map(a => a.fields.banned_deck_class);
  const sideBBans = actions.filter(a => a.fields.side_label === 'side_b').map(a => a.fields.banned_deck_class);
  
  const text = `📢 BP结果公示\n\n🔴 ${bpRound.fields.side_a_entity_name} vs 🔵 ${bpRound.fields.side_b_entity_name}\n\nBan：\n- ${bpRound.fields.side_a_entity_name}：${sideABans.join('、')}\n- ${bpRound.fields.side_b_entity_name}：${sideBBans.join('、')}`;
  
  await updateRecord(CONFIG.bitable.apps.deck, TABLES_BP.bpRounds, bp_round_uid, {
    bp_status: 'public_announced',
    public_announcement_text: text,
  });
  
  return { success: true, message: 'BP结果已公示' };
}

// ============================================
// 导出
// ============================================

module.exports = {
  initBPRound,
  submitBan,
  submitProtect,
  submitLineup,
  publishBPResult,
};
