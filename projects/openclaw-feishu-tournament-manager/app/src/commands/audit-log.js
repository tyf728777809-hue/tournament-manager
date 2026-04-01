import { createLogId } from '../utils/ids.js';
import { nowText } from '../utils/time.js';

export async function writeAuditLog({ bitable, tournamentId, actionType, targetType, targetId = '', operator = 'system', source = '指令', before = '', after = '', result = '成功', error = '' }) {
  return bitable.createRecord('auditLog', {
    LogID: createLogId(),
    TournamentID: tournamentId,
    动作类型: actionType,
    目标对象类型: targetType,
    目标对象ID: targetId,
    操作者: operator,
    操作来源: source,
    变更前摘要: before,
    变更后摘要: after,
    处理结果: result,
    错误原因: error,
    发生时间: nowText()
  });
}
