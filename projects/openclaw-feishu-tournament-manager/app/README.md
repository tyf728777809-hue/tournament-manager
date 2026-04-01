# openclaw-feishu-tournament-manager/app

当前目录是项目的首版代码骨架。

## 已完成
- 基础目录结构
- 本地测试赛事上下文配置
- 指令路由骨架
- Bitable client 双模式切换（mock / real）
- 启动入口 `src/index.js`
- 已跑通本地 mock 版 `/检查注册`、`/暂停顺延`、`/恢复顺延`

## 数据层模式
默认使用 mock：
- `BITABLE_CLIENT_MODE=mock`

切到真实飞书 Bitable：
- `BITABLE_CLIENT_MODE=real`
- 同时配置：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`

## 下一步建议
1. 用真实模式验证 `/暂停顺延`、`/恢复顺延`
2. 再用真实模式接 `/检查注册`
3. 然后开始接签到卡片与比分顺延
