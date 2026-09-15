import { describe, expect, it } from 'vitest';
import {
  scoreImportMatch,
  suggestExistingDives,
  suggestSegmentGroups,
} from '../lib/offline/computer-import-matcher';
import type {
  OceanicSegment,
  OceanicSourceSite,
} from '../lib/offline/oceanic-uddf';
import type { DiveRecord } from '../lib/offline/dives';
import type { DiveSiteRecord, Stored } from '../lib/offline/dive-planning';

const segment: OceanicSegment = {
  sourceDiveId: 's1',
  sourceSiteId: 'site-source',
  rawTimestamp: '2026-09-05T11:58:00+01:00',
  normalisedTimestamp: '2026-09-05T11:58:00+01:00',
  timestampTransforms: [],
  greatestDepthM: 20,
  sourceDurationSec: 1800,
  finalSampleElapsedSec: 1800,
  minimumTemperatureC: null,
  ballastKg: null,
  gasId: null,
  diveMode: null,
  tankPressureBeginBar: null,
  tankPressureEndBar: null,
  waypoints: [],
};
const dive: DiveRecord & { entityId: string } = {
  entityId: 'd1',
  site: 'Site',
  siteId: 'canonical-site',
  date: '2026-09-05',
  timeIn: '11:58',
  maxDepthM: 20.5,
  bottomTimeMin: 30,
  gas: 'Air',
  notes: '',
  source: 'manual',
  createdAt: 'x',
  modifiedAt: 'x',
};
const sourceSite: OceanicSourceSite = {
  id: 'site-source',
  name: 'Site',
  location: 'Test',
  latitude: 55,
  longitude: -2,
};
const sites: Array<Stored<DiveSiteRecord>> = [
  {
    entityId: 'canonical-site',
    name: 'Site',
    location: 'Test',
    country: 'UK',
    maxDepthM: 30,
    access: 'Test access',
    hazards: '',
    notes: '',
    latitude: 55.001,
    longitude: -2.001,
    createdAt: 'x',
    modifiedAt: 'x',
  },
];

describe('T12 explainable matcher', () => {
  it('scores matching time/depth/GPS and exposes reasons', () => {
    const result = scoreImportMatch(segment, dive, sourceSite, sites);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.reasons.map((reason) => reason.key)).toEqual(
      expect.arrayContaining(['time', 'depth', 'gps']),
    );
  });

  it('suggests multi-segment groups but does not assign a target Dive', () => {
    const groups = suggestSegmentGroups([
      segment,
      {
        ...segment,
        sourceDiveId: 's2',
        normalisedTimestamp: '2026-09-05T12:05:00+01:00',
      },
    ]);
    expect(groups[0]?.segmentIds).toEqual(['s1', 's2']);
    expect(groups[0]?.reason).toMatch(/Suggestion only/);
  });

  it('lists same-date and nearest-time Dive candidates before looser similarities', () => {
    const candidates = suggestExistingDives(
      segment,
      [
        {
          ...dive,
          entityId: 'different-day',
          date: '2026-09-04',
          site: 'Site',
        },
        {
          ...dive,
          entityId: 'same-day-later',
          timeIn: '12:20',
        },
        { ...dive, entityId: 'same-day-nearest', timeIn: '12:00' },
      ],
      sourceSite,
      sites,
      10,
    );
    expect(candidates.map((candidate) => candidate.diveId).slice(0, 2)).toEqual(
      ['same-day-nearest', 'same-day-later'],
    );
    expect(candidates[0]?.reasons.map((reason) => reason.key)).toEqual(
      expect.arrayContaining(['time', 'site', 'duration', 'depth']),
    );
  });
});
