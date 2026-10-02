import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeCopernicus } from '../lib/server/conditions/adapters';
import {
  checkProvider,
  conditionsService,
  providerStatuses,
} from '../lib/server/conditions/service';
import { clearConditionsTransport } from '../lib/server/conditions/transport';
import type { ConditionsRequest } from '../lib/weather/conditions-model';

const now = '2026-10-02T12:00:00Z';
const request: ConditionsRequest = {
  latitude: 50.8,
  longitude: -1.1,
  siteId: 'provider-assessment-site',
  siteName: 'Fixture coast',
  siteType: 'coastal',
  provider: 'auto',
  date: '2026-10-02',
  time: '12:00',
  timeZone: 'UTC',
  mode: 'forecast',
  marine: true,
  plannedDepthM: 20,
};
const atmospheric = {
  latitude: request.latitude,
  longitude: request.longitude,
  timezone: 'UTC',
  utc_offset_seconds: 0,
  hourly: { time: [now], temperature_2m: [17] },
};
const marine = {
  latitude: request.latitude,
  longitude: request.longitude,
  timezone: 'UTC',
  utc_offset_seconds: 0,
  hourly: { time: [now], wave_height: [1.2], sea_surface_temperature: [15] },
};
function fallbackFetch() {
  const fetcher = vi.fn(async (url: URL | Request | string) => {
    const address = url instanceof Request ? url.url : String(url);
    if (address.startsWith('https://marine-api.open-meteo.com/'))
      return Response.json(marine);
    if (address.startsWith('https://api.open-meteo.com/'))
      return Response.json(atmospheric);
    throw new Error('Unexpected external provider request in assessment fixture');
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
afterEach(() => {
  vi.unstubAllGlobals();
  clearConditionsTransport();
});

describe('outstanding optional provider assessment boundaries', () => {
  it('reports the actual configured, unverified and approval states without contacting providers', () => {
    const fetcher = fallbackFetch();
    const statuses = providerStatuses({
      MET_OFFICE_API_KEY: 'assessment-unverified-fixture',
    });
    expect(statuses.find((row) => row.id === 'met-office')).toMatchObject({
      configured: true, enabled: false, status: 'unverified',
    });
    expect(statuses.find((row) => row.id === 'copernicus')).toMatchObject({
      configured: false, enabled: false, status: 'unconfigured',
    });
    expect(statuses.find((row) => row.id === 'swellcloud')).toMatchObject({
      configured: false, enabled: false, status: 'disabled',
      reason: 'Awaiting provider approval and a documented access contract.',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('retains a redacted Met Office 403 and excludes the denied provider from Auto', async () => {
    const fixtureKey = 'assessment-denied-fixture';
    const deniedFetch = vi.fn(async () => new Response(
      `private upstream detail ${fixtureKey}`, { status: 403 },
    ));
    vi.stubGlobal('fetch', deniedFetch);
    const env = { MET_OFFICE_API_KEY: fixtureKey };
    const check = await checkProvider('met-office', env, request, now);
    expect(check).toMatchObject({ provider: 'met-office', status: 'denied' });
    expect(JSON.stringify(check)).not.toMatch(/private upstream detail|assessment-denied-fixture/);
    expect(providerStatuses(env).find((row) => row.id === 'met-office')).toMatchObject({
      configured: true, enabled: false, status: 'denied',
    });
    const fetcher = fallbackFetch();
    const result = await conditionsService(request, env, { now });
    expect(result.readings.some((row) => row.provider === 'open-meteo')).toBe(true);
    expect(result.readings.some((row) => row.provider === 'met-office')).toBe(false);
    expect(fetcher.mock.calls.every(([url]) => !(url instanceof Request ? url.url : String(url)).includes('metoffice'))).toBe(true);
    expect(request.provider).toBe('auto');
  });

  it('keeps missing direct Copernicus access separate from existing Open-Meteo marine provenance', async () => {
    const fetcher = fallbackFetch();
    const result = await conditionsService({ ...request, provider: 'copernicus' }, {}, { now });
    expect(result.diagnostics.find((row) => row.provider === 'copernicus')?.status).toBe('unconfigured');
    expect(result.readings.some((row) => row.provider === 'copernicus')).toBe(false);
    expect(result.readings.find((row) => row.metric === 'wave-height')).toMatchObject({
      provider: 'open-meteo', value: 1.2,
    });
    expect(result.readings.find((row) => row.metric === 'water-temperature')?.depth.kind).toBe('surface');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('never issues a SwellCloud request while its approval requirement is unsatisfied', async () => {
    const fetcher = fallbackFetch();
    const result = await conditionsService({ ...request, provider: 'swellcloud' }, {}, { now });
    expect(result.diagnostics.find((row) => row.provider === 'swellcloud')).toMatchObject({
      status: 'unconfigured',
      message: 'Awaiting provider approval and a documented access contract.',
    });
    expect(result.readings.some((row) => row.provider === 'swellcloud')).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not call even a supplied subset binding when the provider is explicitly disabled', async () => {
    fallbackFetch();
    const subset = vi.fn(async () => { throw new Error('Disabled binding must not run'); });
    const result = await conditionsService({
      ...request, provider: 'copernicus', disabledProviders: ['copernicus'],
    }, { COPERNICUS_CONDITIONS: { fetch: subset } }, { now });
    expect(subset).not.toHaveBeenCalled();
    expect(result.diagnostics.find((row) => row.provider === 'copernicus')?.status).toBe('disabled');
    expect(result.readings.some((row) => row.provider === 'open-meteo')).toBe(true);
  });

  it('preserves subset identity, returned coordinates, UTC validity and actual depth without copying private response fields', async () => {
    fallbackFetch();
    const subset = vi.fn(async (input: Request) => {
      expect(input.url).toBe('https://copernicus-conditions.internal/subset');
      expect(input.method).toBe('POST');
      expect(await input.json()).toEqual({ latitude: 50.8, longitude: -1.1, date: '2026-10-02', depthM: 20 });
      return Response.json({
        dataset: 'fixture-dataset-version-202610', private_token: 'fixture-not-output',
        samples: [{ latitude: 50.801, longitude: -1.101, time: now, depth: 20, thetao: 12, private_note: 'fixture-not-output' }],
      });
    });
    const result = await conditionsService({ ...request, provider: 'copernicus' }, {
      COPERNICUS_CONDITIONS: { fetch: subset },
    }, { now });
    expect(subset).toHaveBeenCalledTimes(1);
    expect(result.readings.find((row) => row.provider === 'copernicus')).toMatchObject({
      model: 'fixture-dataset-version-202610', latitude: 50.801, longitude: -1.101,
      timeZone: 'UTC', validAt: new Date(now).toISOString(), value: 12, unit: '°C', depth: { kind: 'exact', metres: 20 },
    });
    expect(JSON.stringify(result)).not.toContain('fixture-not-output');
  });

  it('retains fallback when a bound service returns no supported dataset', async () => {
    fallbackFetch();
    const subset = vi.fn(async () => Response.json({
      samples: [{ latitude: 50.8, longitude: -1.1, time: now, depth: 20, thetao: 12 }],
    }));
    const result = await conditionsService({ ...request, provider: 'copernicus' }, {
      COPERNICUS_CONDITIONS: { fetch: subset },
    }, { now });
    expect(result.diagnostics.find((row) => row.provider === 'copernicus')?.status).toBe('unsupported');
    expect(result.readings.some((row) => row.provider === 'copernicus')).toBe(false);
    expect(result.readings.some((row) => row.provider === 'open-meteo')).toBe(true);
  });

  it('does not turn undepth-resolved thetao into a planned-depth temperature and caps sample processing', () => {
    const context = { latitude: 50.8, longitude: -1.1, retrievedAt: now, historical: false };
    const sample = { latitude: 50.8, longitude: -1.1, time: now, thetao: 12 };
    expect(normalizeCopernicus({ dataset: 'fixture', samples: [sample] }, context)).toEqual([]);
    expect(normalizeCopernicus({ dataset: 'fixture', samples: [{ ...sample, depth: -1 }] }, context)).toEqual([]);
    const rows = normalizeCopernicus({
      dataset: 'fixture', samples: Array.from({ length: 201 }, (_, index) => ({ ...sample, depth: index })),
    }, context);
    expect(rows).toHaveLength(200);
    expect(rows.some((row) => row.depth.kind === 'exact' && row.depth.metres === 200)).toBe(false);
  });
});
