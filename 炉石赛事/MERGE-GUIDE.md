# 代码合并指南

> 炉石赛事自动化系统 - 如何将工具函数合并到主框架
> 版本: v1.0 | 日期: 2026-03-28

---

## 文件结构

当前目录结构：

```
炉石赛事/
├── callback-handler-skeleton.js          # 主框架（含占位符）
├── callback-handler-skeleton-part2.js    # 实现函数
├── callback-handler-README.md            # 框架说明
├── bitable-api-utils.js                  # 多维表格工具 ✅
├── notification-utils.js                 # 通知工具 ✅
├── utils-integration-guide.md            # 工具使用指南
├── callback-handler-merged.js            # 合并示例（部分）
└── MERGE-GUIDE.md                        # 本文件
```

---

## 合并步骤

### 步骤 1：导入工具函数

在 `callback-handler-skeleton.js` 顶部添加：

```javascript
// ============================================
// 0. 导入工具函数
// ============================================

const {
  queryRecord,
  getRecord,
  updateRecord,
  batchUpdateRecords,
  createRecord,
  batchCreateRecords,
} = require('./bitable-api-utils');

const {
  sendNotification,
  batchSendNotification,
  sendGroupMessage,
  sendGroupMessageByTournament,
  sendCardMessage,
  sendGroupCardMessage,
  pushDeckSubmissionEntry,
  generatePublishConfirmation,
  createAnnouncement,
  notifyDisputeParties,
  notifyAdmin,
} = require('./notification-utils');
```

### 步骤 2：替换占位符调用

#### 2.1 在 `checkPermission()` 中：

**原代码：**
```javascript
const admin = await queryRecord(...);  // 占位符
```

**改为：**
```javascript
const admin = await queryRecord(
  CONFIG.bitable.apps.operation,
  TABLES.tournamentAdmins,
  { filter: {...} }
);
```

#### 2.2 在 `checkState()` 中：

**原代码：**
```javascript
const registration = await getRecord(...);  // 占位符
```

**改为：**
```javascript
const registration = await getRecord(
  CONFIG.bitable.apps.operation,
  TABLES.registrations,
  registration_id
);
```

#### 2.3 在 `approveRegistration()` 中：

**原代码：**
```javascript
await updateRecord(...);  // 占位符
await sendNotification(...);  // 占位符
await pushDeckSubmissionEntry(...);  // 占位符
```

**改为：**
```javascript
await updateRecord(
  CONFIG.bitable.apps.operation,
  TABLES.registrations,
  registration_id,
  { registration_status: 'approved', ... }
);

const team = await getRecord(CONFIG.bitable.apps.basic, TABLES.teams, entity_uid);
const captain = await getRecord(CONFIG.bitable.apps.basic, TABLES.players, team.fields.captain_player_uid);

await sendNotification(captain.fields.feishu_open_id, '✅ 您的报名已通过审核！');
await pushDeckSubmissionEntry(entity_uid, tournament_uid, {
  getRecord, updateRecord, createRecord, queryRecord
});
```

### 步骤 3：合并 part2 内容

将 `callback-handler-skeleton-part2.js` 中的内容追加到 `callback-handler-skeleton.js` 末尾。

### 步骤 4：添加缺失的工具函数

在文件末尾添加 `updateDecksVisibility()`：

```javascript
/**
 * 更新卡组可见性
 * @param {string} submissionId - 卡组提交ID
 * @param {string} visibility - 可见性状态
 * @param {number} timestamp - 时间戳
 */
async function updateDecksVisibility(submissionId, visibility, timestamp) {
  const decks = await queryRecord(
    CONFIG.bitable.apps.deck,
    TABLES.decks,
    {
      filter: {
        conjunction: 'and',
        conditions: [
          { field_name: 'deck_submission_uid', operator: 'is', value: [submissionId] }
        ]
      }
    }
  );
  
  for (const deck of decks) {
    const updateData = { opponent_visibility: visibility };
    if (visibility === 'published' && timestamp) {
      updateData.public_visibility = 'published';
      updateData.published_at = timestamp;
    }
    
    await updateRecord(
      CONFIG.bitable.apps.deck,
      TABLES.decks,
      deck.record_id,
      updateData
    );
  }
}
```

### 步骤 5：导出模块

在文件末尾添加：

```javascript
// ============================================
// 导出
// ============================================

module.exports = {
  handleCallback,
  // 如需单独导出某个 handler，可在此添加
  approveRegistration,
  rejectRegistration,
  approveDeckSubmission,
  rejectDeckSubmission,
  publishDecks,
};
```

---

## 快速合并脚本

创建一个 `merge.js` 脚本自动合并：

```javascript
const fs = require('fs');
const path = require('path');

// 读取文件
const skeleton = fs.readFileSync('callback-handler-skeleton.js', 'utf8');
const part2 = fs.readFileSync('callback-handler-skeleton-part2.js', 'utf8');

// 添加导入语句
const importSection = `
// ============================================
// 0. 导入工具函数
// ============================================

const {
  queryRecord,
  getRecord,
  updateRecord,
  batchUpdateRecords,
  createRecord,
  batchCreateRecords,
} = require('./bitable-api-utils');

const {
  sendNotification,
  batchSendNotification,
  sendGroupMessage,
  sendGroupMessageByTournament,
  sendCardMessage,
  sendGroupCardMessage,
  pushDeckSubmissionEntry,
  generatePublishConfirmation,
  createAnnouncement,
  notifyDisputeParties,
  notifyAdmin,
} = require('./notification-utils');

`;

// 合并内容
const merged = importSection + skeleton + '\n' + part2 + `

// ============================================
// 导出
// ============================================

module.exports = {
  handleCallback,
  approveRegistration,
  rejectRegistration,
  approveDeckSubmission,
  rejectDeckSubmission,
  publishDecks,
};
`;

// 写入文件
fs.writeFileSync('callback-handler-complete.js', merged);
console.log('合并完成: callback-handler-complete.js');
```

运行：
```bash
node merge.js
```

---

## 验证合并结果

合并后检查：

1. **导入语句** - 确保在文件顶部
2. **函数调用** - 所有占位符已替换为真实函数
3. **导出模块** - 文件末尾有 module.exports
4. **语法检查** - 运行 `node -c callback-handler-complete.js`

---

## 使用示例

```javascript
const { handleCallback } = require('./callback-handler-complete');

// 处理回调
const result = await handleCallback({
  action: 'approve_registration',
  registration_id: 'REG-xxx',
  entity_type: 'team',
  entity_uid: 'TEAM-xxx',
  tournament_uid: 'HS202603-TEST-DSTL',
  admin_open_id: 'ou_xxx',
}, {
  operatorOpenId: 'ou_xxx',
});

console.log(result); // { success: true, message: '报名审核通过' }
```

---

## 下一步

1. 运行合并脚本
2. 验证语法正确
3. 测试单个 handler
4. 部署到测试环境

---

*文档版本: v1.0 | 作者: Niko*
