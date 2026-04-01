# openclaw-feishu-tournament-manager/app

当前目录是项目的首版代码骨架。

## 已完成
- 基础目录结构
- 本地测试赛事上下文配置
- 指令路由骨架
- Bitable client 占位层
- 启动入口 `src/index.js`

## 下一步建议
1. 把 `config/tournament-context.js` 从硬编码改成读取 Bitable / 环境变量
2. 优先实现管理员白名单校验
3. 优先实现 `/检查注册`、`/暂停顺延`、`/恢复顺延`
4. 再接签到卡片回调与比分顺延
