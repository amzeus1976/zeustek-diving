import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  marineFallback,
  conditionsService,
} from '../lib/server/conditions/service';
import { clearConditionsTransport } from '../lib/server/conditions/transport';
import {
  selectConditions,
  type ConditionsRequest,
} from '../lib/weather/conditions-model';
vi.mock('cloudflare:workers', () => ({
  env: {
    XWEATHER_CLIENT_ID: 'fixture-marine-id',
    XWEATHER_CLIENT_SECRET: 'fixture-marine-secret',
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
  marine: true,
  timeZone: 'Europe/London',
};
const atmosphere = {
  latitude: 50.8,
  longitude: -1.1,
  timezone: 'Europe/London',
  utc_offset_seconds: 3600,
  hourly: {
    time: ['2026-10-04T12:00'],
    temperature_2m: [17],
    weather_code: [2],
  },
};
const maritime = {
  success: true,
  response: [
    {
      loc: { lat: 50.8, long: -1.1 },
      periods: [
        {
          dateTimeISO: now,
          seaSurfaceTemperatureC: 16,
          significantWaveHeightM: 0.6,
          primaryWavePeriod: 5,
          seaCurrentSpeedMPS: 0.4,
          seaCurrentDirDEG: 180,
        },
      ],
    },
  ],
};
const env = {
  XWEATHER_CLIENT_ID: 'fixture-marine-id',
  XWEATHER_CLIENT_SECRET: 'fixture-marine-secret',
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  clearConditionsTransport();
});
describe('independent sea conditions', () => {
  it('fills a missing primary marine response without a redundant atmospheric provider request or invented depth', async () => {
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('/maritime/')
        ? Response.json(maritime, { headers: { 'X-Cost-Tokens': '1' } })
        : String(url).includes('marine-api')
          ? new Response('', { status: 503 })
          : Response.json(atmosphere),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await conditionsService(request, env, { now });
    const selected = selectConditions(result.readings, result.request, now);
    expect(selected.find((r) => r.metric === 'air-temperature')?.provider).toBe(
      'open-meteo',
    );
    expect(selected.find((r) => r.metric === 'wave-height')).toMatchObject({
      provider: 'xweather',
      value: 0.6,
    });
    expect(
      selected.find((r) => r.metric === 'water-temperature'),
    ).toMatchObject({ value: 16, depth: { kind: 'surface' } });
    expect(selected.find((r) => r.metric === 'current-speed')).toMatchObject({
      value: 0.4,
      unit: 'm/s',
    });
    expect(
      result.diagnostics.find((d) => d.provider === 'xweather-marine'),
    ).toMatchObject({ costAccesses: 1, status: 'ok' });
    expect(
      fetcher.mock.calls.some((c) => String(c[0]).includes('/forecasts/')),
    ).toBe(false);
    expect(JSON.stringify(result)).not.toContain('fixture-marine-secret');
  });
  it('retains zero-height calm seas and performs no replacement request when the primary has usable waves', async () => {
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('marine-api')
        ? Response.json({
            ...atmosphere,
            hourly: {
              time: ['2026-10-04T12:00'],
              wave_height: [0],
              sea_surface_temperature: [16],
            },
          })
        : Response.json(atmosphere),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await conditionsService(request, env, { now });
    expect(
      selectConditions(result.readings, result.request, now).find(
        (r) => r.metric === 'wave-height',
      )?.value,
    ).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('honours inland, seasonal, disabled and unsupported historical restrictions without sending paid marine requests', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const input of [
      { ...request, marine: false },
      { ...request, mode: 'seasonal' as const },
      {
        ...request,
        disabledProviders: ['xweather', 'wwo', 'met-norway'] as const,
      },
    ])
      expect(
        (await marineFallback(input as ConditionsRequest, env, now)).readings,
      ).toEqual([]);
    await marineFallback(
      { ...request, mode: 'historical', date: '2020-01-01' },
      env,
      now,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('keeps marine failure separate, does not fabricate any sea values or remove atmosphere', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL | string) =>
        String(url).includes('api.open-meteo.com/')
          ? Response.json(atmosphere)
          : new Response('', { status: 503 }),
      ),
    );
    const result = await conditionsService(request, env, { now });
    expect(result.readings.some((r) => r.metric === 'air-temperature')).toBe(
      true,
    );
    expect(
      result.readings.some(
        (r) => r.metric === 'wave-height' || r.metric === 'water-temperature',
      ),
    ).toBe(false);
    expect(
      result.diagnostics.some(
        (d) => d.provider === 'xweather-marine' && d.status === 'unavailable',
      ),
    ).toBe(true);
  });
  it('shares sea fallback with Dive Log even when its primary atmospheric request succeeds', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('/maritime/')
        ? Response.json(maritime)
        : String(url).includes('marine-api')
          ? new Response('', { status: 503 })
          : Response.json(atmosphere),
    );
    vi.stubGlobal('fetch', fetcher);
    const { GET } = await import('../app/api/site-weather/route');
    const response = await GET(
      new Request(
        'https://fixture.invalid/api/site-weather?latitude=50.8&longitude=-1.1&date=2026-10-04&time=12:00&marine=true',
      ),
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const result = (await response.json()) as {
      logConditions: Record<string, unknown>;
      attribution: string;
    };
    expect(result.logConditions).toMatchObject({
      airTemperatureC: 17,
      waveHeightM: 0.6,
      surfaceTemperatureC: 16,
      currentDirectionDegrees: 180,
    });
    expect(result.attribution).toContain('Powered by Vaisala Xweather');
    expect(
      fetcher.mock.calls.some((c) => String(c[0]).includes('/forecasts/')),
    ).toBe(false);
  });
  it('uses the returned destination timezone for Xweather sea and air readings when Open-Meteo cannot resolve it', async () => {
    const point = { lat: 35.7, long: 139.8 };
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('xweather')
        ? Response.json({
            success: true,
            response: [
              {
                loc: point,
                profile: { tz: 'Asia/Tokyo' },
                periods: [
                  String(url).includes('/maritime/')
                    ? {
                        ...maritime.response[0]!.periods[0]!,
                        dateTimeISO: '2026-10-04T03:00:00Z',
                      }
                    : { dateTimeISO: '2026-10-04T03:00:00Z', tempC: 20 },
                ],
              },
            ],
          })
        : new Response('', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetcher);
    const { timeZone: _zone, ...withoutZone } = request;
    const result = await conditionsService(
      { ...withoutZone, latitude: 35.7, longitude: 139.8 },
      env,
      { now },
    );
    expect(
      selectConditions(result.readings, result.request, now).find(
        (r) => r.metric === 'wave-height',
      ),
    ).toMatchObject({ value: 0.6, timeZone: 'Asia/Tokyo' });
    expect(
      fetcher.mock.calls.filter((c) => String(c[0]).includes('/maritime/')),
    ).toHaveLength(1);
  });
  it('rejects an invalid provider zone instead of relabelling UTC sea data as the requested local hour', async () => {
    const { timeZone: _zone, ...withoutZone } = request;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          ...maritime,
          response: [
            { ...maritime.response[0]!, profile: { tz: 'Invalid/Zone' } },
          ],
        }),
      ),
    );
    const result = await marineFallback(withoutZone, env, now);
    expect(result.readings).toEqual([]);
    expect(result.diagnostics[0]?.status).toBe('unsupported');
  });
});
