# Hearthstone Ops Hub · Supabase Auth / RLS 落地方案 V1

## 目标
让当前 V1 前端在使用 Supabase anon key 的情况下，既能安全读取自己的数据，也能稳定更新自己的任务状态。

---

## 一、当前现状

当前项目已经有：
- `profiles`
- `events`
- `tasks`
- `daily_checklists`
- 基础 RLS 策略：`auth.uid() = user_id`

这套设计方向是对的，但要真正跑通前端写回，还缺两个前提：

1. **前端必须先登录 Supabase**
2. **写入的数据 user_id 必须和当前登录用户一致**

否则：
- 页面可以加载 mock 数据
- 页面也能尝试 update
- 但真实数据库会因为 RLS 拒绝写入

---

## 二、V1 推荐做法

### 方案：单用户登录 + own data RLS

V1 不做复杂多人协作，直接采用最稳的方案：

- 使用 Supabase Auth 登录
- 当前用户只能读写自己的数据
- 所有 `events / tasks / daily_checklists` 都带 `user_id`
- 所有读写都通过 `auth.uid() = user_id` 控制

这样好处是：
- 安全边界清楚
- 前端可以直接用 anon key + 当前 session 访问
- 不需要额外服务端中转
- 和当前静态导出模式兼容

---

## 三、V1 登录方式建议

### 推荐：Magic Link / OTP 邮箱登录

对于 V1，最省事的是直接启用 Supabase 邮箱登录：

- 用户输入邮箱
- 收到 Magic Link
- 登录后获得 session
- 前端使用 session 访问数据

原因：
- 实现简单
- 不需要自己做密码系统
- Vercel + Supabase 很顺
- 只有你自己使用时最省心

---

## 四、数据访问规则

### 1. profiles
- 用户只能查看 / 更新自己的 profile

### 2. events
- 用户只能查看 / 新建 / 修改 / 删除自己的 event

### 3. tasks
- 用户只能查看 / 新建 / 修改 / 删除自己的 task
- 任务状态更新依赖这张表的 update 权限

### 4. daily_checklists
- 用户只能查看 / 新建 / 修改 / 删除自己的 checklist

---

## 五、前端真正写回需要满足什么

要让当前 `Tasks` 页面点“切换状态”后真实写回，至少要满足：

### 条件 1：已登录
前端必须拿到 Supabase session。

### 条件 2：task 记录属于当前用户
`tasks.user_id` 必须等于当前登录用户的 `auth.uid()`。

### 条件 3：插入 seed 数据时写入正确 user_id
如果是 SQL 导入，就不能漏掉 `user_id`。

这是最容易踩坑的地方。  
如果 seed 里的任务没有正确 user_id，那么：
- 页面可能能查到（取决于你怎么查）
- 但更新一定会失败

---

## 六、V1 建议补充的实现顺序

### Phase A：先打通登录
新增：
- 登录页
- 获取 session
- 登出按钮
- 顶部显示当前登录邮箱

目标：确认前端已经不再是“匿名访问”。

---

### Phase B：打通只读真实数据
登录后：
- 读取当前用户自己的 events
- 读取当前用户自己的 tasks
- 读取当前用户自己的 daily_checklists

目标：确认 RLS 查询正常。

---

### Phase C：打通任务状态更新
登录后点击任务状态切换：
- 前端 update tasks
- RLS 放行
- 状态真实写回

目标：完成 V1 第一个真实可写功能。

---

## 七、seed 导入时的注意事项

### 不要直接导“无 user_id 的公共数据”
如果当前 schema 要求 `user_id not null`，那么 seed 导入必须明确指定用户。

V1 可选两种做法：

#### 做法 A：先登录，再通过前端创建
优点：最符合 RLS
缺点：慢

#### 做法 B：用 SQL + 指定 user_id 导入
优点：快
缺点：要先知道当前用户的 auth uid

V1 推荐：
**先查出你自己的 Supabase auth user id，再用 SQL seed 导入。**

---

## 八、我建议的下一步技术动作

最合理的下一小段不是继续堆页面，而是做这三件事：

1. 新增登录页 / session 状态
2. 在 layout 或首页显示“当前是否已登录 Supabase”
3. 把 Tasks 页的状态更新建立在 session 真实存在的前提下

这样一旦打通：
- 数据查询能真读
- 状态切换能真写
- V1 就从“演示版”进入“可真实使用版”

---

## 九、结论

当前项目的真正关键点已经不是 UI，而是：

**让 Supabase Auth、RLS、seed user_id 三件事对齐。**

只要这三件事对齐，当前 V1 的事件、任务、每日待办页面就能很快从 mock / 半演示状态，切换到真实可用状态。
