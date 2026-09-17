import type { DiveRecord } from './dives';
import type { EnrichedDivePlan } from './dive-planning-centre';
import type { DiveExpeditionTripRecord, TripItinerarySegment } from './trips-expeditions';

export interface PriorDiveContext {
  diveId: string | null;
  summary: string;
  pressureGroup: string | null;
  dataset: string | null;
  surfaceIntervalMin: number | null;
  warning: string | null;
}

function localMinute(date: string, time: string | undefined): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time ?? '')) return null;
  const [hour, minute] = time!.split(':').map(Number);
  if (hour! > 23 || minute! > 59) return null;
  return hour! * 60 + minute!;
}

/** Reads recorded evidence only; never derives a pressure group or residual nitrogen. */
export function previousDiveContext(
  plan: Pick<EnrichedDivePlan, 'startDate' | 'startAt' | 'diveNumberOfDay'>,
  dives: Array<DiveRecord & { entityId: string }>,
): PriorDiveContext {
  const empty = (summary: string, warning: string | null): PriorDiveContext => ({ diveId: null, summary, pressureGroup: null, dataset: null, surfaceIntervalMin: null, warning });
  if (!plan.startDate) return empty('Planned date missing.', 'Earlier dives and pressure group cannot be checked without a planned date.');
  const sameDay = dives.filter((dive) => dive.date === plan.startDate);
  const plannedMinute = plan.startAt?.startsWith(`${plan.startDate}T`) ? localMinute(plan.startDate, plan.startAt.slice(11, 16)) : null;
  if ((plan.diveNumberOfDay ?? 1) <= 1) {
    return empty('Marked as first dive of the day.', sameDay.length ? `${sameDay.length} same-day Logbook dive(s) exist; verify dive order, number of day and residual nitrogen before planning.` : 'Verify earlier dives on previous days independently; no pressure group is calculated.');
  }
  if (plannedMinute === null) return empty(`Dive ${plan.diveNumberOfDay} of the day; planned time unknown.`, 'Cannot determine which same-day Logbook dive precedes this plan; enter a planned time and verify earlier dives.');
  const earlier = sameDay.filter((dive) => {
    const end = localMinute(dive.date, dive.timeOut);
    return end !== null && end <= plannedMinute;
  }).sort((a, b) => localMinute(b.date, b.timeOut)! - localMinute(a.date, a.timeOut)!);
  const previous = earlier[0];
  if (!previous) return empty(`Dive ${plan.diveNumberOfDay} of the day; no earlier same-day Logbook dive with a recorded exit time found.`, 'Previous pressure group and surface interval unknown; use a current, approved table/computer and verify earlier dives.');
  const group = previous.postPressureGroup?.trim() || null;
  const surfaceIntervalMin = plannedMinute - localMinute(previous.date, previous.timeOut)!;
  return {
    diveId: previous.entityId,
    summary: `Earlier same-day Dive: ${previous.site || 'Site not recorded'}${previous.timeOut ? ` · out ${previous.timeOut}` : ''}`,
    pressureGroup: group,
    dataset: previous.pressureGroupDataset?.trim() || null,
    surfaceIntervalMin,
    warning: group ? 'Recorded post-dive pressure group is historical evidence only; the displayed interval is estimated from local clock times. Use the matching edition of the table/computer to account for residual nitrogen; no starting group is calculated here.' : 'Earlier Dive has no recorded post-dive pressure group. Do not infer one.',
  };
}

export interface FlightProximity {
  state: 'within-24h' | 'overlap' | 'unknown-timing' | 'outside-24h' | 'no-flight-recorded';
  warning: string | null;
  flightLabel: string | null;
  flightStartsAt: string | null;
  hoursAfterDive: number | null;
  provenance: string | null;
}

function isFlight(segment: TripItinerarySegment) {
  if (segment.travelMode) return segment.travelMode === 'flight';
  return segment.kind === 'travel' && /\b(flight|airline|aircraft|airport)\b/i.test(`${segment.title} ${segment.notes ?? ''}`);
}

/** Owner-requested 24 h flag; it is not a clearance/no-fly calculation. */
export function flightProximity(
  plan: Pick<EnrichedDivePlan, 'startDate' | 'startAt' | 'maxTotalDurationMin'>,
  trip: Pick<DiveExpeditionTripRecord, 'itinerary'> | null | undefined,
): FlightProximity {
  const flights = (trip?.itinerary ?? []).filter(isFlight).sort((a, b) => (a.startsAt ?? '').localeCompare(b.startsAt ?? ''));
  if (!flights.length) return { state: 'no-flight-recorded', warning: null, flightLabel: null, flightStartsAt: null, hoursAfterDive: null, provenance: null };
  const flight = flights[0]!;
  const provenance = flight.travelMode === 'flight' ? 'Trip itinerary: explicitly marked flight' : 'Trip itinerary: flight inferred from travel text; verify';
  const unknown = (warning: string): FlightProximity => ({ state: 'unknown-timing', warning, flightLabel: flight.title || 'Trip flight', flightStartsAt: flight.startsAt ?? null, hoursAfterDive: null, provenance });
  if (!plan.startAt || !Number.isFinite(plan.maxTotalDurationMin) || (plan.maxTotalDurationMin ?? 0) <= 0) return unknown('Linked Trip has a flight. Enter planned dive time and maximum total duration to check the 24-hour window.');
  const end = new Date(plan.startAt).getTime() + (plan.maxTotalDurationMin ?? 0) * 60_000;
  const relevant = flights.map((row) => ({ row, time: new Date(row.startsAt ?? '').getTime() })).filter(({ time }) => Number.isFinite(time) && time >= new Date(plan.startAt ?? '').getTime()).sort((a, b) => a.time - b.time)[0];
  if (!relevant || !Number.isFinite(end)) return unknown('Flight timing is missing or precedes the planned dive; verify the itinerary manually.');
  const hours = (relevant.time - end) / 3_600_000;
  const common = { flightLabel: relevant.row.title || 'Trip flight', flightStartsAt: relevant.row.startsAt ?? null, hoursAfterDive: hours, provenance: relevant.row.travelMode === 'flight' ? 'Trip itinerary: explicitly marked flight' : 'Trip itinerary: inferred from travel text; verify' };
  if (hours < 0) return { ...common, state: 'overlap', warning: 'Trip flight overlaps the estimated dive end. Review dates, time zone and diving schedule.' };
  if (hours < 24) return { ...common, state: 'within-24h', warning: `Trip flight is approximately ${hours.toFixed(1)} h after the estimated dive end — inside the owner-requested 24-hour warning window. Verify local time zones; this is not flight clearance. Check current diving-medical guidance and your computer.` };
  return { ...common, state: 'outside-24h', warning: null };
}
