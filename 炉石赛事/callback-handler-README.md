# 回调处理代码骨架说明

> 炉石赛事自动化系统 - 回调处理层
> 版本: v1.0 | 日期: 2026-03-28

---

## 文件结构

由于代码骨架内容较长，分为两个文件：

1. **callback-handler-skeleton.js** - 主框架（约 7.7KB）
   - 配置与常量
   - 主入口路由分发
   - 权限校验
   - 状态校验
   - 报名审核处理（approveRegistration）

2. **callback-handler-skeleton-part2.js** - 处理函数（约 7.7KB）
   - 报名审核处理（rejectRegistration, requestRegistrationInfo）
   - 卡组审核处理（approveDeckSubmission, rejectDeckSubmission, publishDecks）
   - 争议处理（approveAIRecommendation, customRuling）
   - 工作台查询（listPendingRegistrations, listPendingDecks, listPendingDisputes）
   - 工具函数占位

---

## 核心功能模块

### 1. 路由分发 (handleCallback)
```javascript
// 统一入口，根据 action 分发到对应处理函数
handleCallback(callback, context)
```

### 2. 权限校验 (checkPermission)
- 查询 tournament_admins 表
- 校验操作人是否有权限
- 校验角色是否允许该操作

### 3. 状态校验 (checkState)
- 校验记录是否存在
- 校验当前状态是否允许该操作
- 防止重复操作

### 4. 报名审核处理
| 函数 | 功能 |
|------|------|
| approveRegistration | 审核通过报名，更新状态，发送通知 |
| rejectRegistration | 驳回报名，记录原因 |
| requestRegistrationInfo | 要求补充资料 |

### 5. 卡组审核处理
| 函数 | 功能 |
|------|------|
| approveDeckSubmission | 审核通过卡组，处理版本，更新可见性 |
| rejectDeckSubmission | 驳回卡组 |
| publishDecks | 公示卡组，创建公告，发送群消息 |

### 6. 争议处理
| 函数 | 功能 |
|------|------|
| approveAIRecommendation | 采纳AI建议并裁决 |
| customRuling | 自定义裁决 |

### 7. 工作台查询
| 函数 | 功能 |
|------|------|
| listPendingRegistrations | 列出待审核报名 |
| listPendingDecks | 列出待审核卡组 |
| listPendingDisputes | 列出待处理争议 |

---

## 使用方式

### 方式1：直接集成到 OpenClaw
将代码合并到 OpenClaw 的插件系统中，通过 webhook 接收飞书回调。

### 方式2：独立部署
作为独立服务部署，暴露 HTTP 接口接收回调：
```javascript
app.post('/callback', async (req, res) => {
  const result = await handleCallback(req.body, req.context);
  res.json(result);
});
```

---

## 待实现部分

代码骨架中以下函数为占位符，需要根据实际环境实现：

- `queryRecord()` - 查询多维表格记录
- `updateRecord()` - 更新多维表格记录
- `getRecord()` - 获取单条记录
- `sendNotification()` - 发送私聊通知
- `sendGroupMessage()` - 发送群消息
- `pushDeckSubmissionEntry()` - 推送卡组提交入口
- `generatePublishConfirmation()` - 生成公示确认稿
- `createAnnouncement()` - 创建公告
- `notifyDisputeParties()` - 通知争议双方
- `notifyAdmin()` - 通知管理员
- `updateDecksVisibility()` - 更新卡组可见性

---

## 下一步建议

1. **实现工具函数** - 对接飞书 API 和多维表格 API
2. **添加错误处理** - 完善重试机制和日志记录
3. **添加测试用例** - 覆盖各种状态流转场景
4. **部署验证** - 用测试数据验证回调处理逻辑

---

*文档版本: v1.0 | 作者: Niko*
