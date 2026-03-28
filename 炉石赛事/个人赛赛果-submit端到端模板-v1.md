# 个人赛赛果 submit 端到端模板 v1

> 日期：2026-03-29

## 1. 目标

固化 `submit_match_result_report` 的标准工作流。

这条模板覆盖：

1. 当前会话读取真实表
2. 组装 `prefetched.json`
3. 统一入口生成 `write_plan`
4. 当前会话串行执行 `write_plan`
5. 复核 `result_reports / matches`

---

## 2. 推荐目录

```bash
tmp/solo-submit/
```

文件建议：
- `callback.json`
- `context.json`
- `match.json`
- `players.json`
- `prefetched.json`
- `result.json`
- `plan.json`

---

## 3. callback.json

```json
{
  "action": "submit_match_result_report",
  "match_uid": "MATCH-HS202603-TEST-SOLO-001",
  "result_report_uid": "RPT-MATCH-HS202603-TEST-SOLO-001-NEW",
  "final_result_text": "小甲 3:1 小乙"
}
```

> 如果联调样本双方共用一个 open_id，`submit` 分支本身通常不需要 `test_as_side`；只有在你想显式模拟 side 时才补。

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
- `players`：读取双方选手记录

保存到：
- `tmp/solo-submit/match.json`
- `tmp/solo-submit/players.json`

---

## 6. 组装 prefetched.json

```bash
node scripts/build-solo-result-prefetched.js \
  --match-file tmp/solo-submit/match.json \
  --players-file tmp/solo-submit/players.json \
  --out tmp/solo-submit/prefetched.json
```

输出里会自动包含：
- `match`
- `players`
- `sideContext`

---

## 7. 生成 write_plan

```bash
node scripts/run-callback-with-prefetched.js \
  --callback tmp/solo-submit/callback.json \
  --prefetched tmp/solo-submit/prefetched.json \
  --context tmp/solo-submit/context.json \
  --result-out tmp/solo-submit/result.json \
  --plan-out tmp/solo-submit/plan.json \
  --render-plan
```

预期：
- `write_plan_count = 2`
- 顺序：
  1. `create resultReports`
  2. `update matches`

---

## 8. 执行 plan.json

按 `sequence` 串行执行：

1. `create result_reports`
2. `update matches`

> 不要并发执行。

---

## 9. 落表复核

### result_reports 预期
- 新建 1 条赛果记录
- `report_status = awaiting_opponent_confirmation`
- `opponent_confirmation_status = pending`
- `final_applied_to_match = false`
- `opponent_confirm_deadline_at` 已写入

### matches 预期
- `match_status = result_pending_confirmation`
- `result_status = pending_opponent_confirmation`
- `latest_result_report_uid` 已写回
- `updated_at` 已刷新

---

## 10. 成功判定

以下全部满足即通过：
1. `result.json` 正常返回
2. `plan.json` 有 2 条计划
3. 两条写表全部成功
4. `result_reports / matches` 状态与预期一致

---

## 11. 与后续分支的衔接

`submit` 跑完后，后续通常进入以下任一路径：

- `confirm`
- `reject`
- `timeout`
- `admin-confirm`（管理员兜底）

因此它是整条个人赛赛果链路的起点模板。
