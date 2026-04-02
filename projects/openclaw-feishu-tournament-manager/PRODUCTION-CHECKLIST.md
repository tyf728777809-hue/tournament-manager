# Tournament Manager - 生产环境部署清单

## 部署前检查

### 1. 环境准备

- [ ] OpenClaw 已安装并运行
- [ ] 飞书插件 `openclaw-lark` 已安装
- [ ] hs-esports agent 已配置并启用
- [ ] Node.js 环境（v18+）

### 2. 飞书配置

- [ ] 飞书应用 `cli_a923114e9838dbdb` 权限已开通
  - [ ] `bitable:record:read`
  - [ ] `bitable:record:create`
  - [ ] `bitable:record:update`
  - [ ] `im:chat:readonly`
  - [ ] `im:message:send`
- [ ] 机器人"吵吵"已添加到生产群聊
- [ ] 群聊 ID 已记录

### 3. Bitable 配置

- [ ] 生产环境 Bitable 已创建
- [ ] 7 张数据表已创建
- [ ] 表字段已配置（第一轮骨架字段）
- [ ] 应用已添加为 Bitable 协作者（可编辑权限）
- [ ] 测试数据已清理（如有需要）

### 4. 数据初始化

- [ ] 赛事配置记录已创建
- [ ] 管理员白名单已添加
- [ ] 战队数据已导入
- [ ] 选手数据已导入
- [ ] 对阵场次已创建

## 部署步骤

### 步骤1：获取代码

```bash
# 从 GitHub 拉取代码
git clone https://github.com/tyf728777809-hue/tournament-manager.git
cd tournament-manager/projects/openclaw-feishu-tournament-manager
```

### 步骤2：配置生产环境

```bash
# 复制 skill-mode 到生产目录
cp -r skill-mode /opt/tournament-manager/
cd /opt/tournament-manager

# 编辑配置文件
vim src/config/tables.js
```

修改以下配置：

```javascript
// 生产环境 Bitable App Token
export const APP_TOKEN = '生产环境的app_token';

// 生产环境赛事ID
export const TOURNAMENT_ID = '生产赛事ID';

// 生产环境群聊ID
export const CHAT_ID = '生产群聊oc_xxx';

// 生产环境表ID
export const TABLES = {
  tournamentConfig: '生产表ID',
  teamMaster: '生产表ID',
  playerMaster: '生产表ID',
  matchResults: '生产表ID',
  deckSubmission: '生产表ID',
  adminWhitelist: '生产表ID',
  auditLog: '生产表ID',
};
```

### 步骤3：安装依赖（可选）

```bash
# 如果需要额外的 npm 包
npm install
```

### 步骤4：配置 OpenClaw

确保 `~/.openclaw/openclaw.json` 中 hs-esports 配置正确：

```json
{
  "channels": {
    "feishu": {
      "accounts": {
        "hs-esports": {
          "enabled": true,
          "appId": "cli_a923114e9838dbdb",
          "appSecret": "E9jJWOuyJcyKdrDyLuk7OfrM8whMvhMA",
          "groupPolicy": "open"
        }
      }
    }
  }
}
```

### 步骤5：启动服务

**方式1：使用 OpenClaw（推荐）**

```bash
# OpenClaw 会自动管理 hs-esports agent
openclaw gateway restart

# 检查状态
openclaw gateway status
```

**方式2：使用 PM2（生产环境推荐）**

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start src/index.js --name tournament-manager

# 保存配置
pm2 save
pm2 startup

# 查看状态
pm2 status
pm2 logs tournament-manager
```

## 部署后验证

### 功能测试

- [ ] 管理员指令测试
  - [ ] `/检查注册` - 显示战队和选手数量
  - [ ] `/暂停顺延` - 关闭顺延开关
  - [ ] `/恢复顺延` - 开启顺延开关
  - [ ] `/手动签到 1` - 发送第1场签到通知
  - [ ] `/重发战报 1` - 发送战报（如已结束）
  - [ ] `/公示卡组` - 公示卡组（如已开启公示）

- [ ] 队长签到测试
  - [ ] 队长 @吵吵 回复"签到"
  - [ ] 验证签到状态已更新
  - [ ] 验证确认消息已发送

- [ ] 自动顺延测试
  - [ ] 更新比分达到赛点
  - [ ] 验证顺延已触发
  - [ ] 验证下一场签到已发送

### 监控检查

- [ ] 查看 OpenClaw 日志无错误
- [ ] 查看 Bitable 数据更新正常
- [ ] 查看飞书消息发送正常

## 回滚方案

如果部署出现问题：

```bash
# 停止服务
pm2 stop tournament-manager
# 或
openclaw gateway stop

# 回滚到上一版本
git checkout HEAD~1

# 重新启动
pm2 start tournament-manager
# 或
openclaw gateway start
```

## 日常运维

### 日志查看

```bash
# OpenClaw 日志
tail -f /tmp/openclaw/openclaw-*.log

# PM2 日志
pm2 logs tournament-manager
```

### 数据备份

定期备份 Bitable 数据：
- 导出为 Excel/CSV
- 或使用 Bitable API 备份

### 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重启服务
pm2 restart tournament-manager
```

## 紧急联系

- 飞书开放平台：https://open.feishu.cn/
- OpenClaw 文档：https://docs.openclaw.ai
- GitHub 仓库：https://github.com/tyf728777809-hue/tournament-manager

---

**部署完成时间**：_______________  
**部署人员**：_______________  
**验证结果**：_______________
