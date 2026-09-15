import { describe, expect, it } from 'vitest';
import {
  archiveRecord,
  buildFixtureDeletionPlan,
  discoverFixtureCandidates,
  findFixtureMatches,
  recordDestination,
  recordActionReason,
  unlinkTargetFromRecord,
  type CanonicalRecordSnapshot,
} from '../lib/workflow/synthetic-fixtures';

const snapshot = (kind: string, entityId: string, record: Record<string, unknown>): CanonicalRecordSnapshot => ({ kind, record: { entityId, ...record } });

describe('T10.6 synthetic fixture discovery and dependency safety', () => {
  it('discovers fixture labels across record kinds and nested visible fields', () => {
    const records = [
      snapshot('equipment', 'eq-1', { displayName: 'T07 synthetic test regulator' }),
      snapshot('trip', 'plan-1', { payload: { title: 'T10 PRODUCTION ACCEPTANCE ONLY' } }),
      snapshot('site', 'site-1', { name: 'St Abbs', notes: 'Owner record' }),
    ];
    const found = discoverFixtureCandidates(records);
    expect(found.map((item) => `${item.kind}:${item.entityId}`)).toEqual(expect.arrayContaining(['equipment:eq-1', 'trip:plan-1']));
    expect(findFixtureMatches(records[1]!.record)).toContainEqual(expect.objectContaining({ field: 'payload.title' }));
  });

  it('does not treat ordinary uses of acceptance as test-fixture labels', () => {
    const records = [
      snapshot('skill', 'skill-1', { description: 'Allow pressure to stabilise before final acceptance.' }),
      snapshot('skill', 'skill-2', { description: 'Compare the final mix against the planned acceptance tolerance.' }),
      snapshot('dive-media', 'media-1', { notes: 'A history of the acceptance of technical diving.' }),
    ];
    expect(discoverFixtureCandidates(records)).toEqual([]);
  });

  it('blocks deletion when a real canonical record references the fixture', () => {
    const records = [
      snapshot('trip', 'plan-fixture', { name: 'T10 ACCEPTANCE ONLY' }),
      snapshot('dive', 'dive-real', { title: 'Owner dive', originatingPlanId: 'plan-fixture' }),
    ];
    const plan = buildFixtureDeletionPlan(['plan-fixture'], records);
    expect(plan.safe).toBe(false);
    expect(plan.blockers).toContainEqual(expect.objectContaining({ sourceId: 'dive-real', path: 'originatingPlanId' }));
  });

  it('allows owner-confirmed deletion of an unreferenced fixture and never selects by default', () => {
    const records = [snapshot('trip', 'plan-fixture', { name: 'T10 TEST ONLY' })];
    expect(buildFixtureDeletionPlan([], records).safe).toBe(false);
    expect(buildFixtureDeletionPlan(['plan-fixture'], records)).toMatchObject({ safe: true, deleteIds: ['plan-fixture'] });
  });

  it('includes labelled fixture children but protects immutable evidence', () => {
    const records = [
      snapshot('equipment', 'equipment-fixture', { name: 'T07 TEST ONLY cylinder' }),
      snapshot('equipment-event', 'event-fixture', { title: 'T07 fixture inspection', equipmentId: 'equipment-fixture' }),
    ];
    expect(buildFixtureDeletionPlan(['equipment-fixture'], records, false).deleteIds).toEqual(['equipment-fixture']);
    const withChildren = buildFixtureDeletionPlan(['equipment-fixture'], records, true);
    expect(withChildren.childIds).toEqual(['event-fixture']);
    expect(withChildren.safe).toBe(false);
    expect(withChildren.protectedIds).toEqual(['event-fixture']);
  });

  it('offers a non-destructive archive marker and safe array unlinking', () => {
    expect(archiveRecord({ entityId: 'attempt-1', title: 'T08 TEST ONLY' }, '2026-09-15T12:00:00.000Z')).toMatchObject({ archived: true, suppressedFromUse: true, archivedAt: '2026-09-15T12:00:00.000Z' });
    const result = unlinkTargetFromRecord({ entityId: 'trip-1', siteIds: ['site-1', 'site-2'], notes: 'site-1 remains text' }, 'site-1');
    expect(result.changed).toBe(true);
    expect(result.record.siteIds).toEqual(['site-2']);
    expect(result.record.notes).toBe('site-1 remains text');
  });

  it('explains each safe action and why a dependent record is blocked', () => {
    expect(recordActionReason('equipment', [])).toContain('Owner-confirmed deletion');
    expect(recordActionReason('dive', [])).toContain('historical or immutable evidence');
    const supported = [{ sourceKind: 'dive-trip', sourceId: 'trip-1', sourceTitle: 'Scapa Flow', path: 'siteIds' }];
    expect(recordActionReason('site', supported)).toContain('Unlink removes only those links');
    const protectedReference = [{ sourceKind: 'dive', sourceId: 'dive-1', sourceTitle: 'Dive 42', path: 'siteId' }];
    expect(recordActionReason('site', protectedReference)).toContain('Direct deletion is blocked');
    expect(recordActionReason('site', protectedReference)).toContain('Dive 42');
  });

  it('routes representative user-data families to their owning page', () => {
    expect(recordDestination('equipment')).toEqual({ destination: 'Equipment', label: 'Equipment' });
    expect(recordDestination('trip').label).toBe('Dive Planning Centre');
    expect(recordDestination('site-overhead-profile').destination).toBe('Sites');
    expect(recordDestination('professional-evidence').destination).toBe('Professional Development');
    expect(recordDestination('test-attempt').destination).toBe('Dive Knowledge');
  });
});
