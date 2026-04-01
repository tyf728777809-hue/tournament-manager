export async function assertAdminAccess({ bitable, tournamentId, operatorOpenId }) {
  const result = await bitable.listRecords('adminWhitelist', (record) => {
    return record.fields.TournamentID === tournamentId
      && record.fields.飞书UserID === operatorOpenId
      && record.fields.是否启用 === true;
  });

  if (!result.ok) {
    return {
      ok: false,
      message: '管理员白名单读取失败'
    };
  }

  const matched = result.records[0];
  if (!matched) {
    return {
      ok: false,
      message: '你不在本赛事管理员白名单内，无法执行该指令。'
    };
  }

  return {
    ok: true,
    record: matched
  };
}
