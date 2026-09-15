import { mutateEntitiesAtomically } from './batch-mutations';
import { zeustekDb } from './db';
import {
  currentDiveAccount,
  flushDiveChanges,
  saveLocalRecord,
} from './dive-store';
import { listRecords } from './dive-planning';
import { listDives, type DiveRecord } from './dives';
import type {
  ComputerEvidenceStore,
  ComputerImportRecord,
  ComputerProfileRecord,
} from './computer-import';
import {
  applyImportDecisions,
  type ImportFieldDecision,
  type ImportResolutionRecord,
} from './import-resolution';

type StoredProfile = ComputerProfileRecord & { entityId: string };
function pending(
  moduleKey: string,
  id: string,
  kind: string,
  record: unknown,
  baseModifiedAt: string | null,
) {
  return {
    key: `pending:${moduleKey}:${id}`,
    value: {
      id,
      kind,
      record,
      baseModifiedAt,
      token: crypto.randomUUID(),
      state: 'pending',
    } as never,
  };
}

function changed() {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event('zeustek-records-updated'));
  void flushDiveChanges();
}

async function recordEntity<T>(account: string, id: string, kind: string) {
  const entity = await zeustekDb.entities.get(`dive:${account}:${id}`);
  if (!entity || entity.deleted || entity.entityType !== kind || !entity.record)
    throw new Error(`${kind.replaceAll('-', ' ')} is unavailable.`);
  return {
    entity,
    record: entity.record as unknown as T & { entityId: string },
  };
}

function updateMutation(
  moduleKey: string,
  id: string,
  kind: string,
  record: Record<string, unknown>,
  baseModifiedAt: string | null,
) {
  return {
    entityId: `${moduleKey}:${id}`,
    module: moduleKey,
    entityType: kind,
    schemaVersion: 1,
    operation: 'update' as const,
    record: record as never,
    pendingSync: pending(moduleKey, id, kind, record, baseModifiedAt),
  };
}

function deleteMutation(
  moduleKey: string,
  id: string,
  kind: string,
  baseModifiedAt: string | null,
) {
  return {
    entityId: `${moduleKey}:${id}`,
    module: moduleKey,
    entityType: kind,
    schemaVersion: 1,
    operation: 'delete' as const,
    record: null,
    pendingSync: pending(moduleKey, id, kind, null, baseModifiedAt),
  };
}

function removeProfileReference(
  dive: DiveRecord & { entityId: string },
  profile: StoredProfile,
  otherProfiles: StoredProfile[],
  now: string,
) {
  const computerProfileIds = (dive.computerProfileIds ?? []).filter(
    (id) => id !== profile.entityId,
  );
  const importStillLinked = otherProfiles.some(
    (item) =>
      item.entityId !== profile.entityId &&
      item.targetDiveId === dive.entityId &&
      item.importId === profile.importId,
  );
  return {
    ...dive,
    computerProfileIds,
    computerImportIds: importStillLinked
      ? dive.computerImportIds
      : (dive.computerImportIds ?? []).filter((id) => id !== profile.importId),
    modifiedAt: now,
  };
}

async function supersededResolutionMutations(
  moduleKey: string,
  profileId: string,
  now: string,
  mode: 'supersede' | 'archive',
) {
  const resolutions =
    await listRecords<ImportResolutionRecord>('import-resolution');
  return resolutions
    .filter(
      (resolution) =>
        resolution.sourceProfileIds?.includes(profileId) &&
        !resolution.supersededAt &&
        !resolution.archivedAt,
    )
    .map((resolution) => {
      const record = {
        ...resolution,
        ...(mode === 'archive'
          ? {
              archivedAt: now,
              archiveReason: 'Imported profile removed by owner.',
            }
          : { supersededAt: now }),
        modifiedAt: now,
      };
      return updateMutation(
        moduleKey,
        resolution.entityId,
        'import-resolution',
        record,
        resolution.modifiedAt,
      );
    });
}

