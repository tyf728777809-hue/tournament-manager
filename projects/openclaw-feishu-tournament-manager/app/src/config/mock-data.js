export function createMockRecords(context) {
  return {
    tournamentConfig: [
      {
        recordId: 'recvfyQZhdQqmZ',
        fields: {
          TournamentID: context.tournamentId,
          赛事名称: 'OpenClaw 多赛事管理系统测试赛事',
          ChatID: context.chatId,
          BitableAppToken: context.appToken,
          赛事状态: '筹备中',
          顺延开关: true,
          公示开关: false,
          首场签到开启方式: '手动',
          默认签到超时分钟数: 10,
          赛事备注: '测试环境初始化记录'
        }
      }
    ],
    teamMaster: [
      {
        recordId: 'recvfyS2kfOheh',
        fields: {
          TeamID: 'TEAM_TEST_A',
          TournamentID: context.tournamentId,
          战队名称: '测试战队A',
          战队队长: [{ id: 'ou_914e6141a81eb6da2602875aee631269' }],
          '队长飞书 UserID': 'ou_914e6141a81eb6da2602875aee631269',
          战队状态: '待组队',
          备注: '最小验收测试队 A'
        }
      },
      {
        recordId: 'recvfyS2kfRS8b',
        fields: {
          TeamID: 'TEAM_TEST_B',
          TournamentID: context.tournamentId,
          战队名称: '测试战队B',
          战队队长: [{ id: 'ou_914e6141a81eb6da2602875aee631269' }],
          '队长飞书 UserID': 'ou_914e6141a81eb6da2602875aee631269',
          战队状态: '待确认',
          备注: '最小验收测试队 B'
        }
      }
    ],
    playerMaster: [
      {
        recordId: 'recvfySPL7jqAA',
        fields: {
          PlayerID: 'PLAYER_TEST_001',
          TournamentID: context.tournamentId,
          '飞书 UserID': 'ou_914e6141a81eb6da2602875aee631269',
          飞书昵称快照: '用户942915',
          报名姓名: '测试队长A',
          '战网 ID': 'captainA#1234',
          队内角色: '队长',
          是否在群: true,
          档案状态: '待补资料',
          异常标记: ['信息不完整'],
          所属战队: 'TEAM_TEST_A',
          备注: '测试选手-队长A，暂未上传定妆照'
        }
      },
      {
        recordId: 'recvfySPL7a9HR',
        fields: {
          PlayerID: 'PLAYER_TEST_002',
          TournamentID: context.tournamentId,
          '飞书 UserID': 'ou_914e6141a81eb6da2602875aee631269',
          飞书昵称快照: '用户942915',
          报名姓名: '测试正选A',
          '战网 ID': 'starterA#2345',
          队内角色: '正选',
          是否在群: true,
          档案状态: '待补资料',
          异常标记: ['信息不完整'],
          所属战队: 'TEAM_TEST_A',
          备注: '测试选手-正选A，暂未上传定妆照'
        }
      },
      {
        recordId: 'recvfySPL7NB4V',
        fields: {
          PlayerID: 'PLAYER_TEST_003',
          TournamentID: context.tournamentId,
          '飞书 UserID': 'ou_914e6141a81eb6da2602875aee631269',
          飞书昵称快照: '用户942915',
          报名姓名: '测试替补A',
          '战网 ID': 'subA#3456',
          队内角色: '替补',
          是否在群: true,
          档案状态: '待补资料',
          异常标记: ['信息不完整'],
          所属战队: 'TEAM_TEST_A',
          备注: '测试选手-替补A，暂未上传定妆照'
        }
      }
    ],
    adminWhitelist: [
      {
        recordId: 'recvfz1YJSkcO0',
        fields: {
          TournamentID: context.tournamentId,
          飞书UserID: 'ou_914e6141a81eb6da2602875aee631269',
          昵称: '用户942915',
          备注: '测试管理员/主裁样本',
          是否启用: true
        }
      }
    ],
    auditLog: [
      {
        recordId: 'recvfz5kP8VSHo',
        fields: {
          LogID: 'LOG_TEST_001',
          TournamentID: context.tournamentId,
          动作类型: '发签到卡',
          目标对象类型: '场次',
          目标对象ID: 'MATCH_TEST_001',
          操作者: 'system',
          操作来源: '自动触发',
          变更前摘要: '{"status":"未开启"}',
          变更后摘要: '{"status":"待签到"}',
          处理结果: '成功',
          错误原因: '',
          发生时间: '2026-04-02 02:20'
        }
      }
    ]
  };
}
