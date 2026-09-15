import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, saveLocalRecord } from '../lib/offline/dive-store';
import { listDives } from '../lib/offline/dives';
import { listRecords } from '../lib/offline/dive-planning';
import {
  assignStageSegments,
  commitComputerImport,
  listComputerImportStages,
  readStagedSegment,
  stageOceanicImport,
  type ComputerEvidenceStore,
  type ComputerImportRecord,
  type ComputerImportStage,
  type ComputerProfileRecord,
} from '../lib/offline/computer-import';
import {
  fieldCandidatesForDive,
  rebaseImportDecisions,
  type ImportFieldCandidate,
  type ImportFieldDecision,
} from '../lib/offline/import-resolution';
import {
  createComputerEvidenceStore,
  loadComputerEvidenceAttachment,
} from '../lib/offline/evidence-attachments';
import {
  localBackupPayload,
  restoreLocalPayload,
} from '../lib/offline/local-backup';

const fixture = () =>
  new File(
    [
      readFileSync(
        resolve(process.cwd(), 'tests/fixtures/oceanic-plus-minimal.uddf'),
      ),
    ],
    'oceanic-plus-minimal.uddf',
    { type: 'application/xml' },
  );

const existingDive = {
  site: 'Owner Site',
  siteId: '',
  date: '2026-09-05',
  timeIn: '11:58',
  maxDepthM: 9,
  bottomTimeMin: 25,
  gas: 'Air',
  notes: 'Owner-authored note',
  source: 'manual' as const,
  createdAt: '2026-09-01T10:00:00.000Z',
  modifiedAt: '2026-09-01T10:00:00.000Z',
};

function memoryEvidenceStore() {
  const evidence = new Map<string, Uint8Array>();
  const removed: string[] = [];
  let index = 0;
  const store: ComputerEvidenceStore = {
    capabilities: {
      localBackup: true,
      cloudSync: true,
      encryptedTransport: true,
    },
    async put(input) {
      const id = `attachment-${++index}-${input.ownerKind}-${input.ownerId}`;
      evidence.set(id, input.bytes.slice());
      return id;
    },
    async remove(id) {
      evidence.delete(id);
      removed.push(id);
    },
  };
  return { store, evidence, removed };
}

async function reviewedStage(stage: ComputerImportStage, targetDiveId: string) {
  const first = await readStagedSegment(stage, stage.segments[0]!.sourceDiveId);
  const target = (await listDives()).find(
    (dive) => dive.entityId === targetDiveId,
  )!;
  const candidates = fieldCandidatesForDive(
    target,
    [first],
    new Map(stage.sites.map((site) => [site.id, site])),
    new Map(stage.gases.map((gas) => [gas.id, gas])),
  );
  const decisions: ImportFieldDecision[] = candidates.map((candidate) => ({
    ...candidate,
    action:
      candidate.fieldPath === 'maxDepthM' ? 'use-imported' : 'keep-zeustek',
  }));
  let next = await assignStageSegments(stage, {
    sourceDiveIds: [stage.segments[0]!.sourceDiveId],
    action: 'target-existing',
    targetDiveId,
    decisions,
  });
  next = await assignStageSegments(next, {
    sourceDiveIds: [stage.segments[1]!.sourceDiveId],
    action: 'exclude',
    targetDiveId: null,
    decisions: [],
  });
  return next;
}

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  configureDiveStore('t12-owner');
  await zeustekDb.open();
  await Promise.all(zeustekDb.tables.map((table) => table.clear()));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  zeustekDb.close();
});

