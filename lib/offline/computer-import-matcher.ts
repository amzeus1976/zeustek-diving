import type { DiveRecord } from './dives';
import type { DiveSiteRecord, Stored } from './dive-planning';
import type { OceanicSegment, OceanicSourceSite } from './oceanic-uddf';

export interface ImportMatchReason {
  key: string;
  label: string;
  points: number;
  detail: string;
}
export interface ImportMatchCandidate {
  diveId: string;
  score: number;
  confidence: 'strong' | 'possible' | 'weak';
  reasons: ImportMatchReason[];
}
const wallClock = (value: string | null | undefined) => {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return { date: match[1]!, minutes: Number(match[2]) * 60 + Number(match[3]) };
};
const haversineKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const r = 6371,
    rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude),
    dLon = rad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
};

export function scoreImportMatch(
  segment: OceanicSegment,
  dive: DiveRecord & { entityId: string },
  sourceSite: OceanicSourceSite | undefined,
  sites: Array<Stored<DiveSiteRecord>>,
): ImportMatchCandidate {
  const reasons: ImportMatchReason[] = [];
  let score = 0;
  const imported = wallClock(segment.normalisedTimestamp);
  const diveTime = wallClock(`${dive.date}T${dive.timeIn || '00:00'}:00`);
  if (imported && diveTime) {
    if (imported.date === diveTime.date) {
      const minutes = Math.abs(imported.minutes - diveTime.minutes);
      if (minutes <= 5) {
        score += 40;
        reasons.push({
          key: 'time',
          label: 'Time',
          points: 40,
          detail: `Within ${minutes.toFixed(1)} min local wall time`,
        });
      } else if (minutes <= 30) {
        score += 24;
        reasons.push({
          key: 'time',
          label: 'Time',
          points: 24,
          detail: `Within ${minutes.toFixed(0)} min local wall time`,
        });
      } else {
        score += 10;
        reasons.push({
          key: 'date',
          label: 'Date',
          points: 10,
          detail: 'Same local dive date',
        });
      }
    }
  }
  if (segment.greatestDepthM != null && dive.maxDepthM != null) {
    const diff = Math.abs(segment.greatestDepthM - dive.maxDepthM);
    const points = diff <= 1 ? 25 : diff <= 3 ? 15 : diff <= 6 ? 6 : 0;
    if (points) {
      score += points;
      reasons.push({
        key: 'depth',
        label: 'Depth',
        points,
        detail: `${diff.toFixed(1)} m difference`,
      });
    }
  }
  if (sourceSite?.latitude != null && sourceSite.longitude != null) {
    const canonical = dive.siteId
      ? sites.find((site) => site.entityId === dive.siteId)
      : undefined;
    const lat = canonical?.latitude ?? dive.latitude,
      long = canonical?.longitude ?? dive.longitude;
    if (lat != null && long != null) {
      const km = haversineKm(
        { latitude: sourceSite.latitude, longitude: sourceSite.longitude },
        { latitude: lat, longitude: long },
      );
      const points = km <= 0.25 ? 30 : km <= 1 ? 22 : km <= 5 ? 10 : 0;
      if (points) {
        score += points;
        reasons.push({
          key: 'gps',
          label: 'GPS',
          points,
          detail: `${km < 1 ? (km * 1000).toFixed(0) + ' m' : km.toFixed(1) + ' km'} apart`,
        });
      }
    }
  }
  return {
    diveId: dive.entityId,
    score,
    confidence: score >= 70 ? 'strong' : score >= 40 ? 'possible' : 'weak',
    reasons,
  };
}
export function suggestExistingDives(
  segment: OceanicSegment,
  dives: Array<DiveRecord & { entityId: string }>,
  sourceSite: OceanicSourceSite | undefined,
  sites: Array<Stored<DiveSiteRecord>>,
  limit = 5,
) {
  return dives
    .map((dive) => scoreImportMatch(segment, dive, sourceSite, sites))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.diveId.localeCompare(b.diveId))
    .slice(0, limit);
}

export interface SegmentGroupSuggestion {
  key: string;
  segmentIds: string[];
  reason: string;
}
export function suggestSegmentGroups(
  segments: OceanicSegment[],
  maxGapMinutes = 20,
): SegmentGroupSuggestion[] {
  const sorted = [...segments]
    .filter(
      (s) =>
        s.normalisedTimestamp &&
        Number.isFinite(Date.parse(s.normalisedTimestamp)),
    )
    .sort((a, b) =>
      String(a.normalisedTimestamp).localeCompare(
        String(b.normalisedTimestamp),
      ),
    );
  const groups: OceanicSegment[][] = [];
  for (const segment of sorted) {
    const last = groups.at(-1);
    const prior = last?.at(-1);
    if (
      prior &&
      prior.sourceSiteId === segment.sourceSiteId &&
      Math.abs(
        Date.parse(segment.normalisedTimestamp!) -
          Date.parse(prior.normalisedTimestamp!),
      ) /
        60000 <=
        maxGapMinutes
    )
      last!.push(segment);
    else groups.push([segment]);
  }
  return groups
    .filter((group) => group.length > 1)
    .map((group, index) => ({
      key: `suggested-group-${index + 1}`,
      segmentIds: group.map((s) => s.sourceDiveId),
      reason: `Adjacent Oceanic source segments from the same source Site within ${maxGapMinutes} minutes. Suggestion only; owner must explicitly choose the target Dive.`,
    }));
}
