import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeLocationForecast,
  normalizeMonthlyClimate,
  independentAtmosphere,
} from '../lib/server/conditions/atmospheric-fallback';
import { conditionsService } from '../lib/server/conditions/service';
import { clearConditionsTransport } from '../lib/server/conditions/transport';
import {
  selectConditions,
  type ConditionsRequest,
} from '../lib/weather/conditions-model';
import { plannedWeatherSnapshot } from '../lib/plan-weather';
import { overviewForecast } from '../lib/weather/overview-forecast';
import { normalizeOpenMeteo } from '../lib/server/conditions/adapters';

const now = '2026-10-04T12:00:00Z';
const request: ConditionsRequest = {
  latitude: 50.8,
  longitude: -1.1,
  siteId: 'fixture-site',
  siteName: 'Fixture coast',
  siteType: 'coastal',
  provider: 'open-meteo',
  date: '2026-10-04',
  time: '12:00',
  mode: 'forecast',
  marine: false,
  timeZone: 'Europe/London',
};
it('retains the real sixteenth-day atmosphere and sea values through the adapter and bounded service window', async () => {
  const time = Array.from({ length: 384 }, (_, i) =>
    new Date(Date.parse('2026-10-04T00:00:00Z') + i * 3600000)
      .toISOString()
      .slice(0, 16),
  );
  const array = (value: number) => Array.from({ length: 384 }, () => value);
  const body = {
    latitude: 50.8,
    longitude: -1.1,
    timezone: 'UTC',
    utc_offset_seconds: 0,
    hourly: {
      time,
      temperature_2m: array(18),
      apparent_temperature: array(17),
      weather_code: array(2),
      wind_speed_10m: array(2),
      wind_gusts_10m: array(3),
      wind_direction_10m: array(180),
      precipitation: array(0),
      visibility: array(10000),
      wave_height: array(0.4),
      wave_direction: array(90),
      wave_period: array(5),
      swell_wave_height: array(0.2),
      sea_surface_temperature: array(16),
      ocean_current_velocity: array(1),
      ocean_current_direction: array(180),
      sea_level_height_msl: array(0.1),
    },
  };
  const late = {
    ...request,
    date: '2026-10-19',
    time: '23:00',
    timeZone: 'UTC',
    marine: true,
  };
  expect(
    normalizeOpenMeteo(body, {
      latitude: 50.8,
      longitude: -1.1,
      retrievedAt: now,
      historical: false,
    }).some((r) => r.validAt?.startsWith('2026-10-19T23:00')),
  ).toBe(true);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(body)),
  );
  const snapshot = await conditionsService(late, {}, { now });
  const selected = selectConditions(snapshot.readings, snapshot.request, now);
  expect(selected.find((r) => r.metric === 'air-temperature')).toMatchObject({
    value: 18,
    provider: 'open-meteo',
  });
  expect(selected.find((r) => r.metric === 'wave-height')).toMatchObject({
    value: 0.4,
    provider: 'open-meteo',
  });
  expect(snapshot.readings.length).toBeLessThanOrEqual(6000);
});
const met = {
  geometry: { coordinates: [-1.1, 50.8, 0] },
  properties: {
    meta: {
      updated_at: now,
      units: {
        air_temperature: 'celsius',
        wind_speed: 'm/s',
        wind_from_direction: 'degrees',
        precipitation_amount: 'mm',
      },
    },
    timeseries: [
      {
        time: now,
        data: {
          instant: {
            details: {
              air_temperature: 15,
              wind_speed: 3,
              wind_from_direction: 180,
            },
          },
          next_1_hours: {
            summary: { symbol_code: 'partlycloudy_day' },
            details: { precipitation_amount: 0.3 },
          },
        },
      },
    ],
  },
};
const climate = {
  geometry: { coordinates: [-1.25, 50.75, 0] },
  header: { start: '2001', end: '2020', fill_value: -999 },
  properties: { parameter: { T2M: { OCT: 12.4 }, WS10M: { OCT: 4.1 } } },
  parameters: { T2M: { units: 'C' }, WS10M: { units: 'm/s' } },
};
afterEach(() => {
  vi.unstubAllGlobals();
  clearConditionsTransport();
});

