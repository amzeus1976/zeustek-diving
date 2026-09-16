import { DIVE_RECORD_KINDS } from '../record-identity';

export const FIXTURE_SCAN_KINDS = DIVE_RECORD_KINDS;

export type CanonicalRecordSnapshot = {
  kind: string;
  record: Record<string, unknown> & { entityId: string };
};

export type FixtureConfidence = 'high' | 'possible' | 'ordinary';
export type FixtureMatch = { field: string; value: string; term: string; confidence: FixtureConfidence };

export type RecordReference = {
  sourceKind: string;
  sourceId: string;
  sourceTitle: string;
  path: string;
  synthetic?: boolean;
};

export type RecordAction = 'delete' | 'archive' | 'unlink' | 'manual-review';

export type SyntheticCleanupPlan = {
  selectedIds: string[];
  deleteIds: string[];
  archiveIds: string[];
  unlinkThenDeleteIds: string[];
  blocked: Array<{ id: string; reason: string }>;
};

export type CleanupReport = {
  deletedByKind: Record<string, number>;
  archivedByKind: Record<string, number>;
  unlinkedReferences: number;
  blocked: Array<{ id: string; reason: string }>;
  ownerRecordsChanged: number;
  remainingSuspicious: number;
};

export interface FixtureCandidate {
  kind: string;
  entityId: string;
  title: string;
  createdAt?: string;
  modifiedAt?: string;
  destination: string;
  destinationLabel: string;
  matches: FixtureMatch[];
  confidence: 'high' | 'possible';
  references: RecordReference[];
  outboundReferences: Array<RecordReference & { targetKind: string; targetId: string }>;
  dependencyStatus: string;
  recommendedAction: RecordAction;
  actionReason: string;
}

export type FixtureDeletionPlan = {
  selectedIds: string[];
  childIds: string[];
  deleteIds: string[];
  blockers: RecordReference[];
  protectedIds: string[];
  safe: boolean;
};

const FIXTURE_PATTERNS: Array<{ term: string; pattern: RegExp; confidence: FixtureConfidence }> = [
  { term: 'PRODUCTION ACCEPTANCE ONLY', pattern: /\bPRODUCTION[\s_-]+ACCEPTANCE[\s_-]+ONLY\b/i, confidence: 'high' },
  { term: 'SYNTHETIC TEST', pattern: /\bSYNTHETIC[\s_-]+TEST\b/i, confidence: 'high' },
  { term: 'SYNTHETIC', pattern: /\bSYNTHETIC\b/i, confidence: 'high' },
  { term: 'TEST ONLY', pattern: /\bTEST[\s_-]+ONLY\b/i, confidence: 'high' },
  { term: 'ACCEPTANCE ONLY', pattern: /\bACCEPTANCE[\s_-]+ONLY\b/i, confidence: 'high' },
  { term: 'ACCEPTANCE FIXTURE', pattern: /\bACCEPTANCE[\s_-]+FIXTURE\b/i, confidence: 'high' },
  { term: 'test-data fixture', pattern: /\b(?:ACCEPTANCE|SYNTHETIC|TEST|PRODUCTION)[\s_-]+FIXTURES?\b|\bFIXTURES?[\s_-]+(?:RECORD|CLEANUP)\b/i, confidence: 'high' },
  { term: 'task fixture', pattern: /\bT(?:0?[789]|10(?:[._ -]?[56])?|11|12(?:[._ -]?[123])?)[\s_-]+FIXTURES?\b/i, confidence: 'high' },
  { term: 'WORKSPACE ONLY', pattern: /\bWORKSPACE[\s_-]+ONLY\b/i, confidence: 'high' },
  { term: 'PRODUCTION SMOKE', pattern: /\bPRODUCTION[\s_-]+SMOKE\b/i, confidence: 'high' },
  { term: 'TEST WORKSPACE', pattern: /\bTEST[\s_-]+WORKSPACE\b/i, confidence: 'high' },
  { term: 'TEST PLAN', pattern: /\bTEST[\s_-]+PLAN\b/i, confidence: 'high' },
  { term: 'TEST IMPORT', pattern: /\bTEST[\s_-]+IMPORT\b/i, confidence: 'high' },
  { term: 'TEST PROFILE', pattern: /\bTEST[\s_-]+PROFILE\b/i, confidence: 'high' },
  { term: 'T07–T12.3 task marker', pattern: /\bT(?:0?[789]|10(?:[._ -]?[56])?|11|12(?:[._ -]?[123])?)(?!\d)(?:\b|_)/i, confidence: 'possible' },
];

