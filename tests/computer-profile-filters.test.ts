import { describe, expect, it } from 'vitest';
import {
  filterComputerProfiles,
  type ComputerProfileFilters,
  type StoredComputerProfile,
} from '../lib/offline/computer-profile-filters';

function profile(
  entityId: string,
  input: Partial<StoredComputerProfile> = {},
): StoredComputerProfile {
  return {
    entityId,
    importId: 'import-a',
    latestImportId: 'import-a',
    sourceDiveId: `source-${entityId}`,
    sourceSiteId: null,
    segmentHash: `hash-${entityId}`,
    targetDiveId: null,
    disposition: 'unlinked',
    sampleAttachmentId: null,
    sourceFileName: 'history-a.uddf',
    sourceAdapterKey: 'oceanic-plus-uddf-3.2.1',
    sourceSite: null,
    sourceGas: null,
    summary: {
      rawTimestamp: null,
      normalisedTimestamp: '2026-09-05T12:00:00+01:00',
      greatestDepthM: 20,
      sourceDurationSec: 1800,
      finalSampleElapsedSec: 1800,
      minimumTemperatureC: 12,
      ballastKg: 8,
      gasId: null,
      tankPressureBeginBar: null,
      tankPressureEndBar: null,
      waypointCount: 30,
    },
    preview: [],
    createdAt: '2026-09-15T12:00:00.000Z',
    modifiedAt: '2026-09-15T12:00:00.000Z',
    ...input,
  };
}

const all: ComputerProfileFilters = {
  search: '',
  status: 'all',
  dateFrom: '',
  dateTo: '',
  sourceId: 'all',
  possibleDiveId: 'all',
};

describe('T12.1 imported-profile filters', () => {
  const profiles = [
    profile('unlinked', {
      sourceSite: {
        name: 'St Abbs',
        location: 'Scotland',
        latitude: 55.89,
        longitude: -2.13,
      },
    }),
    profile('linked', {
      importId: 'import-b',
      latestImportId: 'import-b',
      sourceFileName: 'history-b.uddf',
      targetDiveId: 'dive-2',
      disposition: 'linked',
      summary: {
        ...profile('base').summary,
        normalisedTimestamp: '2026-09-09T09:30:00+01:00',
      },
    }),
    profile('excluded', { disposition: 'excluded' }),
  ];

  it('filters linked, unlinked and excluded profiles independently', () => {
    expect(
      filterComputerProfiles(profiles, { ...all, status: 'unlinked' }).map(
        (item) => item.entityId,
      ),
    ).toEqual(['unlinked']);
    expect(
      filterComputerProfiles(profiles, { ...all, status: 'linked' }).map(
        (item) => item.entityId,
      ),
    ).toEqual(['linked']);
    expect(
      filterComputerProfiles(profiles, { ...all, status: 'excluded' }).map(
        (item) => item.entityId,
      ),
    ).toEqual(['excluded']);
  });

  it('filters by date, import source, search and possible matching Dive', () => {
    const possible = new Map([['unlinked', new Set(['dive-1'])]]);
    expect(
      filterComputerProfiles(
        profiles,
        {
          ...all,
          search: 'st abbs',
          dateFrom: '2026-09-05',
          dateTo: '2026-09-05',
          sourceId: 'import-a',
          possibleDiveId: 'dive-1',
        },
        possible,
      ).map((item) => item.entityId),
    ).toEqual(['unlinked']);
  });
});
