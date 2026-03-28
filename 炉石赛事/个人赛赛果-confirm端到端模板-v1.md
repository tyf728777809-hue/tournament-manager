# 个人赛赛果 confirm 端到端模板 v1

> 日期：2026-03-29

## 1. 目标

把个人赛赛果 `confirm_match_result_report` 固化成一条标准工作流，减少每次真实联调时的临时拼装。

这条模板覆盖：

1. 当前会话读取真实表
2. 组装 `prefetched.json`
3. 统一入口生成 `write_plan`
4. 当前会话串行执行 `write_plan`
5. 落表后复核结果

---

## 2. 推荐目录

建议每次联调都落在一个临时目录里，例如：

```bash
tmp/solo-confirm/
```

其中：

- `callback.json`
- `context.json`
- `match.json`
- `players.json`
- `report.json`
- `prefetched.json`
- `result.json`
- `plan.json`

---

## 3. Step 0：准备 callback.json

```json
{
  "action": "confirm_match_result_report",
  "match_uid": "MATCH-HS202603-TEST-SOLO-001",
  "result_report_uid": "RPT-MATCH-HS202603-TEST-SOLO-001-1774717992036",
  "test_as_side": "side_b"
}
```

> 如果是真实双人样本，`test_as_side` 不需要。

---

## 4. Step 1：准备 context.json

```json
{
  "operatorOpenId": "ou_xxx",
  "writeMode": "user_identity_plan"
}
```

---

## 5. Step 2：当前会话读取真实表

至少需要 3 份输入：

### 5.1 matches

按 `match_uid` 读取 1 条：
- `MATCH-HS202603-TEST-SOLO-001`

### 5.2 result_reports

按 `result_report_uid` 读取 1 条：
- `RPT-MATCH-HS202603-TEST-SOLO-001-1774717992036`

### 5.3 players

读取对局双方选手记录：
- `side_a_player_uid`
- `side_b_player_uid`

把这三份原始结果分别保存为：

- `tmp/solo-confirm/match.json`
- `tmp/solo-confirm/report.json`
- `tmp/solo-confirm/players.json`

---

## 6. Step 3：组装 prefetched.json

```bash
node scripts/build-solo-result-prefetched.js \
  --match-file tmp/solo-confirm/match.json \
  --players-file tmp/solo-confirm/players.json \
  --report-file tmp/solo-confirm/report.json \
  --out tmp/solo-confirm/prefetched.json
```

输出里会自动包含：
- `match`
- `report`
- `players`
- `sideContext`

---

## 7. Step 4：生成 write_plan

```bash
node scripts/run-callback-with-prefetched.js \
  --callback tmp/solo-confirm/callback.json \
  --prefetched tmp/solo-confirm/prefetched.json \
  --context tmp/solo-confirm/context.json \
  --result-out tmp/solo-confirm/result.json \
  --plan-out tmp/solo-confirm/plan.json \
  --render-plan
```

预期：
- `write_plan_count = 2`
- 两条计划依次为：
  1. `update resultReports`
  2. `update matches`

---

## 8. Step 5：当前会话执行 plan.json

按 `sequence` 串行执行：

### 8.1 update result_reports

执行 `feishu_bitable_app_table_record.update`
- `app_token = operation`
- `table_id = resultReports`
- `record_id = report.record_id`
- `fields = plan[1].fields`

### 8.2 update matches

执行 `feishu_bitable_app_table_record.update`
- `app_token = operation`
- `table_id = matches`
- `record_id = match.record_id`
- `fields = plan[2].fields`

> 不要并发执行。

---

## 9. Step 6：落表复核

执行后重新读取：

### result_reports 预期
- `report_status = opponent_confirmed`
- `opponent_confirmation_status = confirmed`
- `final_applied_to_match = true`

### matches 预期
- `match_status = completed`
- `result_status = confirmed`
- `winner_side` 已写回
- `completed_at` 已刷新

---

## 10. 成功判定

满足以下条件即可认为 confirm 链路跑通：

1. `result.json` 成功返回
2. `plan.json` 正常生成
3. 当前会话 2 条写表都成功
4. 复核时 `result_reports / matches` 状态与预期一致

---

## 11. 如何扩展到其他分支

这套模板只要替换 callback 和输入，就能迁移到：

- `reject_match_result_report`
- `escalate_match_result_report_timeout`
- `admin_confirm_match_result_report`

区别主要在：
- 是否需要 `admins.json`
- 是否需要 `disputes.json`
- write_plan 条数从 2 变成 3

所以 confirm 模板可以作为后续所有分支的母版。