describe('location-based weather reliability', () => {
  it('normalises global MET forecast with source coordinates, UTC validity, units and attribution', () => {
    const rs = normalizeLocationForecast(met, request, now);
    expect(rs.find((r) => r.metric === 'air-temperature')).toMatchObject({
      provider: 'met-norway',
      value: 15,
      classification: 'forecast',
      validAt: now,
      timeZone: 'Europe/London',
      latitude: 50.8,
      longitude: -1.1,
    });
    expect(rs.find((r) => r.metric === 'wind-speed')).toMatchObject({
      value: 3,
      unit: 'm/s',
    });
    expect(rs.find((r) => r.metric === 'weather')?.value).toMatch(
      /partly cloudy/i,
    );
    expect(rs.every((r) => r.attribution?.includes('MET Norway'))).toBe(true);
    expect(
      rs.some(
        (r) => r.metric === 'water-temperature' || r.metric === 'visibility',
      ),
    ).toBe(false);
  });
  it('keeps NASA monthly typical context distinct from the requested forecast and actual grid coordinates', () => {
    const rs = normalizeMonthlyClimate(
      climate,
      { ...request, date: '2027-10-20' },
      now,
    );
    expect(rs.find((r) => r.metric === 'air-temperature')).toMatchObject({
      provider: 'nasa',
      value: 12.4,
      classification: 'modelled',
      validAt: null,
      latitude: 50.75,
      longitude: -1.25,
      resolution: 'monthly climatology',
    });
    expect(rs.find((r) => r.metric === 'weather')?.value).toMatch(
      /typical.*not.*forecast/i,
    );
    expect(
      rs.every((r) => r.detail?.includes('2001') && r.detail?.includes('2020')),
    ).toBe(true);
    expect(
      rs.some(
        (r) => r.metric === 'water-temperature' || r.metric === 'visibility',
      ),
    ).toBe(false);
  });
  it('rejects sentinel, malformed, missing-month and unsupported-unit climate data', () => {
    for (const raw of [
      {
        ...climate,
        properties: { parameter: { T2M: { OCT: -999 }, WS10M: { OCT: -999 } } },
      },
      { ...climate, properties: { parameter: { T2M: { JAN: 12 } } } },
      {
        ...climate,
        parameters: { T2M: { units: 'F' }, WS10M: { units: 'mph' } },
      },
      {},
    ])
      expect(normalizeMonthlyClimate(raw, request, now)).toEqual([]);
  });
  it('retains the actual NASA reference period supplied in header.range', () => {
    const rs = normalizeMonthlyClimate(
      {
        ...climate,
        header: {
          range:
            '20-year Meteorological Monthly Climatologies (January 2001 - December 2020)',
          fill_value: -999,
        },
      },
      request,
      now,
    );
    expect(rs[0]?.detail).toContain('2001');
    expect(rs[0]?.detail).toContain('2020');
  });
  it('does not present a UTC forecast as the requested local hour when the location timezone is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...met,
          properties: {
            ...met.properties,
            timeseries: [
              met.properties.timeseries[0],
              {
                ...met.properties.timeseries[0],
                time: '2026-10-04T15:00:00Z',
                data: {
                  instant: { details: { air_temperature: 19, wind_speed: 5 } },
                },
              },
            ],
          },
        }),
      ),
    );
    const { timeZone: _zone, ...withoutZone } = request;
    const result = await independentAtmosphere(withoutZone, now);
    const air = result.readings.find((r) => r.metric === 'air-temperature');
    expect(air).toMatchObject({
      value: 17,
      validAt: '2026-10-04',
      timeZone: 'date-only',
      resolution: 'UTC-day forecast average',
    });
    expect(air?.detail).toContain(
      'not the forecast for the requested local hour',
    );
  });
  it('uses independent free MET when Open-Meteo is down, without inventing a selected provider success', async () => {
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('/locationforecast/')
        ? Response.json(met)
        : new Response('', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await conditionsService(request, {}, { now });
    expect(
      selectConditions(result.readings, result.request, now).find(
        (r) => r.metric === 'air-temperature',
      )?.provider,
    ).toBe('met-norway');
    expect(
      result.diagnostics.find((d) => d.provider === 'open-meteo')?.status,
    ).toBe('unavailable');
    const call = fetcher.mock.calls.find((c) =>
      String(c[0]).includes('/locationforecast/'),
    );
    expect(call).toBeTruthy();
  });
  it('reaches NASA typical context if every date-specific forecast fails, with bounded requests and no secrets in result', async () => {
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('power.larc.nasa.gov')
        ? Response.json(climate)
        : new Response('upstream private detail', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await independentAtmosphere(request, now);
    expect(
      result.readings.some(
        (r) => r.provider === 'nasa' && r.metric === 'air-temperature',
      ),
    ).toBe(true);
    expect(result.readings.every((r) => r.classification === 'modelled')).toBe(
      true,
    );
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
    expect(JSON.stringify(result)).not.toContain('upstream private detail');
  });
  it('uses monthly context beyond real forecast horizon without requesting a current forecast as next-year weather', async () => {
    const fetcher = vi.fn(async (_url: URL | string) => Response.json(climate));
    vi.stubGlobal('fetch', fetcher);
    const result = await independentAtmosphere(
      { ...request, date: '2027-10-20', mode: 'seasonal' },
      now,
    );
    expect(
      result.readings.find((r) => r.metric === 'air-temperature')?.value,
    ).toBe(12.4);
    expect(fetcher.mock.calls.length).toBe(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('/climatology/point');
  });
  it('does not call explicitly disabled MET or NASA, and never fabricates values on total failure', async () => {
    const fetcher = vi.fn(async () => new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    const disabled = await independentAtmosphere(
      { ...request, disabledProviders: ['met-norway', 'nasa'] },
      now,
    );
    expect(disabled.readings).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    const failed = await independentAtmosphere(request, now);
    expect(failed.readings).toEqual([]);
    expect(failed.diagnostics.every((d) => d.status !== 'ok')).toBe(true);
  });
  it('stores derived monthly context as seasonal even if the caller originally requested a forecast', () => {
    const result = plannedWeatherSnapshot(
      {
        resolution: 'monthly climatology',
        weatherContext: 'seasonal',
        logConditions: {
          airTemperatureC: 12.4,
          weatherSummary: 'Typical monthly climate; not a date forecast.',
        },
      },
      'forecast',
      'fixture-site',
      '2027-10-20',
      now,
    );
    expect(result.provenance).toBe('seasonal');
    expect(result.waterTemperatureC).toBeNull();
    expect(result.surfaceTemperatureC).toBeNull();
  });
  it('shows genuine typical context on Overview without manufacturing seven forecast days', () => {
    const result = overviewForecast({
      version: 1,
      request,
      retrievedAt: now,
      diagnostics: [],
      readings: normalizeMonthlyClimate(climate, request, now),
    });
    expect(result.days).toEqual([]);
    expect(result.context).toMatchObject({
      kind: 'seasonal',
      temperatureC: 12.4,
    });
    expect(result.source).toMatch(/NASA/i);
  });
});
