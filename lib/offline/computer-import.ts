import { mutateEntitiesAtomically } from './batch-mutations';
import { zeustekDb } from './db';
import { currentDiveAccount, flushDiveChanges } from './dive-store';
import { listRecords, type DiveSiteRecord } from './dive-planning';
import { listDives } from './dives';
import {
  suggestExistingDives,
  suggestSegmentGroups,
  type ImportMatchCandidate,
  type SegmentGroupSuggestion,
} from './computer-import-matcher';
import type { ImportFieldDecision } from './import-resolution';
import {
  oceanicFileFingerprint,
  oceanicSegmentFingerprint,
  parseOceanicUddf,
  profilePreview,
  type OceanicDocument,
  type OceanicSegment,
} from './oceanic-uddf';

export type ImportDedupState =
  | 'new'
  | 'already-imported'
  | 'updated-source-version'
  | 'previously-excluded';

export interface ComputerImportRecord {
  adapterKey: string;
  sourceFileName: string;
  fileHash: string;
  byteLength: number;
  rawAttachmentId: string;
  importedAt: string;
  segmentHashes: string[];
  profileIds?: string[];
  newProfileCount?: number;
  alreadyImportedCount?: number;
  updatedSourceCount?: number;
  createdAt: string;
  modifiedAt: string;
}

