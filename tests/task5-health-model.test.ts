import { describe, expect, it, vi } from 'vitest';
import { evaluateDataHealth, createDataHealthReport } from '../lib/data-health/health-model';
import { DATA_REVIEW_KINDS, type OwnerDataSnapshot } from '../lib/data-health/read-owner-snapshot';
import type { CanonicalSkillRecord, SkillEvidenceRecord } from '../lib/offline/dive-context';
import type { ComputerProfileRecord } from '../lib/offline/computer-import';
import type { PersonEntityLink, EntityRelation } from '../lib/operators/entity-relationships';

const snapshotAt = '2026-10-02T12:00:00Z';
const record = (kind: string, id: string, data: Record<string, unknown>) => ({ kind, id, data: { entityId: id, ...data } });
const snapshot = (records: OwnerDataSnapshot['records'], completeKinds: readonly string[] = DATA_REVIEW_KINDS, imageEvidence: OwnerDataSnapshot['imageEvidence'] = []): OwnerDataSnapshot => ({
  accountId: 'fixture-owner', snapshotAt, records, completeKinds,
  coverage: DATA_REVIEW_KINDS.map(kind => ({ kind, inspected: records.filter(row => row.kind === kind).length, state: completeKinds.includes(kind) ? 'complete' : 'unknown', reasons: completeKinds.includes(kind) ? [] : ['not-cached'] })),
  imageEvidence,
});
const findings = (result: ReturnType<typeof evaluateDataHealth>, checkId: string, reason?: string) => result.findings.filter(row => row.checkId === checkId && (!reason || row.reason === reason));
const count = (result: ReturnType<typeof evaluateDataHealth>, checkId: string, reason: string) => findings(result, checkId, reason).reduce((total, row) => total + row.count, 0);
const destinations = (result: ReturnType<typeof evaluateDataHealth>, checkId: string, reason: string) => findings(result, checkId, reason).flatMap(row => row.destinations);
const skill = (id: string, data: Partial<CanonicalSkillRecord> = {}) => record('skill', id, { name: 'Dummy Skill', ...data });
const evidence = (id: string, skillKey: string, data: Partial<SkillEvidenceRecord> = {}) => record('skill_evidence', id, { skillKey, performedAt: '2026-10-01', ...data });
const profile = (id: string, disposition: ComputerProfileRecord['disposition'], targetDiveId: string | null = null) => record('computer-profile', id, {
  importId: 'import-fixture', sourceDiveId: 'source-fixture', sourceSiteId: null, segmentHash: `hash-${id}`, disposition, targetDiveId,
  sampleAttachmentId: null, summary: { rawTimestamp: null, normalisedTimestamp: null, greatestDepthM: null, sourceDurationSec: null, finalSampleElapsedSec: null, minimumTemperatureC: null, ballastKg: null, gasId: null, tankPressureBeginBar: null, tankPressureEndBar: null, waypointCount: 0 }, preview: [],
});

