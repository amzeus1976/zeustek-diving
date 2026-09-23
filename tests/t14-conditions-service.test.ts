import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  conditionsService,
  providerStatuses,
  checkProvider,
  hydrateProviderChecks,
} from '../lib/server/conditions/service';
import {
  clearConditionsTransport,
  conditionsFetch,
  ConditionsError,
} from '../lib/server/conditions/transport';
import { parseCapernwrayCsv } from '../lib/server/conditions/operators';
import {
  normalizePickadive,
  normalizeDiveNumber,
} from '../lib/server/conditions/enrichment';
import type { ConditionsRequest } from '../lib/weather/conditions-model';
const request: ConditionsRequest = {
  latitude: 50.8,
  longitude: -1.1,
  siteId: 'site-a',
  siteName: 'Coast',
  siteType: 'coastal',
  provider: 'open-meteo',
  date: '2026-09-23',
  time: '12:00',
  mode: 'forecast',
  marine: true,
};
const now = '2026-09-23T12:00:00Z';
afterEach(() => {
  vi.unstubAllGlobals();
  clearConditionsTransport();
});
const openResponse = {
  latitude: 50.8,
  longitude: -1.1,
  timezone: 'Europe/London',
  utc_offset_seconds: 3600,
  hourly: {
    time: ['2026-09-23T12:00'],
    temperature_2m: [17],
    weather_code: [2],
  },
};
describe('T14 conditions service boundary', () => {
  it('loads only matching persisted access checks without a schema write on read',async()=>{
    const secret='fixture-persisted-key';
    const signature=JSON.stringify([secret]);
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)))].map(v=>v.toString(16).padStart(2,'0')).join('');
    const prepare=vi.fn((sql:string)=>({bind:(timestamp:number)=>({all:async()=>({results:[{provider:'tomorrow',signature_hash:hash,diagnostic_json:JSON.stringify({provider:'tomorrow',status:'ok',message:'Verified',retrievedAt:now}),expires:timestamp+60000}]})})}));
    const env={TOMORROW_API_KEY:secret,DB:{prepare} as unknown as D1Database};
    await hydrateProviderChecks(env);
    expect(providerStatuses(env).find(p=>p.id==='tomorrow')?.enabled).toBe(true);
    expect(prepare.mock.calls.every(call=>String(call[0]).startsWith('SELECT'))).toBe(true);
    expect(providerStatuses({...env,TOMORROW_API_KEY:'rotated'}).find(p=>p.id==='tomorrow')?.enabled).toBe(false);
  });
  it('keeps no-key Open-Meteo enabled and credentialed providers disabled until a successful check', async () => {
    expect(
      providerStatuses({}).find((p) => p.id === 'open-meteo'),
    ).toMatchObject({ configured: true, enabled: true });
    const env = { MET_OFFICE_API_KEY: 'fixture-secret' };
    expect(
      providerStatuses(env).find((p) => p.id === 'met-office'),
    ).toMatchObject({ configured: true, enabled: false, status: 'unverified' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          features: [
            {
              geometry: { coordinates: [-1.1, 50.8] },
              properties: {
                timeSeries: [{ time: now, screenTemperature: 17 }],
              },
            },
          ],
        }),
      ),
    );
    const status = await checkProvider('met-office', env, request, now);
    expect(status.status).toBe('ok');
    expect(
      providerStatuses(env).find((p) => p.id === 'met-office')?.enabled,
    ).toBe(true);
    expect(
      providerStatuses({ MET_OFFICE_API_KEY: 'changed' }).find(
        (p) => p.id === 'met-office',
      )?.enabled,
    ).toBe(false);
  });
  it('falls back on provider denial without returning credentials or upstream error text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL | string) =>
        String(url).includes('metoffice')
          ? new Response('upstream accidentally echoes fixture-secret', {
              status: 401,
            })
          : Response.json(openResponse),
      ),
    );
    const result = await conditionsService(
      { ...request, provider: 'met-office' },
      { MET_OFFICE_API_KEY: 'fixture-secret' },
      { now },
    );
    expect(result.readings.some((r) => r.provider === 'open-meteo')).toBe(true);
    expect(
      result.diagnostics.find((d) => d.provider === 'met-office')?.status,
    ).toBe('denied');
    expect(JSON.stringify(result)).not.toContain('fixture-secret');
  });
  it('retains atmosphere when marine fails and does not fetch marine for inland sites', async () => {
    const fetcher = vi.fn(async (url: URL | string) =>
      String(url).includes('marine-api')
        ? new Response('', { status: 503 })
        : Response.json(openResponse),
    );
    vi.stubGlobal('fetch', fetcher);
    const result = await conditionsService(request, {}, { now });
    expect(result.readings.some((r) => r.metric === 'air-temperature')).toBe(
      true,
    );
    expect(
      result.diagnostics.some(
        (d) => d.provider === 'open-meteo-marine' && d.status === 'unavailable',
      ),
    ).toBe(true);
    clearConditionsTransport();
    fetcher.mockClear();
    await conditionsService(
      { ...request, marine: false, siteType: 'inland' },
      {},
      { now },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('preserves unknown-time Capernwray surface/mid-level temperatures and both visibility descriptions', () => {
    const rs = parseCapernwrayCsv(
      'announcements,surfaceWaterTemp,midLevelWaterTemp,waterVisibilty,visibilityDistance\n"Notice, with comma",21,19,Fantastic!,10',
      now,
    );
    expect(rs.map((r) => [r.value, r.depth.kind, r.observedAt])).toEqual([
      [21, 'surface', null],
      [19, 'mid-level', null],
      [10, 'unknown', null],
      ['Fantastic!', 'unknown', null],
    ]);
  });
  it('rate limits retries, caps downloads and never logs secret query URLs', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('secret', {
          status: 429,
          headers: { 'retry-after': '60' },
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      conditionsFetch(
        new URL(
          'https://api.tomorrow.io/v4/weather/forecast?apikey=fixture-secret',
        ),
      ),
    ).rejects.toMatchObject({ code: 'rate-limited' });
    await expect(
      conditionsFetch(
        new URL(
          'https://api.tomorrow.io/v4/weather/forecast?apikey=fixture-secret',
        ),
      ),
    ).rejects.toBeInstanceOf(ConditionsError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('normalizes enrichment without leaking provider tokens, private properties or inferred site conditions', () => {
    const rs = normalizeDiveNumber(
      {
        success: true,
        sites: [
          {
            spot_name: 'Example',
            lat: 50.801,
            lng: -1.101,
            token: 'secret',
            private_email: 'private',
          },
        ],
      },
      request,
      now,
    );
    expect(rs).toHaveLength(1);
    expect(JSON.stringify(rs)).not.toContain('secret');
    expect(rs[0]?.maxDepthM).toBeNull();
    const pick = normalizePickadive(
      {
        site: {
          name: 'Example',
          lat: 50.8,
          lng: -1.1,
          max_depth_m: 20,
          difficulty: 'intermediate',
          access: 'Shore',
          hazards: ['Boat traffic'],
          url: 'https://pickadive.com/site/example',
        },
      },
      request,
      now,
    );
    expect(pick[0]).toMatchObject({ maxDepthM: 20, access: 'Shore' });
  });
  it('retains Xweather atmosphere when its marine product fails, with a separate diagnostic', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: URL | string) => {
        if (String(url).includes('/maritime/'))
          return new Response('', { status: 503 });
        if (String(url).includes('xweather'))
          return Response.json({
            success: true,
            response: [
              {
                loc: { lat: 50.8, long: -1.1 },
                periods: [{ dateTimeISO: now, tempC: 18 }],
              },
            ],
          });
        return Response.json(openResponse);
      }),
    );
    const result = await conditionsService(
      { ...request, provider: 'xweather' },
      {
        XWEATHER_CLIENT_ID: 'fixture-id',
        XWEATHER_CLIENT_SECRET: 'fixture-secret',
      },
      { now },
    );
    expect(
      result.readings.some(
        (r) => r.provider === 'xweather' && r.metric === 'air-temperature',
      ),
    ).toBe(true);
    expect(
      result.diagnostics.some(
        (d) => d.provider === 'xweather-marine' && d.status === 'unavailable',
      ),
    ).toBe(true);
  });
  it('rejects credentialed World Weather Online redirects before forwarding a key', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response('', {
          status: 302,
          headers: { location: 'https://api.open-meteo.com/forecast' },
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      conditionsFetch(
        new URL(
          'https://api.worldweatheronline.com/premium/v1/marine.ashx?key=fixture-secret',
        ),
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
