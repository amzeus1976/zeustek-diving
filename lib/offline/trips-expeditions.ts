import { listRecords, removeRecord, saveRecord, type Stored } from './dive-planning';

export type DiveExpeditionTripStatus =
  | 'draft'
  | 'planned'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled';

export type TripItineraryKind =
  | 'travel'
  | 'accommodation'
  | 'dive'
  | 'transfer'
  | 'meal'
  | 'activity'
  | 'training'
  | 'meeting'
  | 'rest'
  | 'other';
export type TripBookingKind = 'travel' | 'accommodation' | 'operator' | 'dive' | 'other';
export type TripGuestRole = 'non-diver' | 'family-guest' | 'surface-support' | 'driver' | 'photographer' | 'other';

export interface TripGuestParticipant {
  id: string;
  name: string;
  role: TripGuestRole;
  notes?: string;
}

export interface TripItinerarySegment {
  id: string;
  kind: TripItineraryKind;
  title: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  bookingRef?: string;
  notes?: string;
}

export interface TripBooking {
  id: string;
  kind: TripBookingKind;
  provider: string;
  reference?: string;
  amount?: number | null;
  currency?: string;
  paid?: boolean;
  dueOn?: string;
  notes?: string;
}

export interface TripPackingItem {
  id: string;
  equipmentId?: string;
  equipmentSetId?: string;
  label: string;
  quantity?: number | null;
  packed: boolean;
  checkedAt?: string | undefined;
  notes?: string;
}

export interface TripGasLogisticsItem {
  id: string;
  label: string;
  equipmentId?: string;
  gas?: string;
  plannedFillBar?: number | null;
  fillProvider?: string;
  booked?: boolean;
  notes?: string;
}

export interface DiveExpeditionTripRecord {
  name: string;
  destination?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
  status: DiveExpeditionTripStatus;
  /** Existing saved-Person organiser reference. */
  organiserPersonId?: string;
  /** Signed-in ZeusTek account organiser; avoids duplicating the owner into People. */
  organiserUserId?: string;
  teamPersonIds: string[];
  /** Trip-local people who are not Dive buddies/instructors. Legacy Trips may omit this. */
  guestParticipants?: TripGuestParticipant[];
  siteIds: string[];
  planIds: string[];
  accommodation?: string;
  itinerary: TripItinerarySegment[];
  bookings: TripBooking[];
  packingEquipmentSetIds: string[];
  packingItems: TripPackingItem[];
  gasLogistics: TripGasLogisticsItem[];
  documentAttachmentIds: string[];
  emergencyNotes?: string;
  insuranceNotes?: string;
  medicalNotes?: string;
  notes?: string | null;
  createdAt: string;
  modifiedAt: string;
}

export type DiveExpeditionTripInput = Omit<DiveExpeditionTripRecord, 'createdAt' | 'modifiedAt'> & {
  entityId?: string;
};

export type TripOrganiserSelection =
  | { kind: 'none' }
  | { kind: 'account'; id: string }
  | { kind: 'person'; id: string };

export function tripOrganiserReferences(selection: TripOrganiserSelection) {
  if (selection.kind === 'account') {
    return { organiserUserId: selection.id, organiserPersonId: '' };
  }
  if (selection.kind === 'person') {
    return { organiserUserId: '', organiserPersonId: selection.id };
  }
  return { organiserUserId: '', organiserPersonId: '' };
}

export function normaliseTripGuestParticipants(
  guests: TripGuestParticipant[] | undefined,
): TripGuestParticipant[] {
  return (guests ?? [])
    .filter((guest) => guest.name.trim())
    .map((guest) => ({
      ...guest,
      name: guest.name.trim(),
      notes: guest.notes?.trim() || '',
    }));
}

export const listDiveExpeditionTrips = () => listRecords<DiveExpeditionTripRecord>('dive-trip');

export const saveDiveExpeditionTrip = (input: DiveExpeditionTripInput) =>
  saveRecord('dive-trip', {
    ...input,
    guestParticipants: normaliseTripGuestParticipants(input.guestParticipants),
  });

export const deleteDiveExpeditionTrip = removeRecord;

export function editableDiveExpeditionTrip(
  record: Stored<DiveExpeditionTripRecord>,
): DiveExpeditionTripInput {
  const { entityId, createdAt: _createdAt, modifiedAt: _modifiedAt, ...editable } = record;
  return {
    entityId,
    ...editable,
    guestParticipants: editable.guestParticipants ?? [],
  };
}

