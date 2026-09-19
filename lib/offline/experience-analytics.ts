import type { DiveRecord } from './dives';
import type { ReusableLoadoutRecord } from './loadouts-gas';
import type { DiveSiteRecord, Stored } from './dive-planning';

export type DiveWithId = DiveRecord & { entityId: string };
export type AnalysisWaterType =
  | 'Saltwater'
  | 'Freshwater'
  | 'Brackish'
  | 'Other';
export type AnalysisDiveMode = NonNullable<DiveRecord['diveMode']>;

export interface AnalysisScope {
  dateFrom: string | null;
  dateTo: string | null;
  includePool: boolean;
  includeTraining: boolean;
  diveModes: AnalysisDiveMode[];
  waterTypes: AnalysisWaterType[];
  siteIds: string[];
  equipmentSetIds: string[];
  excludedDiveIds: string[];
  minDepthM: number | null;
  maxDepthM: number | null;
  minTimeMin: number | null;
  maxTimeMin: number | null;
  includeShore: boolean;
  includeBoat: boolean;
  includeNight: boolean;
  includeUnknownOther: boolean;
}

export const DEFAULT_ANALYSIS_SCOPE: AnalysisScope = {
  dateFrom: null,
  dateTo: null,
  includePool: true,
  includeTraining: true,
  diveModes: [],
  waterTypes: [],
  siteIds: [],
  equipmentSetIds: [],
  excludedDiveIds: [],
  minDepthM: null,
  maxDepthM: null,
  minTimeMin: null,
  maxTimeMin: null,
  includeShore: true,
  includeBoat: true,
  includeNight: true,
  includeUnknownOther: true,
};

export interface MetricObservation {
  value: number | null;
  unit: string;
  denominator: number;
  sourceDiveIds: string[];
  definition: string;
  missingCount: number;
}

export interface HeadlineAnalytics {
  totalDives: MetricObservation;
  totalDiveTimeMin: MetricObservation;
  maxDepthM: MetricObservation;
  averageDepthM: MetricObservation;
  averageSacLMin: MetricObservation;
  bestSacLMin: MetricObservation;
  averageSacBarMin: MetricObservation;
  bestSacBarMin: MetricObservation;
  averageRmvLMin: MetricObservation;
  bestRmvLMin: MetricObservation;
  divesLast90Days: MetricObservation;
}

export interface DepthBandRow {
  key: string;
  label: string;
  minInclusive: number;
  maxExclusive: number | null;
  count: number;
  percent: number;
  totalDiveTimeMin: number;
  diveIds: string[];
}

export interface EnvironmentRow {
  key: string;
  label: string;
  count: number;
  percent: number;
  diveIds: string[];
}

export interface SacTrendPoint {
  diveId: string;
  date: string;
  site: string;
  siteId?: string;
  depthM: number | null;
  sacBarMin: number;
  waterType: string;
  training: boolean;
  equipmentSetIds: string[];
}

export interface RmvTrendPoint {
  diveId: string;
  date: string;
  site: string;
  siteId?: string;
  depthM: number | null;
  rmvLMin: number;
  waterType: string;
  training: boolean;
  equipmentSetIds: string[];
}

export interface EquipmentSetUsageRow {
  equipmentSetId: string;
  name: string;
  dives: number;
  percent: number;
  diveIds: string[];
}

export interface SiteUsageRow {
  siteId: string | null;
  name: string;
  dives: number;
  percent: number;
  diveIds: string[];
}

