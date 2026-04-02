# Hearthstone Ops Hub · 部署切换与回家联调交接单

这份文档只做一件事：
把当前“代码已就绪，但公网入口卡住”的状态，整理成回家后可直接执行的最短路线。

---

## 当前结论

### 已经完成的部分
- 前端已切到 `hs_` 前缀并行表：
  - `public.hs_profiles`
  - `public.hs_events`
  - `public.hs_tasks`
  - `public.hs_daily_checklists`
- `schema-hs-v1.sql` 已在 Supabase 执行
- 最小 seed 已导入并验证通过：
  - `event_count = 4`
  - `task_count = 4`
  - `daily_count = 4`
- 本地 production build 成功
- 当前 GitHub `main` 已包含最新联调代码

### 当前未闭环的部分
- 用户侧无法稳定访问 `https://app-black-ten-50.vercel.app`
- 因此还没完成这条最终闭环：
  - `/auth` 登录回流
  - `/setup` 健康检查通过
  - `/tasks` 真实写回成功

---

## 现在真正缺的不是代码，而是正式入口

正式入口必须同时满足：

1. **用户设备可访问**
2. **可作为 Supabase Auth 的 Redirect URL**
3. **稳定，不带免费隧道安全拦截页**

所以：
- localtunnel / pinggy / serveo / localhost.run 只能做临时探测
- 不适合作为正式 Magic Link 登录入口

---

## 回家后建议优先路线

### 路线 A：先验证原 Vercel 域名在家里是否可用
先依次打开：
- `https://app-black-ten-50.vercel.app/`
- `https://app-black-ten-50.vercel.app/setup`
- `https://app-black-ten-50.vercel.app/auth`
- `https://app-black-ten-50.vercel.app/tasks`

如果家里网络下可访问，就继续：
1. 去 `/auth` 发 Magic Link
2. 点邮箱里的链接回流
3. 去 `/setup` 运行检查
4. 去 `/tasks` 切一条任务状态

### 路线 B：如果家里也打不开，就不要再赌这个域名
直接切换到：
- 新正式域名 / 子域名
- 或重新发一个新的正式部署入口

然后把该域名加进 Supabase Auth 的 Redirect allowlist。

---

## Supabase Redirect allowlist 要确认什么

至少要包含：
- `https://<正式域名>/auth`
- 或更宽一点，按当前实现允许对应站点 origin

如果站点域名变了，但 Supabase redirect 没更新，会出现：
- Magic Link 能发出去
- 但点回流后 session 建不起来
- `/setup` 一直显示未登录

---

## 回家后最短验收标准

满足以下 3 条即可判断“真实链路已通”：

1. `/auth` 登录成功，页面能看到已登录邮箱
2. `/setup` 健康检查通过，能看到 user_id / tasks 可见数量
3. `/tasks` 切换状态后，`public.hs_tasks.status` 真实变化且前端不回退

---

## 如果回家后仍失败，优先记录这几类信息

请只发结果，不用长篇描述：

### A. 页面访问层
- 能打开 / 不能打开
- 报错文案（如 `ERR_CONNECTION_CLOSED` / `404` / `500`）

### B. 登录层
- Magic Link 发出成功 / 失败
- 点链接后回流到哪个地址
- 回流后 `/auth` 是否显示已登录

### C. 健康检查层
- `/setup` 点击“运行检查”后的提示全文

### D. 写回层
- `/tasks` 切换状态后是否回退
- Supabase 中 `public.hs_tasks.status` 是否变化

---

## 当前推荐动作

在公网入口问题解决前，继续推进不依赖联调入口的开发与文档收口；
等回到更稳定网络环境，再做最终登录回流与写回验收。
