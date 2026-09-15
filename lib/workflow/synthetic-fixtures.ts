import { looksLikeSyntheticFixture, SYNTHETIC_FIXTURE_TERMS } from './workflow-model';

export interface FixtureCandidate {
  kind: string;
  entityId: string;
  title: string;
  reason: string;
  modifiedAt?: string;
}

export const FIXTURE_SCAN_KINDS = ['trip', 'dive-trip', 'equipment', 'equipment-event', 'site', 'person', 'album', 'gear-wishlist', 'question-set', 'test-attempt'] as const;

function stringValue(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function fixtureTitle(record: Record<string, unknown>) {
  return [record.name, record.title, record.label, record.certification, record.siteName, record.entityId]
    .map(stringValue)
    .find(Boolean) ?? 'Untitled record';
}

export function candidateFromRecord(kind: string, record: Record<string, unknown>): FixtureCandidate | null {
  if (!looksLikeSyntheticFixture(record)) return null;
  const title = fixtureTitle(record);
  const haystack = `${title} ${stringValue(record.notes)}`.toLocaleUpperCase('en-GB');
  const term = SYNTHETIC_FIXTURE_TERMS.find((value) => haystack.includes(value)) ?? 'labelled acceptance/test text';
  const entityId = typeof record.entityId === 'string' ? record.entityId : '';
  if (!entityId) return null;
  return { kind, entityId, title, reason: term, ...(typeof record.modifiedAt === 'string' ? { modifiedAt: record.modifiedAt } : {}) };
}
