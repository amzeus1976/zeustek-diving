import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, deleteLocalRecord, flushDiveChanges, pendingDiveChanges, saveLocalRecord } from '../lib/offline/dive-store';
import { listDives, saveDive } from '../lib/offline/dives';
import { localBackupPayload, restoreLocalPayload } from '../lib/offline/local-backup';
import { parseDiveView, saveDivePerspective } from '../lib/offline/dive-perspectives';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  configureDiveStore('perspectives-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());
const historical = { entityId: 'canonical-dive', site: 'Capernwray', date: '2026-09-01', maxDepthM: 12, bottomTimeMin: 38, gas: 'Air', notes: 'Original notes', source: 'padi', originatingPlanId: 'original-plan', unknownFutureField: 'retain me' };

describe('one canonical Dive, three perspectives', () => {
  it('defaults generic/invalid links to Overview without creating events', async () => {
    await saveLocalRecord('dive', historical);
    const count = await zeustekDb.events.count();
    expect(parseDiveView(null)).toBe('overview');
    expect(parseDiveView('invalid')).toBe('overview');
    expect(parseDiveView('debrief')).toBe('debrief');
    expect(parseDiveView('story')).toBe('story');
    expect((await listDives())[0]?.debrief).toBeUndefined();
    expect((await listDives())[0]?.story).toBeUndefined();
    expect(await zeustekDb.events.count()).toBe(count);
  });
  it('commits offline through the core writer, preserving identity, facts, unknown fields and provenance', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    await saveLocalRecord('dive', historical);
    await saveDivePerspective(historical.entityId, { debrief: { wentWell: 'Controlled ascent', skillEvidenceIds: ['existing-evidence'] } });
    await saveDivePerspective(historical.entityId, { story: { narrative: 'A memorable dive', featuredAttachmentIds: ['existing-attachment'] } });
    const dive = (await listDives())[0];
    expect(dive).toMatchObject({ ...historical, debrief: { wentWell: 'Controlled ascent', skillEvidenceIds: ['existing-evidence'] }, story: { narrative: 'A memorable dive', featuredAttachmentIds: ['existing-attachment'] } });
    expect(await zeustekDb.entities.count()).toBe(1);
    expect(await zeustekDb.events.count()).toBe(3);
    expect(await pendingDiveChanges()).toHaveLength(1);
    expect(network).not.toHaveBeenCalled();
    await zeustekDb.close(); await zeustekDb.open();
    expect((await listDives())[0]?.story?.narrative).toBe('A memorable dive');
  });
  it('serializes rapid field edits and retains nested human-factors siblings', async () => {
    await saveLocalRecord('dive', { ...historical, debrief: { humanFactorsOutcome: { communication: 'Clear signals' }, futureField: 'keep' }, story: { futureField: 'keep too' } });
    await Promise.all([
      saveDivePerspective(historical.entityId, { debrief: { wentWell: 'First' } }),
      saveDivePerspective(historical.entityId, { debrief: { improve: 'Trim' } }),
      saveDivePerspective(historical.entityId, { debrief: { wentWell: 'Latest', humanFactorsOutcome: { taskLoading: 'Comfortable' } } }),
      saveDivePerspective(historical.entityId, { story: { narrative: 'Story' } }),
    ]);
    expect((await listDives())[0]).toMatchObject({ debrief: { wentWell: 'Latest', improve: 'Trim', futureField: 'keep', humanFactorsOutcome: { communication: 'Clear signals', taskLoading: 'Comfortable' } }, story: { narrative: 'Story', futureField: 'keep too' } });
  });
  it('preserves new sections when the old factual edit flow saves only its known fields', async () => {
    await saveLocalRecord('dive', historical);
    await saveDivePerspective(historical.entityId, { story: { narrative: 'Keep my story' }, debrief: { lessonsLearned: 'Keep my lesson' } });
    await saveDive({ entityId: historical.entityId, site: historical.site, date: historical.date, maxDepthM: 14, bottomTimeMin: 38, gas: 'Air', notes: 'Edited factual notes' });
    expect((await listDives())[0]).toMatchObject({ story: { narrative: 'Keep my story' }, debrief: { lessonsLearned: 'Keep my lesson' }, unknownFutureField: 'retain me', maxDepthM: 14 });
  });
  it('round-trips optional sections/references and immutable history in backup/restore', async () => {
    await saveLocalRecord('dive', historical);
    await saveDivePerspective(historical.entityId, { story: { timelineNotes: [{ timeOffsetMin: 12, depthM: 8, text: 'Fish near the wreck' }], featuredAttachmentIds: ['asset-id'] }, debrief: { nextDiveActions: 'Practise trim' } });
    const backup = await localBackupPayload();
    for (const table of zeustekDb.tables) await table.clear();
    await restoreLocalPayload(backup);
    expect((await listDives())[0]).toMatchObject({ entityId: historical.entityId, story: { timelineNotes: [{ timeOffsetMin: 12, depthM: 8, text: 'Fish near the wreck' }], featuredAttachmentIds: ['asset-id'] }, debrief: { nextDiveActions: 'Practise trim' } });
    expect(await zeustekDb.events.count()).toBe(2);
  });
  it('retains same-field conflicting free text instead of choosing a winner', async () => {
    await saveLocalRecord('dive', historical);
    await saveDivePerspective(historical.entityId, { story: { narrative: 'Local account' } });
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ error: 'Cloud revision changed; both branches retained' }, { status: 409 }))));
    vi.stubGlobal('navigator', { onLine: true });
    await flushDiveChanges();
    expect((await pendingDiveChanges())[0]?.value).toMatchObject({ state: 'conflict', record: { story: { narrative: 'Local account' } } });
    expect((await listDives())[0]?.story?.narrative).toBe('Local account');
  });
  it('does not resurrect deleted Dives or write to another account', async () => {
    await saveLocalRecord('dive', historical);
    await deleteLocalRecord(historical.entityId);
    await expect(saveDivePerspective(historical.entityId, { story: { narrative: 'No' } })).rejects.toThrow('Deleted Dives');
    configureDiveStore('another-account');
    await expect(saveDivePerspective(historical.entityId, { story: { narrative: 'No' } })).rejects.toThrow('Load this Dive');
    expect(await zeustekDb.events.count()).toBe(2);
  });
});
