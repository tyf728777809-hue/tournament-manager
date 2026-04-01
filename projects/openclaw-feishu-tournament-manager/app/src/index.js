import { loadLocalTournamentContext } from './config/tournament-context.js';
import { createCommandRouter } from './commands/index.js';

function main() {
  const context = loadLocalTournamentContext();
  const router = createCommandRouter({ context });

  console.log('[tournament-manager] bootstrap ok');
  console.log(JSON.stringify({
    tournamentId: context.tournamentId,
    appToken: context.appToken,
    tables: context.tables
  }, null, 2));

  console.log('[tournament-manager] registered commands:', router.list());
}

main();
