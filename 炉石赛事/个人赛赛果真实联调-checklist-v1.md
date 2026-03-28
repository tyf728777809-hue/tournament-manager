# 个人赛赛果真实联调 checklist v1

> 日期：2026-03-29

## 1. 目的

这份 checklist 只解决一件事：

**把个人赛赛果链路从“离线 write_plan 已补齐”推进到“真实权限分支已跑过并留痕”。**

当前基础已具备：
- `submit / confirm / reject / timeout / admin-confirm`
- `context.prefetched -> write_plan`
- prefetched 组装器
- prefetched 统一入口
- 五条端到端模板

当前唯一显著 blocker：
- `solo_test_001` / `solo_test_002` 仍绑定同一个 `feishu_open_id`
- 所以 `confirm / reject` 的真实双人权限校验尚未彻底验完

---

## 2. 本次联调要验证什么

分两层看：

### 2.1 已经验证过的层
- 统一入口能基于 `prefetched` 产出正确 `write_plan`
- 当前会话可按 `write_plan` 串行写真实表
- `confirm` 已有一轮真实表补测通过

### 2.2 这次必须补齐的层
- `submit` 的提交人确实只能由对局一方触发
- `confirm` 的确认人确实是**另一方真实 open_id**
- `reject` 的拒绝人确实是**另一方真实 open_id**
- 同一 open_id 不会被误判成双边都合法
- `timeout / admin-confirm` 在真实样本上仍可与前序状态顺滑衔接

---

## 3. 联调前准备 checklist

### 3.1 样本准备
- [ ] 确认目标赛事：`HS202603-TEST-SOLO`
- [ ] 确认目标对局：`MATCH-HS202603-TEST-SOLO-001`
- [ ] 确认双方 player 记录存在
- [ ] 确认双方 player 记录对应 **两个不同的 `feishu_open_id`**
- [ ] 记录 side_a / side_b 各自的 open_id
- [ ] 记录本轮管理员 open_id

### 3.2 环境准备
- [ ] 当前分支代码包含最近这几段提交后的状态：`55e115f -> f82556c` 这条线及其后续
- [ ] 主入口文档确认使用：`炉石赛事/个人赛赛果链路操作总入口-v1.md`
- [ ] 本轮联调目录已新建，例如：`tmp/solo-real-check-20260329/`
- [ ] 本轮使用“当前会话执行 write_plan”的方式，不依赖 shell token

### 3.3 基础数据快照
- [ ] 读取并保存 `match.json`
- [ ] 读取并保存 `players.json`
- [ ] 如有旧赛果，先读取并保存旧 `report.json`
- [ ] 如有旧争议，先读取并保存旧 `disputes.json`
- [ ] 记录联调前 `matches` 当前状态（尤其是 `match_status / result_status / latest_result_report_uid / completed_at`）

---

## 4. 样本复位 checklist

如果该对局之前已经跑过联调，先复位，避免旧状态污染观察。

### 4.1 matches 侧
- [ ] `match_status` 是否仍是 `completed / disputed`
- [ ] `result_status` 是否仍是 `confirmed / disputed / pending_admin_review`
- [ ] `winner_side` 是否仍残留
- [ ] `latest_result_report_uid` 是否仍指向旧报告
- [ ] `completed_at` 是否仍残留

### 4.2 result_reports 侧
- [ ] 旧 report 是否仍处于 `awaiting_opponent_confirmation / opponent_confirmed / opponent_rejected / awaiting_admin_review / admin_confirmed`
- [ ] 旧 report 是否需要标记失效或单独换新样本对局

### 4.3 disputes 侧
- [ ] 是否已有旧 dispute 挂在当前 match/report 上
- [ ] 若保留旧 dispute，是否会干扰管理员分支观察

> 建议：
> - **confirm 演练**、**reject -> admin-confirm 演练**、**timeout -> admin-confirm 演练** 最好拆成不同样本或不同复位轮次。
> - 不建议把一条真实样本连续滚过所有终态后再强行回退。

---

## 5. 推荐真实联调顺序

### 5.1 轮次 A：submit -> confirm（验证真实双人确认）
- [ ] side_a 或 side_b 任选一方提交赛果
- [ ] 生成新的 `result_report_uid`
- [ ] 读取新 `report.json`
- [ ] 另一方真实 open_id 执行 `confirm`
- [ ] 复核 `result_reports / matches`

**通过标准：**
- [ ] `report_status = opponent_confirmed`
- [ ] `opponent_confirmation_status = confirmed`
- [ ] `match_status = completed`
- [ ] `result_status = confirmed`
- [ ] `winner_side` 回写正确
- [ ] 使用提交人本人 open_id 重跑 confirm 时，应被拒绝或不视为“对手确认”

