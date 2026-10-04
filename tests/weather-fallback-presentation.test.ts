import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SevenDayForecastCard } from '../components/weather/overview-conditions';
import { ConditionTile } from '../components/weather/conditions-view';
import { conditionReading } from '../lib/weather/conditions-model';
import { overviewForecast } from '../lib/weather/overview-forecast';
describe('truthful weather fallback presentation', () => {
  it('shows actual monthly context and its source after retrieval instead of the initial Get weather prompt', () => {
    const html = renderToStaticMarkup(
      createElement(SevenDayForecastCard, {
        site: {
          entityId: 'fixture-site',
          name: 'Fixture',
          location: 'Fixture coast',
        },
        forecast: {
          days: [],
          source: 'NASA POWER',
          retrievedAt: '2026-10-04T12:00:00Z',
          offline: false,
          stale: false,
          attribution: 'NASA POWER',
          url: 'https://power.larc.nasa.gov/',
          context: {
            kind: 'seasonal',
            temperatureC: 12.4,
            summary: 'Typical October 2001–2020; not a date forecast.',
          },
        },
      }),
    );
    expect(html).toContain('12.4');
    expect(html).toContain('2001');
    expect(html).toContain('not a date forecast');
    expect(html).toContain('NASA POWER');
    expect(html).not.toContain('Choose Get weather');
  });
  it('shows partial retrieval without an atmospheric forecast truthfully', () => {
    const html = renderToStaticMarkup(
      createElement(SevenDayForecastCard, {
        site: {
          entityId: 'fixture-site',
          name: 'Fixture',
          location: 'Fixture coast',
        },
        forecast: {
          days: [],
          source: 'No atmospheric forecast',
          retrievedAt: '2026-10-04T12:00:00Z',
          offline: false,
          stale: true,
          attribution: '',
          url: '',
        },
      }),
    );
    expect(html).toContain('No atmospheric forecast');
    expect(html).not.toContain('Choose Get weather');
  });
  it('keeps required Xweather credit visible before source details are expanded', () => {
    const reading = conditionReading('air-temperature', 18, '°C', {
      provider: 'xweather',
      label: 'Vaisala Xweather',
      kind: 'model',
      classification: 'forecast',
      latitude: 50.8,
      longitude: -1.1,
      retrievedAt: '2026-10-04T12:00:00Z',
      resolution: 'hourly',
      url: 'https://www.xweather.com/',
      attribution: 'Powered by Vaisala Xweather',
    })!;
    const html = renderToStaticMarkup(
      createElement(ConditionTile, { reading, now: '2026-10-04T12:00:00Z' }),
    );
    expect(html.indexOf('Powered by Vaisala Xweather')).toBeLessThan(
      html.indexOf('<details'),
    );
  });
  it('labels UTC-day averages rather than calling their mean a daily maximum, and excludes earlier dates', () => {
    const source = {
      provider: 'met-norway' as const,
      label: 'MET Norway',
      kind: 'model' as const,
      classification: 'forecast' as const,
      latitude: 50.8,
      longitude: -1.1,
      retrievedAt: '2026-10-04T12:00:00Z',
      resolution: 'UTC-day forecast average',
      url: 'https://www.met.no/',
      timeZone: 'date-only',
    };
    const forecast = overviewForecast({
      version: 1,
      retrievedAt: source.retrievedAt,
      diagnostics: [],
      request: {
        latitude: 50.8,
        longitude: -1.1,
        siteId: 'fixture-site',
        siteName: 'Fixture',
        siteType: 'coastal',
        provider: 'auto',
        date: '2026-10-04',
        time: '12:00',
        mode: 'forecast',
        marine: false,
      },
      readings: [
        conditionReading('air-temperature', 30, '°C', {
          ...source,
          validAt: '2026-10-03',
        })!,
        conditionReading('air-temperature', 17, '°C', {
          ...source,
          validAt: '2026-10-04',
        })!,
      ],
    });
    expect(forecast.days).toHaveLength(1);
    expect(forecast.days[0]).toMatchObject({
      date: '2026-10-04',
      maximumC: null,
      averageC: 17,
    });
    const html = renderToStaticMarkup(
      createElement(SevenDayForecastCard, {
        site: {
          entityId: 'fixture-site',
          name: 'Fixture',
          location: 'Fixture',
        },
        forecast,
      }),
    );
    expect(html).toContain('UTC-day average');
  });
});
