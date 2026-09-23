import type { DiveRecord } from '../offline/dives';
import {
  conditionReading,
  type ConditionReading,
  type ConditionsRequest,
  type ConditionProvenance,
} from './conditions-model';
import type { ComputerProfileRecord } from '../offline/computer-import';
/** Pure projection. Minimum recorded temperature has no inferred association with maximum Dive depth. */
export function actualDiveConditions(
  dives: Array<
    Pick<
      DiveRecord,
      | 'siteId'
      | 'date'
      | 'timeIn'
      | 'diveNumber'
      | 'latitude'
      | 'longitude'
      | 'minimumTemperatureC'
      | 'surfaceTemperatureC'
      | 'visibilityM'
      | 'weatherProvider'
    > & { entityId: string }
  >,
  request: ConditionsRequest,
  retrievedAt: string,
): ConditionReading[] {
  const result: ConditionReading[] = [];
  for (const dive of dives) {
    if (!request.siteId || dive.siteId !== request.siteId || !dive.date)
      continue;
    const source: ConditionProvenance = {
      provider: 'zeustek',
      label: `Actual Dive ${dive.diveNumber ?? ''} · ${dive.date}`,
      kind: 'dive',
      classification: 'observed',
      url: '',
      resolution: 'recorded Dive observation',
      latitude: dive.latitude ?? request.latitude,
      longitude: dive.longitude ?? request.longitude,
      retrievedAt,
      observedAt: dive.timeIn ? `${dive.date}T${dive.timeIn}` : dive.date,
      timeZone: dive.timeIn
        ? 'source-local (offset not supplied)'
        : 'date-only',
      sourceRecordId: dive.entityId,
      detail:
        'Recorded minimum temperature; its measurement depth was not supplied.',
      depth: { kind: 'unknown' },
    };
    const minimum = conditionReading(
      'water-temperature',
      dive.minimumTemperatureC,
      '°C',
      source,
    );
    if (minimum) result.push(minimum);
    // Older weather backfills tag the record, not each field. Do not claim their SST as actual observation.
    if (!dive.weatherProvider) {
      const surface = conditionReading(
        'water-temperature',
        dive.surfaceTemperatureC,
        '°C',
        {
          ...source,
          depth: { kind: 'surface' },
          detail: 'Owner-recorded surface temperature.',
        },
      );
      if (surface) result.push(surface);
    }
    const visibility = conditionReading('visibility', dive.visibilityM, 'm', {
      ...source,
      detail:
        'Owner-recorded underwater visibility; measurement depth not supplied.',
    });
    if (visibility) result.push(visibility);
  }
  return result
    .sort((a, b) => (b.observedAt ?? '').localeCompare(a.observedAt ?? ''))
    .slice(0, 150);
}
type DeviceProfile = Pick<
  ComputerProfileRecord,
  'targetDiveId' | 'disposition' | 'preview'
> & {
  entityId: string;
  summary: Pick<ComputerProfileRecord['summary'], 'normalisedTimestamp'>;
};
export function actualDeviceConditions(
  dives: Array<
    Pick<
      DiveRecord,
      'siteId' | 'date' | 'latitude' | 'longitude' | 'computerProfileIds'
    > & { entityId: string }
  >,
  profiles: DeviceProfile[],
  request: ConditionsRequest,
  retrievedAt: string,
): ConditionReading[] {
  const result: ConditionReading[] = [];
  for (const profile of profiles) {
    if (
      !profile.targetDiveId ||
      !['linked', 'created'].includes(profile.disposition)
    )
      continue;
    const dive = dives.find(
      (row) =>
        row.entityId === profile.targetDiveId &&
        row.siteId === request.siteId &&
        row.computerProfileIds?.includes(profile.entityId),
    );
    if (!dive) continue;
    const timestamp = profile.summary.normalisedTimestamp;
    const hasZone = Boolean(timestamp && /Z$|[+-]\d{2}:\d{2}$/.test(timestamp));
    const start = timestamp
      ? Date.parse(hasZone ? timestamp : `${timestamp}Z`)
      : NaN;
    const samples = profile.preview.filter(
      (row) =>
        row.depthM !== null &&
        row.depthM >= 0 &&
        row.temperatureC !== null &&
        row.elapsedSec !== null &&
        row.elapsedSec >= 0,
    );
    // Preserve representative measured points without averaging temperatures or inventing a thermocline.
    const chosen = samples.filter(
      (_, index) =>
        index === 0 ||
        index === samples.length - 1 ||
        index % Math.max(1, Math.ceil(samples.length / 10)) === 0,
    );
    for (const sample of chosen) {
      const observed = Number.isFinite(start)
        ? new Date(start + sample.elapsedSec! * 1000).toISOString()
        : dive.date;
      const source: ConditionProvenance = {
        provider: 'zeustek',
        label: `Dive computer · ${dive.date}`,
        kind: 'device',
        classification: 'observed',
        url: '',
        station: profile.entityId,
        resolution: 'actual imported profile sample',
        latitude: dive.latitude ?? request.latitude,
        longitude: dive.longitude ?? request.longitude,
        retrievedAt,
        observedAt: hasZone ? observed : observed.replace(/Z$/, ''),
        timeZone: hasZone
          ? 'UTC'
          : timestamp
            ? 'source-local (offset not supplied)'
            : 'date-only',
        sourceRecordId: dive.entityId,
        depth: { kind: 'exact', metres: sample.depthM! },
        detail:
          'Temperature and depth from the same imported sample; profile preview, not an inferred depth curve.',
      };
      const reading = conditionReading(
        'water-temperature',
        sample.temperatureC,
        '°C',
        source,
      );
      if (reading) result.push(reading);
    }
  }
  return result
    .sort((a, b) => (b.observedAt ?? '').localeCompare(a.observedAt ?? ''))
    .slice(0, 120);
}
