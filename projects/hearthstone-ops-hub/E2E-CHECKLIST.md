# Hearthstone Ops Hub · E2E 联调清单

## 目标
确认最小可用链路已经跑通：
环境变量 → 登录 → 健康检查 → seed 导入 → 任务状态写回。

---

## 阶段 1：环境变量
- [ ] `app/.env.local` 已创建
- [ ] `NEXT_PUBLIC_SUPABASE_URL` 已填写
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已填写
- [ ] 运行 `npm run check:env` 通过

## 阶段 2：登录
- [ ] `/auth` 能发送 Magic Link
- [ ] 点邮件链接后能回到前端
- [ ] `/auth` 页显示已登录邮箱
- [ ] 首页显示已登录状态

## 阶段 3：健康检查
- [ ] `/setup` 页面显示环境变量正常
- [ ] `/setup` 健康检查通过
- [ ] 能看到 `user_id`
- [ ] 能看到 tasks 可见数量

## 阶段 4：seed 导入
- [ ] 执行 `query-current-user-id.sql`
- [ ] 已运行 `node scripts/generate-seed-sql.mjs <SUPABASE_USER_ID>` 生成 `seed-import.generated.sql`
- [ ] 已导入最小验证集 seed
- [ ] 执行 `query-seed-verification-hs.sql` 检查通过

## 阶段 5：真实写回
- [ ] `/tasks` 页面能看到真实任务
- [ ] 切换一个任务状态
- [ ] Supabase `public.hs_tasks.status` 已变化
- [ ] 状态切换后前端不再自动回退

---

## 通过标准
以上 5 个阶段全部勾完，就说明当前 V1 已从演示骨架进入“真实可用验证版”。