describe('T12 staged and atomic computer imports', () => {
  it('retains unchanged decisions while requiring changed target fields to be reconfirmed', () => {
    const candidate = (
      fieldPath: string,
      zeustekValue: unknown,
    ): ImportFieldCandidate => ({
      fieldPath,
      zeustekValue,
      importedValue: fieldPath === 'maxDepthM' ? 10.2 : '2026-09-05',
      resolutionClass: 'scalar',
      provenance: 'direct',
      transformIds: [],
      sourceSegmentIds: ['segment-1'],
    });
    const prior: ImportFieldDecision[] = [
      { ...candidate('date', '2026-09-05'), action: 'keep-zeustek' },
      { ...candidate('maxDepthM', 9), action: 'use-imported' },
    ];
    const rebased = rebaseImportDecisions(prior, [
      candidate('date', '2026-09-05'),
      candidate('maxDepthM', 12),
    ]);
    expect(rebased.map((decision) => decision.fieldPath)).toEqual(['date']);
  });

  it('stages the source locally without changing canonical records', async () => {
    const stage = await stageOceanicImport(fixture());
    expect(stage.segments).toHaveLength(2);
    expect(await listComputerImportStages()).toHaveLength(1);
    expect(await zeustekDb.diveImages.count()).toBe(3);
    expect(await listRecords<ComputerImportRecord>('computer-import')).toEqual(
      [],
    );
    expect(await listDives()).toEqual([]);
  });

  it('rolls an injected batch failure back without partial records or orphaned evidence', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    const stage = await reviewedStage(
      await stageOceanicImport(fixture()),
      saved.id,
    );
    const evidence = memoryEvidenceStore();
    const before = {
      entities: await zeustekDb.entities.count(),
      events: await zeustekDb.events.count(),
      heads: await zeustekDb.entityHeads.count(),
      outbox: await zeustekDb.outbox.count(),
      pending: await zeustekDb.settings
        .where('key')
        .startsWith('pending:dive:t12-owner:')
        .count(),
    };

    await expect(
      commitComputerImport(stage, evidence.store, { failAfterMutation: 1 }),
    ).rejects.toThrow(/Injected atomic mutation failure/);

    expect({
      entities: await zeustekDb.entities.count(),
      events: await zeustekDb.events.count(),
      heads: await zeustekDb.entityHeads.count(),
      outbox: await zeustekDb.outbox.count(),
      pending: await zeustekDb.settings
        .where('key')
        .startsWith('pending:dive:t12-owner:')
        .count(),
    }).toEqual(before);
    expect(evidence.evidence.size).toBe(0);
    expect(evidence.removed).toHaveLength(2);
    expect(await listComputerImportStages()).toHaveLength(1);
  });

  it('commits source, profiles, decisions and lightweight Dive references as one batch', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    const stage = await reviewedStage(
      await stageOceanicImport(fixture()),
      saved.id,
    );
    const evidence = memoryEvidenceStore();
    const result = await commitComputerImport(stage, evidence.store);

    expect(result.profiles).toBe(2);
    expect(result.resolutions).toBe(1);
    expect(
      await listRecords<ComputerImportRecord>('computer-import'),
    ).toHaveLength(1);
    const profiles =
      await listRecords<ComputerProfileRecord>('computer-profile');
    expect(profiles).toHaveLength(2);
    expect(profiles.map((profile) => profile.disposition).sort()).toEqual([
      'excluded',
      'linked',
    ]);
    const dive = (await listDives()).find((row) => row.entityId === saved.id)!;
    expect(dive.site).toBe('Owner Site');
    expect(dive.notes).toBe('Owner-authored note');
    expect(dive.maxDepthM).toBe(10.2);
    expect(dive.computerImportIds).toEqual([result.importId]);
    expect(dive.computerProfileIds).toHaveLength(1);
    expect(await listComputerImportStages()).toEqual([]);
    expect(evidence.evidence.size).toBe(2);

    const repeated = await stageOceanicImport(fixture());
    expect(repeated.warnings.join(' ')).toMatch(
      /source file hash has already been imported/,
    );
    expect(repeated.segments.map((segment) => segment.dedupState)).toEqual([
      'already-imported',
      'previously-excluded',
    ]);
  });

  it('can explicitly link multiple source segments to one canonical Dive', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    let stage = await stageOceanicImport(fixture());
    const segments = await Promise.all(
      stage.segments.map((segment) =>
        readStagedSegment(stage, segment.sourceDiveId),
      ),
    );
    const target = (await listDives()).find(
      (dive) => dive.entityId === saved.id,
    )!;
    const candidates = fieldCandidatesForDive(
      target,
      segments,
      new Map(stage.sites.map((site) => [site.id, site])),
      new Map(stage.gases.map((gas) => [gas.id, gas])),
    );
    stage = await assignStageSegments(stage, {
      sourceDiveIds: stage.segments.map((segment) => segment.sourceDiveId),
      action: 'target-existing',
      targetDiveId: saved.id,
      decisions: candidates.map((candidate) => ({
        ...candidate,
        action: 'keep-zeustek' as const,
      })),
    });

    await commitComputerImport(stage, memoryEvidenceStore().store);
    const dive = (await listDives()).find((row) => row.entityId === saved.id)!;
    expect(dive.computerProfileIds).toHaveLength(2);
    expect(
      (await listRecords<ComputerProfileRecord>('computer-profile')).map(
        (profile) => profile.targetDiveId,
      ),
    ).toEqual([saved.id, saved.id]);
  });

  it('rejects target revision drift and removes prepared evidence', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    const stage = await reviewedStage(
      await stageOceanicImport(fixture()),
      saved.id,
    );
    await saveLocalRecord('dive', {
      entityId: saved.id,
      ...existingDive,
      notes: 'Newer owner edit',
    });
    const evidence = memoryEvidenceStore();

    await expect(commitComputerImport(stage, evidence.store)).rejects.toThrow(
      `IMPORT_TARGET_CHANGED:${saved.id}`,
    );
    expect(await listRecords<ComputerImportRecord>('computer-import')).toEqual(
      [],
    );
    expect(
      (await listDives()).find((row) => row.entityId === saved.id)?.notes,
    ).toBe('Newer owner edit');
    expect(evidence.evidence.size).toBe(0);
    expect(evidence.removed).toHaveLength(2);
  });

  it('backs up and restores raw/profile evidence with integrity metadata', async () => {
    const store = createComputerEvidenceStore('t12-owner');
    const id = await store.put({
      ownerKind: 'computer-profile',
      ownerId: 'profile-1',
      fileName: 'profile-1.json',
      mimeType: 'application/json',
      bytes: new TextEncoder().encode('{"samples":[1,2,3]}'),
    });
    const backup = await localBackupPayload();
    expect(backup.attachments).toHaveLength(1);
    expect(backup.attachments[0]?.attachmentId).toBe(id);
    await Promise.all(zeustekDb.tables.map((table) => table.clear()));
    await restoreLocalPayload(backup);
    expect(await zeustekDb.attachments.get(id)).toMatchObject({
      state: 'pending',
    });
    expect(
      await (await loadComputerEvidenceAttachment('t12-owner', id)).text(),
    ).toContain('samples');
  });

  it('rejects corrupted computer evidence before restoring any backup rows', async () => {
    const store = createComputerEvidenceStore('t12-owner');
    await store.put({
      ownerKind: 'computer-import',
      ownerId: 'import-1',
      fileName: 'source.uddf',
      mimeType: 'application/xml',
      bytes: new TextEncoder().encode('<uddf/>'),
    });
    const backup = await localBackupPayload();
    const corrupted = {
      ...backup,
      images: backup.images.map((image) => ({
        ...image,
        bytes: btoa('corrupted'),
      })),
    };
    await Promise.all(zeustekDb.tables.map((table) => table.clear()));

    await expect(restoreLocalPayload(corrupted)).rejects.toThrow(
      /invalid data/,
    );
    expect(await zeustekDb.attachments.count()).toBe(0);
    expect(await zeustekDb.diveImages.count()).toBe(0);
  });
});
