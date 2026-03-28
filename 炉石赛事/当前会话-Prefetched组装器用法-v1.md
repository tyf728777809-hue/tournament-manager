# 当前会话 Prefetched 组装器用法 v1

> 日期：2026-03-29

## 1. 目标

减少手工拼 `prefetched.json` 的工作量。

新增脚本：

```bash
node scripts/build-solo-result-prefetched.js
```

它负责把当前会话导出的原始查询结果，自动组装成统一入口可直接使用的 `prefetched.json`。

---

## 2. 最小输入

至少需要：

- `--match-file`
- `--players-file`

可选输入：

- `--report-file`
- `--admins-file`
- `--disputes-file`
- `--permission-role`

---

## 3. 示例

```bash
node scripts/build-solo-result-prefetched.js \
  --match-file tmp/match.json \
  --players-file tmp/players.json \
  --report-file tmp/report.json \
  --admins-file tmp/admins.json \
  --disputes-file tmp/disputes.json \
  --permission-role admin \
  --out tmp/prefetched.json
```

生成后可直接交给统一入口：

```bash
node scripts/run-callback-with-prefetched.js \
  --callback tmp/callback.json \
  --prefetched tmp/prefetched.json \
  --context tmp/context.json \
  --result-out tmp/result.json \
  --plan-out tmp/plan.json \
  --render-plan
```

---

## 4. 输入文件支持格式

脚本兼容以下几种常见格式：

### 4.1 feishu_bitable_app_table_record.list 原始返回

```json
{
  "records": [
    {
      "record_id": "recxxx",
      "fields": { ... }
    }
  ]
}
```

### 4.2 单条 record 包装

```json
{
  "record": {
    "record_id": "recxxx",
    "fields": { ... }
  }
}
```

### 4.3 直接就是 record

```json
{
  "record_id": "recxxx",
  "fields": { ... }
}
```

---

## 5. 自动完成的事情

组装器会自动：

- 从 `match` 中提取：
  - `side_a_player_uid`
  - `side_b_player_uid`
  - `side_a_display_name`
  - `side_b_display_name`
- 从 `players` 中匹配双方选手记录
- 自动生成：

```json
"sideContext": {
  "sideAUid": "...",
  "sideBUid": "...",
  "sideAOpenId": "...",
  "sideBOpenId": "...",
  "sideAName": "...",
  "sideBName": "..."
}
```

如果传了 `--permission-role admin`，还会自动补：

```json
"permission": {
  "adminAllowed": true,
  "role": "admin"
}
```

---

## 6. 推荐工作流

1. 当前会话用飞书用户工具读取：
   - `matches`
   - `players`
   - 需要时再读 `result_reports / tournament_admins / disputes`
2. 把工具返回保存到 `tmp/*.json`
3. 运行 `build-solo-result-prefetched.js`
4. 再运行 `run-callback-with-prefetched.js`
5. 当前会话串行执行 `plan.json`

---

## 7. 当前价值

补完组装器后，当前会话已经有三层稳定工具链：

1. **组装器**：把原始查询结果转成 `prefetched.json`
2. **统一入口**：把 `callback + prefetched` 转成 `write_plan`
3. **执行层**：把 `write_plan` 串行写回飞书

这样后续真实联调时，人工只需要关心“读哪几张表”和“执行哪几条 write_plan”。
