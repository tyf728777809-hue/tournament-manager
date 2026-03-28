# 个人赛赛果 admin-confirm 端到端模板 v1

> 日期：2026-03-29

## 1. 目标

固化 `admin_confirm_match_result_report` 的标准工作流。

---

## 2. 推荐目录

```bash
tmp/solo-admin-confirm/
```

文件建议：
- `callback.json`
- `context.json`
- `match.json`
- `players.json`
- `report.json`
- `admins.json`
- `disputes.json`（若当前 report 已关联争议）
- `prefetched.json`
- `result.json`
- `plan.json`

---

## 3. callback.json

```json
{
  "action": "admin_confirm_match_result_report",
  "match_uid": "MATCH-HS202603-TEST-SOLO-001",
  "result_report_uid": "RPT-MATCH-HS202603-TEST-SOLO-001-1774717992036",
  "admin_open_id": "ou_admin"
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
- `tournament_admins`
- 若 report 已关联争议，则读取 `disputes`

保存到：
- `tmp/solo-admin-confirm/match.json`
- `tmp/solo-admin-confirm/report.json`
- `tmp/solo-admin-confirm/players.json`
- `tmp/solo-admin-confirm/admins.json`
- `tmp/solo-admin-confirm/disputes.json`

---

## 6. 组装 prefetched.json

```bash
node scripts/build-solo-result-prefetched.js \
  --match-file tmp/solo-admin-confirm/match.json \
  --players-file tmp/solo-admin-confirm/players.json \
  --report-file tmp/solo-admin-confirm/report.json \
  --admins-file tmp/solo-admin-confirm/admins.json \
  --disputes-file tmp/solo-admin-confirm/disputes.json \
  --permission-role admin \
  --out tmp/solo-admin-confirm/prefetched.json
```

---

## 7. 生成 write_plan

```bash
node scripts/run-callback-with-prefetched.js \
  --callback tmp/solo-admin-confirm/callback.json \
  --prefetched tmp/solo-admin-confirm/prefetched.json \
  --context tmp/solo-admin-confirm/context.json \
  --result-out tmp/solo-admin-confirm/result.json \
  --plan-out tmp/solo-admin-confirm/plan.json \
  --render-plan
```

预期：
- `write_plan_count = 3`
- 顺序：
  1. `update resultReports`
  2. `update matches`
  3. `update disputes`（若存在关联争议）

---

## 8. 执行 plan.json

按 `sequence` 串行执行。

---

## 9. 落表复核

### result_reports 预期
- `report_status = admin_confirmed`
- `opponent_confirmation_status = skipped`
- `reviewed_by` / `reviewed_at` 已写回
- `final_applied_to_match = true`

### matches 预期
- `match_status = completed`
- `result_status = confirmed`
- `winner_side` / `completed_at` 已写回

### disputes 预期（若存在）
- `dispute_status = resolved`
- `admin_decision_status = approved`
- `resolved_by` / `resolved_at` 已写回
- `applied_to_match = true`

---

## 10. 成功判定

1. `result.json` 正常
2. `plan.json` 与预期条数一致
3. 全部写表成功
4. 关联表状态与预期一致
