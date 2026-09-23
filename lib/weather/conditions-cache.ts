import {conditionsIdentity} from './conditions-retention';
import Dexie, { type Table } from 'dexie';
import type {
  ConditionReading,
  ConditionsRequest,
  ConditionsSnapshot,
} from './conditions-model';
interface CacheRow {
  key: string;
  account: string;
  siteId: string;
  retrievedAt: string;
  snapshot: ConditionsSnapshot;
}
interface HistoryRow {
  key: string;
  account: string;
  siteId: string;
  retrievedAt: string;
  reading: ConditionReading;
}
class ConditionsCache extends Dexie {
  snapshots!: Table<CacheRow, string>;
  history!: Table<HistoryRow, string>;
  constructor() {
    super('zeustek-conditions-v1');
    this.version(1).stores({
      snapshots: '&key,account,[account+siteId],retrievedAt',
      history: '&key,account,[account+siteId],retrievedAt',
    });
  }
}
export const conditionsCacheDb = new ConditionsCache();
export const conditionsCacheKey=conditionsIdentity;
export async function readConditionsCache(
  account: string,
  request: ConditionsRequest,
) {
  if (!account) return null;
  return (
    (
      await conditionsCacheDb.snapshots.get(
        `${account}:${conditionsCacheKey(request)}`,
      )
    )?.snapshot ?? null
  );
}
export async function readOperatorHistory(account: string, siteId: string) {
  if (!account || !siteId) return [];
  return (
    await conditionsCacheDb.history
      .where('[account+siteId]')
      .equals([account, siteId])
      .toArray()
  )
    .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))
    .slice(0, 100)
    .map((row) => row.reading);
}
/** Disposable local cache only: no canonical records, sync events, outbox writes or automatic Plan saves. */
export async function saveConditionsCache(
  account: string,
  snapshot: ConditionsSnapshot,
) {
  if (!account || snapshot.version !== 1 || !snapshot.readings.length) return;
  const readings = snapshot.readings
    .filter(
      (row) =>
        row.provider !== 'zeustek' &&
        row.kind !== 'dive' &&
        row.kind !== 'device',
    )
    .slice(0, 6000);
  if (!readings.length) return;
  const safeSnapshot = { ...snapshot, readings };
  const siteId = snapshot.request.siteId;
  await conditionsCacheDb.transaction(
    'rw',
    conditionsCacheDb.snapshots,
    conditionsCacheDb.history,
    async () => {
      await conditionsCacheDb.snapshots.put({
        key: `${account}:${conditionsCacheKey(snapshot.request)}`,
        account,
        siteId,
        retrievedAt: snapshot.retrievedAt,
        snapshot: safeSnapshot,
      });
      for (const reading of readings.filter((row) => row.kind === 'operator')) {
        const key = JSON.stringify([
          account,
          siteId,
          reading.id,
          reading.value,
        ]);
        const old = await conditionsCacheDb.history.get(key);
        if (!old)
          await conditionsCacheDb.history.put({
            key,
            account,
            siteId,
            retrievedAt: reading.retrievedAt,
            reading,
          });
      }
      const cached = (
        await conditionsCacheDb.snapshots
          .where('account')
          .equals(account)
          .toArray()
      ).sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt));
      await conditionsCacheDb.snapshots.bulkDelete(
        cached.slice(20).map((row) => row.key),
      );
      const history = (
        await conditionsCacheDb.history
          .where('account')
          .equals(account)
          .toArray()
      ).sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt));
      await conditionsCacheDb.history.bulkDelete(
        history.slice(500).map((row) => row.key),
      );
    },
  );
}