export interface ExperienceAnalyticsProjection {
  scope: AnalysisScope;
  totalAvailableDives: number;
  includedDiveIds: string[];
  excludedDiveIds: string[];
  headlines: HeadlineAnalytics;
  depthBands: DepthBandRow[];
  waterTypeSplit: EnvironmentRow[];
  environmentSplit: EnvironmentRow[];
  sacTrend: SacTrendPoint[];
  rmvTrend: RmvTrendPoint[];
  equipmentSetUsage: EquipmentSetUsageRow[];
  siteUsage: SiteUsageRow[];
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number =>
  finite(value) && value > 0;
const lower = (value: string | null | undefined) =>
  (value ?? '').trim().toLocaleLowerCase('en-GB');
const unique = <T>(values: T[]) => [...new Set(values)];

export function isTrainingDive(dive: DiveRecord) {
  return Boolean(
    dive.diveMode === 'recreational-training' ||
    dive.diveMode === 'technical-training' ||
    dive.diveTypes?.some((value) => lower(value) === 'training'),
  );
}

export function isPoolDive(dive: DiveRecord) {
  return Boolean(dive.diveTypes?.some((value) => lower(value) === 'pool'));
}

export function diveEquipmentSetIds(dive: DiveRecord) {
  return unique(
    [
      ...(dive.equipmentSetIds ?? []),
      ...(dive.equipmentSetId ? [dive.equipmentSetId] : []),
      ...(dive.equipmentSetApplications ?? []).map(
        (item) => item.equipmentSetId,
      ),
    ].filter(Boolean),
  );
}

export function diveRuntimeMinutes(dive: DiveRecord): number | null {
  const value = dive.totalElapsedMin ?? dive.bottomTimeMin;
  return finite(value) && value >= 0 ? value : null;
}

/**
 * The mock-up calls this SAC in L/min. ZeusTek's validated volume-rate field is RMV L/min.
 * Never reinterpret a pressure SAC value (bar/min) as litres/min.
 */
export function diveSacLitresPerMinute(dive: DiveRecord): number | null {
  if (positive(dive.rmvRate)) return dive.rmvRate;
  const cylinderRates = (dive.cylinders ?? [])
    .map((item) => item.rmvRate)
    .filter(positive);
  return cylinderRates.length === 1 ? cylinderRates[0]! : null;
}

export function diveSacBarPerMinute(dive: DiveRecord): number | null {
  const direct = (dive as DiveRecord & { sacRate?: number | null }).sacRate;
  if (positive(direct)) return direct;
  const cylinderRates = (dive.cylinders ?? []).map((item) => item.sacPressureBarMin).filter(positive);
  return cylinderRates.length === 1 ? cylinderRates[0]! : null;
}

export function normalWaterType(
  value: DiveRecord['waterType'],
): AnalysisWaterType {
  return value === 'Saltwater' ||
    value === 'Freshwater' ||
    value === 'Brackish' ||
    value === 'Other'
    ? value
    : 'Other';
}

export function diveMatchesAnalysisScope(
  dive: DiveWithId,
  scope: AnalysisScope,
) {
  if (scope.excludedDiveIds.includes(dive.entityId)) return false;
  if (scope.dateFrom && dive.date < scope.dateFrom) return false;
  if (scope.dateTo && dive.date > scope.dateTo) return false;
  if (!scope.includePool && isPoolDive(dive)) return false;
  if (!scope.includeTraining && isTrainingDive(dive)) return false;
  const depth = dive.maxDepthM;
  if (scope.minDepthM != null && (depth == null || depth < scope.minDepthM)) return false;
  if (scope.maxDepthM != null && (depth == null || depth > scope.maxDepthM)) return false;
  const runtime = diveRuntimeMinutes(dive);
  if (scope.minTimeMin != null && (runtime == null || runtime < scope.minTimeMin)) return false;
  if (scope.maxTimeMin != null && (runtime == null || runtime > scope.maxTimeMin)) return false;
  const activities = (dive.diveTypes ?? []).map(lower);
  if (!scope.includeShore && activities.includes('shore')) return false;
  if (!scope.includeBoat && activities.includes('boat')) return false;
  if (!scope.includeNight && activities.some((value) => value === 'night' || value === 'night dive')) return false;
  if (!scope.includeUnknownOther && primaryEnvironment(dive) === 'Other / unknown') return false;
  if (
    scope.diveModes.length &&
    (!dive.diveMode || !scope.diveModes.includes(dive.diveMode))
  )
    return false;
  if (scope.waterTypes.length) {
    const water = normalWaterType(dive.waterType);
    if (!scope.waterTypes.includes(water)) return false;
  }
  if (
    scope.siteIds.length &&
    (!dive.siteId || !scope.siteIds.includes(dive.siteId))
  )
    return false;
  if (scope.equipmentSetIds.length) {
    const refs = new Set(diveEquipmentSetIds(dive));
    if (!scope.equipmentSetIds.some((id) => refs.has(id))) return false;
  }
  return true;
}

export function applyAnalysisScope(dives: DiveWithId[], scope: AnalysisScope) {
  return dives.filter((dive) => diveMatchesAnalysisScope(dive, scope));
}

function metric(
  source: DiveWithId[],
  values: Array<{ dive: DiveWithId; value: number }>,
  value: number | null,
  unit: string,
  definition: string,
): MetricObservation {
  return {
    value,
    unit,
    denominator: values.length,
    sourceDiveIds: values.map((item) => item.dive.entityId),
    definition,
    missingCount: Math.max(0, source.length - values.length),
  };
}

export function headlineAnalytics(
  dives: DiveWithId[],
  asOf = new Date(),
): HeadlineAnalytics {
  const runtime = dives
    .map((dive) => ({ dive, value: diveRuntimeMinutes(dive) }))
    .filter(
      (item): item is { dive: DiveWithId; value: number } => item.value != null,
    );
  const maxDepth = dives
    .map((dive) => ({ dive, value: dive.maxDepthM }))
    .filter(
      (item): item is { dive: DiveWithId; value: number } =>
        finite(item.value) && item.value >= 0,
    );
  const averageDepth = dives
    .map((dive) => ({ dive, value: dive.averageDepthM }))
    .filter(
      (item): item is { dive: DiveWithId; value: number } =>
        finite(item.value) && item.value >= 0,
    );
  const sac = dives
    .map((dive) => ({ dive, value: diveSacLitresPerMinute(dive) }))
    .filter(
      (item): item is { dive: DiveWithId; value: number } => item.value != null,
    );
  const pressureSac = dives
    .map((dive) => ({ dive, value: diveSacBarPerMinute(dive) }))
    .filter((item): item is { dive: DiveWithId; value: number } => item.value != null);
  const cutoff = new Date(asOf);
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  const recent = dives.filter(
    (dive) =>
      dive.date >= cutoffDate && dive.date <= asOf.toISOString().slice(0, 10),
  );
  return {
    totalDives: metric(
      dives,
      dives.map((dive) => ({ dive, value: 1 })),
      dives.length,
      'dives',
      'Count of Dives inside the active analysis scope.',
    ),
    totalDiveTimeMin: metric(
      dives,
      runtime,
      runtime.length
        ? runtime.reduce((sum, item) => sum + item.value, 0)
        : null,
      'min',
      'Sum of total elapsed runtime where recorded; bottom time is used only when elapsed runtime is absent.',
    ),
    maxDepthM: metric(
      dives,
      maxDepth,
      maxDepth.length ? Math.max(...maxDepth.map((item) => item.value)) : null,
      'm',
      'Maximum recorded max depth. Dives with missing max depth are excluded, never treated as zero.',
    ),
    averageDepthM: metric(
      dives,
      averageDepth,
      averageDepth.length
        ? averageDepth.reduce((sum, item) => sum + item.value, 0) /
            averageDepth.length
        : null,
      'm',
      'Mean of recorded average-depth values only. Missing average depth is excluded.',
    ),
    averageSacLMin: metric(
      dives,
      sac,
      sac.length
        ? sac.reduce((sum, item) => sum + item.value, 0) / sac.length
        : null,
      'L/min',
      'Mean valid surface-volume gas rate (RMV L/min). Pressure-only SAC is not relabelled as litres/min.',
    ),
    bestSacLMin: metric(
      dives,
      sac,
      sac.length ? Math.min(...sac.map((item) => item.value)) : null,
      'L/min',
      'Lowest valid surface-volume gas rate (RMV L/min) in scope.',
    ),
    averageSacBarMin: metric(
      dives,
      pressureSac,
      pressureSac.length ? pressureSac.reduce((sum, item) => sum + item.value, 0) / pressureSac.length : null,
      'bar/min',
      'Mean recorded pressure SAC. This remains cylinder-specific and is never relabelled as L/min.',
    ),
    bestSacBarMin: metric(
      dives,
      pressureSac,
      pressureSac.length ? Math.min(...pressureSac.map((item) => item.value)) : null,
      'bar/min',
      'Lowest recorded pressure SAC in scope.',
    ),
    averageRmvLMin: metric(
      dives,
      sac,
      sac.length ? sac.reduce((sum, item) => sum + item.value, 0) / sac.length : null,
      'L/min',
      'Mean valid surface-volume RMV. Missing or pressure-only evidence is excluded.',
    ),
    bestRmvLMin: metric(
      dives,
      sac,
      sac.length ? Math.min(...sac.map((item) => item.value)) : null,
      'L/min',
      'Lowest valid surface-volume RMV in scope.',
    ),
    divesLast90Days: metric(
      dives,
      recent.map((dive) => ({ dive, value: 1 })),
      recent.length,
      'dives',
      'Dives dated in the 90 days ending at the analysis date.',
    ),
  };
}

export const DEFAULT_DEPTH_BANDS = [0, 10, 20, 30, 40, 50] as const;

export function depthBandProjection(
  dives: DiveWithId[],
  starts: readonly number[] = DEFAULT_DEPTH_BANDS,
): DepthBandRow[] {
  const valid = dives.filter(
    (dive) => finite(dive.maxDepthM) && dive.maxDepthM! >= 0,
  );
  return starts.map((start, index) => {
    const next = starts[index + 1] ?? null;
    const matches = valid.filter(
      (dive) =>
        dive.maxDepthM! >= start && (next == null || dive.maxDepthM! < next),
    );
    const time = matches
      .map(diveRuntimeMinutes)
      .filter((value): value is number => value != null)
      .reduce((sum, value) => sum + value, 0);
    return {
      key: `${start}-${next ?? 'plus'}`,
      label: next == null ? `${start}+ m` : `${start}–${next} m`,
      minInclusive: start,
      maxExclusive: next,
      count: matches.length,
      percent: valid.length
        ? Math.round((matches.length / valid.length) * 1000) / 10
        : 0,
      totalDiveTimeMin: time,
      diveIds: matches.map((dive) => dive.entityId),
    };
  });
}

export function primaryEnvironment(dive: DiveRecord) {
  const labels = (dive.diveTypes ?? []).map((value) => lower(value));
  const explicit: Array<[string, string]> = [
    ['pool', 'Pool'],
    ['quarry', 'Quarry'],
    ['river', 'River'],
    ['lake', 'Lake'],
    ['boat', 'Boat'],
    ['shore', 'Shore'],
    ['wreck', 'Wreck'],
    ['sea', 'Sea'],
    ['cave', 'Cave'],
    ['cenote', 'Cenote'],
    ['drift', 'Drift'],
    ['ice', 'Ice'],
  ];
  for (const [key, label] of explicit) if (labels.includes(key)) return label;
  return 'Other / unknown';
}

function groupedProjection(
  dives: DiveWithId[],
  group: (dive: DiveRecord) => string,
): EnvironmentRow[] {
  const groups = new Map<string, DiveWithId[]>();
  for (const dive of dives) {
    const key = group(dive);
    groups.set(key, [...(groups.get(key) ?? []), dive]);
  }
  return [...groups.entries()]
    .map(([label, items]) => ({
      key: label.toLocaleLowerCase('en-GB').replace(/\s+/g, '-'),
      label,
      count: items.length,
      percent: dives.length
        ? Math.round((items.length / dives.length) * 1000) / 10
        : 0,
      diveIds: items.map((item) => item.entityId),
    }))
    .sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'en-GB'),
    );
}

