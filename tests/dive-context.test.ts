import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, saveLocalRecord } from '../lib/offline/dive-store';
import { createDiveDraftFromPlan, loadOriginatingPlan, listSkillEvidence, planComparison } from '../lib/offline/dive-context';
import { saveDive, listDives } from '../lib/offline/dives';
import { saveDivePerspective } from '../lib/offline/dive-perspectives';
import { localBackupPayload, restoreLocalPayload } from '../lib/offline/local-backup';
import { loadMediaMetadata } from '../lib/offline/media-metadata';
import { DiveEditorWrites } from '../lib/offline/dive-editor-writes';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('navigator', { onLine: false });
  configureDiveStore('context-test'); await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());
const plan = { entityId: 'same-plan', name: 'Quarry practice', siteName: 'Capernwray', siteId: 'same-site', startDate: '2026-09-12', endDate: '2026-09-12', startAt: '2026-09-12T10:00', buddy: 'Buddy', status: 'planned', notes: 'Original intent', futurePlanField: 'retain' };

describe('shared Dive references and save boundary', () => {
  it('preserves the original immutable Plan revision through later edits and backup/restore', async () => {
    await saveLocalRecord('trip', plan);
    const draft = await createDiveDraftFromPlan(plan.entityId);
    await saveDive({ ...draft, entityId: 'same-dive', site: draft.site!, date: draft.date!, maxDepthM: 12, bottomTimeMin: 38, gas: 'Air', notes: draft.notes! });
    await saveLocalRecord('trip', { entityId: plan.entityId, notes: 'Later changed plan' });
    const dive = (await listDives())[0]!;
    expect(dive).toMatchObject({ originatingPlanId: plan.entityId, siteId: plan.siteId });
    const original = await loadOriginatingPlan(dive);
    expect(original).toMatchObject({ notes: 'Original intent', futurePlanField: 'retain' });
    expect(planComparison(original!, dive)).toContainEqual(['Dive duration', 'Not recorded', '38 min']);
    const backup = await localBackupPayload();
    for (const table of zeustekDb.tables) await table.clear();
    await restoreLocalPayload(backup);
    expect(await loadOriginatingPlan((await listDives())[0]!)).toMatchObject({ notes: 'Original intent' });
    expect(await zeustekDb.entities.count()).toBe(2);
    configureDiveStore('other-account'); expect(await loadOriginatingPlan(dive)).toBeNull();
  });
  it('retains a legacy cloud Plan in its SAME history/ID before conversion, without losing fields', async () => {
    await zeustekDb.entities.put({ entityId: 'dive:context-test:same-plan', module: 'dive:context-test', entityType: 'trip', schemaVersion: 1, record: { ...plan, modifiedAt: '2026-09-01', createdAt: '2026-09-01' }, recordHash: '', deleted: 0, updatedEventId: '', updatedAt: '2026-09-01' });
    const draft = await createDiveDraftFromPlan(plan.entityId);
    expect(draft.originatingPlanRevision?.eventId).toBeTruthy();
    expect(await zeustekDb.entities.count()).toBe(1);
    expect(await zeustekDb.events.count()).toBe(1);
    expect(await loadOriginatingPlan(draft as never)).toMatchObject({ futurePlanField: 'retain', siteId: 'same-site' });
    await expect(createDiveDraftFromPlan('missing')).rejects.toThrow('Load this Dive Plan');
    expect(await loadOriginatingPlan({ originatingPlanId: plan.entityId } as never)).toBeNull();
  });
  it('links and unlinks shared evidence without copying or deleting the evidence, skill or attachment', async () => {
    await saveLocalRecord('skill_evidence', { entityId: 'existing-evidence', skillKey: 'buoyancy', performedAt: '2026-09-12', attachmentIds: ['same-asset'], notes: 'Recorded session' });
    await saveDive({ entityId: 'same-dive', site: 'Capernwray', date: '2026-09-12', maxDepthM: 12, bottomTimeMin: 38, gas: 'Air', notes: '' });
    const before = (await listSkillEvidence())[0];
    await saveDivePerspective('same-dive', { debrief: { skillEvidenceIds: ['existing-evidence'] } });
    expect((await listDives())[0]?.debrief?.skillEvidenceIds).toEqual(['existing-evidence']);
    await saveDivePerspective('same-dive', { debrief: { skillEvidenceIds: [] } });
    expect((await listSkillEvidence())[0]).toEqual(before);
    expect(await zeustekDb.entities.count()).toBe(2);
  });
  it('retains media metadata and featured IDs after offline restart; no binaries or network are needed', async () => {
    const items = [{ id: 'same-asset', fileName: 'Dive.jpg', contentType: 'image/jpeg', caption: 'Original' }];
    vi.stubGlobal('navigator', { onLine: true });
    const network = vi.fn(async () => Response.json({ items })); vi.stubGlobal('fetch', network);
    expect(await loadMediaMetadata('dive', 'same-dive')).toEqual({ items, unavailable: false });
    vi.stubGlobal('navigator', { onLine: false });
    await saveDive({ entityId: 'same-dive', site: 'Capernwray', date: '2026-09-12', maxDepthM: 12, bottomTimeMin: 38, gas: 'Air', notes: '' });
    await saveDivePerspective('same-dive', { story: { featuredAttachmentIds: ['same-asset'] } });
    await zeustekDb.close(); await zeustekDb.open(); network.mockClear();
    expect(await loadMediaMetadata('dive', 'same-dive')).toEqual({ items, unavailable: true });
    expect((await listDives())[0]?.story?.featuredAttachmentIds).toEqual(['same-asset']);
    expect(network).not.toHaveBeenCalled();
    expect(await zeustekDb.attachmentChunks.count()).toBe(0);
    configureDiveStore('other-account'); expect((await loadMediaMetadata('dive', 'same-dive')).items).toEqual([]);
  });
  it('blocks switch/close/navigation until local save succeeds; failed drafts require explicit retry', async () => {
    const writes = new DiveEditorWrites(); let release!: () => void;
    const pending = writes.enqueue(() => new Promise<void>(resolve => { release = resolve; }));
    const navigate = vi.fn(); const leaving = writes.afterSaved(navigate);
    await Promise.resolve(); expect(navigate).not.toHaveBeenCalled();
    let releaseSecond!: () => void;
    const second = writes.enqueue(() => new Promise<void>(resolve => { releaseSecond = resolve; }));
    release(); await pending; await Promise.resolve(); expect(navigate).not.toHaveBeenCalled();
    releaseSecond(); await second; await leaving;
    expect(navigate).toHaveBeenCalledOnce();
    await expect(writes.enqueue(async () => { throw new Error('Storage full'); })).rejects.toThrow('Storage full');
    const close = vi.fn(); await expect(writes.afterSaved(close)).rejects.toThrow('Storage full'); expect(close).not.toHaveBeenCalled();
    const retry = vi.fn(async () => {}); await writes.retry(retry); await writes.afterSaved(close);
    expect(retry).toHaveBeenCalledOnce(); expect(close).toHaveBeenCalledOnce();
  });
});
