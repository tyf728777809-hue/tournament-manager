/**
 * 状态机模块
 * 
 * 管理所有业务对象的状态流转：
 * - 选手档案状态
 * - 战队状态
 * - 场次状态
 * - 卡组审核状态
 */

import { logger } from './logger.js';

// ============================================
// 选手档案状态机
// ============================================

export const PlayerProfileStatus = {
  UNREGISTERED: '未注册',
  CREATED_INCOMPLETE: '已创建未完成',
  PENDING_SUPPLEMENT: '待补资料',
  COMPLETED: '已完成',
  LOCKED: '已锁定',
};

export const PlayerProfileStatusTransitions = {
  [PlayerProfileStatus.UNREGISTERED]: [
    PlayerProfileStatus.CREATED_INCOMPLETE,
  ],
  [PlayerProfileStatus.CREATED_INCOMPLETE]: [
    PlayerProfileStatus.PENDING_SUPPLEMENT,
    PlayerProfileStatus.COMPLETED,
  ],
  [PlayerProfileStatus.PENDING_SUPPLEMENT]: [
    PlayerProfileStatus.COMPLETED,
  ],
  [PlayerProfileStatus.COMPLETED]: [
    PlayerProfileStatus.LOCKED,
  ],
  [PlayerProfileStatus.LOCKED]: [], // 终态
};

// ============================================
// 战队状态机
// ============================================

export const TeamStatus = {
  PENDING_FORMATION: '待组队',
  PENDING_MEMBERS: '待补员',
  PENDING_CONFIRMATION: '待确认',
  LOCKED: '已锁定',
  WITHDRAWN: '已退赛',
};

export const TeamStatusTransitions = {
  [TeamStatus.PENDING_FORMATION]: [
    TeamStatus.PENDING_MEMBERS,
    TeamStatus.PENDING_CONFIRMATION,
  ],
  [TeamStatus.PENDING_MEMBERS]: [
    TeamStatus.PENDING_CONFIRMATION,
  ],
  [TeamStatus.PENDING_CONFIRMATION]: [
    TeamStatus.LOCKED,
  ],
  [TeamStatus.LOCKED]: [
    TeamStatus.WITHDRAWN,
  ],
  [TeamStatus.WITHDRAWN]: [], // 终态
};

// ============================================
// 场次状态机
// ============================================

export const MatchStatus = {
  NOT_STARTED: '未开启',
  PENDING_CHECKIN: '待签到',
  CHECKED_IN_PENDING_START: '已签到待开赛',
  IN_PROGRESS: '进行中',
  ENDED: '已结束',
  SUSPENDED: '已挂起',
  CANCELLED: '已取消',
  REMATCH: '重赛中',
};

export const MatchStatusTransitions = {
  [MatchStatus.NOT_STARTED]: [
    MatchStatus.PENDING_CHECKIN,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.PENDING_CHECKIN]: [
    MatchStatus.CHECKED_IN_PENDING_START,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.CHECKED_IN_PENDING_START]: [
    MatchStatus.IN_PROGRESS,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.IN_PROGRESS]: [
    MatchStatus.ENDED,
    MatchStatus.SUSPENDED,
    MatchStatus.REMATCH,
  ],
  [MatchStatus.ENDED]: [
    MatchStatus.REMATCH,
  ],
  [MatchStatus.SUSPENDED]: [
    MatchStatus.IN_PROGRESS,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.CANCELLED]: [], // 终态
  [MatchStatus.REMATCH]: [
    MatchStatus.IN_PROGRESS,
  ],
};

// ============================================
// 卡组审核状态机
// ============================================

export const DeckReviewStatus = {
  NOT_SUBMITTED: '未提交',
  SUBMITTED_PENDING_REVIEW: '已提交待审核',
  APPROVED: '审核通过',
  REJECTED: '审核驳回',
  PUBLISHED: '已公示',
  LOCKED: '已锁定',
};

