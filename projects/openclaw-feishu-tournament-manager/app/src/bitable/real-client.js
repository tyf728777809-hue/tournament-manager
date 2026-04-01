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

function isRichTextArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => item && typeof item === 'object' && 'text' in item && 'type' in item);
}

function normalizeFieldValue(value) {
  if (isRichTextArray(value)) {
    return value.map((item) => item.text || '').join('');
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFieldValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, innerValue]) => [key, normalizeFieldValue(innerValue)])
    );
  }

  return value;
}

function normalizeFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, normalizeFieldValue(value)])
  );
}

export function createRealBitableClient({ appToken, tables }) {
  return {
    appToken,
    tables,
    async listRecords(tableKey, predicate = null) {
      const tableId = tables[tableKey];
      try {
        const items = await queryRecord(appToken, tableId, {
          pageSize: 500,
          automaticFields: true,
        });

        const normalized = items.map((item) => ({
          recordId: item.record_id || item.recordId,
          fields: normalizeFields(item.fields || {}),
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
      } catch (error) {
        return {
          ok: false,
          tableKey,
          tableId,
          records: [],
          message: error instanceof Error ? error.message : String(error)
        };
      }
    },
    async createRecord(tableKey, fields) {
      const tableId = tables[tableKey];
      try {
        const data = await createRecord(appToken, tableId, fields);
        return {
          ok: true,
          tableKey,
          tableId,
          record: {
            recordId: data.record?.record_id || data.record_id,
            fields: normalizeFields(data.record?.fields || data.fields || fields),
          }
        };
      } catch (error) {
        return {
          ok: false,
          tableKey,
          tableId,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    },
    async updateRecord(tableKey, recordId, fields) {
      const tableId = tables[tableKey];
      try {
        const data = await updateRecord(appToken, tableId, recordId, fields);
        return {
          ok: true,
          tableKey,
          tableId,
          record: {
            recordId: data.record?.record_id || data.record_id || recordId,
            fields: normalizeFields(data.record?.fields || data.fields || fields),
          }
        };
      } catch (error) {
        return {
          ok: false,
          tableKey,
          tableId,
          recordId,
          message: error instanceof Error ? error.message : String(error)
        };
      }
    }
  };
}