export interface ComputerProfileRecord {
  importId: string;
  sourceDiveId: string;
  sourceSiteId: string | null;
  segmentHash: string;
  targetDiveId: string | null;
  disposition: 'unlinked' | 'linked' | 'created' | 'excluded';
  sampleAttachmentId: string | null;
  sourceFileName?: string;
  sourceAdapterKey?: string;
  latestImportId?: string;
  sourceSite?: {
    name: string;
    location: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  sourceGas?: {
    name: string;
    oxygenFraction: number | null;
    nitrogenFraction: number | null;
    heliumFraction: number | null;
  } | null;
  sourceVersions?: Array<{
    importId: string;
    fileHash: string;
    segmentHash: string;
    sampleAttachmentId: string | null;
    importedAt: string;
  }>;
  summary: {
    rawTimestamp: string | null;
    normalisedTimestamp: string | null;
    greatestDepthM: number | null;
    sourceDurationSec: number | null;
    finalSampleElapsedSec: number | null;
    minimumTemperatureC: number | null;
    ballastKg: number | null;
    gasId: string | null;
    tankPressureBeginBar: number | null;
    tankPressureEndBar: number | null;
    waypointCount: number;
  };
  preview: Array<{
    elapsedSec: number | null;
    depthM: number | null;
    temperatureC: number | null;
  }>;
  createdAt: string;
  modifiedAt: string;
}

export interface StagedComputerSegment {
  sourceDiveId: string;
  sourceSiteId: string | null;
  rawTimestamp: string | null;
  normalisedTimestamp: string | null;
  timestampTransforms: string[];
  greatestDepthM: number | null;
  sourceDurationSec: number | null;
  finalSampleElapsedSec: number | null;
  minimumTemperatureC: number | null;
  ballastKg: number | null;
  gasId: string | null;
  diveMode: string | null;
  tankPressureBeginBar: number | null;
  tankPressureEndBar: number | null;
  waypointCount: number;
  preview: ComputerProfileRecord['preview'];
  segmentHash: string;
  priorProfileId?: string | null;
  priorSegmentHash?: string | null;
  profileBlobId: string;
  dedupState: ImportDedupState;
  matchCandidates: ImportMatchCandidate[];
}

export interface StagedAssignment {
  sourceDiveIds: string[];
  action: 'target-existing' | 'create-new' | 'exclude';
  targetDiveId: string | null;
  targetUpdatedEventId: string | null;
  decisions: ImportFieldDecision[];
}

export interface ComputerImportStage {
  sessionId: string;
  account: string;
  fileName: string;
  fileHash: string;
  byteLength: number;
  rawBlobId: string;
  adapterKey: string;
  createdAt: string;
  sites: OceanicDocument['sites'];
  gases: OceanicDocument['gases'];
  segments: StagedComputerSegment[];
  groupSuggestions: SegmentGroupSuggestion[];
  assignments: StagedAssignment[];
  warnings: string[];
}

export interface ComputerEvidenceStore {
  capabilities: {
    localBackup: boolean;
    cloudSync: boolean;
    encryptedTransport: boolean;
  };
  put(input: {
    ownerKind: string;
    ownerId: string;
    fileName: string;
    mimeType: string;
    bytes: Uint8Array;
  }): Promise<string>;
  remove?(attachmentId: string): Promise<void>;
}

export const LOCAL_STAGING_CAPABILITIES = {
  localBackup: false,
  cloudSync: false,
  encryptedTransport: false,
} as const;

async function stageBlob(
  account: string,
  id: string,
  name: string,
  mimeType: string,
  bytes: Uint8Array,
) {
  await zeustekDb.diveImages.put({
    id,
    account,
    blob: new Blob([bytes.slice().buffer], { type: mimeType }),
    name,
    createdAt: new Date().toISOString(),
  });
  return id;
}

const stageKey = (account: string, sessionId: string) =>
  `computer-import-stage:${account}:${sessionId}`;

export async function saveComputerImportStage(stage: ComputerImportStage) {
  await zeustekDb.settings.put({
    key: stageKey(stage.account, stage.sessionId),
    value: stage as never,
  });
  return stage;
}

export async function listComputerImportStages() {
  const account = currentDiveAccount();
  if (!account) return [];
  return (
    await zeustekDb.settings
      .where('key')
      .startsWith(`computer-import-stage:${account}:`)
      .toArray()
  )
    .map((row) => row.value as unknown as ComputerImportStage)
    .filter(Boolean);
}

export async function deleteComputerImportStage(stage: ComputerImportStage) {
  await zeustekDb.transaction(
    'rw',
    [zeustekDb.settings, zeustekDb.diveImages],
    async () => {
      await zeustekDb.settings.delete(stageKey(stage.account, stage.sessionId));
      await zeustekDb.diveImages.bulkDelete([
        stage.rawBlobId,
        ...stage.segments.map((segment) => segment.profileBlobId),
      ]);
    },
  );
}

function summarySegment(segment: OceanicSegment) {
  const { waypoints: _waypoints, ...summary } = segment;
  return summary;
}

export async function stageOceanicImport(file: File) {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in before importing computer data.');
  if (file.size > 30_000_000)
    throw new Error('UDDF file is over the 30 MB local parse limit.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = parseOceanicUddf(bytes);
  const [fileHash, existingImports, existingProfiles, dives, sites] =
    await Promise.all([
      oceanicFileFingerprint(bytes),
      listRecords<ComputerImportRecord>('computer-import'),
      listRecords<ComputerProfileRecord>('computer-profile'),
      listDives(),
      listRecords<DiveSiteRecord>('site'),
    ]);
  const sessionId = crypto.randomUUID();
  const rawBlobId = `computer-stage-raw:${sessionId}`;
  await stageBlob(
    account,
    rawBlobId,
    file.name,
    file.type || 'application/xml',
    bytes,
  );
  const sourceSites = new Map(document.sites.map((site) => [site.id, site]));
  const segments: StagedComputerSegment[] = [];
  for (const segment of document.segments) {
    const hash = await oceanicSegmentFingerprint(segment);
    const same = existingProfiles.find(
      (profile) => profile.segmentHash === hash,
    );
    const sourceChanged = existingProfiles.find(
      (profile) =>
        profile.sourceDiveId === segment.sourceDiveId &&
        profile.segmentHash !== hash,
    );
    const excluded = existingProfiles.find(
      (profile) =>
        profile.sourceDiveId === segment.sourceDiveId &&
        profile.disposition === 'excluded',
    );
    const dedupState: ImportDedupState = excluded
      ? 'previously-excluded'
      : same
        ? 'already-imported'
        : sourceChanged
          ? 'updated-source-version'
          : 'new';
    const profileBlobId = `computer-stage-profile:${sessionId}:${segment.sourceDiveId}`;
    await stageBlob(
      account,
      profileBlobId,
      `${segment.sourceDiveId}.json`,
      'application/json',
      new TextEncoder().encode(JSON.stringify(segment)),
    );
    segments.push({
      ...summarySegment(segment),
      waypointCount: segment.waypoints.length,
      preview: profilePreview(segment),
      segmentHash: hash,
      priorProfileId: sourceChanged?.entityId ?? null,
      priorSegmentHash: sourceChanged?.segmentHash ?? null,
      profileBlobId,
      dedupState,
      matchCandidates: suggestExistingDives(
        segment,
        dives,
        segment.sourceSiteId
          ? sourceSites.get(segment.sourceSiteId)
          : undefined,
        sites,
      ),
    });
  }
  return saveComputerImportStage({
    sessionId,
    account,
    fileName: file.name,
    fileHash,
    byteLength: file.size,
    rawBlobId,
    adapterKey: document.adapterKey,
    createdAt: new Date().toISOString(),
    sites: document.sites,
    gases: document.gases,
    segments,
    groupSuggestions: suggestSegmentGroups(document.segments),
    assignments: [],
    warnings: [
      ...document.warnings,
      ...(existingImports.some((item) => item.fileHash === fileHash)
        ? [
            'This exact source file hash has already been imported. Review dedup states before continuing.',
          ]
        : []),
    ],
  });
}

export async function assignStageSegments(
  stage: ComputerImportStage,
  assignment: Omit<StagedAssignment, 'targetUpdatedEventId'>,
) {
  let targetUpdatedEventId: string | null = null;
  if (assignment.action === 'target-existing' && assignment.targetDiveId) {
    const entity = await zeustekDb.entities.get(
      `dive:${stage.account}:${assignment.targetDiveId}`,
    );
    if (!entity || entity.deleted || entity.entityType !== 'dive')
      throw new Error('Target Dive is unavailable.');
    targetUpdatedEventId = entity.updatedEventId;
  }
  const ids = new Set(assignment.sourceDiveIds);
  return saveComputerImportStage({
    ...stage,
    assignments: [
      ...stage.assignments.filter(
        (row) => !row.sourceDiveIds.some((id) => ids.has(id)),
      ),
      { ...assignment, targetUpdatedEventId },
    ],
  });
}

export async function readStagedSegment(
  stage: ComputerImportStage,
  sourceDiveId: string,
): Promise<OceanicSegment> {
  const meta = stage.segments.find(
    (segment) => segment.sourceDiveId === sourceDiveId,
  );
  if (!meta) throw new Error('Staged source segment is unavailable.');
  const row = await zeustekDb.diveImages.get(meta.profileBlobId);
  if (!row || row.account !== stage.account)
    throw new Error(
      'Staged profile evidence is missing. Restore or reselect the source file.',
    );
  return JSON.parse(await row.blob.text()) as OceanicSegment;
}

async function evidenceBytes(stage: ComputerImportStage, id: string) {
  const row = await zeustekDb.diveImages.get(id);
  if (!row || row.account !== stage.account)
    throw new Error('Staged source evidence is missing.');
  return new Uint8Array(await row.blob.arrayBuffer());
}

export async function commitComputerImport(
  stage: ComputerImportStage,
  evidenceStore: ComputerEvidenceStore,
  options: {
    failAfterMutation?: number;
    reviewedUpdatedSourceIds?: string[];
  } = {},
) {
  const account = currentDiveAccount();
  if (!account || account !== stage.account)
    throw new Error('Account changed. Reopen the staged import.');
  if (
    !evidenceStore.capabilities.localBackup ||
    !evidenceStore.capabilities.cloudSync
  ) {
    throw new Error(
      'Computer evidence durability is not ready: raw/profile attachments must support local backup AND cloud sync before canonical import can be committed.',
    );
  }
  const [existingImports, existingProfiles] = await Promise.all([
    listRecords<ComputerImportRecord>('computer-import'),
    listRecords<ComputerProfileRecord>('computer-profile'),
  ]);
  const existingImport = existingImports.find(
    (item) => item.fileHash === stage.fileHash,
  );
  const reviewedUpdates = new Set(options.reviewedUpdatedSourceIds ?? []);
  const selected = stage.segments.filter(
    (segment) =>
      segment.dedupState === 'new' ||
      (segment.dedupState === 'updated-source-version' &&
        reviewedUpdates.has(segment.sourceDiveId)),
  );
  if (
    [...reviewedUpdates].some(
      (sourceDiveId) =>
        !stage.segments.some(
          (segment) =>
            segment.sourceDiveId === sourceDiveId &&
            segment.dedupState === 'updated-source-version',
        ),
    )
  )
    throw new Error('Only reviewed updated source versions may be replaced.');

  if (!selected.length && existingImport) {
    await deleteComputerImportStage(stage);
    return {
      importId: existingImport.entityId,
      eventIds: [],
      profiles: 0,
      newProfiles: 0,
      updatedProfiles: 0,
      alreadyImported: stage.segments.filter(
        (segment) => segment.dedupState === 'already-imported',
      ).length,
      resolutions: 0,
      reusedImport: true,
    };
  }

  const importId = existingImport?.entityId ?? crypto.randomUUID();
  const createdAttachmentIds: string[] = [];
  try {
    const rawAttachmentId =
      existingImport?.rawAttachmentId ??
      (await evidenceStore.put({
        ownerKind: 'computer-import',
        ownerId: importId,
        fileName: stage.fileName,
        mimeType: 'application/xml',
        bytes: await evidenceBytes(stage, stage.rawBlobId),
      }));
    if (!existingImport) createdAttachmentIds.push(rawAttachmentId);
    const sampleAttachmentIds = new Map<string, string>();
    const profileIds = new Map<string, string>();
    for (const staged of selected) {
      const prior = existingProfiles.find(
        (profile) => profile.sourceDiveId === staged.sourceDiveId,
      );
      const profileId = prior?.entityId ?? crypto.randomUUID();
      profileIds.set(staged.sourceDiveId, profileId);
      const attachmentId = await evidenceStore.put({
        ownerKind: 'computer-profile',
        ownerId: profileId,
        fileName: `${staged.sourceDiveId}.json`,
        mimeType: 'application/json',
        bytes: await evidenceBytes(stage, staged.profileBlobId),
      });
      sampleAttachmentIds.set(staged.sourceDiveId, attachmentId);
      createdAttachmentIds.push(attachmentId);
    }

    const now = new Date().toISOString();
    const moduleKey = `dive:${account}`;
    const pending = (
      id: string,
      kind: string,
      record: unknown,
      baseModifiedAt: string | null,
    ) => ({
      key: `pending:${moduleKey}:${id}`,
      value: {
        id,
        kind,
        record,
        baseModifiedAt,
        token: crypto.randomUUID(),
        state: 'pending',
      } as never,
    });
    const mutations: Parameters<typeof mutateEntitiesAtomically>[0] = [];
    const profileRecords: Array<
      ComputerProfileRecord & { entityId: string; isUpdate: boolean }
    > = [];

    for (const staged of selected) {
      const segment = await readStagedSegment(stage, staged.sourceDiveId);
      const existing = existingProfiles.find(
        (profile) => profile.sourceDiveId === segment.sourceDiveId,
      );
      const sourceSite = segment.sourceSiteId
        ? (stage.sites.find((site) => site.id === segment.sourceSiteId) ?? null)
        : null;
      const sourceGas = segment.gasId
        ? (stage.gases.find((gas) => gas.id === segment.gasId) ?? null)
        : null;
      const entityId = profileIds.get(segment.sourceDiveId)!;
      const version = {
        importId,
        fileHash: stage.fileHash,
        segmentHash: staged.segmentHash,
        sampleAttachmentId:
          sampleAttachmentIds.get(segment.sourceDiveId) ?? null,
        importedAt: now,
      };
      const priorVersions = existing
        ? [
            ...(existing.sourceVersions ?? []),
            ...(!(existing.sourceVersions ?? []).some(
              (item) => item.segmentHash === existing.segmentHash,
            )
              ? [
                  {
                    importId: existing.latestImportId ?? existing.importId,
                    fileHash: '',
                    segmentHash: existing.segmentHash,
                    sampleAttachmentId: existing.sampleAttachmentId,
                    importedAt: existing.modifiedAt,
                  },
                ]
              : []),
          ]
        : [];
      profileRecords.push({
        ...existing,
        entityId,
        importId: existing?.importId ?? importId,
        latestImportId: importId,
        sourceDiveId: segment.sourceDiveId,
        sourceSiteId: segment.sourceSiteId,
        segmentHash: staged.segmentHash,
        targetDiveId: existing?.targetDiveId ?? null,
        disposition: existing?.disposition ?? 'unlinked',
        sampleAttachmentId:
          sampleAttachmentIds.get(segment.sourceDiveId) ?? null,
        sourceFileName: stage.fileName,
        sourceAdapterKey: stage.adapterKey,
        sourceSite: sourceSite
          ? {
              name: sourceSite.name,
              location: sourceSite.location,
              latitude: sourceSite.latitude,
              longitude: sourceSite.longitude,
            }
          : null,
        sourceGas: sourceGas
          ? {
              name: sourceGas.name,
              oxygenFraction: sourceGas.oxygenFraction,
              nitrogenFraction: sourceGas.nitrogenFraction,
              heliumFraction: sourceGas.heliumFraction,
            }
          : null,
        sourceVersions: [...priorVersions, version],
        summary: {
          rawTimestamp: segment.rawTimestamp,
          normalisedTimestamp: segment.normalisedTimestamp,
          greatestDepthM: segment.greatestDepthM,
          sourceDurationSec: segment.sourceDurationSec,
          finalSampleElapsedSec: segment.finalSampleElapsedSec,
          minimumTemperatureC: segment.minimumTemperatureC,
          ballastKg: segment.ballastKg,
          gasId: segment.gasId,
          tankPressureBeginBar: segment.tankPressureBeginBar,
          tankPressureEndBar: segment.tankPressureEndBar,
          waypointCount: segment.waypoints.length,
        },
        preview: profilePreview(segment),
        createdAt: existing?.createdAt ?? now,
        modifiedAt: now,
        isUpdate: Boolean(existing),
      });
    }

    const importRecord = {
      ...existingImport,
      adapterKey: stage.adapterKey,
      sourceFileName: stage.fileName,
      fileHash: stage.fileHash,
      byteLength: stage.byteLength,
      rawAttachmentId,
      importedAt: now,
      segmentHashes: [
        ...new Set([
          ...(existingImport?.segmentHashes ?? []),
          ...stage.segments.map((segment) => segment.segmentHash),
        ]),
      ],
      profileIds: [
        ...new Set([
          ...(existingImport?.profileIds ?? []),
          ...profileRecords.map((profile) => profile.entityId),
        ]),
      ],
      newProfileCount:
        (existingImport?.newProfileCount ?? 0) +
        profileRecords.filter((profile) => !profile.isUpdate).length,
      alreadyImportedCount: stage.segments.filter(
        (segment) => segment.dedupState === 'already-imported',
      ).length,
      updatedSourceCount: stage.segments.filter(
        (segment) => segment.dedupState === 'updated-source-version',
      ).length,
      createdAt: existingImport?.createdAt ?? now,
      modifiedAt: now,
      entityId: importId,
    };
    mutations.push({
      entityId: `${moduleKey}:${importId}`,
      module: moduleKey,
      entityType: 'computer-import',
      schemaVersion: 1,
      operation: existingImport ? 'update' : 'create',
      record: importRecord as never,
      pendingSync: pending(
        importId,
        'computer-import',
        importRecord,
        existingImport?.modifiedAt ?? null,
      ),
    });
    for (const { isUpdate, ...profile } of profileRecords)
      mutations.push({
        entityId: `${moduleKey}:${profile.entityId}`,
        module: moduleKey,
        entityType: 'computer-profile',
        schemaVersion: 1,
        operation: isUpdate ? 'update' : 'create',
        record: profile as never,
        pendingSync: pending(
          profile.entityId,
          'computer-profile',
          profile,
          isUpdate
            ? (existingProfiles.find(
                (item) => item.entityId === profile.entityId,
              )?.modifiedAt ?? null)
            : null,
        ),
      });

    const events = await mutateEntitiesAtomically(mutations, options);
    await deleteComputerImportStage(stage);
    if (typeof window !== 'undefined')
      window.dispatchEvent(new Event('zeustek-records-updated'));
    void flushDiveChanges();
    return {
      importId,
      eventIds: events.map((event) => event.eventId),
      profiles: profileRecords.length,
      newProfiles: profileRecords.filter((profile) => !profile.isUpdate).length,
      updatedProfiles: profileRecords.filter((profile) => profile.isUpdate)
        .length,
      alreadyImported: stage.segments.filter(
        (segment) => segment.dedupState === 'already-imported',
      ).length,
      resolutions: 0,
      reusedImport: Boolean(existingImport),
    };
  } catch (error) {
    if (evidenceStore.remove)
      await Promise.allSettled(
        createdAttachmentIds.map((id) => evidenceStore.remove!(id)),
      );
    throw error;
  }
}
