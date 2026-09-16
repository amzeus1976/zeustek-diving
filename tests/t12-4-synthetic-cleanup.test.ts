import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, listLocalDiveRecords, saveLocalRecord } from '../lib/offline/dive-store';
import { listDives } from '../lib/offline/dives';
import { listGasPlans } from '../lib/offline/planning-pages';
import {
  archiveRecord, buildSyntheticCleanupPlan, cleanupReport, discoverFixtureCandidates,
  findFixtureMatches, recordDestination, referenceCanUnlink, unlinkTargetFromRecord,
  type CanonicalRecordSnapshot,
} from '../lib/workflow/synthetic-fixtures';

const snapshot = (kind: string, entityId: string, data: Record<string, unknown>): CanonicalRecordSnapshot =>
  ({ kind, record: { entityId, ...data } });

describe('T12.4 recursive synthetic cleanup', () => {
  it('finds explicit markers in arbitrary nested strings and newer identity/evidence fields', () => {
    const data = { entityId: 'x', skillKey: 'T10.6 acceptance fixture', nested: {
      source: [{ pathwayKey: 'T11 TEST ONLY', checkpointKey: 'T12.1 test import',
        segmentHash: 'synthetic-canonical-profile', evidence: { fileName: 'T12.3 PRODUCTION SMOKE.uddf' } }],
    } };
    const matches = findFixtureMatches(data);
    for (const path of ['skillKey', 'nested.source[0].pathwayKey', 'nested.source[0].checkpointKey',
      'nested.source[0].segmentHash', 'nested.source[0].evidence.fileName'])
      expect(matches.map((match) => match.field)).toContain(path);
    expect(discoverFixtureCandidates([snapshot('skill', 'x', data)])).toHaveLength(1);
  });

  it('ignores ordinary test usage and keeps a bare task marker review-only', () => {
    const rows = [snapshot('equipment', 'owner', { notes: 'Pressure test and regulator service completed.' }),
      snapshot('trip', 'possible', { notes: 'Read T12 guidance for future planning.' })];
    expect(discoverFixtureCandidates(rows)).toEqual([]);
    expect(discoverFixtureCandidates(rows, 'suspicious').map((item) => item.entityId)).toEqual(['possible']);
  });

  it('does not classify Liverpool wreck history or physical fixtures as test data', () => {
    const history = 'General cargo and the majority of ships removable fixtures and fittings sold.';
    const rows = [snapshot('site', 'liverpool', { name: 'Liverpool', history }),
      ...['fixtures and fittings', 'boat fixtures', 'wreck fixtures', 'mooring fixtures',
        'lighting fixtures', 'pipe fixtures', 'equipment fixtures', 'site fixtures',
        'wall fixtures', 'historical fixtures'].map((notes, index) =>
        snapshot('site', `ordinary-${index}`, { name: 'Real dive site', notes }))];
    expect(findFixtureMatches(rows[0]?.record ?? {})).toEqual([]);
    expect(discoverFixtureCandidates(rows, 'suspicious')).toEqual([]);
  });

  it('ignores routine service and medical testing language', () => {
    const phrases = ['hydro test', 'visual test', 'cylinder test', 'service test',
      'pressure test', 'test date', 'test certificate', 'tested equipment',
      'medical test', 'oxygen-clean test'];
    const rows = phrases.map((notes, index) => snapshot('equipment', `service-${index}`, { notes }));
    expect(discoverFixtureCandidates(rows, 'suspicious')).toEqual([]);
  });

  it('keeps explicit test-data fixture and production markers high confidence', () => {
    const phrases = ['acceptance fixture', 'synthetic fixture', 'test fixture',
      'fixture record', 'fixture cleanup', 'production fixture', 'T07 fixture',
      'T08 fixture', 'T09 fixture', 'T10 fixture', 'T10.5 fixture',
      'T10.6 fixture', 'T11 fixture', 'T12 fixture', 'T12.1 fixture',
      'T12.2 fixture', 'T12.3 acceptance fixture', 'T12 production smoke test profile',
      'TEST ONLY', 'PRODUCTION ACCEPTANCE ONLY'];
    for (const [index, name] of phrases.entries()) {
      const matches = discoverFixtureCandidates([snapshot('equipment', `fixture-${index}`, { name })]);
      expect(matches, name).toHaveLength(1);
      expect(matches[0]?.confidence, name).toBe('high');
    }
  });

  it('maps newer kinds to the owning page rather than generic Settings', () => {
    expect(recordDestination('gas-plan').destination).toBe('Gas Planning');
    for (const kind of ['computer-import', 'computer-profile', 'import-resolution'])
      expect(recordDestination(kind).destination).toBe('Dive Computer Imports');
    expect(recordDestination('computer-profile').label).toBe('Imported Profiles');
    for (const kind of ['question-review-state', 'learning-ai-checkpoint', 'learning-ai-advice'])
      expect(recordDestination(kind).destination).toBe('Dive Knowledge');
  });

  it('partitions high-confidence selected records without selecting anything by default', () => {
    const rows = [snapshot('gas-plan', 'gas-safe', { name: 'T12.3 TEST ONLY gas' }),
      snapshot('test-attempt', 'attempt', { name: 'T11 FIXTURE historical' }),
      snapshot('site', 'site-linked', { name: 'T10.5 FIXTURE site' }),
      snapshot('dive-trip', 'trip-real', { name: 'Real trip', siteIds: ['site-linked'] }),
      snapshot('equipment', 'eq-blocked', { name: 'T07 FIXTURE regulator' }),
      snapshot('dive', 'owner-dive', { name: 'Owner dive', equipmentSetId: 'eq-blocked' })];
    expect(buildSyntheticCleanupPlan([], rows).selectedIds).toEqual([]);
    expect(buildSyntheticCleanupPlan(['gas-safe', 'attempt', 'site-linked', 'eq-blocked', 'owner-dive'], rows))
      .toMatchObject({ deleteIds: ['gas-safe'], archiveIds: ['attempt'], unlinkThenDeleteIds: ['site-linked'],
        blocked: [{ id: 'eq-blocked' }] });
  });

  it('supports scalar/array unlink planning but protects immutable Dive provenance', () => {
    const supported = { sourceKind: 'dive-trip', sourceId: 'trip', sourceTitle: 'Trip', path: 'equipmentSetIds[0]' };
    expect(referenceCanUnlink(supported)).toBe(true);
    expect(referenceCanUnlink({ ...supported, path: 'cylinders[0].fillId' })).toBe(true);
    expect(referenceCanUnlink({ ...supported, sourceKind: 'dive', path: 'originatingPlanId' })).toBe(false);
    const original = { planId: 'fixture', equipmentSetIds: ['fixture', 'keep'], notes: 'fixture remains plain text' };
    const changed = unlinkTargetFromRecord(original, 'fixture');
    expect(changed).toMatchObject({ changed: true, record: { planId: null, equipmentSetIds: ['keep'], notes: original.notes } });
    expect(original.planId).toBe('fixture');
  });

  it('blocks suppression of protected synthetic evidence still referenced by a real owner record', () => {
    const rows = [snapshot('test-attempt', 'attempt-fixture', { title: 'T11 TEST ONLY' }),
      snapshot('professional-evidence', 'real-evidence', { title: 'Owner learning', evidenceIds: ['attempt-fixture'] })];
    const plan = buildSyntheticCleanupPlan(['attempt-fixture'], rows);
    expect(plan.archiveIds).toEqual([]);
    expect(plan.blocked).toContainEqual(expect.objectContaining({ id: 'attempt-fixture' }));
  });

  it('deletes an explicitly selected synthetic child chain child-first, not an unselected child', () => {
    const rows = [snapshot('gas-plan', 'parent', { name: 'T12.3 TEST ONLY parent' }),
      snapshot('dive-trip', 'child', { name: 'T12.3 TEST ONLY child', gasPlanIds: ['parent'] })];
    expect(buildSyntheticCleanupPlan(['parent'], rows).deleteIds).toEqual([]);
    expect(buildSyntheticCleanupPlan(['parent', 'child'], rows).deleteIds).toEqual(['child', 'parent']);
  });

  it('blocks cyclic synthetic relationships rather than partially deleting them', () => {
    const rows = [snapshot('gas-plan', 'a', { name: 'T12.3 FIXTURE A', planId: 'b' }),
      snapshot('trip', 'b', { name: 'T12.3 FIXTURE B', gasPlanIds: ['a'] })];
    const plan = buildSyntheticCleanupPlan(['a', 'b'], rows);
    expect(plan.deleteIds).toEqual([]);
    expect(plan.blocked).toHaveLength(2);
  });

  it('reports by kind, blocked reason, owner modifications and remaining suspicious records', () => {
    const report = cleanupReport([
      { kind: 'gas-plan', action: 'deleted' }, { kind: 'gas-plan', action: 'deleted' },
      { kind: 'test-attempt', action: 'archived' },
    ], 1, [{ id: 'blocked', reason: 'Immutable owner Dive' }], 1,
    [snapshot('equipment', 'owner', { notes: 'T12 guidance requires owner review' })]);
    expect(report).toEqual({ deletedByKind: { 'gas-plan': 2 }, archivedByKind: { 'test-attempt': 1 },
      unlinkedReferences: 1, blocked: [{ id: 'blocked', reason: 'Immutable owner Dive' }],
      ownerRecordsChanged: 1, remainingSuspicious: 1 });
  });

  it('keeps separate high/suspicious screens, explicit counts and owner confirmation in the UI', () => {
    const ui = readFileSync(resolve(process.cwd(), 'components/workflow/synthetic-fixture-review.tsx'), 'utf8');
    expect(ui).toContain('High-confidence synthetic cleanup');
    expect(ui).toContain('Possible synthetic · review needed');
    expect(ui).toContain("allCandidates.filter((item) => item.confidence === 'possible')");
    expect(ui).toContain('DELETE ${deletionPlan.deleteIds.length} SAFE RECORDS');
    expect(ui).toContain('UNLINK AND DELETE');
    expect(ui).toContain('Post-cleanup report');
    expect(ui).toContain('scanComplete');
  });
});

