import { zeustekDb } from './db';
import type { EntityRow } from './types';

const BATCH_SIZE = 40;
async function transactionWithRetry(action: () => Promise<void>) {
  for (let attempt = 0; ; attempt++) {
    try { await action(); return; }
    catch (error) {
      const text = String(error);
      if (attempt >= 2 || !/UnknownError|TransactionInactiveError|AbortError|in-progress transaction/i.test(text)) throw error;
      await new Promise(resolve => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }
}

export async function cacheCloudRecords(module: string, kind: string, rows: EntityRow[], snapshotStartedAt = new Date().toISOString()) {
  // Small, fresh transactions avoid WebKit's large bulk-write failure. Retries
  // are idempotent and never recreate or clear the database.
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    await transactionWithRetry(() => zeustekDb.transaction('rw', zeustekDb.entities, zeustekDb.settings, async () => {
      for (const row of batch) {
        if (await zeustekDb.settings.get(`pending:${row.entityId}`)) continue;
        const existing = await zeustekDb.entities.get(row.entityId);
        if (existing && existing.updatedAt > row.updatedAt && row.updatedAt) continue;
        if (existing && !existing.deleted && JSON.stringify(existing.record) === JSON.stringify(row.record)) continue;
        await zeustekDb.entities.put(row);
      }
    }));
  }
  // Reconcile absent records only after all incoming batches have succeeded.
  const returned = new Set(rows.map(row => row.entityId));
  const old = await zeustekDb.entities.where('[module+entityType]').equals([module, kind]).primaryKeys();
  const missing = old.filter(id => !returned.has(id));
  for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
    await transactionWithRetry(() => zeustekDb.transaction('rw', zeustekDb.entities, zeustekDb.settings, async () => {
      for (const id of missing.slice(offset, offset + BATCH_SIZE)) {
        if (await zeustekDb.settings.get(`pending:${id}`)) continue;
        const row = await zeustekDb.entities.get(id);
        if (row && !row.deleted && row.updatedAt <= snapshotStartedAt) await zeustekDb.entities.put({ ...row, deleted: 1 });
      }
    }));
  }
}
