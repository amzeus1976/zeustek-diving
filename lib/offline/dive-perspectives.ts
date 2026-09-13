import { zeustekDb } from './db';
import { currentDiveAccount, diveOperation, saveLocalRecord } from './dive-store';
import type { DiveDebrief, DiveRecord, DiveStory } from './dives';

export const DIVE_VIEWS = ['overview', 'debrief', 'story'] as const;
export type DiveView = typeof DIVE_VIEWS[number];
export function parseDiveView(value: string | null | undefined): DiveView {
  return value === 'debrief' || value === 'story' ? value : 'overview';
}

export type DivePerspectivePatch = { debrief?: Partial<DiveDebrief>; story?: Partial<DiveStory> };
const writes = new Map<string, Promise<unknown>>();

/** Read the latest local section inside our queue, not a stale mounted form snapshot.
 * The core writer retains all other/unknown fields and commits history + pending sync atomically.
 * Existing cloud stale-revision handling retains both branches rather than overwriting conflicts.
 */
export async function saveDivePerspective(entityId: string, patch: DivePerspectivePatch): Promise<void> {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to edit this Dive.');
  const key = `dive:${account}:${entityId}`;
  const previous = writes.get(key);
  const work = (previous ?? Promise.resolve()).catch(() => {}).then(async () => {
    if (currentDiveAccount() !== account) throw new Error('Account changed. Reopen this Dive before editing.');
    const entity = await zeustekDb.entities.get(key);
    if (!entity || entity.deleted || entity.entityType !== 'dive' || !entity.record) {
      throw new Error('Load this Dive before editing. Deleted Dives cannot be updated here.');
    }
    const dive = entity.record as unknown as DiveRecord;
    const data: DivePerspectivePatch = {};
    if (patch.debrief) {
      data.debrief = { ...dive.debrief, ...patch.debrief };
      if (patch.debrief.humanFactorsOutcome) {
        data.debrief.humanFactorsOutcome = { ...dive.debrief?.humanFactorsOutcome, ...patch.debrief.humanFactorsOutcome };
      }
    }
    if (patch.story) data.story = { ...dive.story, ...patch.story };
    if (!Object.keys(data).length) return;
    if (currentDiveAccount() !== account) throw new Error('Account changed. Reopen this Dive before editing.');
    await diveOperation(`perspective:${key}:${JSON.stringify(data)}`, 'Saving Dive notes locally…',
      () => saveLocalRecord('dive', { entityId, ...data }));
  });
  writes.set(key, work);
  try { await work; } finally { if (writes.get(key) === work) writes.delete(key); }
}
