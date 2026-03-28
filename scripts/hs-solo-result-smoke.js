#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { handleCallback } = require(path.join(__dirname, '..', '炉石赛事', 'callback-handler.js'));

function usage() {
  console.log(`
用法：
  node scripts/hs-solo-result-smoke.js <step> [options]

步骤：
  submit           选手提交整场赛果
  confirm          对手确认赛果
  reject           对手拒绝赛果（自动转 disputes）
  timeout          模拟超时升级管理员
  admin-confirm    管理员兜底确认

常用参数：
  --match <uid>            对局 UID
  --report <uid>           赛果上报 UID（confirm/reject/timeout/admin-confirm 时可传）
  --operator <open_id>     当前操作人 open_id
  --admin <open_id>        管理员 open_id（admin-confirm 可传）
  --reason <text>          拒绝/超时原因
  --result <text>          自定义赛果文案（submit 可传）
  --timeout <minutes>      提交后确认时限（submit 可传）
  --force true             timeout 时忽略截止时间直接升级
  --as-side <side_a|side_b> 仅联调用，配合 HS_SOLO_RESULT_TEST_BYPASS=1 模拟双方身份
  --write-mode <api|user_identity_plan>  写表模式，默认 api
  --plan-out <path>         当 write_mode=user_identity_plan 时，把 execution.write_plan 落到本地文件

示例：
  node scripts/hs-solo-result-smoke.js submit --match MATCH-HS202603-TEST-SOLO-001 --operator ou_xxx
  node scripts/hs-solo-result-smoke.js reject --match MATCH-HS202603-TEST-SOLO-001 --report RPT-xxx --operator ou_yyy --reason "比分不一致"
`);
}

function parseArgs(argv) {
  const [step, ...rest] = argv;
  const args = { _: step };
  for (let i = 0; i < rest.length; i += 1) {
    const key = rest[i];
    if (!key.startsWith('--')) continue;
    const normalized = key.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith('--')) {
      args[normalized] = true;
      i -= 1;
      continue;
    }
    args[normalized] = next;
  }
  return args;
}

function buildActionPayload(step, args) {
  const match_uid = args.match;
  const result_report_uid = args.report;
  const operator_open_id = args.operator;
  const test_as_side = args['as-side'];
  const writeMode = args['write-mode'] || 'api';

  switch (step) {
    case 'submit':
      return {
        callback: {
          action: 'submit_match_result_report',
          match_uid,
          result_report_uid,
          final_result_text: args.result,
          confirm_timeout_minutes: args.timeout ? Number(args.timeout) : undefined,
          note: args.reason || '',
          test_as_side,
        },
        context: { operatorOpenId: operator_open_id, writeMode },
      };
    case 'confirm':
      return {
        callback: {
          action: 'confirm_match_result_report',
          match_uid,
          result_report_uid,
          test_as_side,
        },
        context: { operatorOpenId: operator_open_id, writeMode },
      };
    case 'reject':
      return {
        callback: {
          action: 'reject_match_result_report',
          match_uid,
          result_report_uid,
          reject_reason: args.reason || 'smoke test rejection',
          test_as_side,
        },
        context: { operatorOpenId: operator_open_id, writeMode },
      };
    case 'timeout':
      return {
        callback: {
          action: 'escalate_match_result_report_timeout',
          match_uid,
          result_report_uid,
          reason: args.reason || 'smoke test timeout escalation',
          force: args.force === 'true' || args.force === true,
        },
        context: { operatorOpenId: operator_open_id || args.admin, writeMode },
      };
    case 'admin-confirm':
      return {
        callback: {
          action: 'admin_confirm_match_result_report',
          match_uid,
          result_report_uid,
          admin_open_id: args.admin || operator_open_id,
        },
        context: { operatorOpenId: args.admin || operator_open_id, writeMode },
      };
    default:
      throw new Error(`未知 step: ${step}`);
  }
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const step = args._;
  const writeMode = args['write-mode'] || 'api';

  if (!step || ['-h', '--help', 'help'].includes(step)) {
    usage();
    process.exit(0);
  }

  if (!process.env.FEISHU_ACCESS_TOKEN) {
    console.error('缺少 FEISHU_ACCESS_TOKEN，当前脚本无法直接读取真实飞书数据或生成 write_plan。');
    process.exit(2);
  }

  if (!args.match) {
    console.error('缺少 --match');
    process.exit(2);
  }

  const { callback, context } = buildActionPayload(step, args);
  console.log('[smoke] callback =', JSON.stringify(callback, null, 2));
  console.log('[smoke] context  =', JSON.stringify(context, null, 2));

  const result = await handleCallback(callback, context);
  console.log('[smoke] result   =', JSON.stringify(result, null, 2));

  if (writeMode === 'user_identity_plan' && args['plan-out']) {
    const outputPath = path.resolve(process.cwd(), args['plan-out']);
    const payload = result?.execution
      ? {
          write_mode: result.execution.write_mode,
          write_plan_version: result.execution.write_plan_version,
          executor_contract: result.execution.executor_contract,
          write_plan: result.execution.write_plan,
        }
      : { write_mode: writeMode, write_plan: [] };
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
    console.log(`[smoke] plan saved to ${outputPath}`);
  }
})().catch((error) => {
  console.error('[smoke] failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
