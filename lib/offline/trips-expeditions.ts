import { listRecords, removeRecord, saveRecord, type Stored } from './dive-planning';

export type DiveExpeditionTripStatus =
  | 'draft'
  | 'planned'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled';

export type TripItineraryKind = 'travel' | 'accommodation' | 'dive' | 'transfer' | 'other';
export type TripBookingKind = 'travel' | 'accommodation' | 'operator' | 'dive' | 'other';

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
  organiserPersonId?: string;
  teamPersonIds: string[];
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

export const listDiveExpeditionTrips = () => listRecords<DiveExpeditionTripRecord>('dive-trip');

export const saveDiveExpeditionTrip = (input: DiveExpeditionTripInput) =>
  saveRecord('dive-trip', input);

export const deleteDiveExpeditionTrip = removeRecord;

export function editableDiveExpeditionTrip(
  record: Stored<DiveExpeditionTripRecord>,
): DiveExpeditionTripInput {
  const { entityId, createdAt: _createdAt, modifiedAt: _modifiedAt, ...editable } = record;
  return { entityId, ...editable };
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
      complete: trip.teamPersonIds.length > 0,
      detail: trip.teamPersonIds.length ? 'Team recorded.' : 'Add the known team when useful.',
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
