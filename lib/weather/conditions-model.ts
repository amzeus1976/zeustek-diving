/** Versioned, provider-independent conditions. No value is a dive-readiness assessment. */
export const CONDITIONS_VERSION = 1 as const;
export type ConditionsProvider =
  | 'open-meteo'
  | 'met-office'
  | 'xweather'
  | 'tomorrow'
  | 'wwo'
  | 'met-norway'
  | 'copernicus'
  | 'swellcloud'
  | 'operator'
  | 'zeustek'
  | 'nasa';
export type ConditionsSelection =
  | Exclude<ConditionsProvider, 'operator' | 'zeustek' | 'nasa'>
  | 'auto';
export type ConditionMetric =
  | 'water-temperature'
  | 'visibility'
  | 'site-status'
  | 'air-temperature'
  | 'feels-like'
  | 'wind-speed'
  | 'wind-gust'
  | 'wind-direction'
  | 'rain'
  | 'air-visibility'
  | 'weather'
  | 'wave-height'
  | 'wave-period'
  | 'wave-direction'
  | 'swell-height'
  | 'current-speed'
  | 'current-direction'
  | 'sea-level';
export type MeasurementDepth =
  | { kind: 'surface' | 'unknown' | 'mid-level' | 'bottom' }
  | { kind: 'exact'; metres: number }
  | { kind: 'band'; minimumM: number; maximumM: number | null };
export interface ConditionsRequest {
  latitude: number;
  longitude: number;
  siteId: string;
  siteName: string;
  siteType: 'inland' | 'coastal' | 'unknown';
  provider: ConditionsSelection;
  date: string;
  time: string;
  mode: 'forecast' | 'historical' | 'seasonal';
  marine: boolean;
  operatorId?: string;
  plannedDepthM?: number;
  disabledProviders?: ConditionsProvider[];
  timeZone?: string;
}
export interface ConditionProvenance {
  provider: ConditionsProvider;
  label: string;
  kind: 'operator' | 'dive' | 'device' | 'model' | 'station';
  classification: 'observed' | 'forecast' | 'modelled';
  url: string;
  attribution?: string;
  station?: string;
  model?: string;
  modelRunAt?: string;
  resolution: string;
  latitude: number;
  longitude: number;
  retrievedAt: string;
  observedAt?: string | null;
  validAt?: string | null;
  timeZone?: string;
  depth?: MeasurementDepth;
  datum?: string;
  sourceRecordId?: string;
  detail?: string;
}
export interface ConditionReading extends Omit<
  ConditionProvenance,
  'observedAt' | 'validAt' | 'depth'
> {
  id: string;
  metric: ConditionMetric;
  value: number | string;
  unit: string;
  depth: MeasurementDepth;
  observedAt: string | null;
  validAt: string | null;
}
export interface ProviderDiagnostic {
  provider: string;
  status:
    | 'ok'
    | 'unconfigured'
    | 'disabled'
    | 'unverified'
    | 'unsupported'
    | 'rate-limited'
    | 'denied'
    | 'unavailable'
    | 'empty';
  message: string;
  retrievedAt: string;
  costAccesses?: number;
}
export interface SiteEnrichment {
  provider: 'pickadive' | 'divenumber';
  name: string;
  url: string;
  latitude: number | null;
  longitude: number | null;
  maxDepthM: number | null;
  difficulty: string | null;
  access: string | null;
  hazards: string | null;
  retrievedAt: string;
  attribution: string;
}
export interface ConditionsSnapshot {
  version: 1;
  request: ConditionsRequest;
  retrievedAt: string;
  readings: ConditionReading[];
  diagnostics: ProviderDiagnostic[];
  enrichment?: SiteEnrichment[];
  offline?: boolean;
}