const PROTECTED_DELETE_KINDS = new Set([
  'dive', 'test-attempt', 'reference-requirement-set', 'professional-evidence',
  'equipment-event', 'cylinder-fill', 'gas-analysis', 'question-set',
  'question-review-state', 'learning-ai-checkpoint', 'learning-ai-advice', 'import-resolution',
]);

const IMMUTABLE_EDIT_KINDS = new Set([...PROTECTED_DELETE_KINDS, 'question-set']);

const SAFE_UNLINK_ARRAY_FIELDS = new Set([
  'siteIds', 'planIds', 'teamPersonIds', 'packingEquipmentSetIds',
  'documentAttachmentIds', 'equipmentIds', 'skillEvidenceIds', 'albumIds',
  'mediaIds', 'personIds', 'linkedDiveIds', 'computerProfileIds', 'computerImportIds',
  'gasPlanIds', 'equipmentSetIds', 'evidenceIds',
]);

const SAFE_UNLINK_SCALAR_FIELDS = new Set([
  'planId', 'tripId', 'diveId', 'siteId', 'equipmentSetId', 'cylinderEquipmentId',
  'fillId', 'analysisId', 'importId', 'profileId', 'originatingPlanId',
  'requirementSetId', 'pathwayId',
]);

// Historical records must not be rewritten merely to remove a convenience link.
const PROTECTED_UNLINK_SOURCE_KINDS = new Set([...PROTECTED_DELETE_KINDS, 'question-set', 'computer-import', 'computer-profile', 'import-resolution']);

const CHILD_PARENT_FIELDS = new Set([
  'ownerId', 'parentId', 'equipmentId', 'siteId', 'pathwayId', 'requirementSetId',
  'questionSetId', 'programmeId',
]);

const KIND_DESTINATIONS: Record<string, [string, string]> = {
  dive: ['Logbook', 'Logbook'],
  equipment: ['Equipment', 'Equipment'],
  'equipment-event': ['Equipment', 'Equipment history'],
  'equipment-set': ['Loadouts & Gas', 'Loadouts & Gas'],
  'cylinder-fill': ['Loadouts & Gas', 'Cylinder fills'],
  'gas-analysis': ['Loadouts & Gas', 'Gas analyses'],
  'gas-plan': ['Gas Planning', 'Gas Planning'],
  site: ['Sites', 'Sites'],
  'site-overhead-profile': ['Sites', 'Wreck & overhead profiles'],
  trip: ['Dive Plans', 'Dive Planning Centre'],
  'dive-trip': ['Trips', 'Trips & Expeditions'],
  certification: ['Training', 'Certifications'],
  'training-progress': ['Course Map', 'Planned Training'],
  person: ['People', 'People'],
  operator: ['People', 'People & operators'],
  album: ['Albums', 'Albums'],
  'catalog-option': ['Settings', 'Site Configuration'],
  'dashboard-settings': ['Settings', 'Site Configuration'],
  'bucket-list': ['Dive Bucket List', 'Bucket List'],
  'gear-wishlist': ['Gear Wishlist', 'Gear Wishlist'],
  'gear-wishlist-group': ['Gear Wishlist', 'Gear Wishlist groups'],
  'price-store': ['Settings', 'Wishlist price search'],
  'price-store-settings': ['Settings', 'Wishlist price search'],
  'news-source': ['Settings', 'Dive News settings'],
  'news-article': ['Dive News', 'Dive News'],
  'news-preferences': ['Settings', 'Dive News settings'],
  'gmail-news': ['Dive News', 'Dive News'],
  'dive-media': ['Dive Media', 'Dive Bibliography'],
  'question-set': ['Dive Knowledge', 'Dive Knowledge'],
  'test-attempt': ['Dive Knowledge', 'Dive Knowledge attempts'],
  'question-review-state': ['Dive Knowledge', 'Question review states'],
  'learning-ai-checkpoint': ['Dive Knowledge', 'AI review checkpoints'],
  'learning-ai-advice': ['Dive Knowledge', 'AI study advice'],
  'computer-import': ['Dive Computer Imports', 'Import files'],
  'computer-profile': ['Dive Computer Imports', 'Imported Profiles'],
  'import-resolution': ['Dive Computer Imports', 'Field Decisions'],
  skill: ['Skills & Currency', 'Dive Skills'],
  skill_evidence: ['Skills & Currency', 'Dive Skill evidence'],
  'currency-policy': ['Skills & Currency', 'Dive Skill currency'],
  'reference-requirement-set': ['Technical Diving', 'Technical Diving requirements'],
  'professional-pathway': ['Professional Development', 'Professional Development'],
  'professional-evidence': ['Professional Development', 'Professional evidence'],
  conservation_activity: ['Conservation & AWARE', 'Conservation & AWARE'],
  'conservation-programme': ['Conservation & AWARE', 'Conservation programmes'],
};

