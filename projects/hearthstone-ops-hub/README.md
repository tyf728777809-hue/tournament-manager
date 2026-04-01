# Hearthstone Ops Hub

炉石社区运营工作台项目目录。

## 当前阶段

目前已经完成：
- V1 方案文档
- 数据库 schema
- 数据导入方案
- Supabase Auth / RLS 方案
- 前端骨架（首页 / Dashboard / Calendar / Tasks / Events / Auth / Setup）
- 本地联调自检脚本

当前主线：
**打通 Supabase 真实登录回流、真实 seed 导入、任务状态真实写回。**

---

## 目录说明

### 核心文档
- `V1-开发文档.md`：V1 产品与开发范围
- `PROGRESS.md`：项目进度记录
- `schema-v1.sql`：Supabase 表结构
- `data-import-plan-v1.md`：数据导入策略
- `supabase-auth-rls-v1.md`：认证 / RLS 落地方案
- `seed-import-sql-template-v1.sql`：带 `user_id` 的 SQL seed 导入模板
- `query-current-user-id.sql`：查询当前 Supabase 用户 ID
- `SEED-RUNBOOK.md`：最小验证集导入与校验步骤

### Seed 模板
- `seed-events-v1.template.json`
- `seed-tasks-v1.template.json`
- `seed-daily-checklists-v1.template.json`

### 前端项目
- `app/`

---

## app/ 内的关键入口

### 页面
- `/`：首页
- `/dashboard`：今日执行面板
- `/calendar`：运营月历
- `/tasks`：任务管理
- `/events`：赛事 / 活动
- `/auth`：Supabase 登录页
- `/setup`：Supabase 联调准备页

### 关键文档
- `app/DEPLOY-V1.md`
- `app/LOCAL-SETUP.md`
- `app/WORKLOG-AUTH-SETUP.md`

### 自检命令
```bash
npm run check:env
```

---

## 当前最短推进路径

1. 在 `app/.env.local` 填入 Supabase 环境变量
2. 运行 `npm run check:env`
3. 打开 `/setup`
4. 打开 `/auth` 做 Magic Link 登录
5. 导入第一批真实 seed
6. 在 `/tasks` 验证任务状态真实写回
