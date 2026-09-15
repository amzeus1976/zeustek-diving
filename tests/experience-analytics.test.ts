import { describe, expect, it } from 'vitest';
import type { DiveSiteRecord, Stored } from '../lib/offline/dive-planning';
import type { ReusableLoadoutRecord } from '../lib/offline/loadouts-gas';
import {
  DEFAULT_ANALYSIS_SCOPE,
  applyAnalysisScope,
  buildExperienceAnalyticsProjection,
  compareDepthBandsByWater,
  depthBandProjection,
  diveSacLitresPerMinute,
  environmentProjection,
  headlineAnalytics,
  insightsExportEnvelope,
  waterTypeProjection,
  type DiveWithId,
} from '../lib/offline/experience-analytics';

const base = (id: string, patch: Partial<DiveWithId> = {}): DiveWithId => ({
  entityId: id,
  site: 'St Abbs',
  siteId: 'site-1',
  date: '2026-09-01',
  timeIn: '10:00',
  timeOut: '10:45',
  maxDepthM: 20,
  averageDepthM: 12,
  bottomTimeMin: 40,
  totalElapsedMin: 45,
  gas: 'Air',
  notes: '',
  source: 'manual',
  waterType: 'Saltwater',
  diveMode: 'recreational',
  createdAt: '2026-09-01T10:00:00Z',
  modifiedAt: '2026-09-01T11:00:00Z',
  ...patch,
});
const sites = [{ entityId: 'site-1', name: 'St Abbs' }] as Array<
  Stored<DiveSiteRecord>
>;
const loadouts = [
  {
    entityId: 'set-1',
    name: 'Cold water',
    equipmentIds: [],
    notes: '',
    createdAt: '2026-08-01T10:00:00Z',
    modifiedAt: '2026-08-01T10:00:00Z',
  },
] satisfies Array<Stored<ReusableLoadoutRecord>>;