describe('T12.4 local-first suppression', () => {
  beforeEach(async () => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('navigator', { onLine: false });
    vi.stubGlobal('fetch', vi.fn());
    configureDiveStore('t12-4-test');
    await zeustekDb.open();
    for (const table of zeustekDb.tables) await table.clear();
  });

  it('hides suppressed fixtures from ordinary analytics/diagnostics/gas lists, but retains review/history', async () => {
    await saveLocalRecord('dive', { entityId: 'owner-1', name: 'Real owner Dive', date: '2026-09-10' });
    await saveLocalRecord('dive', archiveRecord({ entityId: 'fixture-1', name: 'T10 TEST ONLY dive', date: '2026-09-11' }));
    await saveLocalRecord('gas-plan', archiveRecord({ entityId: 'fixture-gas', name: 'T12.3 FIXTURE gas', cylinders: [] }));
    await saveLocalRecord('question-set', archiveRecord({ entityId: 'fixture-questions', name: 'T11 FIXTURE questions' }));
    expect((await listDives()).map((dive) => dive.entityId)).toEqual(['owner-1']);
    expect(await listGasPlans()).toEqual([]);
    expect(await listLocalDiveRecords('question-set')).toEqual([]);
    expect(await listLocalDiveRecords('dive', { includeSuppressed: true })).toHaveLength(2);
    expect(await listLocalDiveRecords('gas-plan', { includeSuppressed: true })).toHaveLength(1);
    expect(discoverFixtureCandidates([{ kind: 'gas-plan', record: (await listLocalDiveRecords<Record<string, unknown>>('gas-plan', { includeSuppressed: true }))[0]! }])).toEqual([]);
    await expect(zeustekDb.events.count()).resolves.toBeGreaterThanOrEqual(4);
  });
});
