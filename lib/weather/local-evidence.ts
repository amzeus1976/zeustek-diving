import { zeustekDb } from '../offline/db';
import type { DiveRecord } from '../offline/dives';
import type { ComputerProfileRecord } from '../offline/computer-import';
import type { EntityRow } from '../offline/types';
function records<T>(
  rows: EntityRow[],
  account: string,
): Array<T & { entityId: string }> {
  return rows
    .filter(
      (row) =>
        !row.deleted &&
        row.record &&
        typeof row.record === 'object' &&
        !Array.isArray(row.record),
    )
    .map((row) => {
      const record = row.record as Record<string, unknown>;
      return {
        ...record,
        entityId:
          typeof record.entityId === 'string'
            ? record.entityId
            : row.entityId.replace(`dive:${account}:`, ''),
      } as T & { entityId: string };
    });
}
/** Pure IndexedDB reads: no cloud refresh, repair, diagnostic, mutation or outbox path. */
export async function readLocalConditionsEvidence(account: string) {
  if (!account) return { dives: [], profiles: [] };
  const [dives, profiles] = await Promise.all([
    zeustekDb.entities
      .where('[module+entityType]')
      .equals([`dive:${account}`, 'dive'])
      .toArray(),
    zeustekDb.entities
      .where('[module+entityType]')
      .equals([`dive:${account}`, 'computer-profile'])
      .toArray(),
  ]);
  return {
    dives: records<DiveRecord>(dives, account),
    profiles: records<ComputerProfileRecord>(profiles, account),
  };
}
