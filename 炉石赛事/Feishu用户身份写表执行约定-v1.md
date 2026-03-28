# Feishu 用户身份写表执行约定 v1

> 日期：2026-03-29

## 1. 目标

把 `callback-handler.js` 在 `writeMode = user_identity_plan` 下产出的 `execution.write_plan`，稳定地交给当前会话的用户身份工具执行。

目标不是让 Node 脚本直接写飞书，而是形成一个固定约定：

1. **业务逻辑层**：`callback-handler.js`
   - 负责权限校验
   - 负责状态机推进
   - 负责计算“应该写什么”
2. **执行层**：当前会话
   - 串行调用 `feishu_bitable_app_table_record`
   - 把 `write_plan` 真正落到用户有权限的多维表格

这样后续就不再依赖 shell 里是否有 `FEISHU_ACCESS_TOKEN` 来完成最终写表。

---

## 2. 当前约定版本

- `write_plan_version = feishu-user-executor/v1`
- 执行工具：`feishu_bitable_app_table_record`
- 执行策略：**严格按 sequence 串行执行**

---

## 3. write_plan 数据结构

在 `user_identity_plan` 模式下，`handleCallback()` 的返回值会附带：

```json
{
  "execution": {
    "write_mode": "user_identity_plan",
    "write_plan_version": "feishu-user-executor/v1",
    "executor_contract": {
      "tool": "feishu_bitable_app_table_record",
      "mode": "serial"
    },
    "write_plan": [
      {
        "planVersion": "feishu-user-executor/v1",
        "sequence": 1,
        "kind": "create",
        "appToken": "KL3TbTEJIa5oytspkGGcf50rnpc",
        "tableId": "tblvNYkA4aa44mDe",
        "appAlias": "operation",
        "tableAlias": "resultReports",
        "executor": {
          "tool": "feishu_bitable_app_table_record",
          "action": "create",
          "serialize": "as-is",
          "mode": "serial"
        },
        "fields": {
          "result_report_uid": "RPT-xxx",
          "report_status": "awaiting_opponent_confirmation"
        }
      },
      {
        "planVersion": "feishu-user-executor/v1",
        "sequence": 2,
        "kind": "update",
        "appToken": "KL3TbTEJIa5oytspkGGcf50rnpc",
        "tableId": "tblgnkqFLhTUkY4c",
        "appAlias": "operation",
        "tableAlias": "matches",
        "executor": {
          "tool": "feishu_bitable_app_table_record",
          "action": "update",
          "serialize": "as-is",
          "mode": "serial"
        },
        "recordId": "recxxxx",
        "fields": {
          "match_status": "result_pending_confirmation",
          "result_status": "pending_opponent_confirmation"
        }
      }
    ]
  }
}
```

### 关键字段说明

- `sequence`：执行顺序，必须严格递增串行执行
- `kind`：`create | update`
- `appToken / tableId`：真实飞书目标
- `appAlias / tableAlias`：仅供人读和调试
- `fields`：**原样透传** 给 `feishu_bitable_app_table_record`
- `recordId`：仅 `update` 需要
- `upsertBy`：若存在，仅表示该条计划来源于 `upsert` 逻辑，执行层不需要再次查重

---

## 4. 执行器规则

当前会话拿到 `write_plan` 后，按下面规则执行：

### 4.1 create

把计划项：

```json
{
  "kind": "create",
  "appToken": "APP",
  "tableId": "TABLE",
  "fields": {"A": 1}
}
```

转换成工具调用：

```json
{
  "action": "create",
  "app_token": "APP",
  "table_id": "TABLE",
  "fields": {"A": 1}
}
```

### 4.2 update

把计划项：

```json
{
  "kind": "update",
  "appToken": "APP",
  "tableId": "TABLE",
  "recordId": "rec123",
  "fields": {"A": 2}
}
```

转换成工具调用：

```json
{
  "action": "update",
  "app_token": "APP",
  "table_id": "TABLE",
  "record_id": "rec123",
  "fields": {"A": 2}
}
```

---

## 5. 严格约束

1. **串行，不并发**
   - 同一数据表禁止并发写
   - 默认整个 `write_plan` 都按 `sequence` 串行跑

2. **字段不重写**
   - `fields` 原样透传
   - 不在执行器层做字段名映射、不补默认值、不改类型

3. **record_id 由业务层提供**
   - 执行器不负责再次搜索记录
   - `update` 缺 `recordId` 直接视为非法计划

4. **失败即停**
   - 任何一步写失败，停止继续执行
   - 记录失败的 `sequence`、目标表、错误信息

5. **先业务计算，后执行**
   - 执行器不做业务判断
   - 它只负责“按计划写表”

---

## 6. 推荐流程

### 方案 A：shell 里生成 plan，再由当前会话执行

```bash
node scripts/hs-solo-result-smoke.js confirm \
  --match MATCH-xxx \
  --report RPT-xxx \
  --operator ou_xxx \
  --write-mode user_identity_plan \
  --plan-out tmp/confirm-plan.json
```

然后：

```bash
node scripts/render-feishu-write-plan.js --in tmp/confirm-plan.json
```

当前会话读取渲染结果后，用 `feishu_bitable_app_table_record` 串行执行。

### 方案 B：当前会话直接拿到 callback 返回结果并执行

如果当前会话已经拿到了 `result.execution.write_plan`，就不必经过本地文件，直接按 `sequence` 调工具即可。

---

## 7. 为什么这套约定有用

它把问题拆成了两半：

- **callback-handler** 解决“该写什么”
- **Feishu 用户身份工具** 解决“谁有权限写”

这让我们后续可以继续把：

- `timeout -> admin_confirm`
- `confirm / reject`
- `BO5 小局推进`
- `争议裁决闭环`

都挂到同一套执行器上，而不是每条链路都单独处理一次用户身份写表。

---

## 8. 当前限制

这份约定解决的是**执行层**问题，不自动解决**plan 生成层**问题。

也就是说：
- 如果 shell 没有 `FEISHU_ACCESS_TOKEN`
- 而 callback 逻辑又需要先读真实飞书表做权限/状态判断

那么 shell 侧仍然可能无法直接产出 `write_plan`。

因此下一步可继续做两个方向：

1. 把“生成计划所需的最小读依赖”迁到当前会话工具侧
2. 或者补一个“callback 结果 -> 当前会话接管执行”的更顺手入口
