# 个人赛第二真实 Feishu open_id 样本方案 v1

> 日期：2026-03-29

## 1. 背景

当前个人赛赛果链路的主要 blocker 不是代码结构，而是**样本身份不够干净**：

- `solo_test_001`
- `solo_test_002`

这两个测试选手当前仍绑定同一个 `feishu_open_id`，导致：
- `confirm / reject` 虽然能产出正确 `write_plan`
- 也能把真实表状态写通
- 但仍不能证明“对手分支的真实权限校验已通过”

所以这一步的目标很明确：

**准备第二个真实 Feishu 身份样本，让 side_a / side_b 具备两个不同 open_id。**

---

## 2. 成功标准

只要满足下面 3 条，就算样本方案可执行：

1. 当前测试对局双方对应到 **两个不同的 `feishu_open_id`**
2. 两个 open_id 都能在当前业务链路里被识别为合法对局参与者
3. 不需要再依赖 `HS_SOLO_RESULT_TEST_BYPASS=1` 或 `test_as_side`

---

## 3. 推荐方案排序

### 方案 A（首选）：给现有 `solo_test_002` 换绑第二个真实员工 open_id

**做法：**
- 保留现有赛事、对局、player_uid、match_uid 不变
- 只把 `solo_test_002` 对应 player 记录的 Feishu 身份字段，换成另一个真实员工 open_id

**优点：**
- 对现有模板、脚本、文档改动最小
- 仍可继续使用 `MATCH-HS202603-TEST-SOLO-001`
- 不需要重新造第二套样本赛事

**缺点：**
- 要确认该员工愿意作为测试样本
- 要确认不会影响其他依赖该 player 记录的链路

**适用条件：**
- player 身份字段与比赛业务字段解耦较好
- 当前 `solo_test_002` 只是测试桩，不承载其他稳定演示用途

---

### 方案 B（次选）：新增一个测试 player，并把对局 side_b 切到新 player_uid

**做法：**
- 新建一个测试选手，例如 `solo_test_003`
- 绑定第二个真实 `feishu_open_id`
- 把目标测试对局的 side_b player 指向新 player_uid

**优点：**
- 不污染现有 `solo_test_002`
- 样本语义更干净：一人一个 player_uid
- 后续更容易扩成多条测试对局

**缺点：**
- 改动面比方案 A 大
- 需要确认 `matches / players / 可能的报名/赛事映射` 是否同步
- 可能牵涉更多数据复位

**适用条件：**
- 当前测试数据允许轻量扩容
- 希望把“同 open_id 双人假样本”彻底留作历史而非继续修补

---

### 方案 C（保底）：新增一条全新个人赛测试对局，双方都绑定真实 open_id

**做法：**
- 保留老样本不动
- 新开一条专门用于真实权限联调的 match
- 两侧分别绑定两个真实 open_id

**优点：**
- 最不污染旧样本
- 最容易做到“联调证据独立留档”
- 适合后续形成长期保留样本

**缺点：**
- 成本最高
- 需要补更多初始化数据
- 当前所有模板中的 `match_uid` 需要替换

**适用条件：**
- 现有 `MATCH-HS202603-TEST-SOLO-001` 已经被反复演练，状态杂质较多
- 希望以后把真实联调和历史 smoke 样本完全隔离

---

## 4. 本轮建议选哪一个

**建议优先走方案 A，必要时退到方案 B。**

原因：
1. 你当前已经围绕 `MATCH-HS202603-TEST-SOLO-001`、五条模板、prefetched 输入做了大量固化
2. 方案 A 最省迁移成本，最快把 blocker 拆掉
3. 如果发现 `solo_test_002` 被其他链路复用，再切方案 B 也不迟

换句话说：
- **先追求“最快得到两个真实 open_id”**
- 不急着一上来就重建整套测试赛事

---

## 5. 方案 A 的具体落地步骤

### Step 1：确认第二个真实 open_id 候选人

需要一个满足以下条件的人：
- 能在飞书里真实操作卡片 / 回调
- 愿意配合一次 submit/confirm/reject 联调
- 不与 `solo_test_001` 当前绑定 open_id 相同

最少要拿到：
- `ou_xxx`
- 对应姓名/显示名

### Step 2：定位 player 表中身份字段

确认 `solo_test_002` 当前 player 记录里，哪一个字段真正承载 Feishu 身份。

常见可能字段（以真实表为准，先查再动）：
- `feishu_open_id`
- `user_open_id`
- `lark_open_id`
- 其他等价字段

