#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function usage() {
  console.log(`
用法：
  node scripts/render-feishu-write-plan.js --in <plan.json> [--format pretty|json]

说明：
  - 输入既可以是完整的 callback 结果里的 execution 包，也可以是单独导出的 plan 文件
  - 输出为建议执行的 feishu_bitable_app_table_record 调用规格
  - 本脚本不直接写飞书，只做渲染/检查，真正执行由当前会话串行调用用户身份工具完成
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

function normalizePlanPayload(payload) {
  if (Array.isArray(payload)) {
    return { write_plan: payload };
  }
  if (payload?.execution?.write_plan) {
    return {
      write_mode: payload.execution.write_mode,
      write_plan_version: payload.execution.write_plan_version,
      executor_contract: payload.execution.executor_contract,
      write_plan: payload.execution.write_plan,
    };
  }
  if (payload?.write_plan) {
    return payload;
  }
  throw new Error('无法识别输入 JSON；需要 execution.write_plan 或 write_plan');
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

(function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h || !args.in) {
    usage();
    process.exit(args.in ? 0 : 2);
  }

  const payload = normalizePlanPayload(loadJson(args.in));
  const calls = (payload.write_plan || []).map(toToolCall);

  if ((args.format || 'pretty') === 'json') {
    console.log(JSON.stringify({
      write_mode: payload.write_mode || 'user_identity_plan',
      write_plan_version: payload.write_plan_version || 'feishu-user-executor/v1',
      executor_contract: payload.executor_contract || null,
      calls,
    }, null, 2));
    return;
  }

  console.log(`# Feishu write plan`);
  console.log(`- mode: ${payload.write_mode || 'user_identity_plan'}`);
  console.log(`- version: ${payload.write_plan_version || 'feishu-user-executor/v1'}`);
  console.log(`- items: ${calls.length}`);
  console.log('');

  for (const call of calls) {
    console.log(`## ${call.meta.sequence}. ${call.meta.appAlias}.${call.meta.tableAlias} -> ${call.parameters.action}`);
    console.log(JSON.stringify(call, null, 2));
    console.log('');
  }
})();
