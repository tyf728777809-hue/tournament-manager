# Tournament Manager - 部署文档

## 部署架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   飞书用户       │────▶│  OpenClaw       │────▶│   Bitable       │
│  (群聊/私聊)     │     │  hs-esports     │     │  (多维表格)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │   吵吵机器人     │
                        │  (飞书群机器人)  │
                        └─────────────────┘
```

## 前置条件

### 1. OpenClaw 环境

- OpenClaw 已安装并配置
- 飞书插件 `openclaw-lark` 已安装
- hs-esports agent 已配置

### 2. 飞书应用配置

在 `~/.openclaw/openclaw.json` 中配置：

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "accounts": {
        "hs-esports": {
          "enabled": true,
          "name": "hs-esports",
          "appId": "cli_a923114e9838dbdb",
          "appSecret": "E9jJWOuyJcyKdrDyLuk7OfrM8whMvhMA",
          "verificationToken": "aUdm7t32lMbKDf3jjNMiZg3jcz1mUazY",
          "connectionMode": "websocket",
          "groupPolicy": "open",
          "dmPolicy": "open",
          "streaming": true
        }
      }
    }
  }
}
```

### 3. 飞书群配置

1. 创建飞书群
2. 添加"吵吵"机器人为群成员
3. 获取群聊 ID (chat_id)
4. 将 chat_id 配置到 `skill-mode/src/config/tables.js`

### 4. Bitable 配置

1. 创建多维表格
2. 创建 7 张数据表（见 README.md）
3. 获取 app_token 和 table_ids
4. 配置到 `skill-mode/src/config/tables.js`

## 部署步骤

### 方案A：部署 skill-mode 代码（推荐生产环境）

**适用场景**：实际生产环境部署，hs-esports agent 直接运行

```bash
# 1. 复制代码到生产目录
cp -r /path/to/project/skill-mode /opt/tournament-manager/

# 2. 进入项目目录
cd /opt/tournament-manager

# 3. 安装依赖（如有需要）
npm install

# 4. 配置环境变量
export FEISHU_APP_ID=cli_a923114e9838dbdb
export FEISHU_APP_SECRET=E9jJWOuyJcyKdrDyLuk7OfrM8whMvhMA
export TOURNAMENT_CHAT_ID=oc_xxx

# 5. 修改配置文件
vim src/config/tables.js
# 配置 APP_TOKEN, TABLE_IDS, TOURNAMENT_ID, CHAT_ID

# 6. 启动服务
node src/index.js
```

### 方案B：安装 Skill 文档（开发/参考）

**适用场景**：开发参考，让 OpenClaw 读取 Skill 上下文

```bash
# 复制 skill 到 OpenClaw skills 目录
cp tournament-manager-v1.0.0.skill ~/.agents/skills/
cd ~/.agents/skills && unzip tournament-manager-v1.0.0.skill

# 注意：此方式仅安装文档，不包含可运行代码
```

### 步骤2：配置环境（方案A）

编辑 `src/config/tables.js`：

```javascript
export const TABLES = {
  tournamentConfig: '你的表ID',
  teamMaster: '你的表ID',
  playerMaster: '你的表ID',
  matchResults: '你的表ID',
  deckSubmission: '你的表ID',
  adminWhitelist: '你的表ID',
  auditLog: '你的表ID',
};

export const APP_TOKEN = '你的app_token';
export const TOURNAMENT_ID = '你的赛事ID';
export const CHAT_ID = '你的群聊ID';
```

### 步骤3：初始化数据（两种方案都需要）

1. 在 Bitable 中创建赛事配置记录
2. 添加管理员到白名单表
3. 添加战队和选手数据
4. 添加对阵场次数据

### 步骤4：测试验证（方案A）

```bash
# 测试管理员指令
/检查注册
/暂停顺延
/恢复顺延

# 测试签到流程
/手动签到 1
# 队长回复：@吵吵 签到

# 测试比分录入（触发顺延）
# 更新第1场比分为 2:0
```

### 步骤5：启动服务（方案A）

**方式1：直接运行（开发/测试）**
```bash
cd /opt/tournament-manager
node src/index.js
```

**方式2：使用 OpenClaw（生产环境）**
OpenClaw 会自动管理 hs-esports agent：
```bash
openclaw gateway status
```
确保状态为 `running`。

**方式3：使用 PM2（生产环境推荐）**
```bash
npm install -g pm2
pm2 start src/index.js --name tournament-manager
pm2 save
pm2 startup
```

## 配置检查清单

- [ ] OpenClaw 已安装
- [ ] 飞书插件已安装
- [ ] hs-esports agent 已配置
- [ ] 飞书应用权限已开通
- [ ] 机器人在群聊中
- [ ] Bitable 表结构已创建
- [ ] 表ID和app_token已配置
- [ ] 管理员已添加到白名单
- [ ] 测试数据已初始化

## 常见问题

### Q1: 机器人收不到消息

**检查**：
1. 机器人在群聊中
2. `groupPolicy` 设置为 `open`
3. 用户 @机器人 发送消息

### Q2: Bitable 写入失败

**检查**：
1. 应用权限是否开通 `bitable:record:write`
2. 应用是否已添加为 Bitable 协作者
3. 使用权限配置脚本：`setup-bitable-permissions.js`

### Q3: 消息发送失败

**检查**：
1. `accountId` 是否正确（hs-esports）
2. `channel` 是否设置为 `feishu`
3. `target` 格式是否正确（`chat:oc_xxx`）

## 监控和日志

### 查看日志

```bash
# OpenClaw 日志
tail -f /tmp/openclaw/openclaw-*.log

# 应用日志（在代码中使用 logger）
# 日志级别：debug/info/warn/error
```

### 健康检查

```bash
# 检查 OpenClaw 状态
openclaw status

# 检查飞书插件
openclaw feishu-diagnose
```

## 回滚方案

如果部署出现问题：

1. 停止 hs-esports agent
2. 回滚到之前的代码版本
3. 恢复 Bitable 数据（如有必要）
4. 重新启动服务

## 联系支持

如有问题，请联系：
- 飞书开放平台文档：https://open.feishu.cn/
- OpenClaw 文档：https://docs.openclaw.ai