export async function linkComputerProfile(
  profileId: string,
  targetDiveId: string,
  decisions: ImportFieldDecision[] = [],
) {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in before linking an imported profile.');
  const moduleKey = `dive:${account}`;
  const [{ record: profile }, { record: targetDive }, profiles] =
    await Promise.all([
      recordEntity<ComputerProfileRecord>(
        account,
        profileId,
        'computer-profile',
      ),
      recordEntity<DiveRecord>(account, targetDiveId, 'dive'),
      listRecords<ComputerProfileRecord>('computer-profile'),
    ]);
  const now = new Date().toISOString();
  const mutations: Parameters<typeof mutateEntitiesAtomically>[0] = [];

  if (profile.targetDiveId && profile.targetDiveId !== targetDiveId) {
    const prior = await recordEntity<DiveRecord>(
      account,
      profile.targetDiveId,
      'dive',
    );
    const priorRecord = removeProfileReference(
      prior.record,
      profile,
      profiles,
      now,
    );
    mutations.push(
      updateMutation(
        moduleKey,
        prior.record.entityId,
        'dive',
        priorRecord,
        prior.record.modifiedAt ?? null,
      ),
    );
  }

  const resolvedTarget = decisions.length
    ? applyImportDecisions(targetDive, decisions)
    : targetDive;
  const targetRecord = {
    ...resolvedTarget,
    entityId: targetDiveId,
    computerProfileIds: [
      ...new Set([...(resolvedTarget.computerProfileIds ?? []), profileId]),
    ],
    computerImportIds: [
      ...new Set([
        ...(resolvedTarget.computerImportIds ?? []),
        profile.importId,
      ]),
    ],
    lastComputerImportAt: now,
    modifiedAt: now,
  };
  mutations.push(
    updateMutation(
      moduleKey,
      targetDiveId,
      'dive',
      targetRecord,
      targetDive.modifiedAt ?? null,
    ),
  );
  const profileRecord = {
    ...profile,
    targetDiveId,
    disposition: 'linked' as const,
    modifiedAt: now,
  };
  mutations.push(
    updateMutation(
      moduleKey,
      profileId,
      'computer-profile',
      profileRecord,
      profile.modifiedAt,
    ),
  );
  mutations.push(
    ...(await supersededResolutionMutations(
      moduleKey,
      profileId,
      now,
      'supersede',
    )),
  );
  let resolutionId: string | null = null;
  if (decisions.length) {
    resolutionId = crypto.randomUUID();
    const resolution: ImportResolutionRecord & { entityId: string } = {
      entityId: resolutionId,
      importId: profile.latestImportId ?? profile.importId,
      sourceProfileIds: [profileId],
      targetDiveId,
      targetRevisionEventId: null,
      decidedAt: now,
      decisions,
      createdAt: now,
      modifiedAt: now,
    };
    mutations.push({
      entityId: `${moduleKey}:${resolutionId}`,
      module: moduleKey,
      entityType: 'import-resolution',
      schemaVersion: 1,
      operation: 'create',
      record: resolution as never,
      pendingSync: pending(
        moduleKey,
        resolutionId,
        'import-resolution',
        resolution,
        null,
      ),
    });
  }

  await mutateEntitiesAtomically(mutations);
  changed();
  return { targetDiveId, resolutionId, decisions: decisions.length };
}

