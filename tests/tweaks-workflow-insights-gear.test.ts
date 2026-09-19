import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  INSIGHT_AWARD_COUNTS,
  INSIGHT_AWARD_DEFINITIONS,
  normaliseInsightAwardCount,
} from '../lib/insights/insight-awards';
import {
  selectAllDataPoints,
  selectNoDataPoints,
  toggleDataPoint,
} from '../lib/insights/data-point-selection';
import {
  DEFAULT_ANALYSIS_SCOPE,
  applyAnalysisScope,
  buildExperienceAnalyticsProjection,
  type DiveWithId,
} from '../lib/offline/experience-analytics';
import {
  resolveWorkflowRoute,
  workflowRoutesForSection,
} from '../lib/workflow/workflow-model';

const read = (path: string) => readFileSync(path, 'utf8');

const dive = (id: string, patch: Partial<DiveWithId> = {}): DiveWithId => ({
  entityId: id,
  site: 'St Abbs',
  siteId: 'site-1',
  date: '2026-09-01',
  maxDepthM: 20,
  averageDepthM: 12,
  totalElapsedMin: 45,
  gas: 'Air',
  notes: '',
  source: 'manual',
  createdAt: '2026-09-01T10:00:00Z',
  modifiedAt: '2026-09-01T11:00:00Z',
  ...patch,
} as DiveWithId);

describe('TWEAKS workflow, Insights and Gear acceptance', () => {
  it('keeps the split planning workflow and legacy deep links', () => {
    expect(workflowRoutesForSection('trip-event-planning').map((route) => route.label)).toEqual([
      'Diving Calendar & Bookings', 'Trips & Expeditions', 'Bucket List',
    ]);
    expect(workflowRoutesForSection('dive-preparation').map((route) => route.label)).toEqual([
      'Dive Planning Centre', 'Gas Planning',
    ]);
    expect(workflowRoutesForSection('diving-cpd').map((route) => route.label)).toContain('Technical Diving');
    expect(resolveWorkflowRoute('Loadouts & Cylinder Gas')).toBe('Loadouts & Gas');
    expect(resolveWorkflowRoute('Cylinder Gas')).toBe('Cylinders & Gas');
  });

  it('offers the required award counts and a broad owner-configurable catalogue', () => {
    expect(INSIGHT_AWARD_COUNTS).toEqual([4, 8, 12, 16, 20]);
    expect(normaliseInsightAwardCount(20)).toBe(20);
    expect(normaliseInsightAwardCount(7)).toBe(8);
    const labels = INSIGHT_AWARD_DEFINITIONS.map((definition) => definition[1]);
    expect(labels).toContain('Total dives logged');
    expect(labels).toContain('Highest technical certification');
    expect(labels).toContain('Wreck penetration dives');
    expect(labels).toContain('Unknown / other dives');
    expect(labels.length).toBeGreaterThanOrEqual(20);
    const dashboard = read('app/dashboard-client.tsx');
    const insights = read('components/experience-analytics.tsx');
    expect(dashboard).toContain('INSIGHT_AWARD_COUNTS.map');
    expect(insights).not.toContain('INSIGHT_AWARD_COUNTS.map');
    expect(insights).not.toContain('Layout choice is local to this view');
    const styles = read('components/experience-analytics.module.css');
    expect(styles).toContain('justify-content: center');
    expect(styles).toContain('flex: 0 0 12.5%');
    expect(styles).toContain('flex-basis: 25%');
  });

  it('keeps Overview at-a-glance without duplicating the Insights awards grid', () => {
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain('NEXT DIVE');
    expect(dashboard).toContain('MY PROFILE');
    expect(dashboard).toContain('TOP DIVE BUDDY');
    expect(dashboard).toContain('Equipment status');
    expect(dashboard).toContain('HOME DIVE FORECASTS');
    expect(dashboard).not.toContain('<div className="overview-awards-grid">');
  });

  it('keeps pressure SAC separate from volume RMV and reports both trends', () => {
    const projection = buildExperienceAnalyticsProjection([
      dive('one', { sacRate: 1.4, rmvRate: 17.2 }),
      dive('two', { sacRate: 1.8, rmvRate: 19.4, date: '2026-09-02' }),
    ], [], []);
    expect(projection.headlines.averageSacBarMin.value).toBe(1.6);
    expect(projection.headlines.averageRmvLMin.value).toBeCloseTo(18.3);
    expect(projection.sacTrend.map((point) => point.sacBarMin)).toEqual([1.4, 1.8]);
    expect(projection.rmvTrend.map((point) => point.rmvLMin)).toEqual([17.2, 19.4]);
    const component = read('components/experience-analytics.tsx');
    expect(component).toContain('SAC is shown in bar/min');
    expect(component).toContain('RMV is tank-independent L/min');
    expect(component).not.toContain('QUALIFYING-DIVE PROGRESS');
    expect(component).not.toContain('<AnalyticsCard title="READINESS"');
  });

  it('supports select/exclude data points and expanded dashboard filtering without changing Dives', () => {
    const all = selectAllDataPoints(['a', 'b', 'c']);
    expect(toggleDataPoint(all, 'b')).toEqual({ mode: 'many', selectedIds: ['a', 'c'], excludedIds: ['b'] });
    expect(selectNoDataPoints(['a', 'a', 'b']).excludedIds).toEqual(['a', 'b']);
    const source = [dive('a'), dive('b', { maxDepthM: 35 })];
    const original = structuredClone(source);
    expect(applyAnalysisScope(source, { ...DEFAULT_ANALYSIS_SCOPE, excludedDiveIds: ['a'], minDepthM: 30 }).map((row) => row.entityId)).toEqual(['b']);
    expect(source).toEqual(original);
    const component = read('components/experience-analytics.tsx');
    expect(component).toContain('Apply to dashboard');
    expect(component).toContain('placeholder="Search Sites"');
    expect(component).toContain('Minimum depth');
  });

  it('keeps individual Equipment, removes gas ownership from Loadouts, and exposes a cylinder table/detail history', () => {
    const dashboard = read('app/dashboard-client.tsx');
    const workspace = read('components/loadouts-gas.tsx');
    expect(dashboard).toContain("active === 'Equipment' && <Equipment />");
    expect(dashboard).toContain("active === 'Loadouts & Gas' && <Loadouts />");
    expect(dashboard).toContain("active === 'Cylinders & Gas' && <CylindersGas />");
    expect(workspace).toContain('Cylinder fills and analyses live in their own workspace.');
    expect(workspace).toContain('<table className={styles.cylinderTable}>');
    expect(workspace).toContain('O₂ cleaned');
    expect(workspace).toContain('Fill location');
    expect(workspace).toContain('Hydro: 5 years');
    expect(workspace).toContain('Visual: 30 months');
    expect(workspace).toContain('optional 12–15 months');
    expect(workspace).toContain('<MediaGallery');
    expect(workspace).toContain("event.key === 'Enter' || event.key === ' '");
  });
});
