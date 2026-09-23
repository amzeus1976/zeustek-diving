import { conditionFreshness, conditionWallTime, type ConditionsSnapshot } from './conditions-model';
export interface OverviewForecastDay {
  date: string;
  minimumC: number | null;
  maximumC: number | null;
  windMaximumMps: number | null;
  summary: string | null;
}
export interface OverviewForecast {
  days: OverviewForecastDay[];
  source: string;
  retrievedAt: string;
  offline: boolean;
  stale: boolean;
  attribution: string;
  url: string;
}
/** Daily extrema of one atmosphere model, never an average across competing providers. */
export function overviewForecast(
  snapshot: ConditionsSnapshot,
): OverviewForecast {
  const candidates = snapshot.readings.filter(
    (r) => r.classification === 'forecast' && r.metric === 'air-temperature',
  );
  const preferred =
    candidates.find((r) => r.provider === snapshot.request.provider) ??
    candidates.find((r) => r.provider === 'open-meteo') ??
    candidates[0];
  if (!preferred)
    return {
      days: [],
      source: 'No atmospheric forecast',stale:true,attribution:'',url:'',
      retrievedAt: snapshot.retrievedAt,
      offline: Boolean(snapshot.offline),
    };
  const rows = snapshot.readings.filter(
    (r) =>
      r.classification === 'forecast' &&
      r.provider === preferred.provider &&
      r.label === preferred.label &&
      r.latitude === preferred.latitude &&
      r.longitude === preferred.longitude,
  );
  const dates = [
    ...new Set(
      rows
        .map((r) => conditionWallTime(r)?.slice(0, 10))
        .filter((d): d is string => Boolean(d)),
    ),
  ]
    .sort()
    .slice(0, 7);
  return {
    days: dates.map((date) => {
      const daily = rows.filter((r) => conditionWallTime(r)?.startsWith(date));
      const air = daily
        .filter(
          (r) => r.metric === 'air-temperature' && typeof r.value === 'number',
        )
        .map((r) => Number(r.value));
      const wind = daily
        .filter((r) => r.metric === 'wind-speed' && typeof r.value === 'number')
        .map((r) => Number(r.value));
      const weather = daily
        .filter((r) => r.metric === 'weather')
        .sort(
          (a, b) =>
            Math.abs(Number(conditionWallTime(a)?.slice(11, 13)) - 12) -
            Math.abs(Number(conditionWallTime(b)?.slice(11, 13)) - 12),
        )[0];
      return {
        date,
        minimumC: air.length ? Math.min(...air) : null,
        maximumC: air.length ? Math.max(...air) : null,
        windMaximumMps: wind.length ? Math.max(...wind) : null,
        summary: typeof weather?.value === 'string' ? weather.value : null,
      };
    }),
    source: preferred.label,
    stale:conditionFreshness(preferred,new Date().toISOString())==='stale',
    attribution:preferred.attribution??preferred.label,
    url:preferred.url,
    retrievedAt: preferred.retrievedAt,
    offline: Boolean(snapshot.offline),
  };
}
