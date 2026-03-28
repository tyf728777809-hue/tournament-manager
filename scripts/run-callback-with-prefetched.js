#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { handleCallback } = require(path.join(__dirname, '..', '炉石赛事', 'callback-handler.js'));

function usage() {
  console.log(`
用法：
  node scripts/run-callback-with-prefetched.js \
    --callback <callback.json> \
    --prefetched <prefetched.json> \
    [--context <context.json>] \
    [--result-out <result.json>] \
    [--plan-out <plan.json>] \
    [--render-plan]

说明：
  - callback.json: 仅放 callback payload（action, match_uid, result_report_uid ...）
  - prefetched.json: 放当前会话预读好的飞书记录与 sideContext/permission
  - context.json: 可选，放 operatorOpenId / writeMode 等；其中 prefetched 会被本脚本覆盖为 --prefetched 内容
  - 默认 writeMode=user_identity_plan
  - --render-plan 会在 stdout 输出可直接映射到 feishu_bitable_app_table_record 的调用规格
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

function loadJson(filePath, fallback = null) {
  if (!filePath) return fallback;
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8'));
}

function ensureDirFor(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(process.cwd(), filePath)), { recursive: true });
}

function normalizePlanPayload(result, writeMode) {
  return result?.execution
    ? {
        write_mode: result.execution.write_mode,
        write_plan_version: result.execution.write_plan_version,
        executor_contract: result.execution.executor_contract,
        write_plan: result.execution.write_plan,
      }
    : {
        write_mode: writeMode,
        write_plan: [],
      };
}

function toToolCall(item) {
  const base = {
    action: item.kind === 'create' ? 'create' : 'update',
    app_token: item.appToken,
    table_id: item.tableId,
  };

  if (item.kind === 'create') {
    return {
      tool: 'feishu_bitable_app_table_record',
      parameters: {
        ...base,
        fields: item.fields,
      },
      meta: {
        sequence: item.sequence,
        appAlias: item.appAlias,
        tableAlias: item.tableAlias,
        upsertBy: item.upsertBy || null,
      },
    };
  }

  return {
    tool: 'feishu_bitable_app_table_record',
    parameters: {
      ...base,
      record_id: item.recordId,
      fields: item.fields,
    },
    meta: {
      sequence: item.sequence,
      appAlias: item.appAlias,
      tableAlias: item.tableAlias,
      upsertBy: item.upsertBy || null,
    },
  };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h || !args.callback || !args.prefetched) {
    usage();
    process.exit(args.callback && args.prefetched ? 0 : 2);
  }

  const callback = loadJson(args.callback);
  const prefetched = loadJson(args.prefetched, {});
  const baseContext = loadJson(args.context, {});
  const context = {
    writeMode: 'user_identity_plan',
    ...baseContext,
    prefetched,
  };

  const result = await handleCallback(callback, context);
  const planPayload = normalizePlanPayload(result, context.writeMode || 'user_identity_plan');

  if (args['result-out']) {
    ensureDirFor(args['result-out']);
    fs.writeFileSync(path.resolve(process.cwd(), args['result-out']), JSON.stringify(result, null, 2));
  }

  if (args['plan-out']) {
    ensureDirFor(args['plan-out']);
    fs.writeFileSync(path.resolve(process.cwd(), args['plan-out']), JSON.stringify(planPayload, null, 2));
  }

  console.log(JSON.stringify({
    success: result.success,
    message: result.message,
    data: result.data,
    write_mode: planPayload.write_mode,
    write_plan_version: planPayload.write_plan_version,
    write_plan_count: (planPayload.write_plan || []).length,
  }, null, 2));

  if (args['render-plan']) {
    const calls = (planPayload.write_plan || []).map(toToolCall);
    console.log('\n# Rendered tool calls');
    console.log(JSON.stringify({
      write_mode: planPayload.write_mode,
      write_plan_version: planPayload.write_plan_version,
      executor_contract: planPayload.executor_contract || null,
      calls,
    }, null, 2));
  }
})().catch((error) => {
  console.error('[prefetched-run] failed:', error && error.stack ? error.stack : error);
  process.exit(1);
});
