---
name: tournament-manager
version: 1.0.0
description: |
  炉石传说赛事管理系统 - 基于飞书机器人和多维表格的全链路赛事管理。
  
  使用场景：
  (1) 管理多赛事并发，包括赛事配置、战队注册、选手档案
  (2) 执行管理员指令：/检查注册, /暂停顺延, /恢复顺延, /手动签到, /重发战报, /公示卡组
  (3) 操作赛事对阵与赛果，驱动自动顺延签到流程
  (4) 管理卡组提交与审核，执行卡组公示
  (5) 查询和更新 Bitable 中的赛事数据
  
  当用户提到"赛事管理"、"签到"、"顺延"、"战报"、"卡组"、"对阵"、"比分"时使用此 Skill。
  
  技术栈：OpenClaw + 飞书机器人 + Bitable
  部署方式：Skill 模式，直接使用 feishu_bitable_* 工具
---

# Tournament Manager - 炉石赛事管理系统

## 概述

本 Skill 提供完整的炉石传说赛事管理能力，基于飞书机器人和多维表格构建。支持多赛事并发、队长通知制签到、比分驱动顺延、人工风控审核等核心功能。

## 核心能力

### 1. 赛事配置管理
- 读取赛事配置（赛事ID、名称、状态、顺延开关、公示开关等）
- 更新赛事状态
- 使用 `feishu_bitable_app_table_record` 操作**赛事配置表**

### 2. 战队与选手管理
- 查询战队注册信息（战队ID、名称、队长OpenID、联系方式等）
- 查询选手档案（选手ID、所属战队、游戏ID等）
- 验证战队和选手存在性
- 使用 `feishu_bitable_app_table_record` 操作**战队主档案库**和**选手主档案库**

### 3. 对阵与赛果管理
- 查询场次信息（场次序号、对阵双方、比赛时间、状态等）
- 更新场次状态（未开始/进行中/已结束）
- 录入和校验比分
- 驱动自动顺延签到流程
- 使用 `feishu_bitable_app_table_record` 操作**赛事对阵与赛果表**

### 4. 签到流程
- 手动触发签到（`/手动签到 [场次]`）
- 自动顺延签到（基于比分变化自动触发）
- 发送签到卡片到飞书群聊（使用 `feishu_im_user_message`）
- 使用 `feishu_bitable_app_table_record` 操作**赛事对阵与赛果表**更新签到状态

### 5. 卡组管理
- 卡组提交审核
- 卡组公示（`/公示卡组`）
- 查询已审核通过的卡组列表
- 使用 `feishu_bitable_app_table_record` 操作**卡组提交与审核表**

### 6. 管理员权限
- 验证管理员白名单（使用 `feishu_bitable_app_table_record` 查询**管理员白名单**）
- 记录审计日志（使用 `feishu_bitable_app_table_record` 写入**审计日志表**）

### 7. 指令处理
- `/检查注册` - 检查赛事注册状态
- `/暂停顺延` - 暂停自动顺延（更新赛事配置的顺延开关为 false）
- `/恢复顺延` - 恢复自动顺延（更新赛事配置的顺延开关为 true）
- `/手动签到 [场次]` - 手动触发指定场次的签到
- `/重发战报 [场次]` - 重新发送指定场次的战报
- `/公示卡组` - 公示已审核通过的卡组

## 数据表结构

本 Skill 依赖以下 7 张 Bitable 数据表：

| 表Key | 用途 | 核心字段 |
|-------|------|----------|
| tournamentConfig | 赛事配置 | TournamentID, 赛事名称, 赛事状态, 顺延开关, 公示开关 |
| teamMaster | 战队主档案 | TeamID, 战队名称, 队长OpenID, 联系方式 |
| playerMaster | 选手主档案 | PlayerID, 所属战队ID, 游戏ID |
| matchResults | 对阵与赛果 | MatchID, TournamentID, 场次序号, 战队A, 战队B, 比分, 场次状态, 签到状态 |
| deckSubmission | 卡组提交 | DeckID, TournamentID, 所属战队ID, 卡组代码, 审核状态 |
| adminWhitelist | 管理员白名单 | OpenID, 权限级别, 备注 |
| auditLog | 审计日志 | 操作类型, 操作人OpenID, 目标赛事ID, 操作时间, 操作详情 |

## 工作流程

### 执行管理员指令的标准流程

1. **验证管理员权限**
   - 使用 `feishu_bitable_app_table_record.list` 查询**管理员白名单**
   - 检查操作人 OpenID 是否在白名单中

2. **读取赛事配置**
   - 使用 `feishu_bitable_app_table_record.list` 查询**赛事配置表**
   - 获取当前赛事状态、开关配置等