### 5.2 轮次 B：submit -> reject（验证真实双人拒绝）
- [ ] 新开一条可用样本或先完成复位
- [ ] 一方提交赛果
- [ ] 另一方真实 open_id 执行 `reject`
- [ ] 复核 `result_reports / matches / disputes`

**通过标准：**
- [ ] `report_status = opponent_rejected`
- [ ] `match_status = disputed`
- [ ] 自动生成关联 `dispute`
- [ ] 管理员分支可继续接上

### 5.3 轮次 C：submit -> timeout -> admin-confirm
- [ ] 新开一条可用样本或先完成复位
- [ ] 一方提交赛果
- [ ] 模拟对手超时升级
- [ ] 管理员执行 `admin-confirm`
- [ ] 复核 `result_reports / matches / disputes`

**通过标准：**
- [ ] `timeout` 后 `report_status = awaiting_admin_review`
- [ ] `opponent_confirmation_status = timeout`
- [ ] `admin-confirm` 后 `report_status = admin_confirmed`
- [ ] `match_status = completed`
- [ ] `result_status = confirmed`
- [ ] 若存在 dispute，其最终状态已同步收口

---

## 6. 每轮固定操作流 checklist

每个动作统一按这条线走，不再临场拼装。

### 6.1 读真实表
- [ ] 读取 `matches`
- [ ] 读取 `players`
- [ ] 如动作需要，读取 `result_reports`
- [ ] 如动作需要，读取 `admins / disputes`

### 6.2 组装 prefetched
- [ ] 运行 `scripts/build-solo-result-prefetched.js`
- [ ] 检查 `prefetched.json` 已包含：
  - [ ] `match`
  - [ ] `players`
  - [ ] `report`（若需要）
  - [ ] `admins`（若需要）
  - [ ] `disputes`（若需要）
  - [ ] `sideContext`

### 6.3 统一入口产 plan
- [ ] 运行 `scripts/run-callback-with-prefetched.js`
- [ ] 检查 `result.json` 成功返回
- [ ] 检查 `plan.json` 条数与顺序符合预期
- [ ] 如有需要，先渲染 `write_plan` 再复核

### 6.4 当前会话执行 plan
- [ ] 按 `sequence` 串行执行
- [ ] 不并发写表
- [ ] 每步记录成功/失败结果

### 6.5 落表复核
- [ ] 重读目标表
- [ ] 对照模板确认字段值
- [ ] 记录最终证据（report uid / dispute uid / match status）

---

## 7. 证据留存 checklist

每轮至少留以下证据，方便回看与补文档：

- [ ] 使用的 `match_uid`
- [ ] 使用的 `result_report_uid`
- [ ] submit 方 open_id
- [ ] confirm/reject 方 open_id
- [ ] admin open_id（如有）
- [ ] `result.json`
- [ ] `plan.json`
- [ ] 执行后的表状态摘录
- [ ] 最终结论：通过 / 未通过 / 样本阻塞

推荐在每轮目录里保留：

```text
tmp/solo-real-check-20260329/
  round-a-confirm/
  round-b-reject/
  round-c-timeout-admin/
```

---

## 8. 当前最关键的额外断言

这次真实联调不要只看“能写进去”，还要刻意确认以下断言：

### 8.1 身份断言
- [ ] 提交人 = 对局参与方之一
- [ ] 确认/拒绝人 = 另一方参与者
- [ ] 管理员 != 普通对局参与者（若业务要求如此）

### 8.2 分支断言
- [ ] 同一个 open_id 不应同时被判定为 submit 方与 opponent 方
- [ ] `test_as_side` 只用于受控测试，不应出现在真实双人联调最终结论里
- [ ] 真实样本验证通过后，应明确标记“已脱离 bypass 场景”

---

## 9. 本轮完成标准

满足以下条件，才算“个人赛赛果真实联调”真正补齐：

- [ ] 已有 **第二个真实 Feishu open_id 样本**
- [ ] `submit -> confirm` 以真实双人 open_id 跑通
- [ ] `submit -> reject` 以真实双人 open_id 跑通
- [ ] `timeout -> admin-confirm` 能在真实样本上收口
- [ ] 至少一份联调摘要把结果和 blocker 写清楚

---

## 10. 这份 checklist 用在什么场景

以后遇到以下情况，优先先开这份 checklist：
- 要做真实表联调
- 要复位旧样本再演练
- 要确认“这次到底验的是 write_plan，还是验的真实权限分支”
- 要把结果整理成摘要/commit 前先核一遍

它的作用不是替代模板文档，而是把“现场执行顺序”和“通过标准”钉死。