> 这一步一定先读表确认，不要凭记忆改字段名。

### Step 3：评估影响面

在改绑前，先确认：
- 当前 `solo_test_002` 是否被别的测试链路引用
- 是否有其他 match 也引用这个 player_uid
- 是否存在按 player_uid 聚合历史数据的看板/脚本

如果影响面很小，可直接进入 Step 4。
如果影响面偏大，转方案 B。

### Step 4：做一次最小改绑

只改与 Feishu 身份绑定直接相关的字段：
- 保持 player_uid 不变
- 保持昵称、站内 uid、业务标识尽量不变
- 只替换 Feishu open_id 到第二个真实值

### Step 5：立即做读表复核

至少确认：
- `solo_test_001.feishu_open_id != solo_test_002.feishu_open_id`
- 当前目标对局两侧 player 都仍可正常被 prefetched 组装器识别
- sideContext 推导不受影响

### Step 6：进入真实联调

建议按这条顺序：
1. `submit -> confirm`
2. `submit -> reject`
3. `submit -> timeout -> admin-confirm`

---

## 6. 方案 B 的具体落地步骤

如果方案 A 不适合，就按方案 B：

### Step 1：新增测试 player
- 新建一个 player 记录
- 命名建议：`solo_test_003`
- 绑定第二个真实 `feishu_open_id`

### Step 2：把目标 match 的 side_b 切到新 player_uid
- 保持 `match_uid` 不变
- 只替换 `side_b_player_uid`

### Step 3：复核 players 读取结果
确认：
- side_a / side_b 已对应到两个不同 player_uid
- 两者 open_id 不同
- 不影响统一入口脚本的输入结构

### Step 4：进入真实联调
与方案 A 同步。

---

## 7. 如何选第二个真实 open_id 候选人

优先级建议：

1. **固定测试搭档**
   - 最适合反复配合卡片点击、拒绝、超时演练

2. **项目内部同事**
   - 便于解释这是测试样本

3. **管理员本人兼任第二角色**
   - 不推荐
   - 容易把“选手权限”和“管理员权限”混在一起

**不建议：**
- 用和当前 side_a 相同的人再开一个马甲字段
- 继续依赖 bypass 变量当作“真实通过”

---

## 8. 联调后应该补什么验证

拿到第二个真实 open_id 后，不要只验证“能确认成功”，还要特意补以下断言：

### 8.1 正向断言
- side_a 提交后，side_b 能 confirm
- side_a 提交后，side_b 能 reject
- timeout 后，admin 能 admin-confirm

### 8.2 反向断言
- side_a 自己不能被当成 side_b 去 confirm
- side_a 自己不能被当成 side_b 去 reject
- 非管理员 open_id 不能直接走 admin-confirm

这组反向断言，才是真正证明身份分支干净的关键。

---

## 9. 风险与回退

### 风险 1：改绑污染旧样本语义

**表现：**
之前默认把 `solo_test_002` 当作某个固定虚拟人使用，改绑后含义变化。

**回退：**
- 记录改前 open_id
- 必要时改回
- 或直接转方案 B，新建 player 保留旧样本

### 风险 2：一个 player 被多条对局复用

**表现：**
改一个 player，别的 match 也跟着变。

**回退：**
- 不在原 player 上硬改
- 直接走方案 B，新建 player_uid

### 风险 3：候选人无法稳定配合测试

**表现：**
第二个 open_id 真实存在，但联调时人不在线、无法点卡片。

**缓解：**
- 优先找可即时响应的测试搭档
- 先做“用户身份直写联调”，再做“真实卡片点击联调”

---

## 10. 最小执行建议

如果本轮只想最快拆 blocker，建议按下面 5 步执行：

1. 先确认一个第二真实 `ou_xxx`
2. 查 `solo_test_002` 当前 player 记录及引用面
3. 若影响面可控，按方案 A 改绑 open_id
4. 立刻用 `submit -> confirm` 跑第一轮真实双人验证
5. 再补 `submit -> reject` 做反向分支验证

这样成本最低，且能最快回答当前最核心的问题：

**“个人赛赛果链路的真实双人权限分支，到底通没通？”**

---

## 11. 结论

本轮不建议直接重建整套测试赛事。

更合适的路径是：
- **优先给现有样本补第二个真实 open_id**
- 先把 `confirm / reject` 的真实双人身份校验补实
- 如果发现旧样本污染面太大，再升级到新 player / 新 match 方案

也就是一句话：

**先用最小数据改动拆掉身份 blocker，再决定要不要重构测试样本。**