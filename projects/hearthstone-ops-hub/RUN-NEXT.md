# Hearthstone Ops Hub · 下一步直接执行指南

这份文件的目标不是解释背景，而是让你 **直接照着跑**。

---

## 路线 A：本地联调（推荐先走）

### 1. 进入前端目录
```bash
cd /Users/tongyifeng/.openclaw/workspace/projects/hearthstone-ops-hub/app
```

### 2. 复制环境变量模板
```bash
cp .env.example .env.local
```

### 3. 编辑 `.env.local`
至少填：
```env
NEXT_PUBLIC_SUPABASE_URL=https://pmysmchiygwmdczsplen.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_supabase_anon_key
```

### 4. 自检环境变量
```bash
npm run check:env
```

### 5. 启动本地开发
```bash
npm run dev
```

### 6. 浏览器联调顺序
依次打开：
1. `/setup`
2. `/auth`
3. `/tasks`

建议动作：
- 先在 `/setup` 看环境变量状态
- 再去 `/auth` 发 Magic Link
- 点邮件链接回来
- 回 `/setup` 跑健康检查
- 最后去 `/tasks` 测状态切换

---

## 路线 B：数据库最小验证集导入

### 1. 在 Supabase SQL Editor 执行
- `query-current-user-id.sql`

拿到当前用户 `id`。

### 2. 生成 seed SQL
```bash
cd /Users/tongyifeng/.openclaw/workspace/projects/hearthstone-ops-hub
node scripts/generate-seed-sql.mjs <SUPABASE_USER_ID>
```

例如：
```bash
node scripts/generate-seed-sql.mjs 12345678-aaaa-bbbb-cccc-1234567890ab
```

会生成：
- `seed-import.generated.sql`

### 3. 在 Supabase 执行生成结果
把 `seed-import.generated.sql` 内容贴到 SQL Editor 执行。

### 4. 验证导入结果
执行：
- `query-seed-verification.sql`

---

## 路线 C：真实写回验证
前提：
- 已登录
- 已导入最小验证集 seed

动作：
1. 打开 `/tasks`
2. 随便切换一条任务状态
3. 回 Supabase 看 `public.tasks.status` 是否真的变化

如果变化了，说明：
- 登录态通了
- RLS 通了
- 前端真实写回通了

---

## 常见失败点

### 1. `/setup` 显示环境变量未配置
原因：
- `.env.local` 没创建
- key 没填
- dev 服务没重启

### 2. `/auth` 发了 Magic Link，但回流后还是未登录
优先检查：
- Supabase 是否启用了邮箱登录
- Redirect URL 是否正确
- 点开的链接是否真的回到了当前前端地址

### 3. `/setup` 健康检查失败
优先看报错文案：
- 没 session
- tasks 表查不到
- RLS 不放行

### 4. `/tasks` 切换状态后又回退
通常说明：
- 没登录
- 任务 `user_id` 不属于当前用户
- RLS 规则没对齐

---

## 当前最短目标
不要一开始就导整月。  
先做到这 3 件事：
1. `/auth` 真登录成功
2. `/setup` 健康检查通过
3. `/tasks` 真写回成功

这三件一通，项目就从“准备态”进入“真实可用验证态”。
