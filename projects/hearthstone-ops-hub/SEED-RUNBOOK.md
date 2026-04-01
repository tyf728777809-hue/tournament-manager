# Hearthstone Ops Hub · Seed 导入操作手册

## 目标
把第一批真实数据导入 Supabase，并为后续任务状态真实写回打基础。

---

## 一、导入前置条件

先确保这几件事成立：

1. `schema-v1.sql` 已在 Supabase 执行
2. 已完成一次 Supabase 登录（至少让 auth.users 里有当前用户）
3. 已能确认自己的 Supabase user id

---

## 二、先查当前用户 ID

在 Supabase SQL Editor 执行：

- `query-current-user-id.sql`

会返回：
- `id`
- `email`
- `created_at`

把你要用的那个 `id` 记下来。

---

## 三、替换 SQL 模板中的 user_id

你可以手工替换：
- `seed-import-sql-template-v1.sql`

把其中所有：
- `YOUR_USER_ID_HERE`

替换成你真实的 Supabase `auth.users.id`。

也可以直接用自动生成脚本：

```bash
node scripts/generate-seed-sql.mjs <SUPABASE_USER_ID>
```

例如：

```bash
node scripts/generate-seed-sql.mjs 12345678-aaaa-bbbb-cccc-1234567890ab
```

默认会生成：
- `seed-import.generated.sql`

---

## 四、导入顺序

推荐顺序：

1. `events`
2. `tasks`
3. `daily_checklists`

当前 `seed-import-sql-template-v1.sql` 已按这个顺序组织。

---

## 五、导入后验证

### 1. 验证 events
```sql
select id, title, slug, start_date, end_date
from public.events
order by start_date asc;
```

### 2. 验证 tasks
```sql
select id, title, status, task_date, due_date, user_id
from public.tasks
order by task_date asc;
```

### 3. 验证 daily_checklists
```sql
select id, check_date, title, status, user_id
from public.daily_checklists
order by check_date asc;
```

---

## 六、前端联动验证顺序

导入成功后，按这个顺序测：

1. 打开 `/setup`
2. 确认环境变量正常
3. 打开 `/auth`
4. 确认当前已登录
5. 打开 `/tasks`
6. 切换一个任务状态
7. 回到 Supabase 检查 `tasks.status` 是否已变化

---

## 七、如果状态切换没有写回

优先检查这几项：

1. 当前是不是已经登录 Supabase
2. 这条任务的 `user_id` 是否等于当前登录用户的 `auth.uid()`
3. `tasks` 表的 RLS 是否还是 `auth.uid() = user_id`
4. 前端环境变量是否正确

---

## 八、当前建议

第一批不要急着把整份 4 月文档全导进去。  
建议先导最小验证集：

- 2 条 events
- 2 条 tasks
- 2 条 daily_checklists

先验证整条链路通，再扩整月数据。