3. **执行业务逻辑**
   - 根据指令类型执行相应操作
   - 使用 `feishu_bitable_app_table_record.update` 更新数据
   - 使用 `feishu_bitable_app_table_record.create` 创建记录

4. **记录审计日志**
   - 使用 `feishu_bitable_app_table_record.create` 写入**审计日志表**

5. **发送通知（如需要）**
   - 使用 `feishu_im_user_message` 发送群消息或卡片

## 关键字段值格式

### 单选字段（如"赛事状态"）
- 值格式：字符串，如 `"进行中"`
- 选项："筹备中", "进行中", "已结束", "已暂停"

### 复选框字段（如"顺延开关"、"公示开关"）
- 值格式：布尔值，`true` 或 `false`

### 日期字段（如"操作时间"）
- 值格式：毫秒时间戳，如 `Date.now()`

### 人员字段（如"操作人OpenID"）
- 值格式：`[{id: "ou_xxx"}]`（数组对象）

## 使用示例

### 示例1：暂停顺延

```javascript
// 1. 验证管理员权限
const adminResult = await feishu_bitable_app_table_record({
  action: 'list',
  app_token: 'EVtobynOiap2Uis39gjc9jSfngg',
  table_id: 'tblHR3MA1aF7VOzY', // 管理员白名单
  filter: {
    conjunction: 'and',
    conditions: [
      { field_name: 'OpenID', operator: 'is', value: ['ou_914e6141a81eb6da2602875aee631269'] }
    ]
  }
});

// 2. 查询赛事配置
const configResult = await feishu_bitable_app_table_record({
  action: 'list',
  app_token: 'EVtobynOiap2Uis39gjc9jSfngg',
  table_id: 'tblIEAXYMO5tEhTm', // 赛事配置表
  filter: {
    conjunction: 'and',
    conditions: [
      { field_name: 'TournamentID', operator: 'is', value: ['T_TEST_2026_001'] }
    ]
  }
});

// 3. 更新顺延开关
await feishu_bitable_app_table_record({
  action: 'update',
  app_token: 'EVtobynOiap2Uis39gjc9jSfngg',
  table_id: 'tblIEAXYMO5tEhTm',
  record_id: configResult.records[0].record_id,
  fields: {
    '顺延开关': false
  }
});

// 4. 记录审计日志
await feishu_bitable_app_table_record({
  action: 'create',
  app_token: 'EVtobynOiap2Uis39gjc9jSfngg',
  table_id: 'tblr7R3Jjnyyx3Gm', // 审计日志表
  fields: {
    '操作类型': '暂停顺延',
    '操作人OpenID': [{id: 'ou_914e6141a81eb6da2602875aee631269'}],
    '目标赛事ID': 'T_TEST_2026_001',
    '操作时间': Date.now()
  }
});
```

### 示例2：手动签到

```javascript
// 查询指定场次
const matchResult = await feishu_bitable_app_table_record({
  action: 'list',
  app_token: 'EVtobynOiap2Uis39gjc9jSfngg',
  table_id: 'tblKNsEQX2ZmnVHM', // 对阵与赛果表
  filter: {
    conjunction: 'and',
    conditions: [
      { field_name: 'TournamentID', operator: 'is', value: ['T_TEST_2026_001'] },
      { field_name: '场次序号', operator: 'is', value: ['2'] }
    ]
  }
});

// 更新签到状态
await feishu_bitable_app_table_record({
  action: 'update',
  app_token: 'EVtobynOiap2Uis39gjc9jSfngg',
  table_id: 'tblKNsEQX2ZmnVHM',
  record_id: matchResult.records[0].record_id,
  fields: {
    '签到状态': '已下发'
  }
});

// 发送签到卡片到群聊
await feishu_im_user_message({
  action: 'send',
  msg_type: 'interactive',
  receive_id_type: 'chat_id',
  receive_id: 'oc_facaef3153706ec59c45e0d67ae5adc4',
  content: JSON.stringify({
    // 卡片内容...
  })
});
```

## 资源文件

### references/
- `table-schema.md` - 完整的 7 张数据表字段定义
- `command-reference.md` - 管理员指令详细说明
- `workflow.md` - 顺延流程和异常处理

### scripts/
- `init-tournament.js` - 初始化赛事数据脚本
- `check-permissions.js` - 检查 Bitable 权限脚本

## 注意事项

1. **权限要求**：使用本 Skill 前，确保当前用户已授权飞书 Bitable 相关权限
2. **并发限制**：同一数据表不支持并发写，需串行调用
3. **批量限制**：单次操作最多 500 条记录
4. **字段格式**：写入前务必确认字段类型和值格式匹配（参考飞书 Bitable Skill 指南）
