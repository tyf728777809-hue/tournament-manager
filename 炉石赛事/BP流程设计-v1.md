# BP流程设计 v1

> 炉石赛事自动化系统 - Ban/Pick 阶段管理
> 版本: v1.0 | 日期: 2026-03-28
> 适用: 战队赛（十一职业 BP KOF）

---

## 1. BP 规则回顾（战队赛）

### 1.1 完整流程
```
ban1 → protect1 → ban2 → 选择出阵职业
```

### 1.2 详细步骤
| 阶段 | 动作 | 说明 |
|------|------|------|
| ban1 | 双方同时 ban 1 个职业 | 被 ban 职业不可用 |
| protect1 | 双方同时 protect 1 个职业 | 被 protect 职业对方不可 ban |
| ban2 | 双方同时再 ban 2 个职业 | 累计 ban 3 个职业 |
| 出阵选择 | 队长选择出场职业 | 从剩余 8 个职业中选择出场顺序 |

### 1.3 关键规则
- 被 ban 职业：双方都不能使用
- 被 protect 职业：对方不能 ban，但自己可以使用
- 出阵选择：队长决定前6个出场职业（BO5先到3胜，但KOF需要准备更多）
- 每局结束 3 分钟内决定下一局出场，超时判负

---

## 2. 数据模型

### 2.1 bp_rounds 表（已存在）

| 字段 | 说明 |
|------|------|
| bp_round_uid | 主键 |
| match_uid | 关联对局 |
| side_a_entity_name | A方名称 |
| side_b_entity_name | B方名称 |
| side_a_submission_uid | A方卡组提交ID |
| side_b_submission_uid | B方卡组提交ID |
| bp_status | 当前状态 |
| deadline_at | 截止时间 |

**bp_status 状态值：**
- `pending_notification` - 等待通知
- `waiting_side_a` - 等待A方提交
- `waiting_side_b` - 等待B方提交
- `waiting_both` - 等待双方提交
- `both_submitted` - 双方已提交
- `public_announced` - 已公示
- `cancelled` - 已取消

### 2.2 bp_actions 表（已存在）

| 字段 | 说明 |
|------|------|
| bp_action_uid | 主键 |
| bp_round_uid | 关联bp_round |
| side_label | side_a / side_b |
| actor_display_name | 操作人显示名 |
| banned_deck_class | 被ban职业 |
| action_status | 动作状态 |

**action_status 状态值：**
- `pending` - 等待提交
- `submitted` - 已提交
- `confirmed` - 已确认
- `timeout` - 超时

### 2.3 建议新增：match_class_states 表

用于记录每局后的职业锁定状态：

| 字段 | 说明 |
|------|------|
| match_class_state_uid | 主键 |
| match_uid | 关联对局 |
| game_number | 第几局（1-11） |
| side_a_locked_class | A方已锁定职业（败者） |
| side_b_locked_class | B方已锁定职业（败者） |
| winner_side | 胜者 side |
| locked_at | 锁定时间 |

---

## 3. BP 状态机

### 3.1 整体流程

```
init
  ↓
pending_notification（创建BP轮次，通知双方）
  ↓
ban1_phase（进入ban1阶段）
  ↓
waiting_both（等待双方ban1）
  ↓
both_submitted（双方已提交ban1）
  ↓
protect1_phase（进入protect1阶段）
  ↓
waiting_both（等待双方protect1）
  ↓
both_submitted（双方已提交protect1）
  ↓
ban2_phase（进入ban2阶段）
  ↓
waiting_both（等待双方ban2）
  ↓
both_submitted（双方已提交ban2）
  ↓
lineup_phase（进入出阵选择阶段）
  ↓
waiting_side_a / waiting_side_b（等待队长提交出阵）
  ↓
both_submitted（出阵已提交）
  ↓
public_announced（BP结果已公示）
  ↓
match_start（比赛开始）
```

### 3.2 每局后的职业锁定

```
match_start
  ↓
game_1_start
  ↓
game_1_end（记录败者职业锁定）
  ↓
lineup_adjustment（队长可调整后续出场）
  ↓
game_2_start
  ↓
...
```

---

## 4. 交互流程

### 4.1 Ban1 阶段

**触发：** 比赛时间到，管理员启动BP

**系统动作：**
1. 创建 bp_rounds 记录
2. 查询双方卡组提交（side_a/b_submission_uid）
3. 获取双方11套卡组职业列表
4. 发送私聊卡片给双方队长

**队长看到的卡片：**
```
🎯 BP Phase 1/4 - Ban 1 职业

对方11职业：死亡骑士、恶魔猎手、德鲁伊、猎人、法师、圣骑士、牧师、潜行者、萨满、术士、战士

请选择要 Ban 的职业：
[死亡骑士] [恶魔猎手] [德鲁伊] ... [战士]

⏰ 剩余时间：2分30秒
```

**队长操作：**
- 点击选择要 ban 的职业
- 确认提交

**系统处理：**
- 接收双方选择
- 校验：不能重复 ban 同一职业（双方可以 ban 相同职业吗？规则待定）
- 更新 bp_actions 表
- 更新 bp_rounds.bp_status = both_submitted

### 4.2 Protect1 阶段

**触发：** 双方完成 ban1

