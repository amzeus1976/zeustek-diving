import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearConditionsTransport } from '../lib/server/conditions/transport';
import {
  conditionsService,
  atmosphericFallback,
  checkProvider,
  providerStatuses,
} from '../lib/server/conditions/service';
import { parseConditionsRequest } from '../lib/server/conditions/request';
import {
  selectConditions,
  type ConditionsRequest,
} from '../lib/weather/conditions-model';
import { planningWeatherRegime } from '../lib/plan-weather';
import {
  fetchDiveLogWeather,
  historicalWeatherBackfillConditions,
} from '../lib/weather/dive-log-weather';
vi.mock('cloudflare:workers', () => ({
  env: {
    XWEATHER_CLIENT_ID: 'fixture-xw-id',
    XWEATHER_CLIENT_SECRET: 'fixture-xw-secret',
  },
}));
vi.mock('../app/chatgpt-auth', () => ({
  getChatGPTUser: async () => ({ userId: 'fixture-owner' }),
}));
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
const xw = {
  success: true,
  response: [
    {
      loc: { lat: 50.8, long: -1.1 },
      profile: { tz: 'Europe/London' },
      periods: [
        {
          dateTimeISO: now,
          tempC: 18,
          weather: 'Partly cloudy',
          windSpeedKTS: 4,
        },
      ],
    },
  ],
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  clearConditionsTransport();
});
describe('shared bounded weather retrieval', () => {
  it('does not backfill recorded Dive temperatures from typical seasonal context, while retaining real daily historical models', () => {
    const monthly = {
      weatherContext: 'seasonal',
      resolution: 'monthly climatology',
      logConditions: { airTemperatureC: 12, weatherSummary: 'Typical October' },
    };
    expect(historicalWeatherBackfillConditions(monthly)).toBeNull();
    expect(
      historicalWeatherBackfillConditions({
        ...monthly,
        weatherContext: undefined,
        resolution: 'regional seasonal reference',
      }),
    ).toBeNull();
    expect(
      historicalWeatherBackfillConditions({
        provider: 'NASA POWER',
        resolution: 'daily',
        logConditions: {
          airTemperatureC: 14,
          weatherSummary: 'Daily averages — NASA POWER (UTC day)',
        },
      }),
    ).toMatchObject({ airTemperatureC: 14 });
  });
  it('uses configured supplied atmosphere on primary failure and reports actual Xweather access cost without secrets', async () => {
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('xweather')
        ? Response.json(xw, { headers: { 'X-Cost-Tokens': '1' } })
        : new Response('', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await conditionsService(
      request,
      {
        XWEATHER_CLIENT_ID: 'fixture-xw-id',
        XWEATHER_CLIENT_SECRET: 'fixture-xw-secret',
      },
      { now },
    );
    expect(
      selectConditions(result.readings, result.request, now).find(
        (r) => r.metric === 'air-temperature',
      ),
    ).toMatchObject({ provider: 'xweather', value: 18 });
    expect(
      result.diagnostics.find((d) => d.provider === 'xweather'),
    ).toMatchObject({ status: 'ok', costAccesses: 1 });
    expect(JSON.stringify(result)).not.toContain('fixture-xw-secret');
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
  });
  it('skips disabled supplied providers and does not probe credentialed providers on successful primary retrieval', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        latitude: 50.8,
        longitude: -1.1,
        timezone: 'Europe/London',
        utc_offset_seconds: 3600,
        hourly: { time: ['2026-10-04T12:00'], temperature_2m: [17] },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const env = {
      XWEATHER_CLIENT_ID: 'fixture-xw-id',
      XWEATHER_CLIENT_SECRET: 'fixture-xw-secret',
    };
    await conditionsService(request, env, { now });
    expect(fetcher).toHaveBeenCalledTimes(1);
    clearConditionsTransport();
    fetcher.mockClear();
    await atmosphericFallback(
      { ...request, disabledProviders: ['xweather', 'met-norway', 'nasa'] },
      env,
      now,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not issue a current credentialed forecast for a historical or far-future date', async () => {
    const fetcher = vi.fn(
      async (_url: URL | string) => new Response('', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetcher);
    await atmosphericFallback(
      { ...request, date: '2024-01-15', mode: 'historical' },
      {
        XWEATHER_CLIENT_ID: 'fixture-xw-id',
        XWEATHER_CLIENT_SECRET: 'fixture-xw-secret',
      },
      now,
    );
    expect(
      fetcher.mock.calls.every((c) => !String(c[0]).includes('/forecasts/')),
    ).toBe(true);
  });
  it('keeps NASA disabling and a verified destination timezone at the request boundary', () => {
    const input = parseConditionsRequest(
      new URL(
        'https://fixture.invalid/api/conditions?latitude=50.8&longitude=-1.1&disabled=nasa,xweather&timeZone=Europe%2FLondon',
      ),
    );
    expect(input.disabledProviders).toEqual(['nasa', 'xweather']);
    expect(input.timeZone).toBe('Europe/London');
    expect(() =>
      parseConditionsRequest(
        new URL(
          'https://fixture.invalid/api/conditions?latitude=50.8&longitude=-1.1&timeZone=Invalid%2FZone',
        ),
      ),
    ).toThrow(/time zone/i);
  });
  it('extends real forecast planning through day15 and uses seasonal context beyond the supported horizon', () => {
    expect(planningWeatherRegime('2026-10-19', '2026-10-04')).toBe('forecast');
    expect(planningWeatherRegime('2026-10-20', '2026-10-04')).toBe('seasonal');
  });
  it('uses the shared server fallback for Dive Log without recursion, repeated primary requests or source-data writes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('xweather')
        ? Response.json(xw)
        : new Response('', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('../app/api/site-weather/route');
    const response = await GET(
      new Request(
        'https://fixture.invalid/api/site-weather?latitude=50.8&longitude=-1.1&date=2026-10-04&time=12:00',
      ),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      provider: 'Vaisala Xweather',
      logConditions: { airTemperatureC: 18 },
    });
    expect(
      fetcher.mock.calls.filter((c) =>
        String(c[0]).includes('api.open-meteo.com'),
      ),
    ).toHaveLength(1);
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(3);
  });
  it('rejects missing coordinates and impossible dates before any server provider request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('../app/api/site-weather/route');
    for (const query of [
      'date=2026-10-04',
      'latitude=50.8&longitude=-1.1&date=2026-02-30',
    ]) {
      const response = await GET(
        new Request(`https://fixture.invalid/api/site-weather?${query}`),
      );
      expect(response.status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('passes existing provider/disabled preferences through Dive Log retrieval without client credentials', async () => {
    const fetcher = vi.fn(async (_url: URL | string | Request) =>
      Response.json({
        provider: 'MET Norway',
        logConditions: { airTemperatureC: 12 },
      }),
    );
    await fetchDiveLogWeather(
      { ...request, provider: 'auto', disabledProviders: ['xweather'] },
      undefined,
      fetcher,
    );
    const firstRequest = fetcher.mock.calls[0]?.[0];
    const params = new URL(
      firstRequest instanceof Request ? firstRequest.url : String(firstRequest),
      'https://fixture.invalid',
    ).searchParams;
    expect(params.get('provider')).toBe('auto');
    expect(params.get('disabled')).toBe('xweather');
    expect(params.has('client_secret')).toBe(false);
  });
  it('verifies global MET atmospheric access inland without treating Oceanforecast coverage as a global requirement', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          geometry: { coordinates: [-1.1, 50.8, 0] },
          properties: {
            meta: { units: { air_temperature: 'celsius' } },
            timeseries: [
              {
                time: now,
                data: { instant: { details: { air_temperature: 17 } } },
              },
            ],
          },
        }),
      ),
    );
    expect(await checkProvider('met-norway', {}, request, now)).toMatchObject({
      status: 'ok',
    });
  });
  it('never credits current provider forecasts to a seasonal future date, even when Auto providers were previously checked', async () => {
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('xweather')
        ? Response.json(xw)
        : new Response('', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetcher);
    const env = {
      XWEATHER_CLIENT_ID: 'fixture-xw-id',
      XWEATHER_CLIENT_SECRET: 'fixture-xw-secret',
    };
    await checkProvider('xweather', env, request, now);
    clearConditionsTransport();
    fetcher.mockClear();
    const result = await conditionsService(
      { ...request, mode: 'seasonal', date: '2027-10-20', provider: 'auto' },
      env,
      {
        now,
        legacy: async () => ({
          provider: 'NASA POWER',
          resolution: 'monthly climatology',
          logConditions: {
            airTemperatureC: 12,
            weatherSummary: 'Typical October; not an exact-date forecast.',
          },
        }),
      },
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.readings.every((r) => r.classification === 'modelled')).toBe(
      true,
    );
  });
  it('does not turn a place/date miss into a global credential denial or expose provider error text', async () => {
    const env = {
      XWEATHER_CLIENT_ID: 'fixture-scope-id',
      XWEATHER_CLIENT_SECRET: 'fixture-scope-secret',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(xw)),
    );
    expect((await checkProvider('xweather', env, request, now)).status).toBe(
      'ok',
    );
    clearConditionsTransport();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL | string) =>
        String(url).includes('xweather')
          ? Response.json({
              success: false,
              error: {
                code: 'invalid_location',
                description: 'fixture-scope-secret',
              },
              response: [],
            })
          : new Response('', { status: 503 }),
      ),
    );
    const result = await conditionsService(
      { ...request, provider: 'xweather' },
      env,
      { now },
    );
    expect(
      result.diagnostics.find((d) => d.provider === 'xweather')?.status,
    ).toBe('unsupported');
    expect(providerStatuses(env).find((p) => p.id === 'xweather')?.status).toBe(
      'ok',
    );
    expect(JSON.stringify(result)).not.toContain('fixture-scope-secret');
  });
  it('shows a labelled UTC-day average when an atmospheric provider cannot supply a valid destination zone', async () => {
    const { timeZone: _zone, ...withoutZone } = request;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          location: { lat: 50.8, lon: -1.1 },
          timelines: {
            hourly: [
              { time: '2026-10-04T03:00:00Z', values: { temperature: 12 } },
              { time: '2026-10-04T15:00:00Z', values: { temperature: 18 } },
            ],
          },
        }),
      ),
    );
    const result = await atmosphericFallback(
      { ...withoutZone, provider: 'tomorrow' },
      { TOMORROW_API_KEY: 'fixture-utc-average' },
      now,
    );
    expect(
      selectConditions(result.readings, withoutZone, now).find(
        (r) => r.metric === 'air-temperature',
      ),
    ).toMatchObject({
      value: 15,
      timeZone: 'date-only',
      resolution: 'UTC-day forecast average',
    });
  });
  it('keeps legacy batch forecasts private and prevents a cached NASA response bypassing the disabled setting', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const { GET } = await import('../app/api/site-weather/route');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ daily: { time: ['2026-10-04'] } })),
    );
    const batch = await GET(
      new Request('https://fixture.invalid/api/site-weather?points=1,2|3,4'),
    );
    expect(batch.ok).toBe(true);
    expect(batch.headers.get('cache-control')).toBe('private, no-store');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL | string) =>
        String(url).includes('power.larc')
          ? Response.json({
              properties: {
                parameter: { T2M: { 20200115: 14 }, WS10M: { 20200115: 2 } },
              },
            })
          : new Response('', { status: 503 }),
      ),
    );
    const query = 'latitude=15.123&longitude=16.123&date=2020-01-15&time=12:00';
    expect(
      (
        await GET(
          new Request('https://fixture.invalid/api/site-weather?' + query),
        )
      ).status,
    ).toBe(200);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    const disabled = await GET(
      new Request(
        'https://fixture.invalid/api/site-weather?' +
          query +
          '&disabled=nasa,met-norway,xweather,wwo,tomorrow,met-office',
      ),
    );
    expect(disabled.ok).toBe(false);
  });
});
