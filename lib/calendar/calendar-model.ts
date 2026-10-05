import { normaliseBooking, type StoredDivingCalendarBooking } from '../offline/planning-pages';
import { deriveCylinderInspectionSchedule, isCylinderEquipment, type CylinderEquipmentRecord } from '../offline/loadouts-gas';
import { equipmentServiceStatus } from '../offline/equipment-usage';
import type { EquipmentRecord, Stored } from '../offline/dive-planning';
import { workflowDestinationUrl } from '../workflow/workflow-destination';
import { sameConvertedCalendarDates, convertedCalendarBookingStatus } from '../planning/calendar-link-identity';
import { addCalendarDays, calendarMonthRange, calendarUtcStamp, resolveCalendarDateTime, validCalendarDay, type CalendarDateTimeResult, type CalendarFoldChoice } from './calendar-dates';

export const CALENDAR_CATEGORIES = [
  ['bookings', 'Calendar bookings / Dive Plans'], ['trips', 'Trips & Expeditions'],
  ['itinerary', 'Trip itinerary'], ['booking-deadlines', 'Trip booking deadlines'],
  ['equipment-service', 'Equipment service dates'], ['cylinder-inspection', 'Cylinder inspection due dates'],
  ['qualification-expiry', 'Qualification expiry dates'],
] as const;
export type CalendarCategory = typeof CALENDAR_CATEGORIES[number][0];
export interface CalendarSourceRecord {
  kind: string; id: string; data: Record<string, unknown>; createdAt?: string; modifiedAt?: string;
}
export interface CalendarSourceSnapshot {
  accountId: string; snapshotAt: string; records: ReadonlyArray<CalendarSourceRecord>; completeKinds: ReadonlyArray<string>;
}
export interface CalendarExportOptions {
  categories: ReadonlyArray<CalendarCategory>;
  fields?: { title?: boolean; location?: boolean; sourceLink?: boolean };
  selectedEventKeys?: ReadonlyArray<string>;
  timezone?: string;
  /** Current authenticated application's origin, supplied by the UI only for opted-in source links. */
  sourceOrigin?: string;
  foldChoices?: Readonly<Record<string, CalendarFoldChoice>>;
  includeCancelled?: boolean; includeHistory?: boolean; includePaid?: boolean;
}
export const DEFAULT_CALENDAR_OPTIONS: CalendarExportOptions = {
  categories: CALENDAR_CATEGORIES.map(([key]) => key), fields: { title: false, location: false, sourceLink: false },
  timezone: 'Europe/London', includeCancelled: false, includeHistory: false, includePaid: false,
};
export interface CalendarEvent {
  uid: string; category: CalendarCategory; summary: string;
  start: { type: 'date' | 'date-time'; value: string }; end?: { type: 'date' | 'date-time'; value: string };
  status: 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'; precision: 'day' | 'minute' | 'month'; transparent: boolean;
  description: string; dateLabel: string; location?: string; url?: string; modifiedAt?: string; createdAt?: string;
  source: { kind: string; id: string }; reviewDestination: string;
}
export interface CalendarOmission {
  category: CalendarCategory; code: 'coverage-unknown' | 'scan-limit' | 'missing-date' | 'invalid-date' | 'reversed-date' | 'conflicting-date' | 'ambiguous-time' | 'gap-time' | 'excluded-status' | 'paid' | 'invalid-identity' | 'ownership-unknown';
  explanation: string; reviewDestination?: string; resolutionKey?: string;
}
export interface CalendarPreview {
  accountId: string; snapshotAt: string; timezone: string; events: CalendarEvent[]; omissions: CalendarOmission[];
  coverageUnknown: boolean; totalCandidates: number;
}

const sourceKinds: Record<CalendarCategory, readonly string[]> = {
  bookings: ['trip'], trips: ['dive-trip'], itinerary: ['dive-trip'], 'booking-deadlines': ['dive-trip'],
  'equipment-service': ['equipment', 'cylinder'], 'cylinder-inspection': ['cylinder', 'equipment'], 'qualification-expiry': ['certification'],
};
const text = (value: unknown) => typeof value === 'string' ? Array.from(value.trim()).slice(0, 2000).filter(character => { const code = character.codePointAt(0)!; return code >= 32 && code !== 127 || [9, 10, 13].includes(code); }).join('') : '';
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const children = (value: unknown) => Array.isArray(value) ? value.map(object).filter((row): row is Record<string, unknown> => row !== null) : [];
const belongsToOwner = (record: CalendarSourceRecord, accountId: string) => record.data.householdOwnedByMe !== false && (!record.data.householdOwnerId || record.data.householdOwnerId === accountId);
const dayStamp = (value: string) => value.replaceAll('-', '');