function valueText(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function fixtureTitle(record: Record<string, unknown>) {
  return [record.name, record.title, record.displayName, record.label, record.certification, record.siteName, record.fileName, record.entityId]
    .map(valueText)
    .find(Boolean) ?? 'Untitled record';
}

export function recordDestination(kind: string) {
  const [destination, label] = KIND_DESTINATIONS[kind] ?? ['Settings', 'Site Configuration'];
  return { destination, label };
}

function searchableStrings(value: unknown, path = '', result: Array<{ path: string; value: string }> = []) {
  if (typeof value === 'string') {
    result.push({ path: path || 'value', value });
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => searchableStrings(item, `${path}[${index}]`, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    if (typeof child === 'string' || (child && typeof child === 'object')) searchableStrings(child, childPath, result);
  }
  return result;
}

export function findFixtureMatches(record: Record<string, unknown>): FixtureMatch[] {
  const matches: FixtureMatch[] = [];
  for (const entry of searchableStrings(record)) {
    for (const candidate of FIXTURE_PATTERNS) {
      if (!candidate.pattern.test(entry.value)) continue;
      matches.push({ field: entry.path, value: entry.value.slice(0, 240), term: candidate.term,
        confidence: candidate.confidence });
      break;
    }
  }
  return matches;
}

export function looksLikeSyntheticFixture(record: Record<string, unknown>) {
  return findFixtureMatches(record).some((match) => match.confidence === 'high');
}

function walkReferenceValues(value: unknown, path: string, visit: (target: string, path: string) => void) {
  if (typeof value === 'string') {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkReferenceValues(item, `${path}[${index}]`, visit));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'entityId') continue;
    walkReferenceValues(child, path ? `${path}.${key}` : key, visit);
  }
}

export function buildReferenceIndex(records: CanonicalRecordSnapshot[]) {
  const ids = new Set(records.map(({ record }) => record.entityId));
  const index = new Map<string, RecordReference[]>();
  for (const source of records) {
    walkReferenceValues(source.record, '', (target, path) => {
      if (!ids.has(target) || target === source.record.entityId) return;
      const references = index.get(target) ?? [];
      if (!references.some((item) => item.sourceId === source.record.entityId && item.path === path)) {
        references.push({ sourceKind: source.kind, sourceId: source.record.entityId, sourceTitle: fixtureTitle(source.record), path,
          synthetic: !PROTECTED_DELETE_KINDS.has(source.kind) && looksLikeSyntheticFixture(source.record) });
        index.set(target, references);
      }
    });
  }
  return index;
}

export function referenceCanUnlink(reference: RecordReference) {
  if (PROTECTED_UNLINK_SOURCE_KINDS.has(reference.sourceKind)) return false;
  const field = reference.path.replace(/\[\d+\]$/, '').split('.').at(-1) ?? '';
  return SAFE_UNLINK_ARRAY_FIELDS.has(field) || SAFE_UNLINK_SCALAR_FIELDS.has(field);
}

export function recommendedRecordAction(kind: string, references: RecordReference[]): RecordAction {
  if (PROTECTED_DELETE_KINDS.has(kind)) return references.some((reference) => !reference.synthetic) ? 'manual-review' : 'archive';
  if (!references.length) return 'delete';
  if (references.every(referenceCanUnlink)) return 'unlink';
  return 'manual-review';
}

export function recordActionReason(kind: string, references: RecordReference[]) {
  const action = recommendedRecordAction(kind, references);
  if (action === 'delete') return 'No canonical dependencies were found. Owner-confirmed deletion is available.';
  if (action === 'archive') return `Direct deletion is blocked because ${kind} preserves historical or immutable evidence. Archive/suppress keeps it reviewable without affecting source records.`;
  if (action === 'unlink') return `${references.length} supported relationship${references.length === 1 ? '' : 's'} point to this record. Unlink removes only those links and keeps both canonical records.`;
  const examples = references.slice(0, 2).map((reference) => `${reference.sourceKind} “${reference.sourceTitle}”`).join(' and ');
  return `Direct deletion is blocked because ${references.length} canonical reference${references.length === 1 ? '' : 's'}${examples ? ` from ${examples}` : ''} cannot be removed safely or would hide evidence linked to owner data. Manual review is required.`;
}

