import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {afterEach, describe, expect, it, vi} from 'vitest';

afterEach(() => vi.restoreAllMocks());

describe('Weather display work while editing a Plan', () => {
  it('does not construct a timezone formatter for every hourly reading and forecast day', async () => {
    vi.resetModules();
    const {ConditionsView} = await import('../components/weather/conditions-view');
    const {conditionReading} = await import('../lib/weather/conditions-model');
    const now = '2026-10-06T06:00:00Z';
    const readings = Array.from({length: 840}, (_, index) => conditionReading(
      'air-temperature', 10 + index % 5, 'celsius', {
        provider: 'xweather', label: 'Dummy forecast', kind: 'model', classification: 'forecast',
        url: 'https://example.invalid/', resolution: 'hourly', latitude: 55, longitude: -2,
        retrievedAt: now, observedAt: null,
        validAt: new Date(Date.parse(now) + (index % 168) * 3600000).toISOString(),
        timeZone: index % 2 ? 'Europe/London' : 'Europe/Paris', depth: {kind: 'surface'},
      },
    )!);
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    const constructor = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function(locales, options) { return new NativeDateTimeFormat(locales, options); });
    const html = renderToStaticMarkup(createElement(ConditionsView, {
      snapshot: {version: 1, retrievedAt: now, readings, diagnostics: [], request: {
        latitude: 55, longitude: -2, siteId: 'fixture', siteName: 'Dummy coast', siteType: 'coastal',
        provider: 'auto', date: '2026-10-06', time: '12:00', mode: 'forecast', marine: true,
      }}, now,
    }));
    expect(html).toContain('Forecast \u00b7');
    expect(html).toContain('7 days');
    expect(html).toContain('2026-10-06 \u00b7 around midday');
    expect(html).toContain('Dummy forecast');
    expect(constructor.mock.calls.length).toBeLessThanOrEqual(2);
  }, 30000);

  it('preserves UTC, date-only, invalid inputs and both sides of daylight-saving changes', async () => {
    vi.resetModules();
    const {conditionWallTime} = await import('../lib/weather/conditions-model');
    const at = (validAt: string | null, timeZone: string) => conditionWallTime({validAt, timeZone} as Parameters<typeof conditionWallTime>[0]);
    expect(at('2026-10-25T00:30:00Z', 'Europe/London')).toBe('2026-10-25T01:30');
    expect(at('2026-10-25T01:30:00Z', 'Europe/London')).toBe('2026-10-25T01:30');
    expect(at('2026-03-29T00:30:00Z', 'Europe/London')).toBe('2026-03-29T00:30');
    expect(at('2026-03-29T01:30:00Z', 'Europe/London')).toBe('2026-03-29T02:30');
    expect(at('2026-10-06T12:00:00Z', 'UTC')).toBe('2026-10-06T12:00');
    expect(at('2026-10-06', 'date-only')).toBe('2026-10-06');
    expect(at('invalid', 'Europe/London')).toBeNull();
    expect(at('2026-10-06T12:00:00Z', 'invalid-zone')).toBeNull();
    expect(at(null, 'Europe/London')).toBeNull();
  });

  it('bounds retained formatter state when many different regions are opened', async () => {
    vi.resetModules();
    const {conditionWallTime} = await import('../lib/weather/conditions-model');
    const zones = Intl.supportedValuesOf('timeZone').slice(0, 40);
    const NativeDateTimeFormat = Intl.DateTimeFormat;
    const constructor = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function(locales, options) { return new NativeDateTimeFormat(locales, options); });
    const at = (timeZone: string) => conditionWallTime({validAt: '2026-10-06T12:00:00Z', timeZone} as Parameters<typeof conditionWallTime>[0]);
    zones.forEach(zone => expect(at(zone)).not.toBeNull());
    const count = constructor.mock.calls.length;
    at(zones[0]!);
    expect(constructor.mock.calls.length).toBe(count + 1);
    at(zones.at(-1)!);
    expect(constructor.mock.calls.length).toBe(count + 1);
  });
});
