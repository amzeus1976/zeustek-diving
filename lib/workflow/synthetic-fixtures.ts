import { DIVE_RECORD_KINDS } from '../record-identity';

export const FIXTURE_SCAN_KINDS = DIVE_RECORD_KINDS;

export type CanonicalRecordSnapshot = {
  kind: string;
  record: Record<string, unknown> & { entityId: string };
};

export type FixtureMatch = { field: string; value: string; term: string };

export type RecordReference = {
  sourceKind: string;
  sourceId: string;
  sourceTitle: string;
  path: string;
};

export type RecordAction = 'delete' | 'archive' | 'unlink' | 'manual-review';

export interface FixtureCandidate {
  kind: string;
  entityId: string;
  title: string;
  createdAt?: string;
  modifiedAt?: string;
  destination: string;
  destinationLabel: string;
  matches: FixtureMatch[];
  references: RecordReference[];
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

const FIXTURE_PATTERNS: Array<{ term: string; pattern: RegExp }> = [
  { term: 'PRODUCTION ACCEPTANCE ONLY', pattern: /\bPRODUCTION\s+ACCEPTANCE\s+ONLY\b/i },
  { term: 'SYNTHETIC TEST', pattern: /\bSYNTHETIC(?:\s+TEST)?\b/i },
  { term: 'TEST ONLY', pattern: /\bTEST\s+ONLY\b/i },
  { term: 'ACCEPTANCE ONLY', pattern: /\bACCEPTANCE\s+ONLY\b/i },
  { term: 'FIXTURE', pattern: /\bFIXTURE(?:S)?\b/i },
  { term: 'T10.5', pattern: /\bT10[._ -]?5\b/i },
  { term: 'T10', pattern: /\bT10\b/i },
  { term: 'T09', pattern: /\bT0?9\b/i },
  { term: 'T08', pattern: /\bT0?8\b/i },
  { term: 'T07', pattern: /\bT0?7\b/i },
];

const SEARCHABLE_KEYS = new Set([
  'name', 'title', 'displayname', 'label', 'notes', 'description', 'sitename',
  'planname', 'equipmenttitle', 'eventtitle', 'questiontitle', 'testtitle',
  'importlabel', 'importedlabel', 'filename', 'certification',
]);

const PROTECTED_DELETE_KINDS = new Set([
  'dive', 'test-attempt', 'reference-requirement-set', 'professional-evidence',
  'equipment-event', 'cylinder-fill', 'gas-analysis',
]);

const IMMUTABLE_EDIT_KINDS = new Set([...PROTECTED_DELETE_KINDS, 'question-set']);

const SAFE_UNLINK_ARRAY_FIELDS = new Set([
  'siteIds', 'planIds', 'teamPersonIds', 'packingEquipmentSetIds',
  'documentAttachmentIds', 'equipmentIds', 'skillEvidenceIds', 'albumIds',
  'mediaIds', 'personIds', 'linkedDiveIds',
]);

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
  if (Array.isArray(value)) {
    value.forEach((item, index) => searchableStrings(item, `${path}[${index}]`, result));
    return result;
  }
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = path ? `${path}.${key}` : key;
    if (typeof child === 'string' && SEARCHABLE_KEYS.has(key.toLocaleLowerCase('en-GB'))) result.push({ path: childPath, value: child });
    else if (child && typeof child === 'object') searchableStrings(child, childPath, result);
  }
  return result;
}

export function findFixtureMatches(record: Record<string, unknown>): FixtureMatch[] {
  const matches: FixtureMatch[] = [];
  for (const entry of searchableStrings(record)) {
    for (const candidate of FIXTURE_PATTERNS) {
      if (!candidate.pattern.test(entry.value)) continue;
      matches.push({ field: entry.path, value: entry.value, term: candidate.term });
      break;
    }
  }
  return matches;
}

export function looksLikeSyntheticFixture(record: Record<string, unknown>) {
  return findFixtureMatches(record).length > 0;
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
        references.push({ sourceKind: source.kind, sourceId: source.record.entityId, sourceTitle: fixtureTitle(source.record), path });
        index.set(target, references);
      }
    });
  }
  return index;
}

function referenceCanUnlink(reference: RecordReference) {
  const field = reference.path.replace(/\[\d+\]$/, '').split('.').at(-1) ?? '';
  return SAFE_UNLINK_ARRAY_FIELDS.has(field);
}

export function recommendedRecordAction(kind: string, references: RecordReference[]): RecordAction {
  if (PROTECTED_DELETE_KINDS.has(kind)) return 'archive';
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
  return `Direct deletion is blocked because ${references.length} canonical reference${references.length === 1 ? '' : 's'}${examples ? ` from ${examples}` : ''} cannot be removed safely as a simple relationship unlink.`;
}

export function discoverFixtureCandidates(records: CanonicalRecordSnapshot[]): FixtureCandidate[] {
  const referenceIndex = buildReferenceIndex(records);
  return records.flatMap(({ kind, record }) => {
    const matches = findFixtureMatches(record);
    if (!matches.length) return [];
    const references = referenceIndex.get(record.entityId) ?? [];
    const destination = recordDestination(kind);
    return [{
      kind, entityId: record.entityId, title: fixtureTitle(record),
      ...(typeof record.createdAt === 'string' ? { createdAt: record.createdAt } : {}),
      ...(typeof record.modifiedAt === 'string' ? { modifiedAt: record.modifiedAt } : {}),
      destination: destination.destination, destinationLabel: destination.label, matches, references,
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
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [childKey, visit(child, childKey)]));
  };
  return { record: visit(record) as Record<string, unknown>, changed };
}
