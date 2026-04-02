# 项目进度记录 - Hearthstone Ops Hub

## 项目信息
- **项目名称**: Hearthstone Ops Hub
- **创建时间**: 2026-04-01 21:03 (Asia/Shanghai)
- **最后更新**: 2026-04-02 13:56 (Asia/Shanghai)

## 项目目标
构建一个面向炉石社区运营场景的轻量工作台，先完成 V1：支持赛事 / 活动管理、每日待办管理、日历视图、今日执行面板，并部署上线供日常使用。

## 进度概览

| 阶段 | 状态 | 完成时间 | 备注 |
|------|------|----------|------|
| 需求分析 | ✅ 已完成 | 2026-04-01 | 已输出 V1 开发文档 |
| 方案设计 | ✅ 已完成 | 2026-04-01 | 已输出数据库 schema、导入计划与 seed 模板 |
| 开发实施 | 🟨 进行中 | - | 已拉取代码仓库并完成 V1 静态骨架调整 |
| 测试验证 | 🟨 进行中 | - | 已通过本地 production build |
| 交付上线 | ⬜ 待开始 | - | 待配置环境变量并部署 |

## 详细记录

### 2026-04-02 - Supabase 真实联调转向 hs_ 并行表
- 已确认真实 Supabase anon key 并完成 `.env.local` 配置
- 已跑通 Magic Link 用户创建，当前联调 user_id：`b7fc22a7-de54-4621-b1df-cf526cf11d3c`
- 已确认旧 `public.tasks` / `public.profiles` 是另一版空壳模型：0 行数据，且 `tasks.project_id -> projects.id`
- 为避免破坏旧模型，已新建并落地并行方案：`hs_profiles` / `hs_events` / `hs_tasks` / `hs_daily_checklists`
- 已新增 `schema-hs-v1.sql`、`query-seed-verification-hs.sql`
- 已把前端真实读写和健康检查切到 `hs_` 前缀表
- 已把 seed 生成脚本切到 `hs_` 前缀表
- 已在 Supabase 成功执行 `schema-hs-v1.sql`
- 已在 Supabase 成功导入 `hs_` 最小验证集，当前聚合结果：`event_count=4 / task_count=4 / daily_count=4`

### 2026-04-02 - 部署与公网入口排查补记
- 已确认 Vercel 公网地址 `https://app-black-ten-50.vercel.app` 在我侧可访问，但用户侧多设备反馈 `ERR_CONNECTION_CLOSED`
- 已确认当前阻塞已从“代码/数据库问题”转为“公网入口可达性问题”
- 已重新执行本地 production build，结果成功，确认当前静态导出可正常产出
- 已把 Hearthstone Ops Hub 本地最新 7 个提交推送到 GitHub `main`，远端分支已追上当前联调代码状态
- 已尝试多种临时公网入口（localtunnel / pinggy / serveo / localhost.run）作为应急绕路
- 当前结论：临时隧道可用于页面可达性探测，但不适合作为正式 Magic Link 登录回流入口；正式闭环仍需要“用户可访问 + 已加入 Supabase Redirect allowlist”的稳定域名
- 经用户确认，当前先不继续死磕入口问题，暂时挂起该阻塞，后续回到更合适的网络环境再处理
- 已把联调文档切到当前真实状态：`RUN-NEXT.md`、`E2E-CHECKLIST.md`、`app/LOCAL-SETUP.md` 已统一改为 `hs_` 前缀表与 `query-seed-verification-hs.sql`
- 已新增 `DEPLOY-HANDOFF.md`，用于回家后按正式入口 / Redirect allowlist 路线继续验收闭环
- 已在 `/auth` 与 `/setup` 页面新增站点来源提示卡：直接展示当前 origin、建议加入 Supabase Redirect allowlist 的 `/auth` 地址，并对临时/默认托管域名给出提示
- 已重新执行 production build 验证上述页面改动，构建通过