export const DeckReviewStatusTransitions = {
  [DeckReviewStatus.NOT_SUBMITTED]: [
    DeckReviewStatus.SUBMITTED_PENDING_REVIEW,
  ],
  [DeckReviewStatus.SUBMITTED_PENDING_REVIEW]: [
    DeckReviewStatus.APPROVED,
    DeckReviewStatus.REJECTED,
  ],
  [DeckReviewStatus.APPROVED]: [
    DeckReviewStatus.PUBLISHED,
  ],
  [DeckReviewStatus.REJECTED]: [
    DeckReviewStatus.SUBMITTED_PENDING_REVIEW, // 可重新提交
  ],
  [DeckReviewStatus.PUBLISHED]: [
    DeckReviewStatus.LOCKED,
  ],
  [DeckReviewStatus.LOCKED]: [], // 终态
};

// ============================================
// 状态机通用方法
// ============================================

/**
 * 状态机类
 */
export class StateMachine {
  constructor(name, transitions, initialState) {
    this.name = name;
    this.transitions = transitions;
    this.initialState = initialState;
  }

  /**
   * 检查状态转换是否允许
   * @param {string} fromState - 当前状态
   * @param {string} toState - 目标状态
   * @returns {boolean}
   */
  canTransition(fromState, toState) {
    const allowedStates = this.transitions[fromState] || [];
    return allowedStates.includes(toState);
  }

  /**
   * 获取允许的目标状态列表
   * @param {string} currentState - 当前状态
   * @returns {string[]}
   */
  getAllowedTransitions(currentState) {
    return this.transitions[currentState] || [];
  }

  /**
   * 执行状态转换
   * @param {string} fromState - 当前状态
   * @param {string} toState - 目标状态
   * @param {Object} context - 转换上下文
   * @returns {Object} - { success: boolean, message: string }
   */
  transition(fromState, toState, context = {}) {
    if (!this.canTransition(fromState, toState)) {
      return {
        success: false,
        message: `状态转换不允许: ${fromState} -> ${toState}`,
      };
    }

    // 执行转换前校验
    const validation = this.validateTransition(fromState, toState, context);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message,
      };
    }

    logger.info('state-machine', `状态转换: ${fromState} -> ${toState}`, {
      machine: this.name,
      context,
    });

    return {
      success: true,
      message: `状态转换成功: ${fromState} -> ${toState}`,
      fromState,
      toState,
    };
  }

  /**
   * 校验状态转换
   * 子类可重写此方法添加自定义校验逻辑
   * @param {string} fromState - 当前状态
   * @param {string} toState - 目标状态
   * @param {Object} context - 转换上下文
   * @returns {Object} - { valid: boolean, message: string }
   */
  validateTransition(fromState, toState, context) {
    return { valid: true, message: '' };
  }
}

// ============================================
// 预定义状态机实例（使用已定义的 transitions）
// ============================================

const playerProfileStateMachine = new StateMachine(
  '选手档案状态',
  PlayerProfileStatusTransitions,
  PlayerProfileStatus.UNREGISTERED
);

const teamStateMachine = new StateMachine(
  '战队状态',
  TeamStatusTransitions,
  TeamStatus.PENDING_FORMATION
);

const matchStateMachine = new StateMachine(
  '场次状态',
  MatchStatusTransitions,
  MatchStatus.NOT_STARTED
);

const deckReviewStateMachine = new StateMachine(
  '卡组审核状态',
  DeckReviewStatusTransitions,
  DeckReviewStatus.NOT_SUBMITTED
);

// ============================================
// 便捷方法
// ============================================

/**
 * 获取状态机实例
 * @param {string} type - 状态机类型: player|team|match|deck
 * @returns {StateMachine}
 */
export function getStateMachine(type) {
  switch (type) {
    case 'player':
      return playerProfileStateMachine;
    case 'team':
      return teamStateMachine;
    case 'match':
      return matchStateMachine;
    case 'deck':
      return deckReviewStateMachine;
    default:
      throw new Error(`未知状态机类型: ${type}`);
  }
}