describe('T09 derived Experience & Analytics', () => {
  it('filters pool and training dives without modifying source data', () => {
    const dives = [
      base('a'),
      base('b', { diveTypes: ['Pool'] }),
      base('c', { diveMode: 'recreational-training' }),
    ];
    const original = structuredClone(dives);
    const filtered = applyAnalysisScope(dives, {
      ...DEFAULT_ANALYSIS_SCOPE,
      includePool: false,
      includeTraining: false,
    });
    expect(filtered.map((d) => d.entityId)).toEqual(['a']);
    expect(dives).toEqual(original);
  });

  it('never turns missing depth or SAC values into zero', () => {
    const dives = [
      base('a', { averageDepthM: null, rmvRate: null, cylinders: [] }),
      base('b', { averageDepthM: 18, rmvRate: 16 }),
    ];
    const metrics = headlineAnalytics(dives, new Date('2026-09-15T12:00:00Z'));
    expect(metrics.averageDepthM.value).toBe(18);
    expect(metrics.averageDepthM.denominator).toBe(1);
    expect(metrics.averageDepthM.missingCount).toBe(1);
    expect(metrics.averageSacLMin.value).toBe(16);
    expect(metrics.averageSacLMin.denominator).toBe(1);
  });

  it('uses RMV L/min and does not reinterpret pressure SAC as L/min', () => {
    expect(
      diveSacLitresPerMinute(base('a', { rmvRate: 17.2, sacRate: 1.4 })),
    ).toBe(17.2);
    expect(
      diveSacLitresPerMinute(
        base('b', { rmvRate: null, sacRate: 1.4, cylinders: [] }),
      ),
    ).toBeNull();
    expect(
      diveSacLitresPerMinute(
        base('c', {
          cylinders: [
            {
              id: 'c',
              name: '12L',
              gasType: 'Air',
              oxygenPercent: 21,
              heliumPercent: 0,
              configuration: 'Single Tank',
              material: 'Steel',
              size: '12L',
              startPressureBar: 200,
              endPressureBar: 80,
              switchDepthM: null,
              switchRuntimeMin: null,
              rmvRate: 15.5,
            },
          ],
        }),
      ),
    ).toBe(15.5);
  });

  it('builds deterministic depth bands and salt/fresh comparison', () => {
    const dives = [
      base('a', { maxDepthM: 9, waterType: 'Saltwater' }),
      base('b', { maxDepthM: 18, waterType: 'Freshwater' }),
      base('c', { maxDepthM: 31, waterType: 'Saltwater' }),
      base('d', { maxDepthM: 55, waterType: 'Freshwater' }),
    ];
    expect(depthBandProjection(dives).map((row) => row.count)).toEqual([
      1, 1, 0, 1, 0, 1,
    ]);
    const comparison = compareDepthBandsByWater(dives);
    expect(comparison[0]).toMatchObject({ saltwater: 1, freshwater: 0 });
    expect(comparison[1]).toMatchObject({ saltwater: 0, freshwater: 1 });
    expect(comparison[5]).toMatchObject({ saltwater: 0, freshwater: 1 });
  });

  it('respects date, water, site and equipment-set scope', () => {
    const dives = [
      base('a', { date: '2026-08-01', equipmentSetIds: ['set-1'] }),
      base('b', {
        date: '2026-09-01',
        waterType: 'Freshwater',
        siteId: 'site-2',
        equipmentSetIds: ['set-2'],
      }),
    ];
    const filtered = applyAnalysisScope(dives, {
      ...DEFAULT_ANALYSIS_SCOPE,
      dateFrom: '2026-08-15',
      waterTypes: ['Freshwater'],
      siteIds: ['site-2'],
      equipmentSetIds: ['set-2'],
    });
    expect(filtered.map((d) => d.entityId)).toEqual(['b']);
  });

  it('keeps water type separate from Dive environment/activity', () => {
    const dives = [
      base('salt-quarry', { waterType: 'Saltwater', diveTypes: ['Quarry'] }),
      base('fresh-boat', { waterType: 'Freshwater', diveTypes: ['Boat'] }),
      base('unknown', { waterType: '', diveTypes: [] }),
    ];
    expect(
      waterTypeProjection(dives).map((row) => [row.label, row.count]),
    ).toEqual([
      ['Freshwater', 1],
      ['Other / unknown', 1],
      ['Saltwater', 1],
    ]);
    expect(
      environmentProjection(dives).map((row) => [row.label, row.count]),
    ).toEqual([
      ['Boat', 1],
      ['Other / unknown', 1],
      ['Quarry', 1],
    ]);
    expect(
      applyAnalysisScope(dives, {
        ...DEFAULT_ANALYSIS_SCOPE,
        waterTypes: ['Other'],
      }).map((dive) => dive.entityId),
    ).toEqual(['unknown']);
  });

  it('builds loadout and site drill-down IDs from canonical references', () => {
    const dives = [
      base('a', { equipmentSetId: 'set-1' }),
      base('b', { equipmentSetIds: ['set-1'] }),
    ];
    const projection = buildExperienceAnalyticsProjection(
      dives,
      sites,
      loadouts,
    );
    expect(projection.equipmentSetUsage[0]).toMatchObject({
      equipmentSetId: 'set-1',
      dives: 2,
      diveIds: ['a', 'b'],
    });
    expect(projection.siteUsage[0]).toMatchObject({
      siteId: 'site-1',
      dives: 2,
      diveIds: ['a', 'b'],
    });
  });

  it('exports provenance and denominator without creating analytics entities', () => {
    const projection = buildExperienceAnalyticsProjection(
      [base('a')],
      sites,
      loadouts,
    );
    const exported = insightsExportEnvelope(
      projection,
      new Date('2026-09-15T00:00:00Z'),
    );
    expect(exported.format).toBe('zeustek-derived-insights');
    expect(exported.canonicalDataChanged).toBe(false);
    expect(exported.denominator).toEqual({
      availableDives: 1,
      includedDives: 1,
      excludedDives: 0,
    });
    expect(exported.waterTypeSplit[0]).toMatchObject({
      label: 'Saltwater',
      count: 1,
      diveIds: ['a'],
    });
    expect(exported.provenance.analytics).toBe('calculated');
  });
});
