import { loadLocalTournamentContext } from './config/tournament-context.js';
import { createCommandRouter } from './commands/index.js';

async function main() {
  const context = loadLocalTournamentContext();
  const router = createCommandRouter({ context });

  console.log('[tournament-manager] bootstrap ok');
  console.log(JSON.stringify({
    tournamentId: context.tournamentId,
    appToken: context.appToken,
    tables: context.tables
  }, null, 2));

  console.log('[tournament-manager] registered commands:', router.list());

  const checkRegistrationResult = await router.dispatch('/检查注册', {
    operatorOpenId: 'ou_914e6141a81eb6da2602875aee631269'
  });
  console.log('[tournament-manager] check registration result:', checkRegistrationResult.message);

  const pauseResult = await router.dispatch('/暂停顺延', {
    operatorOpenId: 'ou_914e6141a81eb6da2602875aee631269'
  });
  console.log('[tournament-manager] pause result:', pauseResult);

  const resumeResult = await router.dispatch('/恢复顺延', {
    operatorOpenId: 'ou_914e6141a81eb6da2602875aee631269'
  });
  console.log('[tournament-manager] resume result:', resumeResult);
}

main();
