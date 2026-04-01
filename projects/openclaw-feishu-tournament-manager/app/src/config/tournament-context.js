export function loadLocalTournamentContext() {
  return {
    tournamentId: 'T_TEST_2026_001',
    chatId: 'oc_facaef3153706ec59c45e0d67ae5adc4',
    appToken: 'EVtobynOiap2Uis39gjc9jSfngg',
    tables: {
      tournamentConfig: 'tblIEAXYMO5tEhTm',
      teamMaster: 'tblzjAZveGqNQqwA',
      playerMaster: 'tblJ52LPlcUOhZbK',
      matchResults: 'tblKNsEQX2ZmnVHM',
      deckSubmission: 'tblPNhmmFrvViKvV',
      adminWhitelist: 'tblHR3MA1aF7VOzY',
      auditLog: 'tblr7R3Jjnyyx3Gm'
    }
  };
}

export function getTableId(context, key) {
  const tableId = context.tables[key];
  if (!tableId) {
    throw new Error(`Unknown table key: ${key}`);
  }
  return tableId;
}
