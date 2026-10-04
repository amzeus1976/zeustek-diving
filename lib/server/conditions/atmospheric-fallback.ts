import {
  conditionReading,
  selectConditions,
  type ConditionMetric,
  type ConditionProvenance,
  type ConditionReading,
  type ConditionsRequest,
  type ProviderDiagnostic,
} from '../../weather/conditions-model';
import { array, object } from './adapters';
import { conditionsFetch, ConditionsError } from './transport';

const months = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];
const scalarText = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
function coordinates(raw: unknown) {
  const values = array(object(object(raw).geometry).coordinates);
  const [longitude, latitude] = values;
  return typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
    ? { latitude, longitude }
    : null;
}
function readings(
  values: Array<[ConditionMetric, unknown, string]>,
  source: ConditionProvenance,
) {
  return values.flatMap(([metric, value, unit]) => {
    const row = conditionReading(metric, value, unit, source);
    return row ? [row] : [];
  });
}
function metSummary(raw: unknown) {
  if (typeof raw !== 'string' || !/^[a-z_]+$/.test(raw)) return undefined;
  return raw
    .replace(/_(day|night|polartwilight)$/, '')
    .replace(/partlycloudy/g, 'partly cloudy')
    .replace(/clearsky/g, 'clear sky')
    .replace(/fair/g, 'mainly clear')
    .replace(/_/g, ' ');
}
/** One global forecast model; source coordinates and UTC instants are never replaced by the requested point/time. */
export function normalizeLocationForecast(
  raw: unknown,
  request: ConditionsRequest,
  retrievedAt: string,
): ConditionReading[] {
  const point = coordinates(raw);
  if (!point) return [];
  const properties = object(object(raw).properties);
  const meta = object(properties.meta);
  const units = object(meta.units);
  return array(properties.timeseries)
    .slice(0, 260)
    .flatMap((item) => {
      const row = object(item);
      if (
        typeof row.time !== 'string' ||
        !row.time.endsWith('Z') ||
        !Number.isFinite(Date.parse(row.time))
      )
        return [];
      const data = object(row.data);
      const detail = object(object(data.instant).details);
      const next = object(data.next_1_hours ?? data.next_6_hours);
      const source: ConditionProvenance = {
        provider: 'met-norway',
        label: 'MET Norway global atmosphere',
        kind: 'model',
        classification: 'forecast',
        url: 'https://www.met.no/en',
        attribution: 'MET Norway · Locationforecast · CC BY 4.0',
        model: 'Locationforecast',
        resolution: 'hourly / six-hourly model grid',
        ...point,
        retrievedAt,
        validAt: row.time,
        timeZone: request.timeZone ?? 'UTC',
        ...(typeof meta.updated_at === 'string'
          ? { modelRunAt: meta.updated_at }
          : {}),
        detail:
          'Atmospheric model forecast. Air temperature is not water temperature or dive readiness.',
      };
      return readings(
        [
          [
            'air-temperature',
            detail.air_temperature,
            scalarText(units.air_temperature),
          ],
          ['wind-speed', detail.wind_speed, scalarText(units.wind_speed)],
          [
            'wind-gust',
            detail.wind_speed_of_gust,
            scalarText(units.wind_speed_of_gust),
          ],
          [
            'wind-direction',
            detail.wind_from_direction,
            scalarText(units.wind_from_direction),
          ],
          ['weather', metSummary(object(next.summary).symbol_code), 'text'],
        ],
        source,
      );
    });
}
/** A climatological month is useful context, never a forecast or observation for an individual dive date. */
export function normalizeMonthlyClimate(
  raw: unknown,
  request: ConditionsRequest,
  retrievedAt: string,
): ConditionReading[] {
  const point = coordinates(raw);
  if (!point) return [];
  const body = object(raw);
  const parameters = object(body.parameters);
  const values = object(object(body.properties).parameter);
  const month = months[Number(request.date.slice(5, 7)) - 1];
  if (!month) return [];
  const header = object(body.header);
  const years =
    typeof header.range === 'string'
      ? header.range.match(/\b(?:19|20)\d{2}\b/g)
      : null;
  const start = scalarText(header.start ?? years?.[0]),
    end = scalarText(header.end ?? years?.[1]);
  const period =
    /^\d{4}$/.test(start) && /^\d{4}$/.test(end)
      ? `${start}–${end}`
      : 'provider reference period (not supplied)';
  const source: ConditionProvenance = {
    provider: 'nasa',
    label: 'NASA POWER typical monthly climate',
    kind: 'model',
    classification: 'modelled',
    url: 'https://power.larc.nasa.gov/',
    attribution: 'NASA POWER · MERRA-2 monthly climatology',
    resolution: 'monthly climatology',
    model: 'NASA POWER',
    ...point,
    retrievedAt,
    validAt: null,
    timeZone: 'date-only',
    detail: `${month} typical monthly conditions · ${period}. Not an exact-date forecast or observation; no water or visibility estimate.`,
  };
  const supported = readings(
    [
      [
        'air-temperature',
        ['C', '°C'].includes(String(object(parameters.T2M).units))
          ? object(values.T2M)[month]
          : undefined,
        '°C',
      ],
      [
        'wind-speed',
        object(parameters.WS10M).units === 'm/s'
          ? object(values.WS10M)[month]
          : undefined,
        'm/s',
      ],
    ],
    source,
  );
  if (!supported.length) return [];
  return [
    ...supported,
    ...readings(
      [
        [
          'weather',
          `Typical ${month} climate (${period}); not a date forecast.`,
          'text',
        ],
      ],
      source,
    ),
  ];
}
/** When the location timezone is unknown, use a UTC-day average instead of pretending a UTC hour is the requested local hour. */
export function dailyUtcContext(
  rows: ConditionReading[],
  request: ConditionsRequest,
): ConditionReading[] {
  if (request.timeZone) return rows;
  return [
    ...new Set(
      rows
        .map((row) => row.validAt?.slice(0, 10))
        .filter((date): date is string => Boolean(date)),
    ),
  ].flatMap((date) => {
    const day = rows.filter((row) => row.validAt?.slice(0, 10) === date);
    if (!day.length) return [];
    const source: ConditionProvenance = {
      ...day[0]!,
      validAt: date,
      timeZone: 'date-only',
      resolution: 'UTC-day forecast average',
      detail:
        'Average of this model’s returned UTC-day samples. Location time zone was unavailable; this is not the forecast for the requested local hour.',
    };
    const output: ConditionReading[] = [];
    for (const metric of ['air-temperature', 'wind-speed'] as const) {
      const values = day
        .filter((row) => row.metric === metric && typeof row.value === 'number')
        .map((row) => Number(row.value));
      if (values.length)
        output.push(
          ...readings(
            [
              [
                metric,
                values.reduce((sum, value) => sum + value, 0) / values.length,
                metric === 'air-temperature' ? '°C' : 'm/s',
              ],
            ],
            source,
          ),
        );
    }
    if (output.length)
      output.push(
        ...readings(
          [
            [
              'weather',
              'Daily atmospheric forecast average (UTC day); local-hour conditions unavailable.',
              'text',
            ],
          ],
          source,
        ),
      );
    return output;
  });
}
export async function globalMetAtmosphere(request: ConditionsRequest) {
  const url = new URL(
    'https://api.met.no/weatherapi/locationforecast/2.0/compact',
  );
  url.search = new URLSearchParams({
    lat: request.latitude.toFixed(4),
    lon: request.longitude.toFixed(4),
  }).toString();
  const response = await conditionsFetch(url, {
    headers: {
      'User-Agent': 'ZeusTekConditions/1.0 https://dive.amzeus.co.uk/',
    },
    timeoutMs: 6000,
  });
  return {
    response,
    readings: dailyUtcContext(
      normalizeLocationForecast(response.data, request, response.retrievedAt),
      request,
    ),
  };
}
export async function independentAtmosphere(
  request: ConditionsRequest,
  now = new Date().toISOString(),
) {
  const result: {
    readings: ConditionReading[];
    diagnostics: ProviderDiagnostic[];
  } = { readings: [], diagnostics: [] };
  const disabled = new Set(request.disabledProviders ?? []);
  const days =
    (Date.parse(`${request.date}T12:00:00Z`) -
      Date.parse(`${now.slice(0, 10)}T12:00:00Z`)) /
    86400000;
  const failure = (provider: string, error: unknown) =>
    result.diagnostics.push({
      provider,
      status: error instanceof ConditionsError ? error.code : 'unavailable',
      message:
        error instanceof ConditionsError
          ? error.message
          : 'The independent weather source could not be reached.',
      retrievedAt: now,
    });
  if (
    !disabled.has('met-norway') &&
    request.mode === 'forecast' &&
    days >= 0 &&
    days < 9
  ) {
    try {
      const { response, readings: rows } = await globalMetAtmosphere(request);
      if (
        !selectConditions(rows, request, now).some((row) =>
          ['air-temperature', 'weather'].includes(row.metric),
        )
      )
        throw new ConditionsError(
          'empty',
          'MET Norway has no atmospheric forecast for the requested date.',
        );
      result.readings = rows;
      result.diagnostics.push({
        provider: 'met-norway',
        status: 'ok',
        message: 'Independent global atmospheric forecast received.',
        retrievedAt: response.retrievedAt,
      });
      return result;
    } catch (error) {
      failure('met-norway', error);
    }
  }
  if (!disabled.has('nasa')) {
    try {
      const url = new URL(
        'https://power.larc.nasa.gov/api/temporal/climatology/point',
      );
      url.search = new URLSearchParams({
        parameters: 'T2M,WS10M',
        community: 'RE',
        longitude: String(request.longitude),
        latitude: String(request.latitude),
        format: 'JSON',
      }).toString();
      const response = await conditionsFetch(url, {
        ttlMs: 30 * 86400000,
        timeoutMs: 8000,
      });
      result.readings = normalizeMonthlyClimate(
        response.data,
        request,
        response.retrievedAt,
      );
      if (!result.readings.length)
        throw new ConditionsError(
          'empty',
          'NASA POWER has no supported monthly climate values at this location.',
        );
      result.diagnostics.push({
        provider: 'nasa',
        status: 'ok',
        message:
          'Typical monthly climate received; not an exact-date forecast or observation.',
        retrievedAt: response.retrievedAt,
      });
    } catch (error) {
      failure('nasa', error);
    }
  }
  return result;
}
