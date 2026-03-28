# 当前会话 Prefetched 统一入口用法 v1

> 日期：2026-03-29

## 1. 目标

把这条链路固定下来：

1. 当前会话用飞书用户工具读取真实表
2. 把读取结果保存成 `prefetched.json`
3. 调用统一入口脚本产出 `write_plan`
4. 当前会话再串行执行 `write_plan`

统一入口脚本：

```bash
node scripts/run-callback-with-prefetched.js
```

---

## 2. 需要准备的文件

### 2.1 callback.json

示例：

```json
{
  "action": "confirm_match_result_report",
  "match_uid": "MATCH-HS202603-TEST-SOLO-001",
  "result_report_uid": "RPT-MATCH-HS202603-TEST-SOLO-001-1774717992036",
  "test_as_side": "side_b"
}
```

### 2.2 context.json（可选）

示例：

```json
{
  "operatorOpenId": "ou_xxx",
  "writeMode": "user_identity_plan"
}
```

> 不写也行；脚本默认 `writeMode = user_identity_plan`。

### 2.3 prefetched.json

示例：

```json
{
  "match": {
    "record_id": "recvf9ZpmsvIws",
    "fields": {
      "match_uid": "MATCH-HS202603-TEST-SOLO-001",
      "tournament_uid": "HS202603-TEST-SOLO",
      "side_a_player_uid": "P-A",
      "side_b_player_uid": "P-B",
      "side_a_display_name": "小甲",
      "side_b_display_name": "小乙",
      "match_status": "result_pending_confirmation",
      "result_status": "pending_opponent_confirmation"
    }
  },
  "report": {
    "record_id": "recvfbpXBJJsgA",
    "fields": {
      "result_report_uid": "RPT-MATCH-HS202603-TEST-SOLO-001-1774717992036",
      "match_uid": "MATCH-HS202603-TEST-SOLO-001",
      "report_status": "awaiting_opponent_confirmation",
      "reporter_side": "side_a",
      "reporter_open_id": "ou_xxx",
      "final_result_text": "小甲 3:1 小乙"
    }
  },
  "players": [
    { "record_id": "recA", "fields": { "player_uid": "P-A", "feishu_open_id": "ou_a", "nickname": "小甲" } },
    { "record_id": "recB", "fields": { "player_uid": "P-B", "feishu_open_id": "ou_b", "nickname": "小乙" } }
  ],
  "sideContext": {
    "sideAUid": "P-A",
    "sideBUid": "P-B",
    "sideAOpenId": "ou_a",
    "sideBOpenId": "ou_b",
    "sideAName": "小甲",
    "sideBName": "小乙"
  },
  "tournamentAdmins": [
    { "record_id": "recAdmin", "fields": { "tournament_uid": "HS202603-TEST-SOLO", "user_open_id": "ou_admin", "status": "active", "role": "admin" } }
  ]
}
```

---

## 3. 调用方式

```bash
node scripts/run-callback-with-prefetched.js \
  --callback tmp/callback.json \
  --prefetched tmp/prefetched.json \
  --context tmp/context.json \
  --result-out tmp/result.json \
  --plan-out tmp/plan.json \
  --render-plan
```

输出分三层：

- stdout：精简结果摘要
- `result.json`：完整 callback 返回
- `plan.json`：可交给执行层的 `write_plan`
- `--render-plan`：额外输出映射好的 `feishu_bitable_app_table_record` 调用规格

---

## 4. 推荐工作流

### Step 1：当前会话读表

用飞书用户工具读取：
- `matches`
- `result_reports`
- `players`
- `tournament_admins`（管理员分支时）
- 必要时 `disputes`

### Step 2：组装 prefetched.json

把真实记录按约定结构写入 `prefetched.json`。

### Step 3：调用统一入口

让脚本生成 `result.json + plan.json`。

### Step 4：执行 write_plan

当前会话按 sequence 串行调用：
- `feishu_bitable_app_table_record.create`
- `feishu_bitable_app_table_record.update`

---

## 5. 已验证范围

当前已验证可走这套入口的 action：

- `submit_match_result_report`
- `confirm_match_result_report`
- `reject_match_result_report`
- `escalate_match_result_report_timeout`
- `admin_confirm_match_result_report`

---

## 6. 好处

这层入口补完后：

- 不需要手写 `node -e "handleCallback(...)"`
- 不需要每次手拼上下文对象
- 当前会话和 callback 的边界更稳定
- 后面把更多链路迁到 prefetched 模式时，可以复用同一个入口