export async function unlinkComputerProfile(profileId: string) {
  const account = currentDiveAccount();
  if (!account)
    throw new Error('Sign in before unlinking an imported profile.');
  const moduleKey = `dive:${account}`;
  const { record: profile } = await recordEntity<ComputerProfileRecord>(
    account,
    profileId,
    'computer-profile',
  );
  if (!profile.targetDiveId) return { unlinked: false };
  const [{ record: dive }, profiles] = await Promise.all([
    recordEntity<DiveRecord>(account, profile.targetDiveId, 'dive'),
    listRecords<ComputerProfileRecord>('computer-profile'),
  ]);
  const now = new Date().toISOString();
  const diveRecord = removeProfileReference(dive, profile, profiles, now);
  const profileRecord = {
    ...profile,
    targetDiveId: null,
    disposition: 'unlinked' as const,
    modifiedAt: now,
  };
  await mutateEntitiesAtomically([
    updateMutation(
      moduleKey,
      dive.entityId,
      'dive',
      diveRecord,
      dive.modifiedAt ?? null,
    ),
    updateMutation(
      moduleKey,
      profileId,
      'computer-profile',
      profileRecord,
      profile.modifiedAt,
    ),
    ...(await supersededResolutionMutations(
      moduleKey,
      profileId,
      now,
      'supersede',
    )),
  ]);
  changed();
  return { unlinked: true };
}

export async function setComputerProfileReviewState(
  profile: StoredProfile,
  state: 'unlinked' | 'excluded',
) {
  if (profile.targetDiveId)
    throw new Error('Unlink this profile before changing its review state.');
  await saveLocalRecord('computer-profile', {
    ...profile,
    disposition: state,
  });
}

export interface ImportRemovalSummary {
  importId: string;
  sourceFileName: string;
  linkedProfiles: number;
  unlinkedProfiles: number;
  sharedVersionProfiles: number;
  resolutionRecords: number;
  removable: boolean;
  reason: string;
}

export async function importRemovalSummary(
  importId: string,
): Promise<ImportRemovalSummary> {
  const [imports, profiles, resolutions] = await Promise.all([
    listRecords<ComputerImportRecord>('computer-import'),
    listRecords<ComputerProfileRecord>('computer-profile'),
    listRecords<ImportResolutionRecord>('import-resolution'),
  ]);
  const source = imports.find((item) => item.entityId === importId);
  if (!source) throw new Error('Computer import is unavailable.');
  const related = profiles.filter(
    (profile) =>
      profile.importId === importId ||
      profile.latestImportId === importId ||
      profile.sourceVersions?.some((version) => version.importId === importId),
  );
  const linkedProfiles = related.filter(
    (profile) => profile.targetDiveId,
  ).length;
  const sharedVersionProfiles = related.filter(
    (profile) => profile.importId !== importId,
  ).length;
  const resolutionRecords = resolutions.filter(
    (resolution) =>
      resolution.importId === importId ||
      resolution.sourceProfileIds?.some((id) =>
        related.some((profile) => profile.entityId === id),
      ),
  ).length;
  const removable = linkedProfiles === 0 && sharedVersionProfiles === 0;
  return {
    importId,
    sourceFileName: source.sourceFileName,
    linkedProfiles,
    unlinkedProfiles: related.length - linkedProfiles,
    sharedVersionProfiles,
    resolutionRecords,
    removable,
    reason: linkedProfiles
      ? 'Unlink the linked profiles before removing this import.'
      : sharedVersionProfiles
        ? 'This import is part of another profile version history and requires manual review.'
        : 'The import and its unlinked profiles can be removed without deleting any Dive.',
  };
}

