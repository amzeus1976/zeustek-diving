import {
  conditionReading,
  type ConditionMetric,
  type ConditionProvenance,
  type ConditionReading,
  type MeasurementDepth,
} from '../../weather/conditions-model';
export interface AdapterContext {
  latitude: number;
  longitude: number;
  retrievedAt: string;
  historical: boolean;
  timeZone?: string;
}
type Json = Record<string, unknown>;
export const object = (value: unknown): Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
export const array = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];
const number = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const string = (value: unknown) =>
  typeof value === 'string' ? value : undefined;
type Field = [
  ConditionMetric,
  string,
  string,
  (MeasurementDepth | undefined)?,
  (string | undefined)?,
];
function fields(
  values: Json,
  definitions: Field[],
  source: ConditionProvenance,
) {
  return definitions.flatMap(([metric, key, unit, depth, datum]) => {
    const value = conditionReading(metric, values[key], unit, {
      ...source,
      ...(depth ? { depth } : {}),
      ...(datum ? { datum } : {}),
    });
    return value ? [value] : [];
  });
}
const SURFACE: MeasurementDepth = { kind: 'surface' };
export function weatherDescription(code: unknown) {
  const map: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Freezing fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    80: 'Rain showers',
    81: 'Heavy rain showers',
    82: 'Violent rain showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Severe thunderstorm with hail',
  };
  return typeof code === 'number'
    ? (map[code] ?? `Weather code ${code}`)
    : undefined;
}
function instant(value: unknown, offset = 0) {
  if (typeof value === 'number') return new Date(value * 1000).toISOString();
  if (typeof value !== 'string') return null;
  const time = Date.parse(
    /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`,
  );
  return Number.isFinite(time)
    ? new Date(time - offset * 1000).toISOString()
    : null;
}

export function normalizeOpenMeteo(
  raw: unknown,
  context: AdapterContext,
  marine = false,
): ConditionReading[] {
  const body = object(raw);
  const hourly = object(body.hourly);
  const current = object(body.current);
  const hourlyUnits = object(body.hourly_units);
  const currentUnits = object(body.current_units);
  const definitions: Field[] = marine
    ? [
        ['water-temperature', 'sea_surface_temperature', '°C', SURFACE],
        ['wave-height', 'wave_height', 'm'],
        ['wave-period', 'wave_period', 's'],
        ['wave-direction', 'wave_direction', '°'],
        ['swell-height', 'swell_wave_height', 'm'],
        ['current-speed', 'ocean_current_velocity', 'km/h'],
        ['current-direction', 'ocean_current_direction', '°'],
        ['sea-level', 'sea_level_height_msl', 'm', undefined, 'MSL'],
      ]
    : [
        ['air-temperature', 'temperature_2m', '°C'],
        ['feels-like', 'apparent_temperature', '°C'],
        ['wind-speed', 'wind_speed_10m', 'km/h'],
        ['wind-gust', 'wind_gusts_10m', 'km/h'],
        ['wind-direction', 'wind_direction_10m', '°'],
        ['rain', 'precipitation', 'mm'],
        ['air-visibility', 'visibility', 'm'],
      ];
  const base: ConditionProvenance = {
    provider: 'open-meteo',
    label: marine ? 'Open-Meteo Marine' : 'Open-Meteo atmosphere',
    kind: 'model',
    classification: context.historical ? 'modelled' : 'forecast',
    url: marine
      ? 'https://open-meteo.com/en/docs/marine-weather-api'
      : 'https://open-meteo.com/',
    attribution: marine
      ? 'Open-Meteo · DWD / Copernicus Marine · CC BY 4.0'
      : 'Open-Meteo · CC BY 4.0',
    resolution: 'hourly model grid',
    model: marine
      ? 'Open-Meteo best-match marine models'
      : 'Open-Meteo best-match atmosphere',
    latitude: number(body.latitude, context.latitude),
    longitude: number(body.longitude, context.longitude),
    retrievedAt: context.retrievedAt,
    timeZone: string(body.timezone) ?? 'UTC',
  };
  const read = (values: Json, units: Json, time: unknown) => {
    const source = {
      ...base,
      validAt: instant(time, number(body.utc_offset_seconds, 0)),
    };
    const rows = fields(
      values,
      definitions.map(([metric, key, unit, depth, datum]) => [
        metric,
        key,
        string(units[key]) ?? unit,
        depth,
        datum,
      ]),
      source,
    );
    const summary = weatherDescription(values.weather_code);
    if (summary) {
      const r = conditionReading('weather', summary, 'text', source);
      if (r) rows.push(r);
    }
    return rows;
  };
  const result = array(hourly.time)
    .slice(0, 192)
    .flatMap((time, index) =>
      read(
        Object.fromEntries(
          Object.entries(hourly).map(([key, values]) => [
            key,
            array(values)[index],
          ]),
        ),
        hourlyUnits,
        time,
      ),
    );
  if (current.time) result.push(...read(current, currentUnits, current.time));
  return result;
}
export function normalizeMetOffice(
  raw: unknown,
  context: AdapterContext,
): ConditionReading[] {
  const feature = object(array(object(raw).features)[0]);
  const properties = object(feature.properties);
  const coords = array(object(feature.geometry).coordinates);
  const source: ConditionProvenance = {
    provider: 'met-office',
    label: 'Met Office DataHub',
    kind: 'model',
    classification: 'forecast',
    url: 'https://datahub.metoffice.gov.uk/',
    attribution: 'Powered by Met Office data',
    latitude: number(coords[1], context.latitude),
    longitude: number(coords[0], context.longitude),
    retrievedAt: context.retrievedAt,
    resolution: 'hourly nearest forecast location',
    timeZone: 'UTC',
    ...(string(properties.modelRunDate)
      ? { modelRunAt: String(properties.modelRunDate) }
      : {}),
    ...(string(object(properties.location).name)
      ? { station: String(object(properties.location).name) }
      : {}),
  };
  return array(properties.timeSeries)
    .slice(0, 168)
    .flatMap((value) => {
      const row = object(value);
      return fields(
        { ...object(row.data), ...row },
        [
          ['air-temperature', 'screenTemperature', '°C'],
          ['feels-like', 'feelsLikeTemperature', '°C'],
          ['wind-speed', 'windSpeed10m', 'm/s'],
          ['wind-gust', 'windGustSpeed10m', 'm/s'],
          ['wind-direction', 'windDirectionFrom10m', '°'],
          ['rain', 'totalPrecipAmount', 'mm'],
          ['air-visibility', 'visibility', 'm'],
        ],
        { ...source, validAt: instant(row.time) },
      );
    });
}
export function normalizeXweather(
  raw: unknown,
  context: AdapterContext,
  marine = false,
): ConditionReading[] {
  const body = object(raw);
  if (body.success === false) return [];
  return array(body.response)
    .slice(0, 1)
    .flatMap((value) => {
      const row = object(value);
      const loc = object(row.loc);
      const source: ConditionProvenance = {
        provider: 'xweather',
        label: marine ? 'Vaisala Xweather Maritime' : 'Vaisala Xweather',
        kind: 'model',
        classification: 'forecast',
        url: 'https://www.xweather.com/',
        attribution: 'Powered by Vaisala Xweather',
        latitude: number(loc.lat, context.latitude),
        longitude: number(loc.long, context.longitude),
        retrievedAt: context.retrievedAt,
        resolution: string(row.interval) ?? 'hourly forecast',
        timeZone: 'UTC',
      };
      return array(row.periods)
        .slice(0, 168)
        .flatMap((value) => {
          const period = object(value);
          return fields(
            period,
            marine
              ? [
                  [
                    'water-temperature',
                    'seaSurfaceTemperatureC',
                    '°C',
                    SURFACE,
                  ],
                  ['current-speed', 'seaCurrentSpeedMPS', 'm/s'],
                  ['current-direction', 'seaCurrentDirDEG', '°'],
                  ['wave-height', 'significantWaveHeightM', 'm'],
                  ['wave-period', 'primaryWavePeriod', 's'],
                  ['wave-direction', 'primaryWaveDirDEG', '°'],
                  ['swell-height', 'primarySwellHeightM', 'm'],
                  ['sea-level', 'tidesM', 'm', undefined, 'unknown'],
                ]
              : [
                  ['air-temperature', 'tempC', '°C'],
                  ['feels-like', 'feelslikeC', '°C'],
                  ['wind-speed', 'windSpeedMPS', 'm/s'],
                  ['wind-gust', 'windGustMPS', 'm/s'],
                  ['wind-direction', 'windDirDEG', '°'],
                  ['rain', 'precipMM', 'mm'],
                  ['weather', 'weather', 'text'],
                ],
            {
              ...source,
              validAt: instant(period.dateTimeISO ?? period.timestamp),
            },
          );
        });
    });
}
export function normalizeTomorrow(
  raw: unknown,
  context: AdapterContext,
): ConditionReading[] {
  const body = object(raw);
  const loc = object(body.location);
  const source: ConditionProvenance = {
    provider: 'tomorrow',
    label: 'Tomorrow.io',
    kind: 'model',
    classification: 'forecast',
    url: 'https://www.tomorrow.io/',
    attribution: 'Tomorrow.io',
    latitude: number(loc.lat, context.latitude),
    longitude: number(loc.lon, context.longitude),
    retrievedAt: context.retrievedAt,
    resolution: 'hourly forecast',
    timeZone: 'UTC',
  };
  return array(object(body.timelines).hourly)
    .slice(0, 168)
    .flatMap((value) => {
      const period = object(value);
      return fields(
        object(period.values),
        [
          ['air-temperature', 'temperature', '°C'],
          ['feels-like', 'temperatureApparent', '°C'],
          ['wind-speed', 'windSpeed', 'm/s'],
          ['wind-gust', 'windGust', 'm/s'],
          ['wind-direction', 'windDirection', '°'],
          ['air-visibility', 'visibility', 'km'],
        ],
        { ...source, validAt: instant(period.time) },
      );
    });
}
export function normalizeWwo(
  raw: unknown,
  context: AdapterContext,
): ConditionReading[] {
  const body = object(object(raw).data);
  const source: ConditionProvenance = {
    provider: 'wwo',
    label: 'World Weather Online Marine',
    kind: 'model',
    classification: context.historical ? 'modelled' : 'forecast',
    url: 'https://www.worldweatheronline.com/',
    attribution: 'World Weather Online',
    latitude: context.latitude,
    longitude: context.longitude,
    retrievedAt: context.retrievedAt,
    resolution: 'three-hourly marine forecast',
    timeZone: 'source-local (offset not supplied)',
  };
  return array(body.weather)
    .slice(0, 7)
    .flatMap((value) => {
      const day = object(value);
      const date = string(day.date);
      if (!date) return [];
      const rs = array(day.hourly)
        .slice(0, 24)
        .flatMap((value) => {
          const hour = object(value);
          const time = (
            typeof hour.time === 'string' || typeof hour.time === 'number'
              ? String(hour.time)
              : ''
          ).padStart(4, '0');
          if (!/^\d{4}$/.test(time)) return [];
          return fields(
            hour,
            [
              ['water-temperature', 'waterTemp_C', '°C', SURFACE],
              ['air-temperature', 'tempC', '°C'],
              ['wind-speed', 'windspeedKmph', 'km/h'],
              ['wind-gust', 'WindGustKmph', 'km/h'],
              ['wind-direction', 'winddirDegree', '°'],
              ['swell-height', 'swellHeight_m', 'm'],
              ['wave-height', 'sigHeight_m', 'm'],
              ['wave-period', 'swellPeriod_secs', 's'],
              ['air-visibility', 'visibility', 'km'],
              ['rain', 'precipMM', 'mm'],
            ],
            {
              ...source,
              validAt: `${date}T${time.slice(0, 2)}:${time.slice(2)}`,
            },
          );
        });
      for (const tides of array(day.tides))
        for (const value of array(object(tides).tide_data)) {
          const tide = object(value);
          const r = conditionReading('sea-level', tide.tideHeight_mt, 'm', {
            ...source,
            validAt: `${date}T${string(tide.tideTime) ?? '00:00'}`,
            datum: 'unknown',
            detail: `${string(tide.tide_type) ?? 'Tide'} · datum not supplied`,
          });
          if (r) rs.push(r);
        }
      return rs;
    });
}
export function normalizeMetNorway(
  raw: unknown,
  context: AdapterContext,
): ConditionReading[] {
  const body = object(raw);
  const properties = object(body.properties);
  const meta = object(properties.meta);
  const coords = array(object(body.geometry).coordinates);
  const source: ConditionProvenance = {
    provider: 'met-norway',
    label: 'MET Norway Oceanforecast',
    kind: 'model',
    classification: 'forecast',
    url: 'https://api.met.no/weatherapi/oceanforecast/2.0/documentation',
    attribution: 'MET Norway · CC BY 4.0',
    latitude: number(coords[1], context.latitude),
    longitude: number(coords[0], context.longitude),
    retrievedAt: context.retrievedAt,
    resolution: 'hourly ocean model',
    timeZone: 'UTC',
    ...(string(meta.updated_at) ? { modelRunAt: String(meta.updated_at) } : {}),
  };
  return array(properties.timeseries)
    .slice(0, 168)
    .flatMap((value) => {
      const row = object(value);
      return fields(
        object(object(object(row.data).instant).details),
        [
          ['water-temperature', 'sea_water_temperature', '°C'],
          ['current-speed', 'sea_water_speed', 'm/s'],
          ['current-direction', 'sea_water_to_direction', '°'],
          ['wave-height', 'sea_surface_wave_height', 'm'],
          ['wave-direction', 'sea_surface_wave_from_direction', '°'],
        ],
        { ...source, validAt: instant(row.time) },
      );
    });
}
/** Strict bridge schema for depth-resolved Copernicus subsets; the bridge must preserve dataset/coordinates/depth/time. */
export function normalizeCopernicus(
  raw: unknown,
  context: AdapterContext,
): ConditionReading[] {
  const body = object(raw);
  if (!string(body.dataset)) return [];
  return array(body.samples)
    .slice(0, 200)
    .flatMap((value) => {
      const row = object(value);
      if (
        !Number.isFinite(row.latitude) ||
        !Number.isFinite(row.longitude) ||
        !string(row.time)
      )
        return [];
      const source: ConditionProvenance = {
        provider: 'copernicus',
        label: 'Copernicus Marine',
        kind: 'model',
        classification: context.historical ? 'modelled' : 'forecast',
        url: 'https://marine.copernicus.eu/',
        attribution: 'Copernicus Marine Service',
        model: String(body.dataset),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        retrievedAt: context.retrievedAt,
        validAt: instant(row.time),
        resolution: 'depth-resolved model subset',
        timeZone: 'UTC',
      };
      const rows: ConditionReading[] = [];
      const depth =
        typeof row.depth === 'number' && row.depth >= 0
          ? { kind: 'exact' as const, metres: row.depth }
          : null;
      if (depth) {
        const temp = conditionReading('water-temperature', row.thetao, '°C', {
          ...source,
          depth,
        });
        if (temp) rows.push(temp);
      }
      const bottom = conditionReading('water-temperature', row.bottomT, '°C', {
        ...source,
        depth: { kind: 'bottom' },
      });
      if (bottom) rows.push(bottom);
      return rows;
    });
}
