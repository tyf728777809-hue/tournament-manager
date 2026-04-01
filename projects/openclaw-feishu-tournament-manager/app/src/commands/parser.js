const COMMANDS = [
  '/检查注册',
  '/公示卡组',
  '/暂停顺延',
  '/恢复顺延',
  '/手动签到',
  '/重发战报',
];

export function parseCommandText(text = '') {
  const trimmed = text.trim();
  const matched = COMMANDS.find((command) => trimmed === command || trimmed.startsWith(`${command} `));

  if (!matched) {
    return null;
  }

  const rest = trimmed.slice(matched.length).trim();
  return {
    command: matched,
    raw: trimmed,
    argsText: rest,
    args: rest ? rest.split(/\s+/) : []
  };
}
