export function createBitableClient({ appToken, tables }) {
  return {
    appToken,
    tables,
    async listRecords(tableKey) {
      return {
        ok: false,
        tableKey,
        tableId: tables[tableKey],
        message: 'Bitable client placeholder: listRecords not implemented'
      };
    },
    async createRecord(tableKey, fields) {
      return {
        ok: false,
        tableKey,
        tableId: tables[tableKey],
        fields,
        message: 'Bitable client placeholder: createRecord not implemented'
      };
    },
    async updateRecord(tableKey, recordId, fields) {
      return {
        ok: false,
        tableKey,
        tableId: tables[tableKey],
        recordId,
        fields,
        message: 'Bitable client placeholder: updateRecord not implemented'
      };
    }
  };
}
