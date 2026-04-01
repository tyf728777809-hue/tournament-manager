function notImplemented(name) {
  return async (payload = {}) => ({
    ok: false,
    command: name,
    payload,
    message: `Command not implemented yet: ${name}`
  });
}

export function createCommandRouter({ context }) {
  const handlers = {
    '/检查注册': notImplemented('/检查注册'),
    '/公示卡组': notImplemented('/公示卡组'),
    '/暂停顺延': notImplemented('/暂停顺延'),
    '/恢复顺延': notImplemented('/恢复顺延'),
    '/手动签到': notImplemented('/手动签到'),
    '/重发战报': notImplemented('/重发战报')
  };

  return {
    context,
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
