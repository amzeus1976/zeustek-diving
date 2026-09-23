import { describe, expect, it } from 'vitest';
import {
  conditionReading,
  conditionFreshness,
  depthLabel,
  selectConditions,
  type ConditionsRequest,
} from '../lib/weather/conditions-model';
import {
  actualDiveConditions,
  actualDeviceConditions,
} from '../lib/weather/actual-dive-conditions';

const now = '2026-09-23T12:00:00Z';
const request: ConditionsRequest = {
  latitude: 54,
  longitude: -2,
  siteId: 'site-a',
  siteName: 'Quarry',
  siteType: 'inland',
  provider: 'auto',
  date: '2026-09-23',
  time: '12:00',
  mode: 'forecast',
  marine: false,
};
const source = {
  provider: 'operator' as const,
  label: 'Operator',
  kind: 'operator' as const,
  url: 'https://operator.example/',
  latitude: 54,
  longitude: -2,
  retrievedAt: now,
  observedAt: now,
  classification: 'observed' as const,
  resolution: 'site observation',
};
describe('T14 normalized conditions contract', () => {
  it('keeps exact, banded, bottom, mid-level, unknown and surface temperatures distinct', () => {
    const depths = [
      { kind: 'surface' as const },
      { kind: 'exact' as const, metres: 20 },
      { kind: 'band' as const, minimumM: 6, maximumM: 12 },
      { kind: 'bottom' as const },
      { kind: 'mid-level' as const },
      { kind: 'unknown' as const },
    ];
    expect(depths.map(depthLabel)).toEqual([
      'Surface / SST',
      '20 m',
      '6–12 m',
      'Bottom (depth not supplied)',
      'Mid-level (depth not supplied)',
      'Depth not supplied',
    ]);
    const values = depths.map((depth) =>
      conditionReading('water-temperature', 68, '°F', { ...source, depth }),
    );
    expect(values.every((r) => r?.value === 20 && r.unit === '°C')).toBe(true);
    expect(new Set(values.map((r) => r?.id)).size).toBe(6);
    expect(
      conditionReading('water-temperature', 20, '°C', {
        ...source,
        depth: { kind: 'band', minimumM: 12, maximumM: 6 },
      }),
    ).toBeNull();
  });
  it('normalizes known units, rejects unknown units and never treats atmospheric visibility as underwater', () => {
    expect(conditionReading('wind-speed', 36, 'km/h', source)?.value).toBe(10);
    expect(conditionReading('visibility', 30, 'ft', source)?.value).toBeCloseTo(
      9.144,
    );
    expect(
      conditionReading('visibility', 'Good', 'text', {
        ...source,
        depth: { kind: 'exact', metres: 6 },
      })?.value,
    ).toBe('Good');
    expect(conditionReading('water-temperature', 20, 'm', source)).toBeNull();
    expect(conditionReading('air-visibility', 5, 'km', source)?.metric).toBe(
      'air-visibility',
    );
    expect(
      conditionReading('water-temperature', null, '°C', source),
    ).toBeNull();
  });
  it('does not turn retrieval time into observation time or stale observations into fresh data', () => {
    const missing = conditionReading('water-temperature', 17, '°C', {
      ...source,
      observedAt: null,
    })!;
    expect(missing.observedAt).toBeNull();
    expect(conditionFreshness(missing, now)).toBe('observation-time-unknown');
    expect(
      conditionFreshness(
        { ...missing, observedAt: '2026-09-01T12:00:00Z' },
        now,
      ),
    ).toBe('stale');
    expect(
      conditionFreshness(
        {
          ...missing,
          classification: 'forecast',
          validAt: '2026-09-24T12:00:00Z',
        },
        now,
      ),
    ).toBe('fresh');
    expect(
      conditionFreshness(
        {
          ...missing,
          classification: 'forecast',
          retrievedAt: '2026-09-21T12:00:00Z',
          validAt: '2026-09-24T12:00:00Z',
        },
        now,
      ),
    ).toBe('stale');
  });
  it('selects by metric, freshness and geography while keeping disagreement and tide datums', () => {
    const operator = conditionReading('water-temperature', 17, '°C', {
      ...source,
      depth: { kind: 'unknown' },
    })!;
    const dive = conditionReading('water-temperature', 16, '°C', {
      ...source,
      provider: 'zeustek',
      kind: 'dive',
      label: 'Actual Dive',
      depth: { kind: 'unknown' },
    })!;
    const model = conditionReading('water-temperature', 19, '°C', {
      ...source,
      provider: 'open-meteo',
      kind: 'model',
      classification: 'forecast',
      validAt: now,
      depth: { kind: 'surface' },
    })!;
    const selected = selectConditions([operator, dive, model], request, now);
    expect(
      selected.find(
        (r) => r.metric === 'water-temperature' && r.depth.kind === 'unknown',
      )?.id,
    ).toBe(operator.id);
    expect(
      selectConditions(
        [{ ...operator, observedAt: '2026-08-01' }, dive],
        request,
        now,
      )[0]?.id,
    ).toBe(dive.id);
    expect(
      selectConditions(
        [{ ...operator, latitude: 0, longitude: 0 }, dive],
        request,
        now,
      )[0]?.id,
    ).toBe(dive.id);
    const tides = ['MSL', 'LAT', 'unknown'].map((datum) =>
      conditionReading('sea-level', 1, 'm', {
        ...source,
        provider: 'xweather',
        kind: 'model',
        datum,
      })!,
    );
    expect(
      selectConditions(tides, { ...request, marine: true }, now),
    ).toHaveLength(3);
    expect(selectConditions([operator, dive], request, now)[0]?.value).toBe(17); // never average competing sources
  });
  it('projects actual observed Dives without assigning minimum temperature to maximum depth or including backfilled SST', () => {
    const dives = [
      {
        entityId: 'd1',
        siteId: 'site-a',
        site: 'Quarry',
        date: '2026-09-22',
        timeIn: '10:00',
        maxDepthM: 30,
        bottomTimeMin: 30,
        minimumTemperatureC: 11,
        surfaceTemperatureC: 18,
        visibilityM: 7,
        weatherProvider: 'Open-Meteo',
      },
      {
        entityId: 'other',
        siteId: 'site-b',
        site: 'Quarry',
        date: '2026-09-22',
        maxDepthM: 20,
        bottomTimeMin: 20,
        minimumTemperatureC: 15,
      },
    ];
    const before = JSON.stringify(dives);
    const readings = actualDiveConditions(dives, request, now);
    expect(
      readings.some(
        (r) =>
          r.metric === 'water-temperature' &&
          r.value === 11 &&
          r.depth.kind === 'unknown',
      ),
    ).toBe(true);
    expect(readings.some((r) => r.value === 18 || r.value === 15)).toBe(false);
    expect(readings.every((r) => r.sourceRecordId === 'd1')).toBe(true);
    expect(JSON.stringify(dives)).toBe(before);
  });
  it('uses only device samples linked to an actual Dive at this Site and preserves measured sample depth', () => {
    const dives = [
      {
        entityId: 'd1',
        siteId: 'site-a',
        date: '2026-09-22',
        computerProfileIds: ['p1'],
      },
    ];
    const profile = {
      entityId: 'p1',
      targetDiveId: 'd1',
      disposition: 'linked' as const,
      summary: { normalisedTimestamp: '2026-09-22T10:00:00Z' },
      preview: [
        { elapsedSec: 120, depthM: 12.5, temperatureC: 13 },
        { elapsedSec: 180, depthM: 18, temperatureC: 11 },
      ],
    };
    const rs = actualDeviceConditions(
      dives,
      [
        profile,
        {
          ...profile,
          entityId: 'unlinked',
          targetDiveId: null,
          disposition: 'unlinked',
        },
      ],
      request,
      now,
    );
    expect(rs).toHaveLength(2);
    expect(rs.find((r) => r.value === 13)).toMatchObject({
      value: 13,
      depth: { kind: 'exact', metres: 12.5 },
      observedAt: '2026-09-22T10:02:00.000Z',
      kind: 'device',
      sourceRecordId: 'd1',
    });
  });
  it('keeps daily historical values eligible without pretending they are hourly or using later observations', () => {
    const daily = conditionReading('air-temperature', 12, '°C', {
      ...source,
      provider: 'nasa',
      kind: 'model',
      classification: 'modelled',
      observedAt: null,
      validAt: '2025-06-01',
      timeZone: 'date-only',
    })!;
    const future = conditionReading('water-temperature', 18, '°C', source)!;
    expect(
      selectConditions(
        [daily, future],
        { ...request, mode: 'historical', date: '2025-06-01' },
        now,
      ).map((r) => r.value),
    ).toEqual([12]);
  });
});