describe('bounded canonical data-health references', () => {
  it('routes a retained equipment event to its actual canonical cylinder or equipment parent',()=>{
    const result=evaluateDataHealth(snapshot([record('cylinder','tank',{}),record('equipment','regulator',{}),record('equipment-event','tank-event',{equipmentId:'tank',occurredAt:'invalid'}),record('equipment-event','gear-event',{equipmentId:'regulator',occurredAt:'invalid'})]));
    const sources=destinations(result,'dates','invalid-date');
    expect(sources).toContainEqual({route:'Cylinders & Gas',recordId:'tank',params:{cylinderId:'tank',eventId:'tank-event'}});
    expect(sources).toContainEqual({route:'Equipment',recordId:'regulator',params:{equipmentId:'regulator',eventId:'gear-event'}});
  });
  it('checks a booking training endpoint against the cached canonical progress kind',()=>{
    const source=[record('trip','booking',{startDate:'2026-10-01',linkedTrainingId:'progress'}),record('training-progress','progress',{courseName:'Recorded course'})];
    expect(findings(evaluateDataHealth(snapshot(source)),'references')).toEqual([]);
    expect(count(evaluateDataHealth(snapshot(source.filter(row=>row.kind!=='training-progress'))),'references','missing-reference')).toBe(1);
    expect(count(evaluateDataHealth(snapshot(source.filter(row=>row.kind!=='training-progress'),DATA_REVIEW_KINDS.filter(kind=>kind!=='training-progress'))),'references','reference-unverified')).toBe(1);
  });
  it('does not treat a supplied suppressed historical endpoint as deleted',()=>{
    const result=evaluateDataHealth(snapshot([skill('historical',{suppressedFromUse:true} as Partial<CanonicalSkillRecord>),evidence('linked-history','historical')]));
    expect(findings(result,'references')).toEqual([]);expect(result.totalChecked).toBe(1);
  });
  it('proves a missing endpoint only when its canonical kind has complete local coverage', () => {
    const source = snapshot([record('dive', 'dive-fixture', { date: '2026-10-01', siteId: 'missing-site' })]);
    const result = evaluateDataHealth(source);
    expect(count(result, 'references', 'missing-reference')).toBe(1);
    expect(findings(result, 'references', 'missing-reference')[0]).toMatchObject({ severity: 'warning' });
    expect(destinations(result, 'references', 'missing-reference')).toContainEqual(expect.objectContaining({ route: 'Logbook', recordId: 'dive-fixture', params: expect.objectContaining({ diveId: 'dive-fixture' }) }));
    expect(result).toMatchObject({ snapshotAt, coverageUnknown: false, totalChecked: 1 });
  });

  it('uses Unknown for an absent endpoint when a target kind was not fully cached', () => {
    const result = evaluateDataHealth(snapshot([record('dive', 'dive-fixture', { date: '2026-10-01', siteId: 'missing-site' })], DATA_REVIEW_KINDS.filter(kind => kind !== 'site')));
    expect(count(result, 'references', 'missing-reference')).toBe(0);
    expect(count(result, 'references', 'reference-unverified')).toBe(1);
    expect(findings(result, 'references', 'reference-unverified')[0]).toMatchObject({ severity: 'unknown' });
    expect(result.coverageUnknown).toBe(true);
  });

  it.each(['canonical-entity-id', 'stable-skill-key', 'legacy-key'])('resolves the saved Skill reference %s without requiring copied labels', reference => {
    // CSV skill_id denotes entityId; the stored resolver additionally accepts skillKey and key.
    const result = evaluateDataHealth(snapshot([
      skill('canonical-entity-id', { skillKey: 'stable-skill-key', key: 'legacy-key', archived: true, archivedAt: '2026-09-01T00:00:00Z' }),
      evidence('evidence-fixture', reference),
    ]));
    expect(findings(result, 'references')).toEqual([]);
  });

  it('keeps missing Skill evidence navigation on the evidence row, even when the target alias is unavailable', () => {
    const result = evaluateDataHealth(snapshot([evidence('evidence-fixture', 'missing-alias')]));
    expect(count(result, 'references', 'missing-reference')).toBe(1);
    expect(destinations(result, 'references', 'missing-reference')).toContainEqual(expect.objectContaining({ route: 'Skills & Currency', params: expect.objectContaining({ evidenceId: 'evidence-fixture' }) }));
    expect(JSON.stringify(destinations(result, 'references', 'missing-reference'))).not.toContain('missing-alias');
  });

  it('does not mistake a Person with the same ID for a required operator endpoint', () => {
    const link = { personId: 'person-fixture', operatorId: 'wrong-kind', role: 'Associated', active: true } satisfies PersonEntityLink;
    const result = evaluateDataHealth(snapshot([
      record('person', 'person-fixture', { name: 'Dummy Person' }), record('person', 'wrong-kind', { name: 'Dummy Person sharing an endpoint ID' }),
      record('person-operator-link', 'person-link-fixture', link),
    ]));
    expect(count(result, 'references', 'missing-reference')).toBe(1);
    expect(destinations(result, 'references', 'missing-reference')).toContainEqual(expect.objectContaining({ route: 'People', recordId: 'person-fixture', params: expect.objectContaining({ personId: 'person-fixture' }) }));
  });

  it.each(['fromOperatorId', 'toOperatorId'] as const)('checks the actual operator relationship field %s', missingField => {
    const relation = { fromOperatorId: 'from-fixture', toOperatorId: 'to-fixture', relationType: 'associated-with', active: true } satisfies EntityRelation;
    const missingId = relation[missingField];
    const result = evaluateDataHealth(snapshot([
      record('operator', missingField === 'fromOperatorId' ? 'to-fixture' : 'from-fixture', { name: 'Dummy Entity' }),
      record('person', missingId, { name: 'Wrong endpoint kind' }), record('operator-operator-link', 'relation-fixture', relation),
    ]));
    expect(count(result, 'references', 'missing-reference')).toBe(1);
    expect(destinations(result, 'references', 'missing-reference')).toContainEqual(expect.objectContaining({ route: 'Dive Centres', recordId: 'from-fixture', params: expect.objectContaining({ operatorId: 'from-fixture' }) }));
  });

  it('retains historical relationship endpoints and archived Skills as existing references', () => {
    const result = evaluateDataHealth(snapshot([
      record('person', 'person-fixture', { name: 'Dummy Person', operatorId: 'operator-fixture', currentDiveOperatorId: 'operator-fixture' }),
      record('operator', 'operator-fixture', { name: 'Dummy Operator' }),
      record('person-operator-link', 'ended-fixture', { personId: 'person-fixture', operatorId: 'operator-fixture', role: 'Associated', active: false, startDate: '2025-01-01', endDate: '2025-12-31' }),
      skill('archived-fixture', { archived: true }), evidence('evidence-fixture', 'archived-fixture'),
    ]));
    expect(findings(result, 'references')).toEqual([]);
  });

  it('scans declared canonical reference fields rather than arbitrary ID-shaped private text', () => {
    const result = evaluateDataHealth(snapshot([record('dive', 'dive-fixture', {
      date: '2026-10-01', notes: 'operatorId: missing-private', contact: { personId: 'missing-contact' }, ownerPrivateDraft: { equipmentIds: ['missing-draft'] },
    })]));
    expect(findings(result, 'references')).toEqual([]);
  });
});

