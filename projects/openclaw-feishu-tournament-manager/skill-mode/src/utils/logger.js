/**
 * 日志工具
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level) {
  return levels[level] >= levels[LOG_LEVEL];
}

function formatMessage(level, module, message, data) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${module}] ${message}${dataStr}`;
}

export const logger = {
  debug: (module, message, data) => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', module, message, data));
    }
  },
  info: (module, message, data) => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', module, message, data));
    }
  },
  warn: (module, message, data) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', module, message, data));
    }
  },
  error: (module, message, error) => {
    if (shouldLog('error')) {
      const errorData = error ? { error: error.message, stack: error.stack } : undefined;
      console.error(formatMessage('error', module, message, errorData));
    }
  },
};
