#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function usage() {
  console.log(`
用法：
  node scripts/build-solo-result-prefetched.js \
    --match-file <match.json> \
    --players-file <players.json> \
    [--report-file <report.json>] \
    [--admins-file <admins.json>] \
    [--disputes-file <disputes.json>] \
    [--permission-role <admin|owner|judge>] \
    [--out <prefetched.json>]

说明：
  - 输入文件可以是 feishu_bitable_app_table_record.list 的原始返回，或单条 record JSON
  - 脚本会自动抽取 records[0] / records[*]，并推导 sideContext
  - 输出为 run-callback-with-prefetched.js 可直接使用的 prefetched.json
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const normalized = key.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[normalized] = true;
      continue;
    }
    args[normalized] = next;
    i += 1;
  }
  return args;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
}

function unwrapFieldValue(value) {
  if (Array.isArray(value)) {
    if (value.length === 1 && value[0] && typeof value[0] === 'object' && 'text' in value[0]) {
      return value[0].text;
    }
    if (value.every(item => item && typeof item === 'object' && 'text' in item)) {
      return value.map(item => item.text).join('');
    }
  }
  return value;
}

function getFieldValue(record, candidateFields = []) {
  if (!record || !record.fields) return undefined;
  for (const fieldName of candidateFields) {
    const raw = record.fields[fieldName];
    const value = unwrapFieldValue(raw);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function normalizeRecordPayload(payload, mode = 'first') {
  if (!payload) return mode === 'all' ? [] : null;
  if (payload.record_id || payload.fields) return mode === 'all' ? [payload] : payload;
  if (payload.record) return mode === 'all' ? [payload.record] : payload.record;
  if (Array.isArray(payload.records)) return mode === 'all' ? payload.records : (payload.records[0] || null);
  if (Array.isArray(payload.items)) return mode === 'all' ? payload.items : (payload.items[0] || null);
  if (Array.isArray(payload)) return mode === 'all' ? payload : (payload[0] || null);
  return mode === 'all' ? [] : null;
}

function indexPlayers(players = []) {
  const byUid = new Map();
  for (const player of players) {
    const playerUid = getFieldValue(player, ['player_uid']);
    if (playerUid) byUid.set(playerUid, player);
  }
  return byUid;
}

function buildSideContext(match, players = []) {
  const sideAUid = getFieldValue(match, ['side_a_entity_uid', 'side_a_uid', 'player_a_uid', 'side_a_player_uid']);
  const sideBUid = getFieldValue(match, ['side_b_entity_uid', 'side_b_uid', 'player_b_uid', 'side_b_player_uid']);
  const byUid = indexPlayers(players);
  const sideAPlayer = byUid.get(sideAUid);
  const sideBPlayer = byUid.get(sideBUid);

  return {
    sideAUid: sideAUid || null,
    sideBUid: sideBUid || null,
    sideAOpenId: getFieldValue(sideAPlayer, ['feishu_open_id', 'user_open_id', 'open_id']) || null,
    sideBOpenId: getFieldValue(sideBPlayer, ['feishu_open_id', 'user_open_id', 'open_id']) || null,
    sideAName: getFieldValue(match, ['side_a_entity_name', 'side_a_name', 'player_a_name', 'side_a_display_name']) || getFieldValue(sideAPlayer, ['nickname', 'real_name']) || 'A方',
    sideBName: getFieldValue(match, ['side_b_entity_name', 'side_b_name', 'player_b_name', 'side_b_display_name']) || getFieldValue(sideBPlayer, ['nickname', 'real_name']) || 'B方',
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h || !args['match-file'] || !args['players-file']) {
    usage();
    process.exit(args['match-file'] && args['players-file'] ? 0 : 2);
  }

  const match = normalizeRecordPayload(loadJson(args['match-file']), 'first');
  const players = normalizeRecordPayload(loadJson(args['players-file']), 'all');
  const report = args['report-file'] ? normalizeRecordPayload(loadJson(args['report-file']), 'first') : null;
  const tournamentAdmins = args['admins-file'] ? normalizeRecordPayload(loadJson(args['admins-file']), 'all') : [];
  const disputes = args['disputes-file'] ? normalizeRecordPayload(loadJson(args['disputes-file']), 'all') : [];

  if (!match) {
    throw new Error('match-file 中未找到 record');
  }

  const prefetched = {
    match,
    players,
    sideContext: buildSideContext(match, players),
  };

  if (report) prefetched.report = report;
  if (tournamentAdmins.length) prefetched.tournamentAdmins = tournamentAdmins;
  if (disputes.length) prefetched.disputes = disputes;
  if (args['permission-role']) {
    prefetched.permission = {
      adminAllowed: true,
      role: args['permission-role'],
    };
  }

  const output = JSON.stringify(prefetched, null, 2);
  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, output);
    console.log(`[prefetched-build] saved to ${outPath}`);
  } else {
    console.log(output);
  }
}

try {
  main();
} catch (error) {
  console.error('[prefetched-build] failed:', error && error.stack ? error.stack : error);
  process.exit(1);
}
