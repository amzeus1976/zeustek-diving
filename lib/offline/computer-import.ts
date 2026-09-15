import { mutateEntitiesAtomically } from './batch-mutations';
import { zeustekDb } from './db';
import { currentDiveAccount, flushDiveChanges } from './dive-store';
import { listRecords, type DiveSiteRecord } from './dive-planning';
import { listDives, type DiveRecord } from './dives';
import {
  suggestExistingDives,
  suggestSegmentGroups,
  type ImportMatchCandidate,
  type SegmentGroupSuggestion,
} from './computer-import-matcher';
import {
  applyImportDecisions,
  decisionsComplete,
  fieldCandidatesForDive,
  type ImportFieldDecision,
  type ImportResolutionRecord,
} from './import-resolution';
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
  createdAt: string;
  modifiedAt: string;
}

export interface ComputerProfileRecord {
  importId: string;
  sourceDiveId: string;
  sourceSiteId: string | null;
  segmentHash: string;
  targetDiveId: string | null;
  disposition: 'linked' | 'created' | 'excluded';
  sampleAttachmentId: string | null;
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

function createImportDive(segment: OceanicSegment, now: string): DiveRecord {
  return {
    site: 'Imported Oceanic+ dive — review Site',
    siteId: '',
    date:
      segment.normalisedTimestamp?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
    timeIn: segment.normalisedTimestamp?.match(/T(\d{2}:\d{2})/)?.[1] ?? '',
    maxDepthM: null,
    bottomTimeMin: null,
    gas: '',
    notes: 'Imported from reviewed Oceanic+ evidence.',
    source: 'oceanic-plus',
    createdAt: now,
    modifiedAt: now,
  };
}

export async function commitComputerImport(
  stage: ComputerImportStage,
  evidenceStore: ComputerEvidenceStore,
  options: { failAfterMutation?: number } = {},
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
  if (!stage.assignments.length)
    throw new Error(
      'Review every source segment and assign it to an existing Dive, create-new group, or exclude it.',
    );
  const assigned = stage.assignments.flatMap(
    (assignment) => assignment.sourceDiveIds,
  );
  if (new Set(assigned).size !== assigned.length)
    throw new Error(
      'A source segment cannot appear in more than one assignment.',
    );
  const assignedIds = new Set(assigned);
  if (stage.segments.some((segment) => !assignedIds.has(segment.sourceDiveId)))
    throw new Error(
      'One or more source segments still need an explicit owner decision.',
    );

  const sourceSites = new Map(stage.sites.map((site) => [site.id, site]));
  const gases = new Map(stage.gases.map((gas) => [gas.id, gas]));
  const prepared: Array<{
    assignment: StagedAssignment;
    segments: OceanicSegment[];
  }> = [];
  for (const assignment of stage.assignments) {
    const staged = assignment.sourceDiveIds.map((id) =>
      stage.segments.find((segment) => segment.sourceDiveId === id),
    );
    if (staged.some((segment) => !segment))
      throw new Error('An assigned source segment is unavailable.');
    if (
      assignment.action !== 'exclude' &&
      staged.some((segment) => segment?.dedupState === 'already-imported')
    ) {
      throw new Error(
        'An already-imported source segment cannot be committed again.',
      );
    }
    prepared.push({
      assignment,
      segments: await Promise.all(
        assignment.sourceDiveIds.map((id) => readStagedSegment(stage, id)),
      ),
    });
  }

  const importId = crypto.randomUUID();
  const profileIds = new Map(
    stage.segments.map((segment) => [
      segment.sourceDiveId,
      crypto.randomUUID(),
    ]),
  );
  const createdAttachmentIds: string[] = [];
  try {
    const rawAttachmentId = await evidenceStore.put({
      ownerKind: 'computer-import',
      ownerId: importId,
      fileName: stage.fileName,
      mimeType: 'application/xml',
      bytes: await evidenceBytes(stage, stage.rawBlobId),
    });
    createdAttachmentIds.push(rawAttachmentId);
    const sampleAttachmentIds = new Map<string, string>();
    for (const { assignment, segments } of prepared) {
      if (assignment.action === 'exclude') continue;
      for (const segment of segments) {
        const staged = stage.segments.find(
          (item) => item.sourceDiveId === segment.sourceDiveId,
        )!;
        const attachmentId = await evidenceStore.put({
          ownerKind: 'computer-profile',
          ownerId: profileIds.get(segment.sourceDiveId)!,
          fileName: `${segment.sourceDiveId}.json`,
          mimeType: 'application/json',
          bytes: await evidenceBytes(stage, staged.profileBlobId),
        });
        sampleAttachmentIds.set(segment.sourceDiveId, attachmentId);
        createdAttachmentIds.push(attachmentId);
      }
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
    const profileRecords: Array<ComputerProfileRecord & { entityId: string }> =
      [];
    const resolutionRecords: ImportResolutionRecord[] = [];

    for (const { assignment, segments } of prepared) {
      let targetDiveId = assignment.targetDiveId;
      let target: DiveRecord | null = null;
      if (assignment.action === 'target-existing') {
        if (!targetDiveId)
          throw new Error('Existing-Dive assignment has no target.');
        const entity = await zeustekDb.entities.get(
          `dive:${account}:${targetDiveId}`,
        );
        if (
          !entity ||
          entity.deleted ||
          entity.entityType !== 'dive' ||
          !entity.record
        )
          throw new Error(
            'Target Dive changed or disappeared. Reopen resolution.',
          );
        if (entity.updatedEventId !== assignment.targetUpdatedEventId)
          throw new Error(`IMPORT_TARGET_CHANGED:${targetDiveId}`);
        target = entity.record as unknown as DiveRecord;
        const candidates = fieldCandidatesForDive(
          target,
          segments,
          sourceSites,
          gases,
        );
        if (!decisionsComplete(candidates, assignment.decisions))
          throw new Error(
            `Field resolution is incomplete for target Dive ${targetDiveId}.`,
          );
        const baseModifiedAt = target.modifiedAt ?? null;
        target = applyImportDecisions(target, assignment.decisions);
        const record = {
          ...target,
          entityId: targetDiveId,
          computerProfileIds: [
            ...new Set([
              ...(target.computerProfileIds ?? []),
              ...assignment.sourceDiveIds.map((id) => profileIds.get(id)!),
            ]),
          ],
          computerImportIds: [
            ...new Set([...(target.computerImportIds ?? []), importId]),
          ],
          lastComputerImportAt: now,
          modifiedAt: now,
        };
        mutations.push({
          entityId: `${moduleKey}:${targetDiveId}`,
          module: moduleKey,
          entityType: 'dive',
          schemaVersion: 1,
          operation: 'update',
          record: record as never,
          pendingSync: pending(targetDiveId, 'dive', record, baseModifiedAt),
        });
      } else if (assignment.action === 'create-new') {
        targetDiveId = crypto.randomUUID();
        const base = createImportDive(segments[0]!, now);
        const candidates = fieldCandidatesForDive(
          base,
          segments,
          sourceSites,
          gases,
        );
        if (!decisionsComplete(candidates, assignment.decisions))
          throw new Error(
            'Field resolution is incomplete for a create-new Dive assignment.',
          );
        target = applyImportDecisions(base, assignment.decisions);
        const record = {
          ...target,
          entityId: targetDiveId,
          computerProfileIds: assignment.sourceDiveIds.map((id) =>
            profileIds.get(id)!,
          ),
          computerImportIds: [importId],
          lastComputerImportAt: now,
        };
        mutations.push({
          entityId: `${moduleKey}:${targetDiveId}`,
          module: moduleKey,
          entityType: 'dive',
          schemaVersion: 1,
          operation: 'create',
          record: record as never,
          pendingSync: pending(targetDiveId, 'dive', record, null),
        });
      }

      for (const segment of segments) {
        const staged = stage.segments.find(
          (item) => item.sourceDiveId === segment.sourceDiveId,
        )!;
        const entityId = profileIds.get(segment.sourceDiveId)!;
        profileRecords.push({
          entityId,
          importId,
          sourceDiveId: segment.sourceDiveId,
          sourceSiteId: segment.sourceSiteId,
          segmentHash: staged.segmentHash,
          targetDiveId: assignment.action === 'exclude' ? null : targetDiveId,
          disposition:
            assignment.action === 'exclude'
              ? 'excluded'
              : assignment.action === 'create-new'
                ? 'created'
                : 'linked',
          sampleAttachmentId:
            sampleAttachmentIds.get(segment.sourceDiveId) ?? null,
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
          createdAt: now,
          modifiedAt: now,
        });
      }
      if (assignment.action !== 'exclude' && targetDiveId)
        resolutionRecords.push({
          importId,
          targetDiveId,
          targetRevisionEventId: assignment.targetUpdatedEventId,
          decidedAt: now,
          decisions: assignment.decisions,
          createdAt: now,
          modifiedAt: now,
        });
    }

    const importRecord = {
      adapterKey: stage.adapterKey,
      sourceFileName: stage.fileName,
      fileHash: stage.fileHash,
      byteLength: stage.byteLength,
      rawAttachmentId,
      importedAt: now,
      segmentHashes: stage.segments.map((segment) => segment.segmentHash),
      createdAt: now,
      modifiedAt: now,
      entityId: importId,
    };
    mutations.push({
      entityId: `${moduleKey}:${importId}`,
      module: moduleKey,
      entityType: 'computer-import',
      schemaVersion: 1,
      operation: 'create',
      record: importRecord as never,
      pendingSync: pending(importId, 'computer-import', importRecord, null),
    });
    for (const profile of profileRecords)
      mutations.push({
        entityId: `${moduleKey}:${profile.entityId}`,
        module: moduleKey,
        entityType: 'computer-profile',
        schemaVersion: 1,
        operation: 'create',
        record: profile as never,
        pendingSync: pending(
          profile.entityId,
          'computer-profile',
          profile,
          null,
        ),
      });
    for (const resolution of resolutionRecords) {
      const entityId = crypto.randomUUID();
      const record = { ...resolution, entityId };
      mutations.push({
        entityId: `${moduleKey}:${entityId}`,
        module: moduleKey,
        entityType: 'import-resolution',
        schemaVersion: 1,
        operation: 'create',
        record: record as never,
        pendingSync: pending(entityId, 'import-resolution', record, null),
      });
    }

    const events = await mutateEntitiesAtomically(mutations, options);
    await deleteComputerImportStage(stage);
    if (typeof window !== 'undefined')
      window.dispatchEvent(new Event('zeustek-records-updated'));
    void flushDiveChanges();
    return {
      importId,
      eventIds: events.map((event) => event.eventId),
      profiles: profileRecords.length,
      resolutions: resolutionRecords.length,
    };
  } catch (error) {
    if (evidenceStore.remove)
      await Promise.allSettled(
        createdAttachmentIds.map((id) => evidenceStore.remove!(id)),
      );
    throw error;
  }
}
