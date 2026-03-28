/**
 * 最小可上线的飞书回调服务入口
 *
 * 用法：
 *   FEISHU_CALLBACK_PORT=8787 node 炉石赛事/feishu-callback-server.js
 *
 * 默认路由：
 *   POST /feishu/callback
 */

const http = require('http');
const { decodeFeishuEvent } = require('./feishu-callback-adapter');
const { handleCallback } = require('./callback-handler');

const PORT = Number(process.env.FEISHU_CALLBACK_PORT || 8787);
const PATHNAME = process.env.FEISHU_CALLBACK_PATH || '/feishu/callback';

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function collectRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function buildSuccessResponse(result) {
  const message = result?.message || '处理成功';
  return {
    code: 0,
    msg: 'ok',
    data: result,
    toast: {
      type: 'success',
      content: message,
    },
  };
}

function buildErrorResponse(error) {
  return {
    code: 0,
    msg: 'ok',
    toast: {
      type: 'error',
      content: error.message || '处理失败',
    },
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/healthz') {
      return sendJson(res, 200, { ok: true, service: 'feishu-callback-server' });
    }

    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method !== 'POST' || requestUrl.pathname !== PATHNAME) {
      return sendJson(res, 404, { code: 404, message: 'Not Found' });
    }

    const rawBody = await collectRawBody(req);
    const decoded = decodeFeishuEvent(rawBody);

    if (decoded.kind === 'url_verification') {
      return sendJson(res, 200, decoded.response);
    }

    const result = await handleCallback(decoded.callback, decoded.context);
    return sendJson(res, 200, buildSuccessResponse(result));
  } catch (error) {
    console.error('[feishu-callback-server] request failed:', error);
    return sendJson(res, 200, buildErrorResponse(error));
  }
});

server.listen(PORT, () => {
  console.log(`[feishu-callback-server] listening on http://0.0.0.0:${PORT}${PATHNAME}`);
});