export function discoverFixtureCandidates(records: CanonicalRecordSnapshot[], mode: 'high' | 'suspicious' = 'high'): FixtureCandidate[] {
  const referenceIndex = buildReferenceIndex(records);
  const byId = new Map(records.map((item) => [item.record.entityId, item]));
  return records.flatMap(({ kind, record }) => {
    if (mode === 'high' && record.suppressedFromUse === true) return [];
    const matches = findFixtureMatches(record);
    const confidence: 'high' | 'possible' = matches.some((match) => match.confidence === 'high') ? 'high' : 'possible';
    if (!matches.length || (mode === 'high' && confidence !== 'high')) return [];
    const references = referenceIndex.get(record.entityId) ?? [];
    const destination = recordDestination(kind);
    const outboundReferences: FixtureCandidate['outboundReferences'] = [];
    walkReferenceValues(record, '', (targetId, path) => {
      const target = byId.get(targetId);
      if (!target || targetId === record.entityId) return;
      outboundReferences.push({ sourceKind: kind, sourceId: record.entityId, sourceTitle: fixtureTitle(record),
        path, synthetic: confidence === 'high', targetKind: target.kind, targetId });
    });
    return [{
      kind, entityId: record.entityId, title: fixtureTitle(record),
      ...(typeof record.createdAt === 'string' ? { createdAt: record.createdAt } : {}),
      ...(typeof record.modifiedAt === 'string' ? { modifiedAt: record.modifiedAt } : {}),
      destination: destination.destination, destinationLabel: destination.label, matches, confidence, references, outboundReferences,
      dependencyStatus: references.length ? `${references.length} reference${references.length === 1 ? '' : 's'} require review` : 'No canonical references found',
      recommendedAction: recommendedRecordAction(kind, references),
      actionReason: recordActionReason(kind, references),
    }];
  }).sort((left, right) => left.title.localeCompare(right.title, 'en-GB'));
}

export function candidateFromRecord(kind: string, record: Record<string, unknown>): FixtureCandidate | null {
  if (typeof record.entityId !== 'string' || !record.entityId) return null;
  return discoverFixtureCandidates([{ kind, record: record as Record<string, unknown> & { entityId: string } }])[0] ?? null;
}

function terminalField(path: string) {
  return path.replace(/\[\d+\]$/, '').split('.').at(-1) ?? '';
}

function isFixtureChildOf(record: CanonicalRecordSnapshot, parentIds: Set<string>) {
  let child = false;
  walkReferenceValues(record.record, '', (target, path) => {
    if (parentIds.has(target) && CHILD_PARENT_FIELDS.has(terminalField(path))) child = true;
  });
  return child;
}

export function buildFixtureDeletionPlan(selectedIds: string[], records: CanonicalRecordSnapshot[], includeChildren = false): FixtureDeletionPlan {
  const fixtures = new Set(discoverFixtureCandidates(records).map((item) => item.entityId));
  const selected = new Set(selectedIds.filter((id) => fixtures.has(id)));
  const deletion = new Set(selected);
  if (includeChildren) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const record of records) {
        const id = record.record.entityId;
        if (deletion.has(id) || !fixtures.has(id) || !isFixtureChildOf(record, deletion)) continue;
        deletion.add(id);
        changed = true;
      }
    }
  }
  const referenceIndex = buildReferenceIndex(records);
  const blockers = [...deletion].flatMap((id) => (referenceIndex.get(id) ?? []).filter((reference) => !deletion.has(reference.sourceId)));
  const protectedIds = records.filter(({ kind, record }) => deletion.has(record.entityId) && PROTECTED_DELETE_KINDS.has(kind)).map(({ record }) => record.entityId);
  const childIds = [...deletion].filter((id) => !selected.has(id));
  return { selectedIds: [...selected], childIds, deleteIds: [...deletion], blockers, protectedIds, safe: deletion.size > 0 && blockers.length === 0 && protectedIds.length === 0 };
}