/** Dive activity/location is deliberately separate from water salinity. */
export function environmentProjection(dives: DiveWithId[]): EnvironmentRow[] {
  return groupedProjection(dives, primaryEnvironment);
}

export function waterTypeProjection(dives: DiveWithId[]): EnvironmentRow[] {
  return groupedProjection(dives, (dive) => {
    const water = normalWaterType(dive.waterType);
    return water === 'Other' ? 'Other / unknown' : water;
  });
}

export function sacTrendProjection(dives: DiveWithId[]): SacTrendPoint[] {
  return dives
    .map((dive) => {
      const value = diveSacBarPerMinute(dive);
      if (value == null) return null;
      return {
        diveId: dive.entityId,
        date: dive.date,
        site: dive.site,
        ...(dive.siteId ? { siteId: dive.siteId } : {}),
        depthM: finite(dive.maxDepthM) ? dive.maxDepthM : null,
        sacBarMin: value,
        waterType: dive.waterType || 'Unknown',
        training: isTrainingDive(dive),
        equipmentSetIds: diveEquipmentSetIds(dive),
      } satisfies SacTrendPoint;
    })
    .filter((item): item is SacTrendPoint => Boolean(item))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.diveId.localeCompare(b.diveId),
    );
}

export function rmvTrendProjection(dives: DiveWithId[]): RmvTrendPoint[] {
  return dives
    .map((dive) => {
      const value = diveSacLitresPerMinute(dive);
      if (value == null) return null;
      return {
        diveId: dive.entityId, date: dive.date, site: dive.site,
        ...(dive.siteId ? { siteId: dive.siteId } : {}),
        depthM: finite(dive.maxDepthM) ? dive.maxDepthM : null,
        rmvLMin: value, waterType: dive.waterType || 'Unknown',
        training: isTrainingDive(dive), equipmentSetIds: diveEquipmentSetIds(dive),
      } satisfies RmvTrendPoint;
    })
    .filter((item): item is RmvTrendPoint => Boolean(item))
    .sort((a, b) => a.date.localeCompare(b.date) || a.diveId.localeCompare(b.diveId));
}