**系统动作：**
1. 扣除被 ban 职业
2. 发送私聊卡片给双方队长

**队长看到的卡片：**
```
🛡️ BP Phase 2/4 - Protect 1 职业

已生效 Ban：法师、猎人（双方各ban1，共2个）

剩余可选职业：死亡骑士、恶魔猎手、德鲁伊、圣骑士、牧师、潜行者、萨满、术士、战士（9个）

请选择要 Protect 的职业：
[死亡骑士] [恶魔猎手] [德鲁伊] ... [战士]

💡 Protect 后对方不能 ban 该职业，但你可以使用
⏰ 剩余时间：2分30秒
```

### 4.3 Ban2 阶段

**触发：** 双方完成 protect1

**系统动作：**
1. 扣除被 protect 职业（从对方可选列表中移除）
2. 发送私聊卡片给双方队长

**队长看到的卡片：**
```
🎯 BP Phase 3/4 - Ban 2 职业

已生效：
- Ban：法师、猎人
- Protect：死亡骑士（我方）、德鲁伊（对方）

剩余可选职业：恶魔猎手、圣骑士、牧师、潜行者、萨满、术士、战士（7个）

请选择要 Ban 的 2 个职业：
[恶魔猎手☑️] [圣骑士☑️] [牧师] [潜行者] [萨满] [术士] [战士]

⏰ 剩余时间：2分30秒
```

### 4.4 出阵选择阶段

**触发：** 双方完成 ban2

**系统动作：**
1. 计算最终可用职业（11 - 3 ban = 8个）
2. 发送私聊卡片给双方队长

**队长看到的卡片：**
```
⚔️ BP Phase 4/4 - 选择出阵职业

最终可用职业（8个）：
死亡骑士、恶魔猎手、圣骑士、牧师、潜行者、萨满、术士、战士

请按出场顺序选择前6个职业：
1. [死亡骑士☑️]
2. [恶魔猎手☑️]
3. [圣骑士☑️]
4. [牧师☑️]
5. [潜行者☑️]
6. [萨满☑️]

💡 KOF规则：败者职业锁定，胜者继续
⏰ 剩余时间：3分钟
```

### 4.5 BP结果公示

**触发：** 双方完成出阵选择

**系统动作：**
1. 汇总BP结果
2. 发送到比赛群

**群消息：**
```
📢 BP结果公示

🔴 烈火战队 vs 🔵 冰霜战队

Ban 阶段：
- 烈火：Ban 法师、猎人、潜行者
- 冰霜：Ban 圣骑士、牧师、术士

Protect 阶段：
- 烈火：Protect 死亡骑士
- 冰霜：Protect 战士

出阵顺序：
- 烈火：死亡骑士 → 恶魔猎手 → 德鲁伊 → ...
- 冰霜：战士 → 萨满 → 猎人 → ...

比赛即将开始！
```

---

## 5. 超时处理

### 5.1 各阶段超时规则

| 阶段 | 超时时间 | 超时处理 |
|------|---------|---------|
| ban1 | 3分钟 | 判负1局，对方选择ban |
| protect1 | 3分钟 | 判负1局，对方选择protect |
| ban2 | 3分钟 | 判负1局，对方选择ban |
| 出阵选择 | 3分钟 | 判负1局，对方选择出阵 |
| 每局后调整 | 3分钟 | 判负1局，败者职业锁定 |

### 5.2 超时实现

- 使用 cron 定时任务检查 deadline_at
- 超时后自动更新 action_status = timeout
- 通知管理员和双方队长

---

## 6. 代码实现要点

### 6.1 新增 Action

```javascript
// BP 相关 Action
'init_bp_round': initBPRound,           // 初始化BP
'submit_ban': submitBan,                // 提交ban
'submit_protect': submitProtect,        // 提交protect
'submit_lineup': submitLineup,          // 提交出阵
'get_bp_status': getBPStatus,           // 查询BP状态
'adjust_lineup': adjustLineup,          // 调整出阵（每局后）
```

### 6.2 核心函数

```javascript
/**
 * 初始化BP轮次
 */
async function initBPRound(params) {
  const { match_uid, side_a_uid, side_b_uid } = params;
  
  // 1. 创建 bp_rounds 记录
  // 2. 查询双方卡组
  // 3. 发送BP通知给双方队长
}

/**
 * 提交ban
 */
async function submitBan(params) {
  const { bp_round_uid, side_label, banned_class } = params;
  
  // 1. 校验当前阶段
  // 2. 创建/更新 bp_actions 记录
  // 3. 检查双方是否都已提交
  // 4. 如都提交，进入下一阶段
}

/**
 * 提交出阵
 */
async function submitLineup(params) {
  const { bp_round_uid, side_label, lineup } = params;
  
  // 1. 校验lineup合法性（8选6，不重复）
  // 2. 保存出阵顺序
  // 3. 检查双方是否都已提交
  // 4. 如都提交，公示BP结果
}
```

---

## 7. 下一步

1. **实现BP核心代码** - 添加到 callback-handler.js
2. **创建BP测试数据** - 模拟一场完整BP
3. **验证超时机制** - 测试超时判负逻辑

---

*文档版本: v1.0 | 作者: Niko*