export async function removeComputerProfile(
  profileId: string,
  evidenceStore: ComputerEvidenceStore,
  confirmed = false,
) {
  if (!confirmed) throw new Error('Explicit removal confirmation is required.');
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in before removing an imported profile.');
  const moduleKey = `dive:${account}`;
  const { record: profile } = await recordEntity<ComputerProfileRecord>(
    account,
    profileId,
    'computer-profile',
  );
  if (profile.targetDiveId)
    throw new Error('Linked profiles must be unlinked before removal.');
  const now = new Date().toISOString();
  const mutations: Parameters<typeof mutateEntitiesAtomically>[0] = [
    deleteMutation(
      moduleKey,
      profileId,
      'computer-profile',
      profile.modifiedAt,
    ),
    ...(await supersededResolutionMutations(
      moduleKey,
      profileId,
      now,
      'archive',
    )),
  ];
  const imports = await listRecords<ComputerImportRecord>('computer-import');
  const sources = imports.filter(
    (item) =>
      item.entityId === profile.importId ||
      item.entityId === profile.latestImportId ||
      item.profileIds?.includes(profileId),
  );
  for (const source of sources) {
    const record = {
      ...source,
      profileIds: (source.profileIds ?? []).filter((id) => id !== profileId),
      modifiedAt: now,
    };
    mutations.push(
      updateMutation(
        moduleKey,
        source.entityId,
        'computer-import',
        record,
        source.modifiedAt,
      ),
    );
  }
  await mutateEntitiesAtomically(mutations);
  if (evidenceStore.remove) {
    const attachmentIds = [
      profile.sampleAttachmentId,
      ...(profile.sourceVersions ?? []).map(
        (version) => version.sampleAttachmentId,
      ),
    ].filter((id): id is string => Boolean(id));
    await Promise.allSettled(
      [...new Set(attachmentIds)].map((id) => evidenceStore.remove!(id)),
    );
  }
  changed();
  return { removed: true };
}

export async function removeComputerImport(
  importId: string,
  evidenceStore: ComputerEvidenceStore,
  confirmed = false,
) {
  if (!confirmed) throw new Error('Explicit removal confirmation is required.');
  const summary = await importRemovalSummary(importId);
  if (!summary.removable) throw new Error(summary.reason);
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in before removing a computer import.');
  const moduleKey = `dive:${account}`;
  const [{ record: source }, profiles, resolutions] = await Promise.all([
    recordEntity<ComputerImportRecord>(account, importId, 'computer-import'),
    listRecords<ComputerProfileRecord>('computer-profile'),
    listRecords<ImportResolutionRecord>('import-resolution'),
  ]);
  const related = profiles.filter((profile) => profile.importId === importId);
  const now = new Date().toISOString();
  const relatedIds = new Set(related.map((profile) => profile.entityId));
  const mutations: Parameters<typeof mutateEntitiesAtomically>[0] = [
    deleteMutation(moduleKey, importId, 'computer-import', source.modifiedAt),
    ...related.map((profile) =>
      deleteMutation(
        moduleKey,
        profile.entityId,
        'computer-profile',
        profile.modifiedAt,
      ),
    ),
    ...resolutions
      .filter(
        (resolution) =>
          resolution.importId === importId ||
          resolution.sourceProfileIds?.some((id) => relatedIds.has(id)),
      )
      .filter((resolution) => !resolution.archivedAt)
      .map((resolution) => {
        const record = {
          ...resolution,
          archivedAt: now,
          archiveReason: 'Computer import removed by owner.',
          modifiedAt: now,
        };
        return updateMutation(
          moduleKey,
          resolution.entityId,
          'import-resolution',
          record,
          resolution.modifiedAt,
        );
      }),
  ];
  await mutateEntitiesAtomically(mutations);
  if (evidenceStore.remove) {
    const attachmentIds = [
      source.rawAttachmentId,
      ...related.flatMap((profile) =>
        [
          profile.sampleAttachmentId,
          ...(profile.sourceVersions ?? []).map(
            (version) => version.sampleAttachmentId,
          ),
        ].filter((id): id is string => Boolean(id)),
      ),
    ];
    await Promise.allSettled(
      [...new Set(attachmentIds)].map((id) => evidenceStore.remove!(id)),
    );
  }
  changed();
  return { removedImport: true, removedProfiles: related.length };
}

export async function listProfileManagementData() {
  const [profiles, imports, dives, resolutions] = await Promise.all([
    listRecords<ComputerProfileRecord>('computer-profile'),
    listRecords<ComputerImportRecord>('computer-import'),
    listDives(),
    listRecords<ImportResolutionRecord>('import-resolution'),
  ]);
  return { profiles, imports, dives, resolutions };
}
