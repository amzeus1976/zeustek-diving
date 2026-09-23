import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { ConditionsView } from '../components/weather/conditions-view';
import {
  conditionReading,
  type ConditionsSnapshot,
} from '../lib/weather/conditions-model';
import {
  plannedWeatherSnapshot,
  ownerConditionMode,
} from '../lib/plan-weather';
import { parseConditionsRequest } from '../lib/server/conditions/request';
import { requestedInstant } from '../lib/server/conditions/service';
const request = {
  latitude: 54,
  longitude: -2,
  siteId: 'site-a',
  siteName: 'Quarry',
  siteType: 'inland' as const,
  provider: 'auto' as const,
  date: '2026-09-23',
  time: '12:00',
  mode: 'forecast' as const,
  marine: false,
  plannedDepthM: 18,
};
const now = '2026-09-23T12:00:00Z';
describe('T14 conditions presentation and request boundary', () => {
  it('shows SST, depth absence, unknown observation time and stale status without inventing at-depth temperature', () => {
    const source = {
      provider: 'operator' as const,
      kind: 'operator' as const,
      classification: 'observed' as const,
      label: 'Operator',
      url: 'https://example.com/',
      resolution: 'site report',
      latitude: 54,
      longitude: -2,
      retrievedAt: now,
      depth: { kind: 'surface' as const },
    };
    const snapshot: ConditionsSnapshot = {
      version: 1,
      request,
      retrievedAt: now,
      readings: [
        conditionReading('water-temperature', 18, '°C', source)!,
        conditionReading('visibility', 'Poor', 'text', {
          ...source,
          depth: { kind: 'exact', metres: 20 },
          observedAt: '2026-08-01',
        })!,
      ],
      diagnostics: [],
    };
    const html = renderToStaticMarkup(
      createElement(ConditionsView, { snapshot, now }),
    );
    expect(html).toContain('Surface / SST');
    expect(html).toContain('Observation time not supplied');
    expect(html).toContain('Stale');
    expect(html).toContain('planned 18 m depth is unknown');
    expect(html).toContain('Poor');
    expect(html).toContain('20 m');
  });
  it('does not write forecast SST into the Plan water-at-depth field', () => {
    const snapshot = plannedWeatherSnapshot(
      {
        logConditions: {
          weatherSummary: 'Forecast',
          airTemperatureC: 15,
          surfaceTemperatureC: 18,
        },
      },
      'forecast',
      'site-a',
      '2026-09-23',
      now,
    );
    expect(snapshot.surfaceTemperatureC).toBe(18);
    expect(snapshot.waterTemperatureC).toBeNull();
    const manual = ownerConditionMode(snapshot, 'manual');
    expect(manual.surfaceTemperatureC).toBeNull();
    expect(manual.waterTemperatureC).toBeNull();
  });
  it('rejects missing coordinates, invalid dates and unknown providers at the authenticated boundary', () => {
    for (const query of [
      'date=2026-09-23',
      'latitude=54&longitude=-2&date=2026-02-30',
      'latitude=54&longitude=-2&provider=unknown',
      'latitude=54&longitude=-2&time=28:00',
    ])
      expect(() =>
        parseConditionsRequest(
          new URL(`https://example.com/api/conditions?${query}`),
        ),
      ).toThrow();
  });
  it('converts destination wall time with the returned time zone rather than the browser zone', () => {
    expect(requestedInstant({ ...request, timeZone: 'Europe/London' })).toBe(
      '2026-09-23T11:00:00.000Z',
    );
    expect(
      requestedInstant({
        ...request,
        date: '2026-12-01',
        timeZone: 'Europe/London',
      }),
    ).toBe('2026-12-01T12:00:00.000Z');
  });
});
