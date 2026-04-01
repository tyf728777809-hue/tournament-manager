import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  queryRecord,
  createRecord,
  updateRecord,
} = require('../../../../../炉石赛事/bitable-api-utils.js');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createRealBitableClient({ appToken, tables }) {
  return {
    appToken,
    tables,
    async listRecords(tableKey, predicate = null) {
      const tableId = tables[tableKey];
      const items = await queryRecord(appToken, tableId, {
        pageSize: 500,
        automaticFields: true,
      });

      const normalized = items.map((item) => ({
        recordId: item.record_id || item.recordId,
        fields: item.fields || {},
      }));

      const filtered = typeof predicate === 'function'
        ? normalized.filter(predicate)
        : normalized;

      return {
        ok: true,
        tableKey,
        tableId,
        records: clone(filtered)
      };
    },
    async createRecord(tableKey, fields) {
      const tableId = tables[tableKey];
      const data = await createRecord(appToken, tableId, fields);
      return {
        ok: true,
        tableKey,
        tableId,
        record: {
          recordId: data.record?.record_id || data.record_id,
          fields: data.record?.fields || data.fields || fields,
        }
      };
    },
    async updateRecord(tableKey, recordId, fields) {
      const tableId = tables[tableKey];
      const data = await updateRecord(appToken, tableId, recordId, fields);
      return {
        ok: true,
        tableKey,
        tableId,
        record: {
          recordId: data.record?.record_id || data.record_id || recordId,
          fields: data.record?.fields || data.fields || fields,
        }
      };
    }
  };
}
