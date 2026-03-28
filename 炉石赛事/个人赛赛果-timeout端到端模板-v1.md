# 个人赛赛果 timeout 端到端模板 v1

> 日期：2026-03-29

## 1. 目标

固化 `escalate_match_result_report_timeout` 的标准工作流。

---

## 2. 推荐目录

```bash
tmp/solo-timeout/
```

文件建议：
- `callback.json`
- `context.json`
- `match.json`
- `players.json`
- `report.json`
- `admins.json`（建议）
- `prefetched.json`
- `result.json`
- `plan.json`

---

## 3. callback.json

```json
{
  "action": "escalate_match_result_report_timeout",
  "match_uid": "MATCH-HS202603-TEST-SOLO-001",
  "result_report_uid": "RPT-MATCH-HS202603-TEST-SOLO-001-1774717992036",
  "reason": "联调时强制模拟超时",
  "force": true
}
```

---

## 4. context.json

```json
{
  "operatorOpenId": "ou_admin",
  "writeMode": "user_identity_plan"
}
```

---

## 5. 当前会话读取真实表

至少需要：
- `matches`
- `result_reports`
- `players`
- `tournament_admins`（管理员分支建议读取）

保存到：
- `tmp/solo-timeout/match.json`
- `tmp/solo-timeout/report.json`
- `tmp/solo-timeout/players.json`
- `tmp/solo-timeout/admins.json`

---

## 6. 组装 prefetched.json

```bash
node scripts/build-solo-result-prefetched.js \
  --match-file tmp/solo-timeout/match.json \
  --players-file tmp/solo-timeout/players.json \
  --report-file tmp/solo-timeout/report.json \
  --admins-file tmp/solo-timeout/admins.json \
  --permission-role admin \
  --out tmp/solo-timeout/prefetched.json
```

---

## 7. 生成 write_plan

```bash
node scripts/run-callback-with-prefetched.js \
  --callback tmp/solo-timeout/callback.json \
  --prefetched tmp/solo-timeout/prefetched.json \
  --context tmp/solo-timeout/context.json \
  --result-out tmp/solo-timeout/result.json \
  --plan-out tmp/solo-timeout/plan.json \
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

按 `sequence` 串行执行。

---

## 9. 落表复核

### disputes 预期
- 新建 1 条争议记录
- `issue_type = other`
- `dispute_status = awaiting_admin_decision`

### result_reports 预期
- `report_status = awaiting_admin_review`
- `opponent_confirmation_status = timeout`
- `linked_dispute_uid` 已写回
- `escalated_to_admin_at` 已写回

### matches 预期
- `match_status = disputed`
- `result_status = disputed`
- `latest_dispute_uid` 已写回

---

## 10. 成功判定

1. `result.json` 正常
2. `plan.json` 有 3 条计划
3. 三条写表都成功
4. 三张表状态与预期一致