const normalise = (value: unknown) =>
  typeof value === 'string'
    ? value.normalize('NFKC').trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' ')
    : '';

/**
 * Deliberately conservative UI duplicate hint. This is not a canonical recordIdentity rule:
 * two genuinely different trips may share a destination/date, so the owner must decide.
 */
export function sameTripFingerprint(
  left: Pick<DiveExpeditionTripRecord, 'name' | 'destination' | 'startsOn' | 'endsOn'>,
  right: Pick<DiveExpeditionTripRecord, 'name' | 'destination' | 'startsOn' | 'endsOn'>,
) {
  return (
    normalise(left.name) !== '' &&
    normalise(left.name) === normalise(right.name) &&
    normalise(left.destination) === normalise(right.destination) &&
    (left.startsOn ?? '') === (right.startsOn ?? '') &&
    (left.endsOn ?? '') === (right.endsOn ?? '')
  );
}

export interface TripReadinessCheck {
  id: string;
  label: string;
  complete: boolean;
  detail: string;
}

export interface TripReadiness {
  percent: number;
  state: 'needs-attention' | 'getting-there' | 'ready';
  checks: TripReadinessCheck[];
}

/** Advisory projection only. Never persist this result as canonical Trip data. */
export function tripReadiness(
  trip: Pick<
    DiveExpeditionTripRecord,
    | 'destination'
    | 'startsOn'
    | 'endsOn'
    | 'planIds'
    | 'siteIds'
    | 'teamPersonIds'
    | 'guestParticipants'
    | 'itinerary'
    | 'bookings'
    | 'packingEquipmentSetIds'
    | 'packingItems'
    | 'emergencyNotes'
    | 'insuranceNotes'
  >,
): TripReadiness {
  const datesValid = Boolean(
    trip.startsOn && trip.endsOn && trip.startsOn <= trip.endsOn,
  );
  const guests = (trip.guestParticipants ?? []).filter((guest) => guest.name.trim());
  const checks: TripReadinessCheck[] = [
    {
      id: 'dates',
      label: 'Dates',
      complete: datesValid,
      detail: datesValid ? 'Trip dates recorded.' : 'Add valid start and end dates.',
    },
    {
      id: 'destination',
      label: 'Destination',
      complete: Boolean(trip.destination?.trim()),
      detail: trip.destination?.trim() ? 'Destination recorded.' : 'Add a destination.',
    },
    {
      id: 'diving',
      label: 'Diving',
      complete: trip.planIds.length > 0 || trip.siteIds.length > 0,
      detail:
        trip.planIds.length > 0 || trip.siteIds.length > 0
          ? 'Linked plans or sites recorded.'
          : 'Link at least one Plan or Site.',
    },
    {
      id: 'team',
      label: 'Team',
      complete: trip.teamPersonIds.length > 0 || guests.length > 0,
      detail:
        trip.teamPersonIds.length > 0 || guests.length > 0
          ? 'Trip participants recorded.'
          : 'Add the known team or guests when useful.',
    },
    {
      id: 'logistics',
      label: 'Logistics',
      complete: trip.itinerary.length > 0 || trip.bookings.length > 0,
      detail:
        trip.itinerary.length > 0 || trip.bookings.length > 0
          ? 'Travel or booking logistics recorded.'
          : 'Add itinerary or booking details when needed.',
    },
    {
      id: 'packing',
      label: 'Packing',
      complete: trip.packingEquipmentSetIds.length > 0 || trip.packingItems.length > 0,
      detail:
        trip.packingEquipmentSetIds.length > 0 || trip.packingItems.length > 0
          ? 'Packing references recorded.'
          : 'Add a loadout or packing item when useful.',
    },
    {
      id: 'emergency',
      label: 'Emergency / insurance',
      complete: Boolean(trip.emergencyNotes?.trim() || trip.insuranceNotes?.trim()),
      detail:
        trip.emergencyNotes?.trim() || trip.insuranceNotes?.trim()
          ? 'Emergency or insurance information recorded.'
          : 'Record emergency or insurance information for trips that need it.',
    },
  ];
  const complete = checks.filter((check) => check.complete).length;
  const percent = Math.round((complete / checks.length) * 100);
  return {
    percent,
    state: percent >= 86 ? 'ready' : percent >= 50 ? 'getting-there' : 'needs-attention',
    checks,
  };
}
