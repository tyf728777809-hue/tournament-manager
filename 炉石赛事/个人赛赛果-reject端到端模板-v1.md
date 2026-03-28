# 个人赛赛果 reject 端到端模板 v1

> 日期：2026-03-29

## 1. 目标

固化 `reject_match_result_report` 的标准工作流：

1. 当前会话读取真实表
2. 组装 `prefetched.json`
3. 统一入口生成 `write_plan`
4. 当前会话串行执行 `write_plan`
5. 复核 `disputes / result_reports / matches`

---

## 2. 推荐目录

```bash
tmp/solo-reject/
```

文件建议：
- `callback.json`
- `context.json`
- `match.json`
- `players.json`
- `report.json`
- `prefetched.json`
- `result.json`
- `plan.json`

---

## 3. callback.json

```json
{
  "action": "reject_match_result_report",
  "match_uid": "MATCH-HS202603-TEST-SOLO-001",
  "result_report_uid": "RPT-MATCH-HS202603-TEST-SOLO-001-1774717992036",
  "reject_reason": "比分不一致，申请管理员核实",
  "test_as_side": "side_b"
}
```

---

## 4. context.json

```json
{
  "operatorOpenId": "ou_xxx",
  "writeMode": "user_identity_plan"
}
```

---

## 5. 当前会话读取真实表

至少需要：
- `matches`：按 `match_uid` 读取 1 条
- `result_reports`：按 `result_report_uid` 读取 1 条
- `players`：读取双方选手记录

保存到：
- `tmp/solo-reject/match.json`
- `tmp/solo-reject/report.json`
- `tmp/solo-reject/players.json`

---

## 6. 组装 prefetched.json

```bash
node scripts/build-solo-result-prefetched.js \
  --match-file tmp/solo-reject/match.json \
  --players-file tmp/solo-reject/players.json \
  --report-file tmp/solo-reject/report.json \
  --out tmp/solo-reject/prefetched.json
```

---

## 7. 生成 write_plan

```bash
node scripts/run-callback-with-prefetched.js \
  --callback tmp/solo-reject/callback.json \
  --prefetched tmp/solo-reject/prefetched.json \
  --context tmp/solo-reject/context.json \
  --result-out tmp/solo-reject/result.json \
  --plan-out tmp/solo-reject/plan.json \
  --render-plan
```

预期：
- `write_plan_count = 3`
- 顺序：
  1. `create disputes`
  2. `update resultReports`
  3. `update matches`

---

## 8. 执行 plan.json

按 `sequence` 串行执行：

1. `create disputes`
2. `update result_reports`
3. `update matches`

> 不并发，不跳步。

---

## 9. 落表复核

### disputes 预期
- 新建 1 条争议记录
- `dispute_status = awaiting_admin_decision`
- `admin_decision_status = pending`

### result_reports 预期
- `report_status = opponent_rejected`
- `opponent_confirmation_status = rejected`
- `linked_dispute_uid` 已写回
- `escalation_reason = opponent_rejected`

### matches 预期
- `match_status = disputed`
- `result_status = disputed`
- `latest_dispute_uid` 已写回

---

## 10. 成功判定

以下全部满足即通过：
1. `result.json` 正常返回
2. `plan.json` 有 3 条计划
3. 3 条写表全部成功
4. 三张表状态与预期一致
