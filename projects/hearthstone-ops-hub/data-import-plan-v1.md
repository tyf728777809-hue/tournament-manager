# Hearthstone Ops Hub 数据导入计划 V1

## 目标
把《网易大神炉石传说社区运营 - 2025年4月工作规划》拆成可导入的结构化数据，优先保证 V1 可以快速落库、快速展示、快速上线。

---

## 一、导入顺序

建议按下面顺序导入：

1. `events`
2. `tasks`
3. `daily_checklists`

原因：
- `events` 是主对象
- `tasks` 和 `daily_checklists` 都可能关联 `event_id`
- 先有活动，再挂任务，数据关系更清晰

---

## 二、events 拆分规则

把文档里的“赛事 / 活动 / 节点型事项”拆成 `events`。

### 建议分类
- `event`：赛事
- `campaign`：活动
- `milestone`：节点型事项

### 首批应录入的典型数据
- 世冠赛平台赛决赛美术提需（milestone）
- 冲钻领卡包活动上线（campaign 或 milestone，取决于是否有持续周期）
- 世冠赛春季平台赛决赛（event）
- 黄金棋坛比赛（event）

### 字段映射建议
- 文档标题 → `title`
- 开始日期 → `start_date`
- 结束日期 → `end_date`
- 紧急程度 → `priority`
- 简述 / 说明 → `description`
- 文档来源 → `source_doc`

---

## 三、tasks 拆分规则

把能明确拆成执行动作的事项录入 `tasks`。

### 适合进 tasks 的内容
- 美术提需
- 后台配置
- 赛程配置
- 宣发上线
- 复盘整理
- 数据同步
- 奖励配置
- 页面检查

### 字段映射建议
- 任务名称 → `title`
- 所属赛事 / 活动 → `event_id`
- 任务发生日期 → `task_date`
- 计划开始日期 → `planned_date`
- 截止日期 → `due_date`
- 类型 → `task_type`
- 优先级 → `priority`
- 来源 → `source_type = imported`
- 备注 → `notes`

### task_type 归类建议
- 美术提需 → `design`
- 后台配置 / 赛程配置 → `config`
- 上线 / 发布 → `launch`
- 宣发文案 / 内容制作 → `content`
- 复盘 / 审核 → `review`
- 数据统计 / 数据回收 → `data`
- 其他运营执行 → `ops`

---

## 四、daily_checklists 拆分规则

把文档中按日期罗列的“每日待办原文”优先录入 `daily_checklists`。

### 适合进 daily_checklists 的内容
- 4 月 1 日当天待办
- 4 月 2 日当天待办
- ……
- 4 月 30 日当天待办

### 字段映射建议
- 日期 → `check_date`
- 该条待办标题 → `title`
- 原文说明 → `content`
- 优先级 → `priority`
- 关联赛事 / 活动 → `related_event_id`
- 来源 → `source_type = imported`

### 录入原则
- 一天多条，就拆成多条记录
- 原文先尽量保留，不要过度改写
- 后续如果某条 daily checklist 明显应升级为 task，再补一条 task 即可

---

## 五、推荐的首批导入范围

### A. 关键事件 / 活动
优先把以下内容先录进去：
- 4.1 世冠赛平台赛决赛美术提需
- 4.3 冲钻领卡包活动上线
- 4.10 - 4.12 世冠赛春季平台赛决赛
- 4.18 - 4.19 黄金棋坛比赛
- 文档中其余 6 场赛事
- 文档中明确写出的活动

### B. 高优先级任务
优先录入：
- 极高优先级任务
- 明确上线节点
- 明确提需节点
- 明确复盘节点

### C. 每日待办
按 4 月 1 日到 30 日完整录入。

---

## 六、建议输出的 seed 文件

建议下一步把数据整理成这 3 个文件：

- `seed-events-v1.json`
- `seed-tasks-v1.json`
- `seed-daily-checklists-v1.json`

如果想更利于 Supabase SQL 导入，也可以同时生成：

- `seed-events-v1.sql`
- `seed-tasks-v1.sql`
- `seed-daily-checklists-v1.sql`

---

## 七、导入策略建议

### 方案 A：先 JSON，再脚本导入
优点：
- 好维护
- 可反复修订
- 适合和前端联调一起用

### 方案 B：直接 SQL insert
优点：
- 快
- 可直接在 Supabase SQL Editor 执行

### V1 推荐
**先整理 JSON，再按需要生成 SQL**。

因为目前最大的工作量不在“插入数据库”，而在“把云文档内容拆干净”。

---

## 八、下一步建议

建议按这个顺序继续：

1. 根据云文档整理 `seed-events-v1.json`
2. 整理 `seed-tasks-v1.json`
3. 整理 `seed-daily-checklists-v1.json`
4. 如有需要，再生成对应 SQL 导入脚本

这样后面：
- 数据库能导
- 前端可直接读
- 后续模板系统也能复用这些真实数据
