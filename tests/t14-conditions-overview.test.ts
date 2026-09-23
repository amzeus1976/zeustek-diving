import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { overviewForecast } from '../lib/weather/overview-forecast';
import {
  conditionReading,
  type ConditionsSnapshot,
} from '../lib/weather/conditions-model';
import { zeustekDb } from '../lib/offline/db';
import { readLocalConditionsEvidence } from '../lib/weather/local-evidence';
import { mergeConditionsSettings } from '../lib/weather/conditions-settings';
afterEach(() => vi.unstubAllGlobals());
describe('T14 conditions overview and read boundaries', () => {
  it('summarises one named model without pooling competing forecasts or substituting zero for missing data', () => {
    const source = {
      provider: 'open-meteo' as const,
      kind: 'model' as const,
      classification: 'forecast' as const,
      label: 'Open-Meteo',
      url: 'https://open-meteo.com/',
      resolution: 'hourly',
      latitude: 50,
      longitude: -2,
      retrievedAt: '2026-09-23T10:00:00Z',
      timeZone: 'UTC',
    };
    const readings = [
      conditionReading('air-temperature', 15, '°C', {
        ...source,
        validAt: '2026-09-23T10:00:00Z',
      })!,
      conditionReading('air-temperature', 18, '°C', {
        ...source,
        validAt: '2026-09-23T12:00:00Z',
      })!,
      conditionReading('air-temperature', 40, '°C', {
        ...source,
        provider: 'tomorrow',
        label: 'Tomorrow',
        validAt: '2026-09-23T12:00:00Z',
      })!,
    ];
    const snapshot: ConditionsSnapshot = {
      version: 1,
      request: {
        latitude: 50,
        longitude: -2,
        siteId: 's',
        siteName: 'Coast',
        siteType: 'coastal',
        provider: 'open-meteo',
        date: '2026-09-23',
        time: '12:00',
        mode: 'forecast',
        marine: true,
      },
      retrievedAt: source.retrievedAt,
      readings,
      diagnostics: [],
    };
    expect(overviewForecast(snapshot).days[0]).toMatchObject({
      date: '2026-09-23',
      minimumC: 15,
      maximumC: 18,
      windMaximumMps: null,
      summary: null,
    });
  });
  it('reads only the current account cached evidence without network, repairs or pending edits', async () => {
    await zeustekDb.open();
    for (const table of zeustekDb.tables) await table.clear();
    const row = {
      schemaVersion: 1,
      recordHash: 'hash',
      deleted: 0 as const,
      updatedEventId: '',
      updatedAt: '2026-09-23',
    };
    await zeustekDb.entities.bulkPut([
      {
        ...row,
        entityId: 'dive:a:d1',
        module: 'dive:a',
        entityType: 'dive',
        record: { siteId: 's', date: '2026-09-22' },
      },
      {
        ...row,
        entityId: 'dive:b:d2',
        module: 'dive:b',
        entityType: 'dive',
        record: { siteId: 's', date: '2026-09-22' },
      },
    ]);
    vi.stubGlobal('fetch', vi.fn());
    const before = await zeustekDb.entities.toArray();
    expect(
      (await readLocalConditionsEvidence('a')).dives.map((d) => d.entityId),
    ).toEqual(['d1']);
    expect(await zeustekDb.entities.toArray()).toEqual(before);
    expect(await zeustekDb.events.count()).toBe(0);
    expect(await zeustekDb.outbox.count()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves other configuration and restores Open-Meteo when the selected default is disabled', () => {
    const current = {
      entityId: 'config',
      selectedAwards: ['dives'],
      maxAwards: 6,
      homeWeatherSiteIds: ['s'],
      newsletterEmail: 'retained@example.com',
      createdAt: 'a',
      modifiedAt: 'b',
    };
    const result = mergeConditionsSettings(current, {
      version: 1,
      defaultProvider: 'xweather',
      disabledProviders: ['xweather'],
      includeSiteReferences: false,
    });
    expect(result).toMatchObject({homeWeatherSiteIds:['s'],newsletterEmail:current.newsletterEmail});
    expect(result.weatherConditions.defaultProvider).toBe('open-meteo');
  });
});
