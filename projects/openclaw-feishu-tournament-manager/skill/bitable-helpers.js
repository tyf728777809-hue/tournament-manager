/**
 * Bitable 操作辅助函数
 * 
 * 这些函数封装了 feishu_bitable_* 工具的调用
 * 在 OpenClaw 会话环境中使用
 */

/**
 * 查询记录列表
 * @param {Object} params - 查询参数
 * @returns {Promise<Object>} - { ok, records, message }
 */
export async function listRecords(params) {
  try {
    // 在 OpenClaw 会话中，这里会调用 feishu_bitable_app_table_record 工具
    // 实际调用由 OpenClaw 运行时处理
    const result = await callBitableTool('feishu_bitable_app_table_record', {
      action: 'list',
      ...params
    });
    
    return {
      ok: true,
      records: result.records || [],
      hasMore: result.has_more || false
    };
  } catch (error) {
    return {
      ok: false,
      records: [],
      message: error.message || '查询失败'
    };
  }
}

/**
 * 创建记录
 * @param {Object} params - 创建参数
 * @returns {Promise<Object>} - { ok, record, message }
 */
export async function createRecord(params) {
  try {
    const result = await callBitableTool('feishu_bitable_app_table_record', {
      action: 'create',
      ...params
    });
    
    return {
      ok: true,
      record: result.record
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || '创建失败'
    };
  }
}

/**
 * 批量创建记录
 * @param {Object} params - 批量创建参数
 * @returns {Promise<Object>} - { ok, records, message }
 */
export async function batchCreateRecords(params) {
  try {
    const result = await callBitableTool('feishu_bitable_app_table_record', {
      action: 'batch_create',
      ...params
    });
    
    return {
      ok: true,
      records: result.records || []
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || '批量创建失败'
    };
  }
}

/**
 * 更新记录
 * @param {Object} params - 更新参数
 * @returns {Promise<Object>} - { ok, record, message }
 */
export async function updateRecord(params) {
  try {
    const result = await callBitableTool('feishu_bitable_app_table_record', {
      action: 'update',
      ...params
    });
    
    return {
      ok: true,
      record: result.record
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || '更新失败'
    };
  }
}

/**
 * 批量更新记录
 * @param {Object} params - 批量更新参数
 * @returns {Promise<Object>} - { ok, records, message }
 */
export async function batchUpdateRecords(params) {
  try {
    const result = await callBitableTool('feishu_bitable_app_table_record', {
      action: 'batch_update',
      ...params
    });
    
    return {
      ok: true,
      records: result.records || []
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message || '批量更新失败'
    };
  }
}

/**
 * 字段值归一化（处理富文本数组）
 * @param {*} value 
 * @returns {*}
 */
export function normalizeFieldValue(value) {
  // 处理富文本数组
  if (Array.isArray(value) && value.length > 0) {
    const isRichText = value.every(item => 
      item && typeof item === 'object' && 'text' in item && 'type' in item
    );
    
    if (isRichText) {
      return value.map(item => item.text || '').join('');
    }
  }
  
  // 递归处理数组
  if (Array.isArray(value)) {
    return value.map(item => normalizeFieldValue(item));
  }
  
  // 递归处理对象
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => [key, normalizeFieldValue(innerValue)])
    );
  }
  
  return value;
}

/**
 * 批量归一化字段
 * @param {Object} fields 
 * @returns {Object}
 */
export function normalizeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, normalizeFieldValue(value)])
  );
}

/**
 * 调用 Bitable 工具的占位函数
 * 
 * 注意：在实际的 OpenClaw 会话中，这些工具调用会被运行时处理
 * 此函数仅作为类型提示和文档说明
 * 
 * @param {string} toolName 
 * @param {Object} params 
 * @returns {Promise<Object>}
 */
async function callBitableTool(toolName, params) {
  // 在 OpenClaw 会话中，这里会被替换为实际的工具调用
  // 例如：使用 feishu_bitable_app_table_record 工具
  throw new Error(
    `callBitableTool 是占位函数，应在 OpenClaw 会话中使用实际的工具调用。\n` +
    `工具: ${toolName}\n` +
    `参数: ${JSON.stringify(params, null, 2)}`
  );
}
