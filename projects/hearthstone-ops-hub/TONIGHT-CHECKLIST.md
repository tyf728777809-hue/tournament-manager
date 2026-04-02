# Hearthstone Ops Hub · 今晚联调清单

这份只保留今晚要做的最短动作。

---

## 开始前
先在家里电脑确认两件事：

1. 项目已启动
```bash
cd /Users/tongyifeng/.openclaw/workspace/projects/hearthstone-ops-hub/app
npm run dev
```

2. 浏览器能打开：
- `http://localhost:3000/auth`

---

## 今晚执行顺序

### 1. 打开 auth 页面
在家里电脑打开：
- `http://localhost:3000/auth`

然后发我一句：
- **家里电脑 auth 已打开**

### 2. 我发 Magic Link
我这边会给你发一次登录链接。

### 3. 你在家里电脑点开邮件链接
目标是让回流落到本机站点，并建立 session。

### 4. 我接浏览器做 setup 验收
我会继续看：
- `/setup`
- 健康检查是否通过
- 当前 user_id / email / tasks 可见数量

### 5. 我接着做 tasks 写回验收
我会继续看：
- `/tasks`
- 切一条任务状态
- 检查是否回退
- 最后确认 `hs_tasks.status` 是否真实变化

---

## 今晚通过标准
只看这 3 条：

1. `/auth` 已登录
2. `/setup` 健康检查通过
3. `/tasks` 状态切换真实写回且不回退

做到这三条，就可以判定：
**当前 `hs_` 并行表方案的真实链路已经打通。**

---

## 如果中途失败，你只要回我这一种格式

### A. 页面打不开
- `auth 打不开`
- `setup 打不开`
- `tasks 打不开`

### B. 登录失败
- `Magic Link 发出成功 / 失败`
- `点开后已回到 localhost / 没回到 localhost`
- `auth 仍显示未登录`

### C. 健康检查失败
直接把 `/setup` 的报错原文发我。

### D. 写回失败
直接回我：
- `tasks 切换后回退了`
- 或 `tasks 切换成功`

---

## 当前注意事项
今晚优先走本地 `localhost:3000`，不要再先试白天那个 `vercel.app` 地址。