describe('canonical date and import evidence', () => {
  it('accepts normal canonical Skill evidence ISO timestamps without discarding calendar-day imports',()=>{
    const result=evaluateDataHealth(snapshot([skill('s'),evidence('timed','s',{performedAt:'2026-08-01T12:00:00Z'}),evidence('day','s',{performedAt:'2026-08-01'})]));
    expect(findings(result,'dates','invalid-date')).toEqual([]);
  });
  it('does not assume a UK timezone for unzoned international wall-clock timestamps',()=>{
    const result=evaluateDataHealth(snapshot([record('trip','spring-local',{startDate:'2026-03-29',endDate:'',startAt:'2026-03-29T01:30',endAt:'2026-03-29T02:30'})]));
    expect(findings(result,'dates','invalid-date')).toEqual([]);
    expect(findings(result,'dates','reversed-date')).toEqual([]);
  });
  it('keeps mixed wall-clock and offset range ordering Unknown rather than assuming the device timezone',()=>{
    const result=evaluateDataHealth(snapshot([record('trip','mixed-zone',{startDate:'2026-10-10',endDate:'2026-10-10',startAt:'2026-10-10T10:00',endAt:'2026-10-10T08:00Z'})]));
    expect(findings(result,'dates','reversed-date')).toEqual([]);
    expect(findings(result,'dates','date-order-unverified')[0]).toMatchObject({severity:'unknown'});
  });
  it('distinguishes required missing dates, impossible days, reversed ranges and saved date/time conflicts', () => {
    const result = evaluateDataHealth(snapshot([
      record('dive', 'undated-fixture', { date: '' }),
      record('dive', 'impossible-fixture', { date: '2026-02-30' }),
      record('trip', 'reversed-fixture', { startDate: '2026-10-10', endDate: '2026-10-09' }),
      record('trip', 'conflict-fixture', { startDate: '2026-10-10', startAt: '2026-10-11T10:00', endDate: '' }),
    ]));
    for (const reason of ['missing-date', 'invalid-date', 'reversed-date', 'conflicting-date']) {
      expect(count(result, 'dates', reason)).toBe(1);
      expect(findings(result, 'dates', reason)[0]).toMatchObject({ severity: 'warning' });
    }
    expect(destinations(result, 'dates', 'missing-date')).toContainEqual(expect.objectContaining({ route: 'Logbook', params: expect.objectContaining({ diveId: 'undated-fixture' }) }));
    expect(destinations(result, 'dates', 'reversed-date')).toContainEqual(expect.objectContaining({ route: 'Dive Plans', params: expect.objectContaining({ planId: 'reversed-fixture' }) }));
  });

  it('does not turn optional absent expiry or correctly recorded month precision into an invalid day', () => {
    const result = evaluateDataHealth(snapshot([
      record('certification', 'no-expiry-fixture', { issuedAt: '2024-02-29', expiresAt: '' }),
      record('cylinder', 'month-fixture', { hydroTestAt: '2021-10', visualTestAt: '2024-04' }),
      record('trip', 'start-only-fixture', { startDate: '2026-10-10', endDate: '', startAt: '2026-10-10T10:00' }),
    ]));
    expect(findings(result, 'dates', 'invalid-date')).toEqual([]);
    expect(findings(result, 'dates', 'missing-date')).toEqual([]);
    expect(findings(result, 'dates', 'conflicting-date')).toEqual([]);
  });

  it('checks qualification range order and expeditions using their own canonical date fields', () => {
    const result = evaluateDataHealth(snapshot([
      record('certification', 'award-fixture', { issuedAt: '2026-10-10', expiresAt: '2026-10-09' }),
      record('dive-trip', 'expedition-fixture', { startsOn: '2026-10-10', endsOn: '2026-10-09', status: 'planned' }),
    ]));
    expect(count(result, 'dates', 'reversed-date')).toBe(2);
    expect(destinations(result, 'dates', 'reversed-date')).toEqual(expect.arrayContaining([
      expect.objectContaining({ route: 'Training', params: expect.objectContaining({ certificationId: 'award-fixture' }) }),
      expect.objectContaining({ route: 'Trips', params: expect.objectContaining({ tripId: 'expedition-fixture' }) }),
    ]));
  });

  it('finds unresolved profiles from disposition, without inventing an import state or reopening exclusions', () => {
    const result = evaluateDataHealth(snapshot([
      record('computer-import', 'import-fixture', { adapterKey: 'oceanic-uddf', fileHash: 'dummy-hash', importedAt: '2026-10-01T00:00:00Z', segmentHashes: [] }),
      record('dive', 'target-fixture', { date: '2026-10-01' }),
      profile('unlinked-fixture', 'unlinked'), profile('linked-fixture', 'linked', 'target-fixture'),
      profile('created-fixture', 'created', 'target-fixture'), profile('excluded-fixture', 'excluded'),
    ]));
    expect(count(result, 'imports', 'unresolved-import')).toBe(1);
    expect(findings(result, 'imports', 'unresolved-import')[0]).toMatchObject({ severity: 'warning' });
    expect(destinations(result, 'imports', 'unresolved-import')).toContainEqual(expect.objectContaining({ route: 'Dive Computer Imports', params: expect.objectContaining({ importId: 'import-fixture', profileId: 'unlinked-fixture' }) }));
    expect(findings(result, 'references')).toEqual([]);
  });

  it('preserves archived/superseded resolution history instead of treating it as a current missing endpoint', () => {
    const result = evaluateDataHealth(snapshot([
      record('import-resolution', 'archived-resolution-fixture', { importId: 'old-import', targetDiveId: 'removed-dive', sourceProfileIds: ['old-profile'], decisions: [], archivedAt: '2026-09-01T00:00:00Z', archiveReason: 'Target removed' }),
      record('import-resolution', 'superseded-resolution-fixture', { importId: 'old-import', targetDiveId: 'removed-dive', sourceProfileIds: ['old-profile'], decisions: [], supersededAt: '2026-09-02T00:00:00Z' }),
    ]));
    expect(findings(result, 'references', 'missing-reference')).toEqual([]);
    expect(findings(result, 'imports', 'unresolved-import')).toEqual([]);
  });
});