### 2026-04-01 - 项目启动
- 创建项目工作区：`projects/hearthstone-ops-hub/`
- 创建项目进度文档 `PROGRESS.md`
- 生成 V1 开发文档 `V1-开发文档.md`
- 明确 V1 目标：优先做运营日历、每日执行面板、任务管理与上线部署
- 输出数据库建表脚本：`schema-v1.sql`
- 输出数据导入计划：`data-import-plan-v1.md`
- 生成首批 seed 模板：`seed-events-v1.template.json`、`seed-tasks-v1.template.json`、`seed-daily-checklists-v1.template.json`
- 成功通过 SSH 拉取 GitHub 仓库到 `app/`
- 已将首页和核心页面骨架调整到 V1 方向：Dashboard / Calendar / Tasks / Events
- 已补充 Supabase 接入层：`app/lib/supabase.ts`、`app/lib/data.ts`
- 已补充部署与环境变量文件：`.env.example`、`DEPLOY-V1.md`
- 已完成 `npm install` 和 `npm run build` 验证，当前骨架可正常构建

---

## 待办事项
- [x] 输出 V1 数据库 SQL 建表脚本
- [x] 生成 events seed 模板
- [x] 生成 tasks seed 模板
- [x] 生成 daily_checklists seed 模板
- [x] 获取 GitHub 仓库代码并初始化本地工作树
- [ ] 根据云文档补全真实 seed 数据
- [x] 启动前端骨架开发
- [x] 接入 Supabase 环境变量与真实数据读取（含 mock fallback）
- [x] 准备首次部署到 Vercel
- [x] 增加任务状态更新能力（支持前端交互与 Supabase 直连尝试写回）
- [x] 补 Supabase Auth / RLS 方案文档
- [x] 生成带 user_id 的 SQL seed 导入模板
- [x] 接入 Supabase 登录态骨架（Magic Link / OTP 页面与首页状态展示）
- [x] 补登录前后行为提示（首页状态、任务页写回前提示、退出登录）
- [x] 增加登录回流检查面板（用于确认 Magic Link 后是否拿到 session）
- [x] 增加 Supabase 联调准备页（环境变量 / 登录状态 / 操作顺序检查）
- [x] 增加本地联调自检脚本与说明（`npm run check:env` / `LOCAL-SETUP.md`）
- [x] 补 seed 导入操作手册与当前用户 ID 查询 SQL
- [x] 增加 `/setup` 健康检查面板（环境变量 + session + tasks 查询）
- [x] 补 seed 导入验证 SQL 与 E2E 联调清单
- [x] 增加 seed SQL 自动生成脚本（按 user_id 生成可执行 SQL）
- [x] 补下一步执行指南与 next-step 自检脚本
- [x] 增加 `.env.local` 初始化脚本与占位值检测
- [ ] 接上真实登录回流与 session 持久化验证
- [x] 定位 Supabase 旧表冲突来源（旧 `tasks/project_id` 空壳模型）
- [x] 设计并切换到 `hs_` 前缀并行 V1 表方案（保留旧表）
- [x] 生成 `schema-hs-v1.sql` / `query-seed-verification-hs.sql`
- [x] 前端读写切到 `hs_events` / `hs_tasks` / `hs_daily_checklists`
- [x] 在 Supabase 执行 `schema-hs-v1.sql`
- [x] 导入 `hs_` 前缀最小验证 seed
- [ ] 完成 `/setup` 与 `/tasks` 基于 `hs_` 表的真实联调

## 关键决策
| 日期 | 决策内容 | 决策原因 |
|------|----------|----------|
| 2026-04-01 | V1 先聚焦运营执行工作台，而非复杂模板系统 | 先确保系统尽快可用，能支撑每日执行 |
| 2026-04-01 | 数据模型先采用 events / tasks / daily_checklists 三张核心表 | 降低抽象复杂度，便于快速落地 |

## 参考资料
- `V1-开发文档.md`
- 《网易大神炉石传说社区运营 - 2025年4月工作规划》
- GitHub 仓库：`tyf728777809-hue/hearthstone-ops-hub`
- Supabase：`https://pmysmchiygwmdczsplen.supabase.co`
