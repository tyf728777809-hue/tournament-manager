import { createMockRecords } from '../config/mock-data.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function generateRecordId(prefix = 'rec') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createBitableClient({ appToken, tables, context }) {
  const store = createMockRecords(context);

  function getTableStore(tableKey) {
    if (!tables[tableKey]) {
      throw new Error(`Unknown table key: ${tableKey}`);
    }
    if (!store[tableKey]) {
      store[tableKey] = [];
    }
    return store[tableKey];
  }

  return {
    appToken,
    tables,
    debugDump() {
      return clone(store);
    },
    async listRecords(tableKey, predicate = null) {
      const records = getTableStore(tableKey);
      const filtered = typeof predicate === 'function' ? records.filter(predicate) : records;
      return {
        ok: true,
        tableKey,
        tableId: tables[tableKey],
        records: clone(filtered)
      };
    },
    async createRecord(tableKey, fields) {
      const records = getTableStore(tableKey);
      const record = {
        recordId: generateRecordId(tableKey),
        fields: clone(fields)
      };
      records.push(record);
      return {
        ok: true,
        tableKey,
        tableId: tables[tableKey],
        record: clone(record)
      };
    },
    async updateRecord(tableKey, recordId, fields) {
      const records = getTableStore(tableKey);
      const target = records.find((item) => item.recordId === recordId);
      if (!target) {
        return {
          ok: false,
          tableKey,
          tableId: tables[tableKey],
          recordId,
          fields,
          message: `Record not found: ${recordId}`
        };
      }
      Object.assign(target.fields, clone(fields));
      return {
        ok: true,
        tableKey,
        tableId: tables[tableKey],
        record: clone(target)
      };
    }
  };
}