describe('local image evidence and strict shareable reports', () => {
  const pointer = { attachmentId: 'private-attachment-id', remoteKey: 'private/remote/path', zoom: 1, x: 50, y: 50 };

  it('keeps a declared card pointer Unknown when no local evidence was supplied', () => {
    const result = evaluateDataHealth(snapshot([record('certification', 'award-fixture', { issuedAt: '2026-01-01', expiresAt: '', cardFront: pointer })]));
    expect(count(result, 'images', 'image-unverified')).toBe(1);
    expect(count(result, 'images', 'image-missing')).toBe(0);
    expect(findings(result, 'images', 'image-unverified')[0]).toMatchObject({ severity: 'unknown' });
    expect(destinations(result, 'images', 'image-unverified')).toContainEqual(expect.objectContaining({ route: 'Training', params: expect.objectContaining({ certificationId: 'award-fixture' }) }));
  });

  it('separates local presence from remote uncertainty and declared local unavailability', () => {
    const result = evaluateDataHealth(snapshot([
      record('certification', 'award-fixture', { issuedAt: '2026-01-01', expiresAt: '', cardFront: pointer, cardBack: { attachmentId: 'local-missing', zoom: 1, x: 50, y: 50 } }),
      record('person', 'person-fixture', { name: 'Dummy Person', profileImage: pointer }),
      record('site', 'site-fixture', { name: 'Dummy Site', diveMapImage: pointer }),
    ], DATA_REVIEW_KINDS, [
      { recordId: 'award-fixture', field: 'cardFront', state: 'local-present' },
      { recordId: 'award-fixture', field: 'cardBack', state: 'missing' },
      { recordId: 'person-fixture', field: 'profileImage', state: 'remote-unverified' },
      { recordId: 'site-fixture', field: 'diveMapImage', state: 'remote-unverified' },
    ]));
    expect(count(result, 'images', 'image-missing')).toBe(1);
    expect(findings(result, 'images', 'image-missing')[0]).toMatchObject({ severity: 'warning' });
    expect(count(result, 'images', 'image-unverified')).toBe(2);
    expect(JSON.stringify(findings(result, 'images'))).not.toMatch(/private-attachment-id|private\/remote\/path|local-missing/);
    expect(JSON.stringify(result)).not.toMatch(/decode verified|serviceable|safe to dive|ready to dive|proficiency/i);
  });

  it('does not report undeclared images as missing', () => {
    const result = evaluateDataHealth(snapshot([record('certification', 'award-fixture', { issuedAt: '2026-01-01', expiresAt: '', cardFront: null, cardBack: null })]));
    expect(findings(result, 'images')).toEqual([]);
  });

  it('explains incomplete local coverage without asserting an exhaustive clean data set', () => {
    const result = evaluateDataHealth(snapshot([], ['dive']));
    expect(result).toMatchObject({ coverageUnknown: true, totalChecked: 0, snapshotAt });
    expect(findings(result, 'coverage', 'coverage-unknown').length).toBeGreaterThan(0);
    expect(findings(result, 'coverage').every(row => row.severity === 'unknown')).toBe(true);
    expect(JSON.stringify(createDataHealthReport(result))).toMatch(/unknown|unverified|incomplete/i);
  });

  it('produces only a fixed safe report DTO, even if callers add private fields to a legitimate result', () => {
    const source = snapshot([record('dive', 'PRIVATE-RECORD-ID', { date: '', siteId: 'PRIVATE-SITE-ID', name: 'PRIVATE-NAME', notes: 'PRIVATE-NOTES', email: 'PRIVATE-CONTACT', attachmentId: 'PRIVATE-ASSET', refreshToken: 'PRIVATE-SECRET' })]);
    const result = evaluateDataHealth(source);
    const clean = createDataHealthReport(result);
    const contaminated = { ...result, accountId: 'PRIVATE-ACCOUNT', name: 'PRIVATE-NAME', rawRecords: source.records, token: 'PRIVATE-SECRET', findings: result.findings.map(row => ({ ...row, summary: 'PRIVATE-SUMMARY', notes: 'PRIVATE-NOTES', filenames: ['PRIVATE-FILE.png'], raw: source.records })) };
    expect(createDataHealthReport(contaminated)).toEqual(clean);
    const text = JSON.stringify(clean);
    expect(text).not.toMatch(/PRIVATE-|destinations|recordId|personId|attachment|filename|rawRecords|refreshToken/);
    expect(text).toContain('references');
    expect(text).toContain('dates');
    expect(text).toContain(snapshotAt);
  });

  it('does not echo an untrusted check ID or reason into a report summary', () => {
    const result = evaluateDataHealth(snapshot([]));
    const poisoned = { ...result, findings: [{ checkId: 'PRIVATE-CHECK', reason: 'PRIVATE-REASON', severity: 'warning', count: 1, destinations: [], summary: 'PRIVATE-TEXT' }] };
    const text = JSON.stringify(createDataHealthReport(poisoned as unknown as typeof result));
    expect(text).not.toMatch(/PRIVATE-/);
  });

  it('evaluates and reports without provider reads, mutation or repair effects', () => {
    const source = snapshot([record('dive', 'dive-fixture', { date: '2026-02-30', notes: 'Retain verbatim private notes' })]);
    const original = structuredClone(source);
    const provider = vi.fn(() => { throw new Error('No provider operation is permitted'); });
    vi.stubGlobal('fetch', provider);
    try {
      const first = evaluateDataHealth(source);
      expect(evaluateDataHealth(source)).toEqual(first);
      createDataHealthReport(first);
      expect(source).toEqual(original);
      expect(provider).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });
});
