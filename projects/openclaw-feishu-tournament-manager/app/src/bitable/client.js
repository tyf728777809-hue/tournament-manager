import { createMockBitableClient } from './mock-client.js';
import { createRealBitableClient } from './real-client.js';

export function createBitableClient({ appToken, tables, context }) {
  const mode = process.env.BITABLE_CLIENT_MODE || 'mock';

  if (mode === 'real') {
    if (!process.env.FEISHU_APP_ID || !process.env.FEISHU_APP_SECRET) {
      throw new Error('BITABLE_CLIENT_MODE=real 但缺少 FEISHU_APP_ID / FEISHU_APP_SECRET');
    }
    return createRealBitableClient({ appToken, tables, context });
  }

  return createMockBitableClient({ appToken, tables, context });
}
