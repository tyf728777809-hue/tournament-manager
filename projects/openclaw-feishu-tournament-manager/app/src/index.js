import { loadLocalTournamentContext } from './config/tournament-context.js';
import { createCommandRouter } from './commands/index.js';
import { parseCommandText } from './commands/parser.js';

async function demo(router) {
  const samples = [
    '/检查注册',
    '/暂停顺延',
    '/恢复顺延',
    '/手动签到 2',
    '/重发战报 4'
  ];

  for (const sample of samples) {
    const parsed = parseCommandText(sample);
    const result = await router.dispatch(parsed.command, {
      operatorOpenId: 'ou_914e6141a81eb6da2602875aee631269',
      args: parsed.args,
      raw: parsed.raw
    });
    console.log(`[tournament-manager] ${sample} =>`, result.message || result);
  }
}

async function main() {
  const context = loadLocalTournamentContext();
  const router = createCommandRouter({ context });

  console.log('[tournament-manager] bootstrap ok');
  console.log(JSON.stringify({
    tournamentId: context.tournamentId,
    appToken: context.appToken,
    bitableMode: process.env.BITABLE_CLIENT_MODE || 'mock',
    tables: context.tables
  }, null, 2));

  console.log('[tournament-manager] registered commands:', router.list());
  await demo(router);
}

main();