export function buildSyntheticCleanupPlan(selectedIds: string[], records: CanonicalRecordSnapshot[]): SyntheticCleanupPlan {
  const candidates = discoverFixtureCandidates(records);
  const selection = new Set(selectedIds);
  const plan: SyntheticCleanupPlan = { selectedIds: [], deleteIds: [], archiveIds: [], unlinkThenDeleteIds: [], blocked: [] };
  const chosen = candidates.filter((item) => selection.has(item.entityId));
  const unprotected = new Set(chosen.filter((item) => !PROTECTED_DELETE_KINDS.has(item.kind)).map((item) => item.entityId));
  // A selected, entirely synthetic child chain can be removed child-first, but
  // no link from outside the selected set may be removed implicitly.
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of chosen) {
      if (unprotected.has(item.entityId) && item.references.some((ref) => !unprotected.has(ref.sourceId))) {
        unprotected.delete(item.entityId);
        changed = true;
      }
    }
  }
  const byId = new Map(chosen.map((item) => [item.entityId, item]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycles = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) { cycles.add(id); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const ref of byId.get(id)?.references ?? []) if (unprotected.has(ref.sourceId)) visit(ref.sourceId);
    visiting.delete(id);
    visited.add(id);
    plan.deleteIds.push(id);
  };
  for (const id of unprotected) visit(id);
  if (cycles.size) {
    for (const id of unprotected) {
      cycles.add(id);
      plan.blocked.push({ id, reason: 'Selected records include a reference cycle. Resolve each link manually before deletion.' });
    }
    plan.deleteIds = [];
  }
  for (const item of candidates) {
    if (!selection.has(item.entityId)) continue;
    plan.selectedIds.push(item.entityId);
    if (PROTECTED_DELETE_KINDS.has(item.kind)) {
      if (item.references.some((reference) => !reference.synthetic))
        plan.blocked.push({ id: item.entityId, reason: recordActionReason(item.kind, item.references) });
      else plan.archiveIds.push(item.entityId);
    }
    else if (plan.deleteIds.includes(item.entityId) || cycles.has(item.entityId)) continue;
    else if (item.references.every(referenceCanUnlink)) plan.unlinkThenDeleteIds.push(item.entityId);
    else plan.blocked.push({ id: item.entityId, reason: recordActionReason(item.kind, item.references) });
  }
  return plan;
}

export function cleanupReport(
  actions: Array<{ kind: string; action: 'deleted' | 'archived' }>,
  unlinkedReferences: number, blocked: SyntheticCleanupPlan['blocked'],
  ownerRecordsChanged: number, remaining: CanonicalRecordSnapshot[],
): CleanupReport {
  const deletedByKind: Record<string, number> = {};
  const archivedByKind: Record<string, number> = {};
  for (const { kind, action } of actions) {
    const counts = action === 'deleted' ? deletedByKind : archivedByKind;
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return { deletedByKind, archivedByKind, unlinkedReferences, blocked,
    ownerRecordsChanged, remainingSuspicious: discoverFixtureCandidates(remaining, 'suspicious').length };
}

export function canEditRecordMetadata(kind: string, record: Record<string, unknown>) {
  if (IMMUTABLE_EDIT_KINDS.has(kind)) return false;
  return ['name', 'title', 'displayName', 'label', 'notes', 'description'].some((field) => typeof record[field] === 'string');
}

export function editableRecordFields(record: Record<string, unknown>) {
  return ['name', 'title', 'displayName', 'label', 'notes', 'description'].filter((field) => typeof record[field] === 'string');
}

export function archiveRecord(record: Record<string, unknown>, at = new Date().toISOString()) {
  return { ...record, archived: true, suppressedFromUse: true, archivedAt: at };
}

export function unlinkTargetFromRecord(record: Record<string, unknown>, targetId: string) {
  let changed = false;
  const visit = (value: unknown, key = ''): unknown => {
    if (Array.isArray(value)) {
      if (SAFE_UNLINK_ARRAY_FIELDS.has(key)) {
        const next = value.filter((item) => item !== targetId).map((item) => visit(item));
        if (next.length !== value.length) changed = true;
        return next;
      }
      return value.map((item) => visit(item));
    }
    if (typeof value === 'string' && value === targetId && SAFE_UNLINK_SCALAR_FIELDS.has(key)) {
      changed = true;
      return null;
    }
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, visit(child, childKey)]));
  };
  return { record: visit(record) as Record<string, unknown>, changed };
}
