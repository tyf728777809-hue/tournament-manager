/**
 * Skill 模式测试脚本
 */

import { checkRegistration } from './src/commands/check-registration.js';
import { pauseRolling, resumeRolling } from './src/commands/pause-rolling.js';

const TEST_OPERATOR = 'ou_914e6141a81eb6da2602875aee631269';

async function runTests() {
  console.log('========================================');
  console.log('Skill 模式测试');
  console.log('========================================\n');

  // 测试 1: 检查注册
  console.log('测试 1: /检查注册');
  const regResult = await checkRegistration({ operatorOpenId: TEST_OPERATOR });
  console.log('结果:', regResult.ok ? '✅ 成功' : '❌ 失败');
  console.log('消息:', regResult.message);
  console.log();

  // 测试 2: 暂停顺延
  console.log('测试 2: /暂停顺延');
  const pauseResult = await pauseRolling({ operatorOpenId: TEST_OPERATOR });
  console.log('结果:', pauseResult.ok ? '✅ 成功' : '❌ 失败');
  console.log('消息:', pauseResult.message);
  console.log();

  // 测试 3: 恢复顺延
  console.log('测试 3: /恢复顺延');
  const resumeResult = await resumeRolling({ operatorOpenId: TEST_OPERATOR });
  console.log('结果:', resumeResult.ok ? '✅ 成功' : '❌ 失败');
  console.log('消息:', resumeResult.message);
  console.log();

  console.log('========================================');
  console.log('测试完成');
  console.log('========================================');
}

runTests().catch(console.error);