const temperature = new Set<ConditionMetric>([
  'water-temperature',
  'air-temperature',
  'feels-like',
]);
const speeds = new Set<ConditionMetric>([
  'wind-speed',
  'wind-gust',
  'current-speed',
]);
const distances = new Set<ConditionMetric>([
  'visibility',
  'air-visibility',
  'wave-height',
  'swell-height',
  'sea-level',
]);
const angles = new Set<ConditionMetric>([
  'wind-direction',
  'wave-direction',
  'current-direction',
]);
function validDepth(depth: MeasurementDepth) {
  return depth.kind === 'exact'
    ? Number.isFinite(depth.metres) && depth.metres >= 0
    : depth.kind === 'band'
      ? Number.isFinite(depth.minimumM) &&
        depth.minimumM >= 0 &&
        (depth.maximumM === null ||
          (Number.isFinite(depth.maximumM) && depth.maximumM >= depth.minimumM))
      : ['surface', 'unknown', 'bottom', 'mid-level'].includes(depth.kind);
}
export function conditionReading(
  metric: ConditionMetric,
  raw: unknown,
  rawUnit: string,
  source: ConditionProvenance,
): ConditionReading | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const depth = source.depth ?? { kind: 'unknown' };
  if (
    !validDepth(depth) ||
    !Number.isFinite(source.latitude) ||
    !Number.isFinite(source.longitude) ||
    Math.abs(source.latitude) > 90 ||
    Math.abs(source.longitude) > 180
  )
    return null;
  let value: number | string;
  let unit = rawUnit;
  if (
    rawUnit === 'text' &&
    typeof raw === 'string' &&
    ['visibility', 'site-status', 'weather'].includes(metric)
  ) {
    value = raw.trim().slice(0, 250);
    if (!value) return null;
  } else {
    value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim()
          ? Number(raw)
          : NaN;
    if (!Number.isFinite(value) || value <= -900) return null;
    const u = rawUnit.toLowerCase().replace(/\s/g, '');
    if (temperature.has(metric)) {
      if (['°f', 'f', 'fahrenheit'].includes(u)) value = ((value - 32) * 5) / 9;
      else if (['k', 'kelvin'].includes(u)) value -= 273.15;
      else if (!['°c', 'ºc', 'c', 'celsius'].includes(u)) return null;
      unit = '°C';
      if (value < -90 || value > 65) return null;
    } else if (speeds.has(metric)) {
      const factor: Record<string, number> = {
        'm/s': 1,
        mps: 1,
        'km/h': 1 / 3.6,
        kph: 1 / 3.6,
        mph: 0.44704,
        kn: 0.514444,
        knots: 0.514444,
        kts: 0.514444,
      };
      if (factor[u] === undefined || value < 0) return null;
      value *= factor[u];
      unit = 'm/s';
    } else if (distances.has(metric)) {
      const factor: Record<string, number> = {
        m: 1,
        metres: 1,
        meters: 1,
        ft: 0.3048,
        feet: 0.3048,
        km: 1000,
      };
      if (factor[u] === undefined || (metric !== 'sea-level' && value < 0))
        return null;
      value *= factor[u];
      unit = 'm';
    } else if (angles.has(metric)) {
      if (!['°', 'degrees', 'deg'].includes(u) || value < 0 || value > 360)
        return null;
      unit = '°';
    } else if (metric === 'rain') {
      if (!['mm', 'inch', 'in'].includes(u) || value < 0) return null;
      if (u !== 'mm') value *= 25.4;
      unit = 'mm';
    } else if (metric === 'wave-period') {
      if (!['s', 'seconds'].includes(u) || value < 0) return null;
      unit = 's';
    } else return null;
    value = Math.round(value * 10000) / 10000;
  }
  const observedAt = source.observedAt ?? null;
  const validAt = source.validAt ?? null;
  const id = JSON.stringify([
    source.provider,
    source.station ?? source.model ?? source.label,
    metric,
    depth,
    source.datum ?? '',
    source.latitude,
    source.longitude,
    observedAt,
    validAt,
    source.sourceRecordId ?? '',
  ]);
  return { ...source, id, metric, value, unit, depth, observedAt, validAt };
}
export function depthLabel(depth: MeasurementDepth): string {
  switch (depth.kind) {
    case 'surface':
      return 'Surface / SST';
    case 'exact':
      return `${depth.metres} m`;
    case 'band':
      return depth.maximumM === null
        ? `Below ${depth.minimumM} m`
        : `${depth.minimumM}–${depth.maximumM} m`;
    case 'bottom':
      return 'Bottom (depth not supplied)';
    case 'mid-level':
      return 'Mid-level (depth not supplied)';
    default:
      return 'Depth not supplied';
  }
}
export type ConditionFreshness = 'fresh' | 'stale' | 'observation-time-unknown';
export function conditionFreshness(
  reading: ConditionReading,
  now: string,
): ConditionFreshness {
  const clock = Date.parse(now);
  const retrieved = Date.parse(reading.retrievedAt);
  if (
    !Number.isFinite(clock) ||
    !Number.isFinite(retrieved) ||
    retrieved > clock + 300000
  )
    return 'stale';
  if (reading.classification === 'observed') {
    if (!reading.observedAt)
      return clock - retrieved > 48 * 3600000
        ? 'stale'
        : 'observation-time-unknown';
    const observed = Date.parse(reading.observedAt);
    const age = clock - observed;
    return Number.isFinite(observed) &&
      age >= -86400000 &&
      age <= (reading.kind === 'operator' ? 48 : 72) * 3600000
      ? 'fresh'
      : 'stale';
  }
  return clock - retrieved <=
    (reading.classification === 'modelled' ? 168 : 6) * 3600000
    ? 'fresh'
    : 'stale';
}
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180;
  const x = (b.latitude - a.latitude) * rad;
  const y = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(x / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(y / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
}
export function conditionGroup(reading: ConditionReading) {
  return JSON.stringify([
    reading.metric,
    reading.depth,
    reading.metric === 'sea-level' ? (reading.datum ?? 'unknown') : '',
    reading.metric === 'visibility' ? reading.unit : '',
  ]);
}
/** Compare the requested site-local wall time with the returned time zone. Never relabel UTC as local. */
export function conditionWallTime(reading: ConditionReading): string | null {
  if (!reading.validAt) return null;
  if (
    reading.timeZone &&
    !['UTC', 'source-local (offset not supplied)', 'date-only'].includes(
      reading.timeZone,
    )
  ) {
    try {
      const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: reading.timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(reading.validAt));
      return parts.replace(' ', 'T');
    } catch {
      return null;
    }
  }
  return reading.validAt.slice(0, 16);
}
function score(
  reading: ConditionReading,
  request: ConditionsRequest,
  now: string,
) {
  if (
    request.mode === 'historical' &&
    reading.classification === 'observed' &&
    (!reading.observedAt || reading.observedAt.slice(0, 10) > request.date)
  )
    return -Infinity;
  const freshness = conditionFreshness(reading, now);
  let value =
    freshness === 'fresh'
      ? 100
      : freshness === 'observation-time-unknown'
        ? 50
        : 0;
  const distance = distanceKm(reading, request);
  if (distance > 100) return -Infinity;
  value -= Math.min(60, distance);
  const underwater = [
    'water-temperature',
    'visibility',
    'site-status',
  ].includes(reading.metric);
  if (underwater && request.siteType === 'inland')
    value +=
      reading.kind === 'operator'
        ? 40
        : reading.kind === 'dive' || reading.kind === 'device'
          ? 30
          : reading.kind === 'station'
            ? 20
            : 0;
  else if (
    [
      'current-speed',
      'current-direction',
      'sea-level',
      'wave-height',
      'swell-height',
    ].includes(reading.metric)
  )
    value +=
      reading.kind === 'station'
        ? 30
        : reading.provider === 'met-norway' &&
            request.latitude > 55 &&
            request.longitude > 0
          ? 20
          : reading.provider === 'open-meteo'
            ? 10
            : 0;
  else
    value +=
      reading.kind === 'station'
        ? 20
        : reading.provider === 'met-office' &&
            request.latitude >= 49 &&
            request.latitude <= 61 &&
            request.longitude >= -9 &&
            request.longitude <= 3
          ? 15
          : reading.provider === 'open-meteo'
            ? 10
            : 0;
  if (request.provider !== 'auto' && reading.provider === request.provider)
    value += 80;
  if (reading.validAt && request.mode !== 'seasonal') {
    if (reading.timeZone === 'date-only')
      return reading.validAt.slice(0, 10) === request.date ? value : -Infinity;
    const wall = conditionWallTime(reading);
    if (!wall) return -Infinity;
    const hours =
      Math.abs(
        Date.parse(`${wall.slice(0, 16)}Z`) -
          Date.parse(`${request.date}T${request.time}Z`),
      ) / 3600000;
    if (hours > 3) return -Infinity;
    value -= hours * 10;
  }
  return value;
}
/** One representative per metric/depth/datum; all alternatives remain in the snapshot. No averaging. */
export function selectConditions(
  readings: ConditionReading[],
  request: ConditionsRequest,
  now: string,
): ConditionReading[] {
  const winners = new Map<
    string,
    { reading: ConditionReading; score: number }
  >();
  for (const reading of readings) {
    if (
      !request.marine &&
      [
        'wave-height',
        'wave-period',
        'wave-direction',
        'swell-height',
        'current-speed',
        'current-direction',
        'sea-level',
      ].includes(reading.metric)
    )
      continue;
    const value = score(reading, request, now);
    if (!Number.isFinite(value)) continue;
    const key = conditionGroup(reading);
    const prior = winners.get(key);
    if (!prior || value > prior.score)
      winners.set(key, { reading, score: value });
  }
  return [...winners.values()].map((v) => v.reading);
}
export const CONDITION_LABELS: Record<ConditionMetric, string> = {
  'water-temperature': 'Water temperature',
  visibility: 'Underwater visibility',
  'site-status': 'Operator notice',
  'air-temperature': 'Air temperature',
  'feels-like': 'Feels like',
  'wind-speed': 'Wind',
  'wind-gust': 'Gusts',
  'wind-direction': 'Wind from',
  rain: 'Rain',
  'air-visibility': 'Atmospheric visibility',
  weather: 'Weather',
  'wave-height': 'Wave height',
  'wave-period': 'Wave period',
  'wave-direction': 'Waves from',
  'swell-height': 'Swell height',
  'current-speed': 'Current speed',
  'current-direction': 'Current towards',
  'sea-level': 'Sea level / tide',
};