export function equipmentSetUsageProjection(
  dives: DiveWithId[],
  loadouts: Array<Stored<ReusableLoadoutRecord>>,
): EquipmentSetUsageRow[] {
  return loadouts
    .map((loadout) => {
      const matches = dives.filter((dive) =>
        diveEquipmentSetIds(dive).includes(loadout.entityId),
      );
      return {
        equipmentSetId: loadout.entityId,
        name: loadout.name,
        dives: matches.length,
        percent: dives.length
          ? Math.round((matches.length / dives.length) * 1000) / 10
          : 0,
        diveIds: matches.map((item) => item.entityId),
      };
    })
    .filter((item) => item.dives > 0)
    .sort((a, b) => b.dives - a.dives || a.name.localeCompare(b.name, 'en-GB'));
}

export function siteUsageProjection(
  dives: DiveWithId[],
  sites: Array<Stored<DiveSiteRecord>>,
): SiteUsageRow[] {
  const groups = new Map<string, DiveWithId[]>();
  for (const dive of dives) {
    const key = dive.siteId || `name:${lower(dive.site)}`;
    groups.set(key, [...(groups.get(key) ?? []), dive]);
  }
  return [...groups.entries()]
    .map(([, matches]) => {
      const sample = matches[0]!;
      const site = sample.siteId
        ? sites.find((item) => item.entityId === sample.siteId)
        : undefined;
      return {
        siteId: site?.entityId ?? sample.siteId ?? null,
        name: site?.name ?? sample.site,
        dives: matches.length,
        percent: dives.length
          ? Math.round((matches.length / dives.length) * 1000) / 10
          : 0,
        diveIds: matches.map((item) => item.entityId),
      };
    })
    .sort((a, b) => b.dives - a.dives || a.name.localeCompare(b.name, 'en-GB'));
}

