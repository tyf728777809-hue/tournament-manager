# 工具函数集成指南

> 炉石赛事自动化系统 - 工具函数使用说明
> 版本: v1.0 | 日期: 2026-03-28

---

## 文件结构

```
炉石赛事/
├── callback-handler-skeleton.js      # 回调处理主框架（含占位符）
├── callback-handler-skeleton-part2.js # 回调处理实现函数
├── callback-handler-README.md        # 回调框架说明
├── bitable-api-utils.js              # 多维表格 API 工具（刚完成）
├── notification-utils.js             # 消息通知工具（刚完成）
└── utils-integration-guide.md        # 本文件
```

---

## 工具函数清单

### 1. bitable-api-utils.js

| 函数 | 功能 | 对应占位符 |
|------|------|-----------|
| `queryRecord()` | 查询记录列表 | ✅ 已实现 |
| `getRecord()` | 获取单条记录 | ✅ 已实现 |
| `updateRecord()` | 更新单条记录 | ✅ 已实现 |
| `batchUpdateRecords()` | 批量更新记录 | ✅ 已实现 |
| `createRecord()` | 创建单条记录 | ✅ 已实现 |
| `batchCreateRecords()` | 批量创建记录 | ✅ 已实现 |
| `formatFields()` | 字段格式化 | ✅ 已实现 |

### 2. notification-utils.js

| 函数 | 功能 | 对应占位符 |
|------|------|-----------|
| `sendNotification()` | 发送私聊通知 | ✅ 已实现 |
| `batchSendNotification()` | 批量私聊通知 | ✅ 已实现 |
| `sendGroupMessage()` | 发送群消息 | ✅ 已实现 |
| `sendGroupMessageByTournament()` | 按赛事发群消息 | ✅ 已实现 |
| `sendCardMessage()` | 发送卡片消息（私聊） | ✅ 已实现 |
| `sendGroupCardMessage()` | 发送卡片消息（群聊） | ✅ 已实现 |
| `pushDeckSubmissionEntry()` | 推送卡组提交入口 | ✅ 已实现 |
| `generatePublishConfirmation()` | 生成公示确认通知 | ✅ 已实现 |
| `createAnnouncement()` | 创建公告 | ✅ 已实现 |
| `notifyDisputeParties()` | 通知争议双方 | ✅ 已实现 |
| `notifyAdmin()` | 通知管理员 | ✅ 已实现 |

---

## 集成方式

### 方式1：合并到 callback-handler-skeleton.js

将工具函数导入到主框架中：

```javascript
// 在 callback-handler-skeleton.js 顶部添加
const bitableUtils = require('./bitable-api-utils');
const notificationUtils = require('./notification-utils');

// 替换占位符调用
// 原：await queryRecord(...)
// 改为：await bitableUtils.queryRecord(...)
```

### 方式2：独立使用

在其他模块中单独使用：

```javascript
const { queryRecord, updateRecord } = require('./bitable-api-utils');
const { sendNotification, sendGroupMessage } = require('./notification-utils');

// 查询数据
const records = await queryRecord(appToken, tableId, { filter: {...} });

// 发送通知
await sendNotification(openId, '您的报名已通过！');
```

---

## 环境变量配置

需要在运行环境中配置：

```bash
# 飞书应用凭证
export FEISHU_APP_ID="cli_a93c0f666df89cba"
export FEISHU_APP_SECRET="your_app_secret"

# 访问令牌（可由系统自动获取）
export FEISHU_ACCESS_TOKEN="your_access_token"
```

---

## 使用示例

### 示例1：审核通过报名

```javascript
const bitableUtils = require('./bitable-api-utils');
const notificationUtils = require('./notification-utils');

async function approveRegistration(params) {
  const { registration_id, entity_uid, admin_open_id } = params;
  const timestamp = Date.now();
  
  // 1. 更新报名记录
  await bitableUtils.updateRecord(
    CONFIG.bitable.apps.operation,
    TABLES.registrations,
    registration_id,
    {
      registration_status: 'approved',
      review_status: 'approved',
      reviewed_by: admin_open_id,
      reviewed_at: timestamp,
    }
  );
  
  // 2. 获取实体信息
  const entity = await bitableUtils.getRecord(
    CONFIG.bitable.apps.basic,
    TABLES.teams,
    entity_uid
  );
  
  // 3. 获取队长信息
  const captain = await bitableUtils.getRecord(
    CONFIG.bitable.apps.basic,
    TABLES.players,
    entity.fields.captain_player_uid
  );
  
  // 4. 发送通知
  await notificationUtils.sendNotification(
    captain.fields.feishu_open_id,
    '✅ 您的报名已通过审核！'
  );
  
  // 5. 推送卡组提交入口
  await notificationUtils.pushDeckSubmissionEntry(
    entity_uid,
    params.tournament_uid,
    bitableUtils
  );
}
```

### 示例2：公示卡组

```javascript
async function publishDecks(params) {
  const { tournament_uid, submission_ids, admin_open_id } = params;
  const timestamp = Date.now();
  
  // 1. 批量更新卡组状态
  for (const submission_id of submission_ids) {
    await bitableUtils.updateRecord(
      CONFIG.bitable.apps.deck,
      TABLES.deckSubmissions,
      submission_id,
      {
        public_publish_status: 'published',
        secrecy_status: 'public',
      }
    );
  }
  
  // 2. 创建公告
  await notificationUtils.createAnnouncement(
    tournament_uid,
    {
      type: 'deck_publication',
      title: '卡组公示',
      content: `本次公示共 ${submission_ids.length} 支战队卡组`,
      published_by: admin_open_id,
      published_at: timestamp,
    },
    bitableUtils
  );
  
  // 3. 发送群消息
  await notificationUtils.sendGroupMessageByTournament(
    tournament_uid,
    `📢 卡组公示已发布\n共 ${submission_ids.length} 支战队`,
    bitableUtils
  );
}
```

---

## 错误处理

所有工具函数都已包含错误处理：

```javascript
try {
  const result = await queryRecord(...);
} catch (error) {
  console.error('查询失败:', error.message);
  // 重试或通知管理员
  await notifyAdmin(`查询失败: ${error.message}`);
}
```

---

## 下一步

1. **合并到主框架** - 将工具函数导入 callback-handler-skeleton.js
2. **添加测试用例** - 验证各函数正常工作
3. **部署验证** - 在测试环境运行完整链路

---

*文档版本: v1.0 | 作者: Niko*
