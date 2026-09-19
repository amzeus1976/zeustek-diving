import type { PlanConditionSnapshot } from './offline/dive-planning-centre';

export const PLAN_FORECAST_DAYS = 7;
export type PlanWeatherMode = 'auto' | 'seasonal' | 'manual' | 'unavailable';

export function planWeatherMode(conditions?: PlanConditionSnapshot): PlanWeatherMode {
  if (conditions?.provenance === 'recorded') return 'manual';
  if (conditions?.provenance === 'seasonal') return 'seasonal';
  if (conditions?.provenance === 'forecast') return 'auto';
  return 'unavailable';
}

/** A provider failure never deletes observations or upgrades stale data into a new forecast. */
export function weatherFailureFallback(conditions: PlanConditionSnapshot | undefined, rateLimited: boolean): PlanConditionSnapshot {
  return {
    ...conditions,
    provenance: conditions?.provenance ?? 'unavailable',
    weatherAvailability: rateLimited ? 'rate-limited' : 'unavailable',
    sourceDetail: conditions?.sourceDetail ?? 'Weather unavailable — check conditions manually before diving.',
  };
}

/** Switching to owner-entered conditions preserves prior owner entries, but not an old model forecast. */
export function ownerConditionMode(conditions: PlanConditionSnapshot | undefined, mode: 'manual' | 'seasonal' | 'unavailable'): PlanConditionSnapshot {
  const previousForecast = conditions?.provenance === 'forecast';
  const retained = previousForecast ? {
    ...conditions,
    weather: null,
    airTemperatureC: null,
    waterTemperatureC: null,
    waveHeightM: null,
    visibilityM: null,
    swellHeightM: null,
    currentStrength: null,
  } : { ...conditions };
  return {
    ...retained,
    provenance: mode === 'manual' ? 'recorded' : mode,
    ...(mode === 'unavailable' ? { weatherAvailability: 'unavailable' as const } : retained.weatherAvailability ? { weatherAvailability: retained.weatherAvailability } : {}),
    sourceDetail: mode === 'seasonal'
      ? 'Owner-entered seasonal / typical conditions — not a dive-day forecast.'
      : mode === 'manual'
        ? 'Owner-entered conditions — verify locally before diving.'
        : 'Weather unavailable — check conditions manually before diving.',
  };
}

/** The existing ZeusTek weather endpoint requests seven forecast days, starting today. */
export function planningWeatherRegime(plannedDate: string, today: string): 'forecast' | 'seasonal' | 'past' | 'invalid' {
  const planned = Date.parse(`${plannedDate}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(planned) || !Number.isFinite(start)) return 'invalid';
  const days = Math.round((planned - start) / 86400000);
  if (days < 0) return 'past';
  return days < PLAN_FORECAST_DAYS ? 'forecast' : 'seasonal';
}

export interface PlannedWeatherResponse {
  error?: string;
  provider?: string;
  resolution?: string;
  attribution?: string;
  logConditions?: {
    weatherSummary?: string;
    airTemperatureC?: number | null;
    waveHeightM?: number | null;
    surfaceTemperatureC?: number | null;
    currentDirectionDegrees?: number | null;
  };
}

/** Unknown marine fields stay unknown; historical seasonal context is never presented as a dive-day forecast. */
export function plannedWeatherSnapshot(response: PlannedWeatherResponse, regime: 'forecast' | 'seasonal', siteId: string, date: string, capturedAt: string): PlanConditionSnapshot {
  const value = response.logConditions;
  if (!value || (!value.weatherSummary && value.airTemperatureC == null)) throw new Error('No usable weather data were returned. Existing conditions were kept.');
  return {
    provenance: regime,
    weatherAvailability: 'available',
    capturedAt,
    sourceSiteId: siteId,
    sourceDate: date,
    sourceDetail: `${response.provider ?? 'Open-Meteo'} · ${response.resolution ?? regime} · ${response.attribution ?? ''}`,
    weather: value.weatherSummary || null,
    airTemperatureC: value.airTemperatureC ?? null,
    waterTemperatureC: regime === 'forecast' ? value.surfaceTemperatureC ?? null : null,
    waveHeightM: regime === 'forecast' ? value.waveHeightM ?? null : null,
    currentStrength: null,
    visibilityM: null,
    swellHeightM: null,
  };
}
