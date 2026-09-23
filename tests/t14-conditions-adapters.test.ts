import { describe, expect, it } from 'vitest';
import {
  normalizeOpenMeteo,
  normalizeMetOffice,
  normalizeXweather,
  normalizeTomorrow,
  normalizeWwo,
  normalizeMetNorway,
  normalizeCopernicus,
} from '../lib/server/conditions/adapters';
import { parseOperatorConditions } from '../lib/server/conditions/operators';
const context = {
  latitude: 54,
  longitude: -2,
  retrievedAt: '2026-09-23T12:00:00Z',
  historical: false,
};
describe('T14 provider fixtures', () => {
  it('normalizes Open-Meteo with actual grid coordinates, time zone, units and MSL datum', () => {
    const readings = normalizeOpenMeteo(
      {
        latitude: 54.02,
        longitude: -2.03,
        utc_offset_seconds: 3600,
        hourly: {
          time: ['2026-09-23T13:00'],
          sea_surface_temperature: [18],
          ocean_current_velocity: [3.6],
          sea_level_height_msl: [1.2],
        },
        hourly_units: {
          sea_surface_temperature: '°C',
          ocean_current_velocity: 'km/h',
          sea_level_height_msl: 'm',
        },
      },
      context,
      true,
    );
    expect(
      readings.find((r) => r.metric === 'water-temperature'),
    ).toMatchObject({
      value: 18,
      depth: { kind: 'surface' },
      latitude: 54.02,
      validAt: '2026-09-23T12:00:00.000Z',
      classification: 'forecast',
    });
    expect(readings.find((r) => r.metric === 'current-speed')?.value).toBe(1);
    expect(readings.find((r) => r.metric === 'sea-level')?.datum).toBe('MSL');
  });
  it('reads Met Office GeoJSON actual location and model run, leaving absent marine fields absent', () => {
    const rs = normalizeMetOffice(
      {
        features: [
          {
            geometry: { coordinates: [-2.1, 54.1] },
            properties: {
              modelRunDate: '2026-09-23T06:00:00Z',
              location: { name: 'Nearest grid site' },
              timeSeries: [
                {
                  time: '2026-09-23T12:00:00Z',
                  screenTemperature: 17,
                  windSpeed10m: 4,
                  windDirectionFrom10m: 180,
                },
              ],
            },
          },
        ],
      },
      context,
    );
    expect(rs.find((r) => r.metric === 'air-temperature')).toMatchObject({
      value: 17,
      latitude: 54.1,
      longitude: -2.1,
      modelRunAt: '2026-09-23T06:00:00Z',
    });
    expect(rs.some((r) => r.metric === 'water-temperature')).toBe(false);
  });
  it('keeps Xweather maritime SST, model tide datum unknown and required attribution', () => {
    const rs = normalizeXweather(
      {
        success: true,
        response: [
          {
            loc: { lat: 54, long: -2 },
            periods: [
              {
                dateTimeISO: '2026-09-23T12:00:00Z',
                seaSurfaceTemperatureC: 18,
                seaCurrentSpeedMPS: 0.5,
                significantWaveHeightM: 1.1,
                tidesM: 2.2,
              },
            ],
          },
        ],
      },
      context,
      true,
    );
    expect(rs.find((r) => r.metric === 'water-temperature')?.depth.kind).toBe(
      'surface',
    );
    expect(rs.find((r) => r.metric === 'sea-level')?.datum).toBe('unknown');
    expect(rs[0]?.attribution).toBe('Powered by Vaisala Xweather');
  });
  it('does not mislabel Tomorrow atmospheric visibility as underwater visibility', () => {
    const rs = normalizeTomorrow(
      {
        location: { lat: 54, lon: -2 },
        timelines: {
          hourly: [
            {
              time: '2026-09-23T12:00:00Z',
              values: { temperature: 16, windSpeed: 3, visibility: 8 },
            },
          ],
        },
      },
      context,
    );
    expect(rs.find((r) => r.metric === 'air-visibility')?.value).toBe(8000);
    expect(rs.some((r) => r.metric === 'visibility')).toBe(false);
  });
  it('uses WWO waterTemp_C as SST and keeps unknown tide datum and local time explicit', () => {
    const rs = normalizeWwo(
      {
        data: {
          request: [{ query: 'Lat 54 and Lon -2' }],
          weather: [
            {
              date: '2026-09-23',
              hourly: [
                {
                  time: '1200',
                  waterTemp_C: '18',
                  windspeedKmph: '36',
                  swellHeight_m: '1.2',
                  visibility: '8',
                },
              ],
              tides: [
                {
                  tide_data: [
                    {
                      tideTime: '12:00',
                      tideHeight_mt: '2.1',
                      tide_type: 'HIGH',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      context,
    );
    expect(rs.find((r) => r.metric === 'water-temperature')).toMatchObject({
      value: 18,
      depth: { kind: 'surface' },
      timeZone: 'source-local (offset not supplied)',
    });
    expect(rs.find((r) => r.metric === 'wind-speed')?.value).toBe(10);
    expect(rs.some((r) => r.metric === 'visibility')).toBe(false);
    expect(rs.find((r) => r.metric === 'sea-level')?.datum).toBe('unknown');
  });
  it('keeps MET Norway sea-water temperature depth unknown unless the source supplies depth', () => {
    const rs = normalizeMetNorway(
      {
        geometry: { coordinates: [5, 60, 0] },
        properties: {
          meta: {
            updated_at: '2026-09-23T06:00:00Z',
            units: { sea_water_temperature: 'celsius', sea_water_speed: 'm/s' },
          },
          timeseries: [
            {
              time: '2026-09-23T12:00:00Z',
              data: {
                instant: {
                  details: { sea_water_temperature: 14, sea_water_speed: 0.4 },
                },
              },
            },
          ],
        },
      },
      context,
    );
    expect(rs.find((r) => r.metric === 'water-temperature')).toMatchObject({
      value: 14,
      depth: { kind: 'unknown' },
      latitude: 60,
      longitude: 5,
    });
  });
  it('preserves genuine Copernicus sample depths and bottomT rather than inferring them', () => {
    const rs = normalizeCopernicus(
      {
        dataset: 'cmems-fixture',
        model: 'forecast',
        samples: [
          {
            latitude: 54,
            longitude: -2,
            time: '2026-09-23T12:00:00Z',
            depth: 20,
            thetao: 12,
          },
          {
            latitude: 54,
            longitude: -2,
            time: '2026-09-23T12:00:00Z',
            bottomT: 8,
          },
        ],
      },
      context,
    );
    expect(rs[0]).toMatchObject({
      value: 12,
      depth: { kind: 'exact', metres: 20 },
    });
    expect(rs[1]?.depth.kind).toBe('bottom');
  });
});
describe('operator conditions have bounded, source-specific parsers', () => {
  it('keeps Vobster surface temperature and source update date', () => {
    const rs = parseOperatorConditions(
      'vobster',
      '<p>SURFACE WATER TEMP:&nbsp;20 &deg;C UPDATED:&nbsp;23-09-2026</p>',
      context.retrievedAt,
    );
    expect(rs[0]).toMatchObject({
      value: 20,
      depth: { kind: 'surface' },
      observedAt: '2026-09-23',
      timeZone: 'date-only',
    });
  });
  it('keeps Ellerton unknown depth and missing observation time, ignoring expired closure prose', () => {
    const rs = parseOperatorConditions(
      'ellerton',
      '<p>Closed 5th September 2026.</p><p>Water Temperature 18.5 degrees C.</p>',
      context.retrievedAt,
    );
    expect(rs[0]).toMatchObject({
      value: 18.5,
      depth: { kind: 'unknown' },
      observedAt: null,
    });
    expect(rs.some((r) => r.metric === 'site-status')).toBe(false);
  });
  it('preserves Stoney Cove qualitative visibility at exact and open-ended depth bands', () => {
    const rs = parseOperatorConditions(
      'stoney',
      '<p>23rd September 2026</p><p>THE CURRENT SURFACE TEMPERATURE IS 17 ºC, Visibility is Good @ 6m / Good @ 20m / Poor @ Below 22m</p>',
      context.retrievedAt,
    );
    expect(
      rs
        .filter((r) => r.metric === 'visibility')
        .map((r) => [r.value, r.depth]),
    ).toEqual([
      ['Good', { kind: 'exact', metres: 6 }],
      ['Good', { kind: 'exact', metres: 20 }],
      ['Poor', { kind: 'band', minimumM: 22, maximumM: null }],
    ]);
    expect(rs[0]?.observedAt).toBe('2026-09-23');
  });
  it('does not invent Capernwray values from loading placeholders or marketing text', () => {
    expect(
      parseOperatorConditions(
        'capernwray',
        'SURFACE WATER TEMP Loading... MID-LEVEL WATER TEMP Loading... WATER VISIBILITY IS Loading...',
        context.retrievedAt,
      ),
    ).toEqual([]);
  });
});