export function compareDepthBandsByWater(dives: DiveWithId[]) {
  const pick = (waterType: AnalysisWaterType) =>
    depthBandProjection(dives.filter((dive) => dive.waterType === waterType));
  const salt = pick('Saltwater');
  const fresh = pick('Freshwater');
  return DEFAULT_DEPTH_BANDS.map((start, index) => ({
    key: salt[index]!.key,
    label: salt[index]!.label,
    saltwater: salt[index]!.count,
    freshwater: fresh[index]!.count,
    saltwaterDiveIds: salt[index]!.diveIds,
    freshwaterDiveIds: fresh[index]!.diveIds,
  }));
}

export function buildExperienceAnalyticsProjection(
  dives: DiveWithId[],
  sites: Array<Stored<DiveSiteRecord>>,
  loadouts: Array<Stored<ReusableLoadoutRecord>>,
  scope: AnalysisScope = DEFAULT_ANALYSIS_SCOPE,
  asOf = new Date(),
): ExperienceAnalyticsProjection {
  const included = applyAnalysisScope(dives, scope);
  const includedSet = new Set(included.map((item) => item.entityId));
  return {
    scope,
    totalAvailableDives: dives.length,
    includedDiveIds: included.map((item) => item.entityId),
    excludedDiveIds: dives
      .filter((item) => !includedSet.has(item.entityId))
      .map((item) => item.entityId),
    headlines: headlineAnalytics(included, asOf),
    depthBands: depthBandProjection(included),
    waterTypeSplit: waterTypeProjection(included),
    environmentSplit: environmentProjection(included),
    sacTrend: sacTrendProjection(included),
    rmvTrend: rmvTrendProjection(included),
    equipmentSetUsage: equipmentSetUsageProjection(included, loadouts),
    siteUsage: siteUsageProjection(included, sites),
  };
}

export function insightsExportEnvelope(
  projection: ExperienceAnalyticsProjection,
  generatedAt = new Date(),
) {
  return {
    format: 'zeustek-derived-insights',
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    canonicalDataChanged: false,
    scope: projection.scope,
    denominator: {
      availableDives: projection.totalAvailableDives,
      includedDives: projection.includedDiveIds.length,
      excludedDives: projection.excludedDiveIds.length,
    },
    headlines: projection.headlines,
    depthBands: projection.depthBands,
    waterTypeSplit: projection.waterTypeSplit,
    environmentSplit: projection.environmentSplit,
    sacTrend: projection.sacTrend,
    rmvTrend: projection.rmvTrend,
    equipmentSetUsage: projection.equipmentSetUsage,
    siteUsage: projection.siteUsage,
    provenance: {
      analytics: 'calculated',
      note: 'This export is a rebuildable projection over canonical ZeusTek records. Missing values are excluded from their metric denominator and are never converted to zero.',
    },
  };
}
