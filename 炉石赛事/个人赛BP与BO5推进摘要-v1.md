# 个人赛 BP 与 BO5 推进摘要 v1

> 日期：2026-03-28
> 测试赛事：`HS202603-TEST-SOLO`

## 1. 本轮目标

验证个人赛在“正式公示”之后，是否能够继续推进到：
- 对局创建
- ban1 阶段
- 进入 BO5 征服 ready 状态

## 2. 已创建的新增测试数据

### 2.1 对手选手样本
- `P-HS202603TESTSOLO-OPP001`
- 昵称：小乙
- player_id：`solo_test_002`

### 2.2 对手报名记录
- `REG-HS202603TESTSOLO-PHS202603TESTSOLOOPP001`
- 状态：`approved`

### 2.3 对手卡组提交
- `DECKSUB-HS202603TESTSOLO-PHS202603TESTSOLOOPP001-V1`
- 状态：`approved`
- 已配 4 套卡组：
  - 圣骑士：快攻骑
  - 术士：控制术
  - 德鲁伊：跳费德
  - 萨满祭司：元素萨

### 2.4 测试对局
- `MATCH-HS202603-TEST-SOLO-001`
- 对阵：小甲 vs 小乙
- 当前状态：`ready`
- 当前 BP 状态：`finished`

### 2.5 BP 轮次
- `BP-MATCH-HS202603-TEST-SOLO-001-01`
- 阶段：`solo_ban1`
- 当前状态：`public_announced`

### 2.6 BP 动作
- side_a（小甲）ban：法师
- side_b（小乙）ban：圣骑士

## 3. 当前结果

本轮已经真实推进到：
1. 个人赛双方有效卡组样本准备完成
2. 创建一场 `waiting_bp` 的对局
3. 创建一轮 `solo_ban1` BP 轮次
4. 双方 ban1 动作已写入 `bp_actions`
5. ban1 公示文本已生成
6. 对局状态已推进为 `ready`

这意味着：
- **个人赛 ban1 已有真实测试数据闭环**
- 当前已经能够把一场个人赛推进到“BO5 征服可开打”的状态

## 4. 下一步建议

最值得继续补的有两条：

### A. 小局级征服推进
新增/明确：
- Game 1 / Game 2 / Game 3 ...
- 每小局双方使用职业
- 每小局胜者 / 败者
- 征服后职业池变化

### B. 赛果上报
新增/明确：
- 一方上报比分
- 对手确认比分
- 最终 winner / final_result_text 写回 matches

## 5. 当前判断

炉石赛事系统现在已经具备：
- 战队赛 P0 主链路闭环
- 个人赛报名 / 卡组 / 公示闭环
- 个人赛 ban1 → BO5 ready 的真实测试样本

下一阶段最合理的任务是：
**补“个人赛小局级征服推进 + 赛果上报确认”**
