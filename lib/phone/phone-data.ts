import {
  listLocalDiveRecords,
  currentDiveAccount,
  pendingDiveChanges,
  refreshDiveRecords,
  flushDiveChanges,
} from '../offline/dive-store';
import { zeustekDb } from '../offline/db';
import { withRecordNetwork } from './network-policy';
import {
  normalisePlan,
  type StoredEnrichedDivePlan,
} from '../offline/dive-planning-centre';
import {
  normaliseBooking,
  type StoredGasPlanRecord,
  type StoredDivingCalendarBooking,
} from '../offline/planning-pages';
import type { DiveExpeditionTripRecord } from '../offline/trips-expeditions';
import type {
  PersonRecord,
  Stored,
  DiveSiteRecord,
  OperatorRecord,
} from '../offline/dive-planning';
import type { JsonValue } from '../offline/types';
import type { DiveRecord } from '../offline/dives';

export const PHONE_DOWNLOAD_KINDS = [
  'dive',
  'trip',
  'dive-trip',
  'gas-plan',
  'person',
  'operator',
  'person-operator-link',
  'operator-operator-link',
  'site',
  'site-overhead-profile',
  'equipment',
  'equipment-event',
  'equipment-set',
  'cylinder',
  'cylinder-fill',
  'gas-analysis',
  'certification',
  'skill',
  'skill_evidence',
  'dashboard-settings',
  'catalog-option',
] as const;
export interface PhoneData {
  plans: StoredEnrichedDivePlan[];
  gasPlans: StoredGasPlanRecord[];
  trips: Stored<DiveExpeditionTripRecord>[];
  people: Stored<PersonRecord>[];
  sites: Stored<DiveSiteRecord>[];
  dives: Stored<DiveRecord>[];
  events: StoredDivingCalendarBooking[];
  operators: Stored<OperatorRecord>[];
  equipment: Array<Record<string, unknown> & { entityId: string }>;
}
export const EMPTY_PHONE_DATA: PhoneData = {
  plans: [],
  gasPlans: [],
  trips: [],
  events: [],
  people: [],
  sites: [],
  dives: [],
  operators: [],
  equipment: [],
};
export async function loadPhoneData(): Promise<PhoneData> {
  const [plans, gasPlans, trips, people, sites, dives, operators, equipment] =
    await Promise.all([
      listLocalDiveRecords<StoredEnrichedDivePlan>('trip'),
      listLocalDiveRecords<StoredGasPlanRecord>('gas-plan'),
      listLocalDiveRecords<DiveExpeditionTripRecord>('dive-trip'),
      listLocalDiveRecords<PersonRecord>('person'),
      listLocalDiveRecords<DiveSiteRecord>('site'),
      listLocalDiveRecords<DiveRecord>('dive'),
      listLocalDiveRecords<OperatorRecord>('operator'),
      listLocalDiveRecords<Record<string, unknown>>('equipment'),
    ]);
  return {
    plans: plans.filter((plan) => !('bookingKind' in plan)).map(normalisePlan),
    events: plans
      .filter((plan) => 'bookingKind' in plan)
      .map((plan) => normaliseBooking(plan as StoredDivingCalendarBooking)),
    gasPlans,
    trips: trips.map((trip) => ({
      ...trip,
      itinerary: trip.itinerary || [],
      bookings: trip.bookings || [],
      planIds: trip.planIds || [],
      siteIds: trip.siteIds || [],
      teamPersonIds: trip.teamPersonIds || [],
    })),
    people,
    sites,
    dives,
    operators,
    equipment,
  };
}
export function phoneDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function planDay(plan: StoredEnrichedDivePlan) {
  return (plan.startAt || plan.startDate || '').slice(0, 10);
}
export function initialPhoneDay(data: PhoneData, today = phoneDate()) {
  const days = [
    ...data.plans
      .filter(
        (plan) =>
          !['completed', 'cancelled'].includes(
            plan.lifecycleStatus || plan.status,
          ),
      )
      .map(planDay),
    ...data.trips
      .filter((trip) => !['completed', 'cancelled'].includes(trip.status))
      .map((trip) => (trip.startsOn || '').slice(0, 10)),
  ]
    .filter((day) => day >= today)
    .sort();
  return days[0] || today;
}
export function linkedPhoneGasPlans(
  plan: StoredEnrichedDivePlan,
  gasPlans: StoredGasPlanRecord[],
) {
  const ids = new Set(plan.gasPlanLinks?.map((link) => link.gasPlanId) || []);
  return gasPlans.filter(
    (gas) => gas.divePlanId === plan.entityId || ids.has(gas.entityId),
  );
}
export function tripForPhoneDay(data: PhoneData, day: string) {
  const plan = data.plans.find((item) => planDay(item) === day && item.tripId);
  return (
    data.trips.find((trip) => trip.entityId === plan?.tripId) ||
    data.trips.find(
      (trip) =>
        (trip.startsOn || '').slice(0, 10) <= day &&
        (trip.endsOn || trip.startsOn || '').slice(0, 10) >= day &&
        !['completed', 'cancelled'].includes(trip.status),
    )
  );
}
export function phoneTimeline(data: PhoneData, day: string) {
  const trip = tripForPhoneDay(data, day);
  const itinerary = (trip?.itinerary || [])
    .filter(
      (segment) =>
        segment.startsAt?.slice(0, 10) === day && segment.kind !== 'dive',
    )
    .map((segment) => ({
      id: segment.id,
      time: segment.startsAt?.slice(11, 16) || '',
      title: segment.title,
      subtitle: segment.location || '',
      kind: 'trip' as const,
      recordId: trip!.entityId,
    }));
  const plans = data.plans
    .filter(
      (plan) => planDay(plan) === day && plan.lifecycleStatus !== 'cancelled',
    )
    .sort((a, b) =>
      (a.startAt || a.startDate).localeCompare(b.startAt || b.startDate),
    );
  const events = data.events
    .filter(
      (event) =>
        (event.startAt || event.startDate).slice(0, 10) === day &&
        !['archived', 'cancelled'].includes(event.bookingStatus || '') &&
        !trip?.itinerary.some(
          (item) => item.calendarBookingId === event.entityId,
        ),
    )
    .map((event) => ({
      id: event.entityId,
      time: event.startAt?.slice(11, 16) || '',
      title: event.name,
      subtitle: event.locationName || event.siteName,
      kind: 'event' as const,
      recordId: event.entityId,
    }));
  return [
    ...itinerary,
    ...events,
    ...plans.map((plan, index) => ({
      id: plan.entityId,
      time: plan.startAt?.includes('T') ? plan.startAt.slice(11, 16) : '',
      title: `Dive ${String(plan.diveNumberOfDay || index + 1).padStart(2, '0')}`,
      subtitle: plan.name,
      kind: 'plan' as const,
      recordId: plan.entityId,
    })),
  ].sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));
}
export async function phoneDownloadStatus(account: string) {
  return (await zeustekDb.settings.get(`phone:download:${account}`))?.value as
    | { downloadedAt?: string; kinds?: string[] }
    | undefined;
}
export async function missingPhoneReferences(account: string, data: PhoneData) {
  const local = await zeustekDb.entities
    .where('module')
    .equals(`dive:${account}`)
    .filter((row) => !row.deleted)
    .toArray();
  const ids = new Set(
    local.map((row) => {
      const id = (row.record as Record<string, JsonValue> | null)?.entityId;
      return typeof id === 'string' ? id : '';
    }),
  );
  const missing = new Set<string>();
  const check = (id: unknown, name: string) => {
    if (typeof id === 'string' && id && !ids.has(id)) missing.add(name);
  };
  for (const plan of data.plans) {
    check(plan.siteId, `${plan.name}: Site`);
    check(plan.tripId, `${plan.name}: Trip`);
    for (const member of plan.planTeam || [])
      check(member.personId, `${plan.name}: Person`);
    for (const id of plan.diveCentreIds || [])
      check(id, `${plan.name}: Dive Centre`);
    for (const link of plan.gasPlanLinks || [])
      check(link.gasPlanId, `${plan.name}: Gas Plan`);
  }
  for (const trip of data.trips) {
    for (const id of trip.planIds || []) check(id, `${trip.name}: Dive Plan`);
    for (const id of trip.teamPersonIds || [])
      check(id, `${trip.name}: Person`);
    for (const id of trip.diveCentreIds || [])
      check(id, `${trip.name}: Dive Centre`);
  }
  for (const gas of data.gasPlans)
    check(gas.divePlanId, `${gas.name}: Dive Plan`);
  return [...missing];
}
export async function synchronizePhoneRecords(
  progress: (message: string) => void = () => {},
) {
  const account = currentDiveAccount();
  progress('Checking the signed-in account…');
  const identity = await fetch('/api/household', {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!identity.ok)
    throw new Error(
      'Sign in online before syncing. Your device records and drafts are retained.',
    );
  const verified = (await identity.json()) as { current?: { userId?: string } };
  if (verified.current?.userId !== account || currentDiveAccount() !== account)
    throw new Error(
      'The signed-in account changed. Reopen ZeusTek online in the correct account before syncing.',
    );
  await withRecordNetwork(account, async () => {
    progress('Uploading saved changes…');
    await flushDiveChanges(true);
    const pending = await pendingDiveChanges();
    if (pending.length)
      throw new Error(
        `${pending.length} saved change${pending.length === 1 ? '' : 's'} still need sync or review. Both versions are retained.`,
      );
    for (const kind of PHONE_DOWNLOAD_KINDS) {
      progress(`Downloading ${kind.replaceAll('-', ' ')}…`);
      await refreshDiveRecords(kind, true, true);
      if (currentDiveAccount() !== account)
        throw new Error('The account changed during download.');
    }
  });
  const downloadedAt = new Date().toISOString();
  await zeustekDb.settings.put({
    key: `phone:download:${account}`,
    value: { downloadedAt, kinds: [...PHONE_DOWNLOAD_KINDS] },
  });
  return downloadedAt;
}