export async function calendarDigest(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
async function eventUid(account: string, record: CalendarSourceRecord, discriminator: string) {
  return `ztek-${await calendarDigest(JSON.stringify(['zeustek-calendar-v1', account, record.kind, record.id, discriminator]))}@calendar.zeustek`;
}
function destination(record: CalendarSourceRecord) {
  if (record.kind === 'cylinder') return workflowDestinationUrl({ route: 'Cylinders & Gas', recordId: record.id, params: { cylinderId: record.id } });
  const route = record.kind === 'dive-trip' ? 'Trips' : record.kind === 'trip' ? 'Dive Plans'
    : record.kind === 'certification' ? 'Training' : 'Equipment';
  return workflowDestinationUrl({ route, recordId: record.id });
}
function sourceLink(origin: string | undefined, path: string) {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) return null;
    return new URL(`/${path}`, url.origin).toString();
  } catch { return null; }
}
function validMonthEvidence(value: unknown) {
  if (typeof value !== 'string') return null;
  return calendarMonthRange(value) ? value : validCalendarDay(value) ? value.slice(0, 7) : null;
}

/** Pure owner snapshot projection: no local/cloud reads, canonical writes or upstream operations. */
export async function buildCalendarPreview(snapshot: CalendarSourceSnapshot, options: CalendarExportOptions): Promise<CalendarPreview> {
  const timezone = options.timezone ?? 'Europe/London';
  const preview: CalendarPreview = { accountId: snapshot.accountId, snapshotAt: snapshot.snapshotAt, timezone, events: [], omissions: [], coverageUnknown: false, totalCandidates: 0 };
  const categories = new Set(options.categories);
  const selection = options.selectedEventKeys ? new Set(options.selectedEventKeys) : null;
  const resolvedTimes = new Map<string, CalendarDateTimeResult>();
  const complete = new Set(snapshot.completeKinds);
  for (const category of categories) if ((sourceKinds[category] ?? []).some(kind => !complete.has(kind))) {
    preview.coverageUnknown = true;
    preview.omissions.push({ category, code: 'coverage-unknown', explanation: 'This category has incomplete record coverage on this device. Uninspected records are Unknown.' });
  }
  if (!snapshot.accountId || snapshot.records.length > 25_000) {
    preview.coverageUnknown = true;
    preview.omissions.push({ category: 'bookings', code: 'scan-limit', explanation: 'The snapshot is unavailable or exceeds the bounded scan. No calendar events were projected.' });
    return preview;
  }
  const records = snapshot.records.filter(row => row.id && object(row.data) && belongsToOwner(row, snapshot.accountId));
  const bookingSources = new Map(records.filter(row => row.kind === 'trip').map(row => [row.id, row]));
  const convertedTrips = new Map<string,CalendarSourceRecord[]>();
  for(const record of records.filter(row=>row.kind==='dive-trip')){
    const origin=bookingSources.get(text(record.data.originCalendarBookingId));
    if(origin&&sameConvertedCalendarDates(record.data,origin.data))convertedTrips.set(origin.id,[...(convertedTrips.get(origin.id)??[]),record]);
  }
  const ownerPeople = records.filter(row => row.kind === 'person' && object(row.data.roles)?.ownerProfile === true);
  const omit = (category: CalendarCategory, code: CalendarOmission['code'], explanation: string, record?: CalendarSourceRecord, resolutionKey?: string) => {
    preview.omissions.push({ category, code, explanation, ...(record ? { reviewDestination: destination(record) } : {}), ...(resolutionKey ? { resolutionKey } : {}) });
  };
  interface Candidate {
    record: CalendarSourceRecord; category: CalendarCategory; discriminator: string; label: string;
    title?: string; location?: string; start: unknown; end?: unknown; timed?: boolean; inclusiveEnd?: boolean;
    month?: boolean; provenance: string; status?: unknown; paid?: boolean;
  }
  const project = async (candidate: Candidate) => {
    if (!categories.has(candidate.category)) return;
    preview.totalCandidates++;
    const { record, category } = candidate;
    const uid = await eventUid(snapshot.accountId, record, candidate.discriminator);
    if (selection && !selection.has(uid)) return;
    const status = text(candidate.status).toLowerCase();
    if ((['cancelled', 'canceled'].includes(status) && !options.includeCancelled) || (['completed', 'archived'].includes(status) && !options.includeHistory)) {
      omit(category, 'excluded-status', 'Cancelled or completed/archived history is excluded by the current export selection.', record); return;
    }
    if (candidate.paid && !options.includePaid) { omit(category, 'paid', 'This booking deadline is already marked paid and is excluded by the current selection.', record); return; }
    const rawStart = text(candidate.start), rawEnd = text(candidate.end);
    if (!rawStart) { omit(category, 'missing-date', 'No supported saved date is available. No date was invented.', record); return; }
    let start: CalendarEvent['start'], end: CalendarEvent['end'];
    let precision: CalendarEvent['precision'] = 'day', dateLabel = rawStart;
    if (candidate.month) {
      const range = calendarMonthRange(rawStart);
      if (!range) { omit(category, 'invalid-date', 'The saved due month is invalid and needs review.', record); return; }
      start = { type: 'date', value: dayStamp(range.start) }; end = { type: 'date', value: dayStamp(addCalendarDays(range.start, 1)!) };
      precision = 'month'; dateLabel = `${rawStart} · due month; exact day unknown · reminder on ${range.start}`;
    } else if (candidate.timed) {
      precision = 'minute';
      const resolve = (raw: string, boundary: 'start' | 'end') => {
        const resolutionKey = `${uid}:${boundary}`;
        const choice = options.foldChoices?.[resolutionKey] ?? options.foldChoices?.[uid];
        const cacheKey = JSON.stringify([raw, timezone, choice]);
        let result = resolvedTimes.get(cacheKey);
        if (!result) { result = resolveCalendarDateTime(raw, timezone, choice); resolvedTimes.set(cacheKey, result); }
        if (result.kind !== 'resolved') {
          omit(category, result.kind === 'fold' ? 'ambiguous-time' : result.kind === 'gap' ? 'gap-time' : 'invalid-date', result.message, record, result.kind === 'fold' ? resolutionKey : undefined);
          return null;
        }
        return result;
      };
      const resolvedStart = resolve(rawStart, 'start'); if (!resolvedStart) return;
      start = { type: 'date-time', value: resolvedStart.value }; dateLabel = resolvedStart.display;
      if (rawEnd) {
        const resolvedEnd = resolve(rawEnd, 'end'); if (!resolvedEnd) return;
        if (resolvedEnd.instant <= resolvedStart.instant) { omit(category, 'reversed-date', 'The saved end must be after the start. No duration was invented.', record); return; }
        end = { type: 'date-time', value: resolvedEnd.value }; dateLabel += ` → ${resolvedEnd.display}`;
      }
    } else {
      if (!validCalendarDay(rawStart) || (rawEnd && !validCalendarDay(rawEnd))) { omit(category, 'invalid-date', 'A saved calendar date is invalid and needs review.', record); return; }
      if (rawEnd && rawEnd < rawStart) { omit(category, 'reversed-date', 'The saved end predates the start and needs review.', record); return; }
      const exclusiveEnd = candidate.inclusiveEnd !== false ? addCalendarDays(rawEnd || rawStart, 1) : rawEnd;
      if (!exclusiveEnd || exclusiveEnd <= rawStart) { omit(category, 'invalid-date', 'The saved range cannot be represented without inventing an end.', record); return; }
      start = { type: 'date', value: dayStamp(rawStart) }; end = { type: 'date', value: dayStamp(exclusiveEnd) };
      if (rawEnd && rawEnd !== rawStart) dateLabel += ` → ${rawEnd} (inclusive)`;
    }
    const event: CalendarEvent = {
      uid, category, summary: options.fields?.title && candidate.title ? text(candidate.title) : candidate.label,
      start, ...(end ? { end } : {}), precision, transparent: true,
      status: ['cancelled', 'canceled'].includes(status) ? 'CANCELLED' : ['confirmed', 'booked', 'active'].includes(status) || !status ? 'CONFIRMED' : 'TENTATIVE',
      description: `${candidate.provenance}${precision === 'month' ? ' Due month; exact day unknown. One reminder on the first day of the month, not a first-day deadline.' : ''} Reminder only; no inspection compliance, serviceability or diver readiness is asserted.`,
      dateLabel, source: { kind: record.kind, id: record.id }, reviewDestination: destination(record),
    };
    const modifiedAt = text(record.modifiedAt ?? record.data.modifiedAt), createdAt = text(record.createdAt ?? record.data.createdAt);
    if (modifiedAt && calendarUtcStamp(modifiedAt)) event.modifiedAt = modifiedAt;
    if (createdAt && calendarUtcStamp(createdAt)) event.createdAt = createdAt;
    if (options.fields?.location && candidate.location) event.location = text(candidate.location);
    if (options.fields?.sourceLink) { const url = sourceLink(options.sourceOrigin, destination(record)); if (url) event.url = url; }
    preview.events.push(event);
  };
  const ambiguousBookingsReported = new Set<string>();
  const projectBooking = async (record: CalendarSourceRecord, category: 'bookings' | 'trips' | 'itinerary') => {
      const data = record.data;
      const booking = normaliseBooking({ ...data, entityId: record.id } as unknown as StoredDivingCalendarBooking);
      const startAt = text(data.startAt), endAt = text(data.endAt);
      if ((startAt && text(data.startDate) && startAt.slice(0, 10) !== text(data.startDate)) || (endAt && text(data.endDate) && endAt.slice(0, 10) !== text(data.endDate))) {
        preview.totalCandidates++; omit(category, 'conflicting-date', 'Saved date and time fields disagree. Open the source record to review them.', record); return;
      }
      if (endAt && !startAt) { preview.totalCandidates++; omit(category, 'conflicting-date', 'An end time exists without a start time. No start was invented.', record); return; }
      const matches=convertedTrips.get(record.id)??[];
      if(matches.length>1){
        const key=`${category}:${record.id}`;
        if(!ambiguousBookingsReported.has(key)){
          ambiguousBookingsReported.add(key);preview.totalCandidates++;
          omit(category,'invalid-identity','Multiple converted Trips share this event identity. Review the canonical Trips before exporting; no source status was substituted.',record);
        }
        return;
      }
      const status=matches.length===1?convertedCalendarBookingStatus(matches[0]!.data.status,data.bookingStatus??data.status):data.bookingStatus??data.status??booking.bookingStatus;
      await project({ record, category, discriminator: 'booking', label: 'Diving booking', title: text(data.name), location: text(booking.locationName), start: startAt || data.startDate, end: startAt ? endAt : data.endDate, timed: Boolean(startAt), provenance: 'Recorded calendar/plan dates.', status });
  };
  for (const record of records) {
    const data = record.data;
    if (record.kind === 'trip' && categories.has('bookings')) await projectBooking(record, 'bookings');
    if (record.kind === 'dive-trip') {
      const origin = bookingSources.get(text(data.originCalendarBookingId));
      const converted = origin && sameConvertedCalendarDates(data, origin.data);
      if (converted) {
        if (!categories.has('bookings')) await projectBooking(origin, 'trips');
      } else await project({ record, category: 'trips', discriminator: 'trip', label: 'Diving trip', title: text(data.name), location: text(data.destination), start: data.startsOn, end: data.endsOn, provenance: 'Recorded Trip dates.', status: data.status });
      for (const [category, field] of [['itinerary', 'itinerary'], ['booking-deadlines', 'bookings']] as const) {
        if (!categories.has(category)) continue;
        const savedRows = data[field];
        if (Array.isArray(savedRows) && savedRows.length > 2000) {
          preview.coverageUnknown = true;
          omit(category, 'scan-limit', 'Only the first 2,000 items were inspected. Remaining itinerary/booking items are Unknown.', record);
        }
        const rows = children(Array.isArray(savedRows) ? savedRows.slice(0, 2000) : savedRows);
        const counts = new Map<string, number>();
        for (const row of rows) { const id = text(row.id); counts.set(id, (counts.get(id) ?? 0) + 1); }
        for (const row of rows) {
          const id = text(row.id);
          if (!id || counts.get(id) !== 1) { preview.totalCandidates++; omit(category, 'invalid-identity', 'An itinerary/booking item has a missing or duplicate stable identity and needs review.', record); continue; }
          const source = category === 'itinerary' ? bookingSources.get(text(row.calendarBookingId)) : undefined;
          if (source && text(row.startsAt) === (text(source.data.startAt) || text(source.data.startDate)) && text(row.endsAt) === (text(source.data.endAt) || text(source.data.endDate))) {
            // One explicit imported event has one stable identity across selected categories.
            if (!categories.has('bookings') && !(converted && categories.has('trips') && origin.id === source.id)) await projectBooking(source, 'itinerary');
            continue;
          }
          await project({ record, category, discriminator: `${field}:${id}`, label: category === 'itinerary' ? 'Trip itinerary event' : 'Trip booking payment reminder', title: text(category === 'itinerary' ? row.title : row.provider), location: text(row.location), start: category === 'itinerary' ? row.startsAt : row.dueOn, end: category === 'itinerary' ? row.endsAt : undefined, timed: category === 'itinerary' && text(row.startsAt).includes('T'), provenance: category === 'itinerary' ? 'Recorded itinerary date/time.' : 'Recorded booking payment due date.', status: data.status, paid: row.paid === true });
        }
      }
    }
    if ((record.kind === 'equipment' || record.kind === 'cylinder') && categories.has('equipment-service') && data.retired !== true && data.cylinderStatus !== 'retired' && data.serviceRequired !== false) {
      let due = text(data.nextServiceAt), provenance = 'Explicitly recorded equipment service due date.';
      if (!due) {
        const baseline = text(data.lastServiceAt) || text(data.purchasedAt), months = data.serviceIntervalMonths;
        if (validCalendarDay(baseline) && typeof months === 'number' && Number.isInteger(months) && months > 0 && months <= 1200) {
          due = equipmentServiceStatus({ ...data, entityId: record.id } as unknown as Stored<EquipmentRecord>, []).dateDue;
          provenance = data.lastServiceAt ? 'Derived using the existing service baseline and recorded month interval.' : 'Derived using the existing purchase baseline and recorded month interval.';
        }
      }
      if (due || data.serviceRequired === true || data.serviceIntervalDives || data.serviceIntervalMonths) await project({ record, category: 'equipment-service', discriminator: 'service', label: 'Equipment service reminder', title: text(data.name), start: due, provenance });
    }
    if (categories.has('cylinder-inspection') && (record.kind === 'cylinder' || record.kind === 'equipment' && isCylinderEquipment({ category: text(data.category), name: text(data.name) })) && data.retired !== true && data.cylinderStatus !== 'retired') {
      const validated: Partial<CylinderEquipmentRecord> = {
        hydroTestAt: validMonthEvidence(data.hydroTestAt), visualTestAt: validMonthEvidence(data.visualTestAt), lastTestAt: validMonthEvidence(data.lastTestAt),
        lastTestType: data.lastTestType === 'hydro' || data.lastTestType === 'visual' ? data.lastTestType : null,
        visualInspection: { inspectedAt: validMonthEvidence(object(data.visualInspection)?.inspectedAt) },
        hydroTestStamps: children(data.hydroTestStamps).flatMap(stamp => { const testedAt = validMonthEvidence(stamp.testedAt); return testedAt ? [{ facility: '', testedAt, stampMark: '' }] : []; }),
      };
      const schedule = deriveCylinderInspectionSchedule(validated);
      for (const type of ['hydro', 'visual'] as const) {
        const explicit = type === 'hydro' ? text(data.hydroDueAt) : text(data.visualDueAt) || text(object(data.visualInspection)?.dueAt);
        const due = explicit || (type === 'hydro' ? schedule.hydroDueAt : schedule.visualDueAt) || '';
        const month = Boolean(calendarMonthRange(due));
        await project({ record, category: 'cylinder-inspection', discriminator: type, label: `Cylinder ${type} ${month ? 'due this month' : 'inspection reminder'}`, title: options.fields?.title && text(data.name) ? `${text(data.name)} · ${type}${month ? ' due this month' : ' inspection'}` : '', start: due, month, provenance: explicit ? 'Recorded cylinder inspection due evidence.' : 'Derived month from recorded test evidence using the existing cylinder schedule helper.' });
      }
    }
    if (record.kind === 'certification' && categories.has('qualification-expiry')) {
      if (data.personId && (ownerPeople.length !== 1 || data.personId !== ownerPeople[0]?.id)) {
        if (!complete.has('person') || ownerPeople.length !== 1) { preview.totalCandidates++; preview.coverageUnknown = true; omit('qualification-expiry', 'ownership-unknown', 'The qualification owner cannot be confirmed from this snapshot. Other people’s qualifications are excluded.', record); }
        continue;
      }
      await project({ record, category: 'qualification-expiry', discriminator: 'expiry', label: 'Qualification expiry reminder', title: text(data.certification) || text(data.level), start: data.expiresAt, provenance: 'Recorded qualification expiry date.' });
    }
  }
  preview.events = preview.events.filter((event, index, events) => events.findIndex(other => other.uid === event.uid) === index);
  preview.events.sort((a, b) => a.start.value.localeCompare(b.start.value) || a.uid.localeCompare(b.uid));
  return preview;
}
