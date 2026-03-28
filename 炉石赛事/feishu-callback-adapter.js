/**
 * 飞书回调事件适配层
 *
 * 目标：把飞书 webhook / 卡片交互事件统一转换为 callback-handler.js 可消费的
 * { callback, context } 结构。
 *
 * 说明：
 * - 默认支持未加密 payload
 * - 若配置 FEISHU_ENCRYPT_KEY，则支持 decrypt(encrypt) 信封
 * - 当前优先覆盖 url_verification + interactive card callback 两类线上接线必需场景
 */

const crypto = require('crypto');

function parseRawBody(rawBody) {
  if (!rawBody) return {};
  if (Buffer.isBuffer(rawBody)) {
    return JSON.parse(rawBody.toString('utf8') || '{}');
  }
  if (typeof rawBody === 'string') {
    return JSON.parse(rawBody || '{}');
  }
  return rawBody;
}

function getEncryptKey() {
  return process.env.FEISHU_ENCRYPT_KEY || '';
}

function getVerificationToken() {
  return process.env.FEISHU_VERIFICATION_TOKEN || '';
}

function decryptIfNeeded(body) {
  if (!body?.encrypt) {
    return body;
  }

  const encryptKey = getEncryptKey();
  if (!encryptKey) {
    throw new Error('收到 encrypt payload，但未配置 FEISHU_ENCRYPT_KEY');
  }

  const key = Buffer.from(`${encryptKey}=`, 'base64');
  const iv = key.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);

  const encrypted = Buffer.from(body.encrypt, 'base64');
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  const pad = decrypted[decrypted.length - 1];
  const unpadded = decrypted.subarray(0, decrypted.length - pad);
  const content = unpadded.subarray(16);
  const jsonLength = content.readUInt32BE(0);
  const jsonBuffer = content.subarray(4, 4 + jsonLength);

  return JSON.parse(jsonBuffer.toString('utf8'));
}

function validateVerificationToken(payload) {
  const expected = getVerificationToken();
  const actual = payload?.token || payload?.header?.token || '';

  if (expected && actual && expected !== actual) {
    throw new Error('FEISHU_VERIFICATION_TOKEN 不匹配');
  }
}

function pick(obj, paths = []) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function normalizeActionValue(rawValue) {
  const value = rawValue && typeof rawValue === 'object' ? { ...rawValue } : {};
  const action = value.action || value.name || value.callback_action || '';

  if (!action) {
    throw new Error('回调事件中未找到 action');
  }

  return {
    action,
    ...value,
  };
}

function extractOperatorOpenId(payload) {
  return pick(payload, [
    'event.operator.open_id',
    'event.operator.operator_id.open_id',
    'operator.open_id',
    'operator.operator_id.open_id',
    'action.operator.open_id',
    'action.form_value.operator_open_id',
    'open_id',
  ]) || '';
}

function extractActionValue(payload) {
  const candidates = [
    payload?.event?.action?.value,
    payload?.action?.value,
    payload?.open_message?.action?.value,
    payload?.event?.context?.action?.value,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return normalizeActionValue(candidate);
    }
  }

  throw new Error('未找到可识别的卡片 action.value');
}

function extractContext(payload) {
  return {
    operatorOpenId: extractOperatorOpenId(payload),
    requestId: pick(payload, [
      'header.event_id',
      'uuid',
      'event.context.open_message_id',
      'open_message.message_id',
      'message.message_id',
    ]) || '',
    rawEventType: pick(payload, ['header.event_type', 'type']) || '',
    rawPayload: payload,
  };
}

function decodeFeishuEvent(rawBody) {
  const parsedBody = parseRawBody(rawBody);
  const payload = decryptIfNeeded(parsedBody);

  validateVerificationToken(payload);

  if (payload?.type === 'url_verification') {
    return {
      kind: 'url_verification',
      payload,
      response: {
        challenge: payload.challenge,
      },
    };
  }

  const callback = extractActionValue(payload);
  const context = extractContext(payload);

  return {
    kind: 'interactive_callback',
    payload,
    callback,
    context,
  };
}

module.exports = {
  decodeFeishuEvent,
  parseRawBody,
};
