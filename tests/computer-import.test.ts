import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, saveLocalRecord } from '../lib/offline/dive-store';
import { listDives } from '../lib/offline/dives';
import { listRecords } from '../lib/offline/dive-planning';
import {
  commitComputerImport,
  listComputerImportStages,
  stageOceanicImport,
  type ComputerEvidenceStore,
  type ComputerImportRecord,
  type ComputerProfileRecord,
} from '../lib/offline/computer-import';
import {
  fieldCandidatesForDive,
  rebaseImportDecisions,
  type ImportFieldCandidate,
  type ImportFieldDecision,
} from '../lib/offline/import-resolution';
import {
  importRemovalSummary,
  linkComputerProfile,
  removeComputerImport,
  removeComputerProfile,
  unlinkComputerProfile,
} from '../lib/offline/computer-profile-management';
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
    await saveLocalRecord('dive', existingDive);
    const stage = await stageOceanicImport(fixture());
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
    expect(evidence.removed).toHaveLength(3);
    expect(await listComputerImportStages()).toHaveLength(1);
  });

  it('imports all new profiles without requiring a Dive assignment or overwriting Dive data', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    const stage = await stageOceanicImport(fixture());
    const evidence = memoryEvidenceStore();
    const result = await commitComputerImport(stage, evidence.store);

    expect(result.profiles).toBe(2);
    expect(result.newProfiles).toBe(2);
    expect(result.resolutions).toBe(0);
    expect(
      await listRecords<ComputerImportRecord>('computer-import'),
    ).toHaveLength(1);
    const profiles =
      await listRecords<ComputerProfileRecord>('computer-profile');
    expect(profiles).toHaveLength(2);
    expect(profiles.map((profile) => profile.disposition)).toEqual([
      'unlinked',
      'unlinked',
    ]);
    const dive = (await listDives()).find((row) => row.entityId === saved.id)!;
    expect(dive.site).toBe('Owner Site');
    expect(dive.notes).toBe('Owner-authored note');
    expect(dive.maxDepthM).toBe(9);
    expect(dive.computerImportIds).toBeUndefined();
    expect(dive.computerProfileIds).toBeUndefined();
    expect(await listComputerImportStages()).toEqual([]);
    expect(evidence.evidence.size).toBe(3);

    const repeated = await stageOceanicImport(fixture());
    expect(repeated.warnings.join(' ')).toMatch(
      /source file hash has already been imported/,
    );
    expect(repeated.segments.map((segment) => segment.dedupState)).toEqual([
      'already-imported',
      'already-imported',
    ]);
    const repeatedResult = await commitComputerImport(repeated, evidence.store);
    expect(repeatedResult).toMatchObject({
      importId: result.importId,
      profiles: 0,
      alreadyImported: 2,
      reusedImport: true,
    });
    expect(
      await listRecords<ComputerProfileRecord>('computer-profile'),
    ).toHaveLength(2);
  });

  it('links and unlinks imported profiles after import without deleting or rewriting the Dive', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    await commitComputerImport(
      await stageOceanicImport(fixture()),
      memoryEvidenceStore().store,
    );
    const profiles =
      await listRecords<ComputerProfileRecord>('computer-profile');
    await linkComputerProfile(profiles[0]!.entityId, saved.id);
    await linkComputerProfile(profiles[1]!.entityId, saved.id);
    let dive = (await listDives()).find((row) => row.entityId === saved.id)!;
    expect(dive.computerProfileIds).toHaveLength(2);
    expect(dive.site).toBe('Owner Site');
    expect(dive.maxDepthM).toBe(9);
    expect(
      (await listRecords<ComputerProfileRecord>('computer-profile')).map(
        (profile) => profile.targetDiveId,
      ),
    ).toEqual([saved.id, saved.id]);
    await unlinkComputerProfile(profiles[0]!.entityId);
    dive = (await listDives()).find((row) => row.entityId === saved.id)!;
    expect(dive.computerProfileIds).toEqual([profiles[1]!.entityId]);
    expect(dive.site).toBe('Owner Site');
    expect(await listDives()).toHaveLength(1);
  });

  it('preserves profile identity and prior linking when a reviewed source version changes', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    const evidence = memoryEvidenceStore();
    await commitComputerImport(
      await stageOceanicImport(fixture()),
      evidence.store,
    );
    const before = (
      await listRecords<ComputerProfileRecord>('computer-profile')
    ).find((profile) => profile.summary.greatestDepthM === 10.2)!;
    await linkComputerProfile(before.entityId, saved.id);
    const updatedFile = new File(
      [
        readFileSync(
          resolve(process.cwd(), 'tests/fixtures/oceanic-plus-minimal.uddf'),
          'utf8',
        ).replace(
          '<greatestdepth>10.2</greatestdepth>',
          '<greatestdepth>10.8</greatestdepth>',
        ),
      ],
      'oceanic-plus-updated.uddf',
      { type: 'application/xml' },
    );
    const stage = await stageOceanicImport(updatedFile);
    expect(stage.segments.map((segment) => segment.dedupState)).toEqual([
      'updated-source-version',
      'already-imported',
    ]);
    const result = await commitComputerImport(stage, evidence.store, {
      reviewedUpdatedSourceIds: [stage.segments[0]!.sourceDiveId],
    });
    expect(result).toMatchObject({ newProfiles: 0, updatedProfiles: 1 });
    const profiles =
      await listRecords<ComputerProfileRecord>('computer-profile');
    expect(profiles).toHaveLength(2);
    const updated = profiles.find(
      (profile) => profile.entityId === before.entityId,
    )!;
    expect(updated.targetDiveId).toBe(saved.id);
    expect(updated.summary.greatestDepthM).toBe(10.8);
    expect(updated.sourceVersions).toHaveLength(2);
    expect(
      (await listDives()).find((dive) => dive.entityId === saved.id)?.maxDepthM,
    ).toBe(9);
  });

  it('persists import-resolution only after explicit owner field decisions', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    const stage = await stageOceanicImport(fixture());
    await commitComputerImport(stage, memoryEvidenceStore().store);
    const profile = (
      await listRecords<ComputerProfileRecord>('computer-profile')
    )[0]!;
    await linkComputerProfile(profile.entityId, saved.id);
    expect(await listRecords('import-resolution')).toEqual([]);

    const target = (await listDives()).find(
      (dive) => dive.entityId === saved.id,
    )!;
    const imported = {
      ...stage.segments[0]!,
      waypoints: [],
    } as never;
    const candidates = fieldCandidatesForDive(
      target,
      [imported],
      new Map(stage.sites.map((site) => [site.id, site])),
      new Map(stage.gases.map((gas) => [gas.id, gas])),
    );
    await linkComputerProfile(
      profile.entityId,
      saved.id,
      candidates.map((candidate) => ({
        ...candidate,
        action:
          candidate.fieldPath === 'maxDepthM'
            ? ('use-imported' as const)
            : ('keep-zeustek' as const),
      })),
    );
    const updated = (await listDives()).find(
      (row) => row.entityId === saved.id,
    )!;
    expect(updated.maxDepthM).toBe(10.2);
    expect(updated.notes).toBe('Owner-authored note');
    expect(await listRecords('import-resolution')).toHaveLength(1);

    const repeated = await stageOceanicImport(fixture());
    await commitComputerImport(repeated, memoryEvidenceStore().store);
    expect(await listRecords('import-resolution')).toHaveLength(1);
    expect(
      (await listDives()).find((dive) => dive.entityId === saved.id)?.maxDepthM,
    ).toBe(10.2);
  });

  it('blocks linked import removal, then removes unlinked profiles without deleting the Dive', async () => {
    const saved = await saveLocalRecord('dive', existingDive);
    const evidence = memoryEvidenceStore();
    const result = await commitComputerImport(
      await stageOceanicImport(fixture()),
      evidence.store,
    );
    const profiles =
      await listRecords<ComputerProfileRecord>('computer-profile');
    await linkComputerProfile(profiles[0]!.entityId, saved.id);
    expect(await importRemovalSummary(result.importId)).toMatchObject({
      linkedProfiles: 1,
      removable: false,
    });
    await expect(
      removeComputerImport(result.importId, evidence.store, true),
    ).rejects.toThrow(/Unlink/);
    await unlinkComputerProfile(profiles[0]!.entityId);
    await removeComputerProfile(profiles[0]!.entityId, evidence.store, true);
    expect(await listDives()).toHaveLength(1);
    expect(
      (await listDives()).find((dive) => dive.entityId === saved.id)?.site,
    ).toBe('Owner Site');
    expect(
      await listRecords<ComputerProfileRecord>('computer-profile'),
    ).toHaveLength(1);
  });

  it('removes an unlinked import only after explicit confirmation and retains every Dive', async () => {
    await saveLocalRecord('dive', existingDive);
    const evidence = memoryEvidenceStore();
    const result = await commitComputerImport(
      await stageOceanicImport(fixture()),
      evidence.store,
    );
    await expect(
      removeComputerImport(result.importId, evidence.store),
    ).rejects.toThrow(/confirmation/);
    const removed = await removeComputerImport(
      result.importId,
      evidence.store,
      true,
    );
    expect(removed.removedProfiles).toBe(2);
    expect(await listRecords<ComputerImportRecord>('computer-import')).toEqual(
      [],
    );
    expect(
      await listRecords<ComputerProfileRecord>('computer-profile'),
    ).toEqual([]);
    expect(await listDives()).toHaveLength(1);
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
