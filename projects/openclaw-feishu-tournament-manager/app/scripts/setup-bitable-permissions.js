/**
 * Bitable 权限自动化配置脚本
 * 
 * 通过"群组+机器人"的方式为飞书应用授权多维表格访问权限
 * 
 * 使用方法：
 *   FEISHU_APP_ID="xxx" FEISHU_APP_SECRET="xxx" node setup-bitable-permissions.js <app_token> [chat_id]
 * 
 * 参数：
 *   app_token - 多维表格 App Token
 *   chat_id   - 可选，已存在的群组ID（如果不提供，需要手动创建群组并添加机器人）
 * 
 * 环境变量：
 *   FEISHU_APP_ID - 飞书应用 ID
 *   FEISHU_APP_SECRET - 飞书应用 Secret
 * 
 * 前置条件：
 *   1. 飞书应用必须已开通"机器人"能力
 *   2. 必须创建一个群组，并将应用添加为群机器人
 *   3. 使用群组的 chat_id 作为参数调用此脚本
 * 
 * 参考文档：
 *   https://open.feishu.cn/document/faq/trouble-shooting/how-to-add-permissions-to-app
 */

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

// ============================================
// Token 管理
// ============================================

let cachedToken = null;
let tokenExpireTime = 0;

async function getTenantAccessToken() {
  const now = Date.now();
  
  if (cachedToken && now < tokenExpireTime - 5 * 60 * 1000) {
    return cachedToken;
  }
  
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  
  if (!appId || !appSecret) {
    throw new Error('缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET 环境变量');
  }
  
  const response = await fetch(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  
  const data = await response.json();
  
  if (data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${data.msg}`);
  }
  
  cachedToken = data.tenant_access_token;
  tokenExpireTime = now + data.expire * 1000;
  
  return cachedToken;
}

// ============================================
// HTTP 请求封装
// ============================================

async function httpRequest(method, url, data = null) {
  const token = await getTenantAccessToken();
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  const options = { method, headers };
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  const text = await response.text();
  
  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    throw new Error(`JSON 解析失败: ${e.message}. 原始响应: ${text.substring(0, 200)}`);
  }
  
  return { status: response.status, data: result };
}

// ============================================
// 云文档权限 API
// ============================================

/**
 * 获取云文档协作者列表
 */
async function listDocumentCollaborators(token, type = 'bitable') {
  const url = `${FEISHU_API_BASE}/drive/v1/permissions/${token}/members?type=${type}&page_size=100`;
  const result = await httpRequest('GET', url);
  
  if (result.data.code !== 0) {
    throw new Error(`获取协作者列表失败: ${result.data.msg}`);
  }
  
  return result.data.data?.members || [];
}

/**
 * 添加群组为云文档协作者
 */
async function addChatCollaborator(token, chatId, perm = 'edit', type = 'bitable') {
  const url = `${FEISHU_API_BASE}/drive/v1/permissions/${token}/members?type=${type}`;
  
  const body = {
    member_type: 'openchat',
    member_id: chatId,
    perm: perm,
  };
  
  const result = await httpRequest('POST', url, body);
  
  if (result.data.code !== 0) {
    if (result.data.code === 40009 || result.data.msg?.includes('already exists')) {
      return { success: true, exists: true, message: '协作者已存在' };
    }
    throw new Error(`添加协作者失败: ${result.data.msg} (code: ${result.data.code})`);
  }
  
  return { success: true, exists: false, data: result.data.data };
}

/**
 * 更新云文档协作者权限
 */
async function updateChatCollaborator(token, chatId, perm = 'edit', type = 'bitable') {
  const url = `${FEISHU_API_BASE}/drive/v1/permissions/${token}/members?type=${type}`;
  
  const body = {
    member_type: 'openchat',
    member_id: chatId,
    perm: perm,
  };
  
  const result = await httpRequest('PUT', url, body);
  
  if (result.data.code !== 0) {
    throw new Error(`更新协作者权限失败: ${result.data.msg}`);
  }
  
  return { success: true, data: result.data.data };
}

// ============================================
// 主流程
// ============================================

async function setupBitablePermissions(appToken, chatId) {
  console.log('========================================');
  console.log('Bitable 权限自动化配置');
  console.log('========================================\n');
  
  console.log(`目标 Bitable: ${appToken}`);
  console.log(`授权群组 ID: ${chatId}\n`);
  
  // 1. 获取当前协作者列表
  console.log('[1/3] 获取当前协作者列表...');
  const members = await listDocumentCollaborators(appToken, 'bitable');
  console.log(`      当前共有 ${members.length} 个协作者`);
  
  // 2. 检查群组是否已在协作者列表中
  const existingMember = members.find(m => 
    (m.member_type === 'chat' || m.member_type === 'openchat') && m.member_id === chatId
  );
  
  if (existingMember) {
    console.log(`      群组 ${chatId} 已是协作者，当前权限: ${existingMember.perm}`);
    
    if (existingMember.perm !== 'edit') {
      console.log('[2/3] 更新权限为"可编辑"...');
      await updateChatCollaborator(appToken, chatId, 'edit', 'bitable');
      console.log('      ✅ 权限已更新');
    } else {
      console.log('[2/3] 权限已是"可编辑"，无需更新');
    }
  } else {
    console.log('[2/3] 添加群组为协作者...');
    const result = await addChatCollaborator(appToken, chatId, 'edit', 'bitable');
    if (result.exists) {
      console.log('      ✅ 协作者已存在');
    } else {
      console.log('      ✅ 添加成功');
    }
  }
  
  // 3. 验证权限（通过尝试读取 Bitable 数据来验证）
  console.log('[3/3] 验证权限...');
  
  // 尝试读取 Bitable 数据来验证权限
  const testUrl = `${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables`;
  try {
    const testResult = await httpRequest('GET', testUrl);
    if (testResult.data.code === 0) {
      console.log('      ✅ 权限验证通过，应用可以访问该多维表格');
      console.log(`      共有 ${testResult.data.data?.items?.length || 0} 张数据表\n`);
    } else if (testResult.data.code === 91403) {
      console.log('      ❌ 权限验证失败，应用仍无法访问该多维表格');
      console.log('      可能原因：群组未正确添加，或应用未添加到群组机器人');
      throw new Error('权限配置未生效');
    } else {
      console.log(`      ⚠️ 验证返回错误: ${testResult.data.msg} (code: ${testResult.data.code})`);
    }
  } catch (error) {
    console.log('      ❌ 验证请求失败:', error.message);
    throw new Error('权限验证请求失败');
  }
  
  console.log('========================================');
  console.log('配置完成！');
  console.log('========================================');
  console.log('\n说明：');
  console.log('- 群组已被添加为多维表格的协作者');
  console.log('- 应用作为群机器人，间接获得访问权限');
  console.log('- 应用现在可以读写该多维表格');
  return true;
}

// ============================================
// 命令行入口
// ============================================

async function main() {
  const appToken = process.argv[2];
  const chatId = process.argv[3] || process.env.TOURNAMENT_CHAT_ID;
  
  if (!appToken) {
    console.error('错误：请提供 Bitable App Token');
    console.error('');
    console.error('用法：');
    console.error('  FEISHU_APP_ID="xxx" FEISHU_APP_SECRET="xxx" node setup-bitable-permissions.js <app_token> <chat_id>');
    console.error('');
    console.error('参数说明：');
    console.error('  app_token - 多维表格 App Token');
    console.error('  chat_id   - 群聊 ID（格式：oc_xxx），该群组需已添加应用为机器人');
    console.error('');
    console.error('前置条件：');
    console.error('  1. 飞书应用已开通"机器人"能力');
    console.error('  2. 创建一个群组，将应用添加为群机器人');
    console.error('  3. 获取群组的 chat_id（可通过飞书开放平台或群设置查看）');
    process.exit(1);
  }
  
  if (!chatId) {
    console.error('错误：请提供群聊 ID (chat_id)');
    console.error('');
    console.error('该群组需要：');
    console.error('  1. 是一个飞书群聊');
    console.error('  2. 已将应用添加为群机器人');
    console.error('');
    console.error('获取 chat_id 的方法：');
    console.error('  - 通过飞书开放平台 → 群组管理查看');
    console.error('  - 或通过群设置 → 群组信息查看');
    process.exit(1);
  }
  
  if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
    console.error('错误：缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET 环境变量');
    process.exit(1);
  }
  
  try {
    await setupBitablePermissions(appToken, chatId);
  } catch (error) {
    console.error('\n❌ 配置失败:', error.message);
    process.exit(1);
  }
}

main();