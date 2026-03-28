/**
 * 炉石赛事自动化系统 - 多维表格 API 工具函数
 * 版本: v1.0 | 日期: 2026-03-28
 * 
 * 本文件实现 callback-handler-skeleton.js 中的工具函数占位符
 * 基于飞书开放平台 Bitable API
 */

// ============================================
// 1. 基础配置
// ============================================

const axios = require('axios');

const CONFIG = {
  baseUrl: 'https://open.feishu.cn/open-apis/bitable/v1',
  apps: {
    basic: 'KSyvbZIb1af98gsLJ7wcKmtEn9Q',
    operation: 'KL3TbTEJIa5oytspkGGcf50rnpc',
    deck: 'SXg4bBhrhajJgdsRNCzcycOrnbe',
  },
  // 从环境变量获取访问令牌
  getAccessToken: async () => {
    // 实际实现：调用飞书获取 tenant_access_token
    // 这里使用 OpenClaw 内置的 token 获取机制
    return process.env.FEISHU_ACCESS_TOKEN;
  }
};

// ============================================
// 2. 记录查询操作
// ============================================

/**
 * 查询记录列表
 * @param {string} appToken - App Token
 * @param {string} tableId - 表ID
 * @param {Object} options - 查询选项 { filter, sort, pageSize }
 * @returns {Promise<Array>} 记录列表
 */
async function queryRecord(appToken, tableId, options = {}) {
  const token = await CONFIG.getAccessToken();
  const { filter, sort, pageSize = 500 } = options;
  
  const params = new URLSearchParams();
  params.append('page_size', pageSize.toString());
  
  if (filter) {
    params.append('filter', JSON.stringify(filter));
  }
  
  if (sort) {
    params.append('sort', JSON.stringify(sort));
  }
  
  const response = await axios({
    method: 'GET',
    url: `${CONFIG.baseUrl}/apps/${appToken}/tables/${tableId}/records`,
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    params: params,
  });
  
  if (response.data.code !== 0) {
    throw new Error(`Query failed: ${response.data.msg}`);
  }
  
  return response.data.data.items || [];
}

/**
 * 获取单条记录
 * @param {string} appToken - App Token
 * @param {string} tableId - 表ID
 * @param {string} recordId - 记录ID
 * @returns {Promise<Object>} 记录详情
 */
async function getRecord(appToken, tableId, recordId) {
  const token = await CONFIG.getAccessToken();
  
  const response = await axios({
    method: 'GET',
    url: `${CONFIG.baseUrl}/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (response.data.code !== 0) {
    throw new Error(`Get record failed: ${response.data.msg}`);
  }
  
  return response.data.data;
}

// ============================================
// 3. 记录更新操作
// ============================================

/**
 * 更新单条记录
 * @param {string} appToken - App Token
 * @param {string} tableId - 表ID
 * @param {string} recordId - 记录ID
 * @param {Object} fields - 要更新的字段
 * @returns {Promise<Object>} 更新后的记录
 */
async function updateRecord(appToken, tableId, recordId, fields) {
  const token = await CONFIG.getAccessToken();
  
  const response = await axios({
    method: 'PUT',
    url: `${CONFIG.baseUrl}/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      fields: formatFields(fields),
    },
  });
  
  if (response.data.code !== 0) {
    throw new Error(`Update failed: ${response.data.msg}`);
  }
  
  return response.data.data;
}

/**
 * 批量更新记录
 * @param {string} appToken - App Token
 * @param {string} tableId - 表ID
 * @param {Array} records - 记录数组 [{ record_id, fields }]
 * @returns {Promise<Array>} 更新后的记录列表
 */
async function batchUpdateRecords(appToken, tableId, records) {
  const token = await CONFIG.getAccessToken();
  
  // 飞书限制：单次最多 500 条
  const batchSize = 500;
  const results = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const response = await axios({
      method: 'PUT',
      url: `${CONFIG.baseUrl}/apps/${appToken}/tables/${tableId}/records/batch_update`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        records: batch.map(r => ({
          record_id: r.record_id,
          fields: formatFields(r.fields),
        })),
      },
    });
    
    if (response.data.code !== 0) {
      throw new Error(`Batch update failed: ${response.data.msg}`);
    }
    
    results.push(...(response.data.data.records || []));
  }
  
  return results;
}

/**
 * 创建单条记录
 * @param {string} appToken - App Token
 * @param {string} tableId - 表ID
 * @param {Object} fields - 字段数据
 * @returns {Promise<Object>} 创建的记录
 */
async function createRecord(appToken, tableId, fields) {
  const token = await CONFIG.getAccessToken();
  
  const response = await axios({
    method: 'POST',
    url: `${CONFIG.baseUrl}/apps/${appToken}/tables/${tableId}/records`,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    data: {
      fields: formatFields(fields),
    },
  });
  
  if (response.data.code !== 0) {
    throw new Error(`Create failed: ${response.data.msg}`);
  }
  
  return response.data.data;
}

/**
 * 批量创建记录
 * @param {string} appToken - App Token
 * @param {string} tableId - 表ID
 * @param {Array} records - 记录数组 [{ fields }]
 * @returns {Promise<Array>} 创建的记录列表
 */
async function batchCreateRecords(appToken, tableId, records) {
  const token = await CONFIG.getAccessToken();
  
  // 飞书限制：单次最多 500 条
  const batchSize = 500;
  const results = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const response = await axios({
      method: 'POST',
      url: `${CONFIG.baseUrl}/apps/${appToken}/tables/${tableId}/records/batch_create`,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        records: batch.map(r => ({
          fields: formatFields(r.fields),
        })),
      },
    });
    
    if (response.data.code !== 0) {
      throw new Error(`Batch create failed: ${response.data.msg}`);
    }
    
    results.push(...(response.data.data.records || []));
  }
  
  return results;
}

// ============================================
// 4. 字段格式化
// ============================================

/**
 * 格式化字段值，适配飞书 Bitable API
 * @param {Object} fields - 原始字段对象
 * @returns {Object} 格式化后的字段对象
 */
function formatFields(fields) {
  const formatted = {};
  
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) {
      continue;
    }
    
    // 处理日期字段（毫秒时间戳）
    if (key.includes('_at') || key.includes('time') || key.includes('date')) {
      if (typeof value === 'number') {
        formatted[key] = value;
      } else if (value instanceof Date) {
        formatted[key] = value.getTime();
      }
      continue;
    }
    
    // 处理超链接字段
    if (typeof value === 'object' && value.link && value.text) {
      formatted[key] = {
        link: value.link,
        text: value.text,
      };
      continue;
    }
    
    // 处理多选字段
    if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
      formatted[key] = value;
      continue;
    }
    
    // 处理单选/文本/数字等基础类型
    formatted[key] = value;
  }
  
  return formatted;
}

// ============================================
// 5. 导出
// ============================================

module.exports = {
  // 查询
  queryRecord,
  getRecord,
  
  // 更新
  updateRecord,
  batchUpdateRecords,
  
  // 创建
  createRecord,
  batchCreateRecords,
  
  // 工具
  formatFields,
};
