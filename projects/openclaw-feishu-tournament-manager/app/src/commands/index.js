import { createBitableClient } from '../bitable/client.js';
import { checkRegistration } from './check-registration.js';
import { manualCheckin } from './manual-checkin.js';
import { pauseRolling, resumeRolling } from './pause-rolling.js';
import { resendReport } from './resend-report.js';

function notImplemented(name) {
  return async (payload = {}) => ({
    ok: false,
    command: name,
    payload,
    message: `Command not implemented yet: ${name}`
  });
}

export function createCommandRouter({ context }) {
  const bitable = createBitableClient({
    appToken: context.appToken,
    tables: context.tables,
    context
  });

  const handlers = {
    '/检查注册': (payload) => checkRegistration({ context, bitable, payload }),
    '/公示卡组': notImplemented('/公示卡组'),
    '/暂停顺延': (payload) => pauseRolling({ context, bitable, payload }),
    '/恢复顺延': (payload) => resumeRolling({ context, bitable, payload }),
    '/手动签到': (payload) => manualCheckin({ context, bitable, payload }),
    '/重发战报': (payload) => resendReport({ context, bitable, payload })
  };

  return {
    context,
    bitable,
    list() {
      return Object.keys(handlers);
    },
    has(command) {
      return command in handlers;
    },
    async dispatch(command, payload) {
      const handler = handlers[command];
      if (!handler) {
        return {
          ok: false,
          command,
          payload,
          message: `Unknown command: ${command}`
        };
      }
      return handler(payload);
    }
  };
}
