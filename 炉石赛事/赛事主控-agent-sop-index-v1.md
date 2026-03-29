# 赛事主控 Agent SOP Index v1

> 用途：为赛事主控代理提供“先读什么、遇到什么问题查什么”的索引地图。

---

## 1. 顶层总览

### 系统总入口
- `炉石赛事/README.md`
  - 先读这个，用来建立全局地图

### 主控代理自我约束
- `炉石赛事/赛事主控-agent-core-v1.md`
- `炉石赛事/赛事主控-agent-operating-rules-v1.md`
- `炉石赛事/赛事主控-agent-handover-checklist-v1.md`
- `炉石赛事/赛事主控-agent-bootstrap-context-v1.md`

---

## 2. 设计类文档

### 想看整体业务结构
- `炉石赛事/P0-入口状态变化表-v1.md`
- `炉石赛事/表单字段详细设计-v1.md`
- `炉石赛事/回调映射与写回规则-v1.md`
- `炉石赛事/管理员审核卡片设计-v1.md`
- `炉石赛事/飞书卡片模板草案-v1.md`

### 想看测试与实例
- `炉石赛事/战队赛测试赛卡片实例-v1.md`
- `炉石赛事/公示确认稿-烈火战队-v1.md`

---

## 3. 实现类文档 / 代码

### 核心业务入口
- `炉石赛事/callback-handler.js`

### 数据层
- `炉石赛事/bitable-api-utils.js`

### 通知层
- `炉石赛事/notification-utils.js`

### 飞书回调接线
- `炉石赛事/feishu-callback-adapter.js`
- `炉石赛事/feishu-callback-server.js`
- `炉石赛事/run-feishu-callback-local.sh`

### 旧框架/参考合并稿
- `炉石赛事/callback-handler-skeleton.js`
- `炉石赛事/callback-handler-skeleton-part2.js`
- `炉石赛事/callback-handler-merged.js`
- `炉石赛事/MERGE-GUIDE.md`
- `炉石赛事/utils-integration-guide.md`

---

## 4. 个人赛优先链路文档

### 想看个人赛建设脉络
- `炉石赛事/个人赛链路实施清单-v1.md`
- `炉石赛事/个人赛报名实现说明-v1.md`
- `炉石赛事/个人赛卡组提交实现说明-v1.md`
- `炉石赛事/个人赛小局明细落地说明-v1.md`
- `炉石赛事/个人赛BP与BO5推进摘要-v1.md`

### 想看个人赛赛果主链路
- `炉石赛事/赛果确认链路实现说明-v1.md`
- `炉石赛事/个人赛赛果确认升级与真实表对接说明-v1.md`
- `炉石赛事/个人赛赛果用户身份写表方案-v1.md`
- `炉石赛事/Feishu用户身份写表执行约定-v1.md`

### 想看个人赛赛果最终结论
- `炉石赛事/个人赛赛果链路最终收口摘要-v1.md`
- `炉石赛事/个人赛赛果联调清单-v1.md`
- `炉石赛事/个人赛测试链路演练摘要-v1.md`
- `炉石赛事/个人赛赛果真实联调-checklist-v1.md`
- `炉石赛事/个人赛赛果链路操作总入口-v1.md`

---

## 5. 按动作查文档

### 如果要做“报名/审核”
优先看：
- `个人赛链路实施清单-v1.md`
- `P0-入口状态变化表-v1.md`
- `表单字段详细设计-v1.md`

### 如果要做“卡组提交/校验/审核”
优先看：
- `个人赛卡组提交实现说明-v1.md`
- `个人赛链路实施清单-v1.md`
- `表单字段详细设计-v1.md`

### 如果要做“赛果上报/确认/争议”
优先看：
- `个人赛赛果链路操作总入口-v1.md`
- `个人赛赛果链路最终收口摘要-v1.md`
- `个人赛赛果真实联调-checklist-v1.md`
- `个人赛赛果线上回调接线方案-v1.md`

### 如果要做“线上接线/飞书 webhook”
优先看：
- `个人赛赛果线上回调接线方案-v1.md`
- `feishu-callback-adapter.js`
- `feishu-callback-server.js`
- `run-feishu-callback-local.sh`

### 如果要做“管理员兜底/异常收口”
优先看：
- `个人赛赛果-admin-confirm端到端模板-v1.md`
- `个人赛赛果链路最终收口摘要-v1.md`
- `回调映射与写回规则-v1.md`

---

## 6. 按风险查文档

### 遇到状态不一致
- 先查 `个人赛赛果链路最终收口摘要-v1.md`
- 再查 `回调映射与写回规则-v1.md`
- 再看 `callback-handler.js`

### 遇到赛果/争议同步问题
- 先查 `个人赛赛果链路操作总入口-v1.md`
- 再查 `个人赛赛果-admin-confirm端到端模板-v1.md`

### 遇到回调入口问题
- 先查 `个人赛赛果线上回调接线方案-v1.md`
- 再查 `feishu-callback-adapter.js`
- 再查 `feishu-callback-server.js`

---

## 7. 最短阅读路径（推荐）

如果时间紧，只读以下 8 份：
1. `README.md`
2. `赛事主控-agent-core-v1.md`
3. `赛事主控-agent-operating-rules-v1.md`
4. `赛事主控-agent-bootstrap-context-v1.md`
5. `个人赛赛果链路最终收口摘要-v1.md`
6. `个人赛赛果链路操作总入口-v1.md`
7. `个人赛赛果线上回调接线方案-v1.md`
8. `callback-handler.js`

---

## 8. 一句话使用方法

> 先用本索引定位问题，再去读最相关的 1~3 份文档，不要在全部文档里无差别漫游。
