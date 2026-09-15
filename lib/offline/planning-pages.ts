import {
  listRecords,
  removeRecord,
  saveRecord,
  type DiveTripRecord,
  type Stored,
} from './dive-planning';
import {
  listEnrichedDivePlans,
  saveEnrichedDivePlan,
  type StoredEnrichedDivePlan,
} from './dive-planning-centre';
import { listDives, type DiveRecord } from './dives';
import {
  listCylinderFills,
  listGasAnalyses,
  type CylinderEquipmentRecord,
  type CylinderFillRecord,
} from './loadouts-gas';

export type BookingKind =
  | 'dive'
  | 'course'
  | 'assessment'
  | 'club'
  | 'centre'
  | 'trip'
  | 'show'
  | 'gear-service'
  | 'travel'
  | 'other';
export type BookingStatus =
  | 'idea'
  | 'planned'
  | 'booked'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'archived';

export interface DivingCalendarBookingExtension {
  bookingKind?: BookingKind;
  bookingStatus?: BookingStatus;
  locationName?: string | null;
  linkedTripId?: string | null;
  linkedDivePlanId?: string | null;
  linkedGasPlanId?: string | null;
  linkedTrainingId?: string | null;
  linkedCertificationId?: string | null;
  quickNotes?: string | null;
}
export type DivingCalendarBooking = DiveTripRecord &
  DivingCalendarBookingExtension;
export type StoredDivingCalendarBooking = Stored<DivingCalendarBooking>;

export type GasPlanStatus = 'draft' | 'planned' | 'ready' | 'used' | 'archived';
export type GasPlanRmvSource = 'logbook-average' | 'manual' | null;
export interface GasPlanCylinder {
  id: string;
  cylinderEquipmentId?: string | null;
  fillId?: string | null;
  analysisId?: string | null;
  role: 'primary' | 'backup' | 'stage' | 'deco' | 'suit' | 'other';
  startPressureBar?: number | null;
  endPressureBar?: number | null;
  reservePressureBar?: number | null;
  turnPressureBar?: number | null;
  notes?: string | null;
}
export interface GasPlanRecord {
  name: string;
  divePlanId?: string | null;
  status: GasPlanStatus;
  plannedDepthM?: number | null;
  plannedBottomTimeMin?: number | null;
  sacRateBarMin?: number | null;
  rmvRateLitresMin?: number | null;
  rmvSource?: GasPlanRmvSource;
  rmvSourceDiveIds?: string[];
  cylinders: GasPlanCylinder[];
  warnings: string[];
  notes: string;
  createdAt: string;
  modifiedAt: string;
}
export type StoredGasPlanRecord = Stored<GasPlanRecord>;

export interface RmvBaseline {
  litresPerMinute: number | null;
  observationCount: number;
  diveIds: string[];
}

export function normaliseBooking(
  input: Stored<DivingCalendarBooking>,
): StoredDivingCalendarBooking {
  const bookingKind: BookingKind =
    input.bookingKind ??
    (input.planType === 'course'
      ? 'course'
      : input.planType === 'holiday'
        ? 'trip'
        : input.planType === 'club-meet'
          ? 'club'
          : 'dive');
  const bookingStatus: BookingStatus =
    input.bookingStatus ??
    (input.status === 'completed'
      ? 'completed'
      : input.status === 'confirmed'
        ? 'confirmed'
        : 'planned');
  return {
    ...input,
    bookingKind,
    bookingStatus,
    locationName: input.locationName ?? input.siteName ?? '',
  };
}

export async function listDivingCalendarBookings() {
  const rows = await listRecords<DivingCalendarBooking>('trip');
  return rows
    .map(normaliseBooking)
    .sort((left, right) =>
      `${left.startDate}T${left.startAt ?? ''}`.localeCompare(
        `${right.startDate}T${right.startAt ?? ''}`,
      ),
    );
}

function planTypeForBooking(kind: BookingKind): DiveTripRecord['planType'] {
  if (kind === 'course' || kind === 'assessment') return 'course';
  if (kind === 'trip' || kind === 'travel') return 'holiday';
  if (kind === 'club') return 'club-meet';
  return 'day-dive';
}

function legacyStatusForBooking(
  status: BookingStatus,
): DiveTripRecord['status'] {
  if (status === 'completed') return 'completed';
  if (status === 'booked' || status === 'confirmed') return 'confirmed';
  return 'planned';
}

export async function saveDivingCalendarBooking(
  input: Omit<DivingCalendarBooking, 'createdAt' | 'modifiedAt'> & {
    entityId?: string;
  },
) {
  if (!input.name.trim()) throw new Error('Enter an event name.');
  if (!input.startDate) throw new Error('Choose a start date.');
  const bookingKind = input.bookingKind ?? 'dive';
  const bookingStatus = input.bookingStatus ?? 'planned';
  return saveRecord('trip', {
    ...input,
    name: input.name.trim(),
    planType: input.planType ?? planTypeForBooking(bookingKind),
    status: legacyStatusForBooking(bookingStatus),
    bookingKind,
    bookingStatus,
    siteName: input.siteName?.trim() ?? input.locationName?.trim() ?? '',
    locationName: input.locationName?.trim() ?? input.siteName?.trim() ?? '',
    notes: input.notes?.trim() ?? '',
    quickNotes: input.quickNotes?.trim() ?? '',
  });
}

export function setDivingCalendarBookingStatus(
  item: StoredDivingCalendarBooking,
  bookingStatus: BookingStatus,
) {
  return saveDivingCalendarBooking({
    ...item,
    entityId: item.entityId,
    bookingStatus,
  });
}

export const archiveDivingCalendarBooking = (
  item: StoredDivingCalendarBooking,
) => setDivingCalendarBookingStatus(item, 'archived');
export async function deleteDivingCalendarBooking(entityId: string) {
  return removeRecord(entityId);
}

export async function listGasPlans() {
  return listRecords<GasPlanRecord>('gas-plan');
}
export async function saveGasPlan(
  input: Omit<GasPlanRecord, 'createdAt' | 'modifiedAt'> & {
    entityId?: string;
  },
) {
  if (!input.name.trim()) throw new Error('Enter a gas plan name.');
  return saveRecord('gas-plan', {
    ...input,
    name: input.name.trim(),
    cylinders: input.cylinders ?? [],
    warnings: input.warnings ?? [],
    rmvSourceDiveIds: [...new Set(input.rmvSourceDiveIds ?? [])],
    notes: input.notes?.trim() ?? '',
  });
}
export async function deleteGasPlan(entityId: string) {
  return removeRecord(entityId);
}

export function fractionLabel(
  oxygenFraction?: number | null,
  heliumFraction?: number | null,
) {
  const o2 = oxygenFraction == null ? null : Math.round(oxygenFraction * 100);
  const he = heliumFraction == null ? null : Math.round(heliumFraction * 100);
  if (o2 == null && he == null) return 'Unknown gas';
  if ((he ?? 0) > 0) return `Trimix ${o2 ?? 0}/${he}`;
  if (o2 === 21) return 'Air';
  return `EAN${o2}`;
}

export function gasAvailableLitres(
  volumeLitres: number | null | undefined,
  startPressureBar: number | null | undefined,
  reservePressureBar: number | null | undefined,
) {
  if (!volumeLitres || !startPressureBar) return null;
  return Math.max(
    0,
    Math.round(
      volumeLitres * Math.max(0, startPressureBar - (reservePressureBar ?? 0)),
    ),
  );
}

export function gasNeededLitres(
  depthM: number | null | undefined,
  minutes: number | null | undefined,
  rmvLitresMin: number | null | undefined,
) {
  if (
    !Number.isFinite(depthM ?? Number.NaN) ||
    !Number.isFinite(minutes ?? Number.NaN) ||
    !Number.isFinite(rmvLitresMin ?? Number.NaN)
  )
    return null;
  return Math.round(
    ((depthM ?? 0) / 10 + 1) * (minutes ?? 0) * (rmvLitresMin ?? 0),
  );
}

export function deriveRmvBaseline(
  dives: Array<DiveRecord & { entityId: string }>,
): RmvBaseline {
  const observations: Array<{ value: number; diveId: string }> = [];
  for (const dive of dives) {
    const values = [
      dive.rmvRate,
      ...(dive.cylinders?.map((cylinder) => cylinder.rmvRate) ?? []),
    ].filter(
      (value): value is number => Number.isFinite(value) && (value ?? 0) > 0,
    );
    for (const value of values)
      observations.push({ value, diveId: dive.entityId });
  }
  if (!observations.length)
    return { litresPerMinute: null, observationCount: 0, diveIds: [] };
  return {
    litresPerMinute:
      Math.round(
        (observations.reduce((sum, item) => sum + item.value, 0) /
          observations.length) *
          10,
      ) / 10,
    observationCount: observations.length,
    diveIds: [...new Set(observations.map((item) => item.diveId))],
  };
}

export function warnGasPlan(
  input: Pick<
    GasPlanRecord,
    'plannedDepthM' | 'plannedBottomTimeMin' | 'rmvRateLitresMin' | 'cylinders'
  >,
  fills: Array<Stored<CylinderFillRecord>>,
  equipment: Array<Stored<CylinderEquipmentRecord>> = [],
) {
  const warnings: string[] = [];
  if (!input.cylinders.length) warnings.push('No cylinders selected.');
  if (input.plannedDepthM == null || input.plannedBottomTimeMin == null)
    warnings.push('Depth/time incomplete; gas needed cannot be trusted.');
  if (input.rmvRateLitresMin == null)
    warnings.push('Using no RMV baseline; enter a conservative override.');
  for (const cylinder of input.cylinders) {
    const fill = cylinder.fillId
      ? fills.find((candidate) => candidate.entityId === cylinder.fillId)
      : null;
    if (!fill)
      warnings.push(`${cylinder.role} cylinder has no current fill evidence.`);
    if (cylinder.startPressureBar == null && fill?.pressureBar == null)
      warnings.push(`${cylinder.role} cylinder has no start pressure.`);
    if (cylinder.reservePressureBar == null)
      warnings.push(`${cylinder.role} cylinder has no reserve pressure.`);
    const equipmentItem = equipment.find(
      (candidate) => candidate.entityId === cylinder.cylinderEquipmentId,
    );
    if (cylinder.cylinderEquipmentId && !equipmentItem?.waterVolumeLiters)
      warnings.push(`${cylinder.role} cylinder has no water-volume evidence.`);
  }
  return [...new Set(warnings)];
}

export async function planningPageSources() {
  const [bookings, gasPlans, divePlans, dives, fills, analyses] =
    await Promise.all([
      listDivingCalendarBookings(),
      listGasPlans().catch(() => [] as StoredGasPlanRecord[]),
      listEnrichedDivePlans(),
      listDives(),
      listCylinderFills(),
      listGasAnalyses(),
    ]);
  return {
    bookings,
    gasPlans,
    divePlans,
    dives,
    fills,
    analyses,
    rmvBaseline: deriveRmvBaseline(dives),
  };
}

export async function saveGasPlanNotesToDivePlan(
  plan: StoredEnrichedDivePlan,
  gasPlan: StoredGasPlanRecord,
) {
  const gasPlanLinks = [
    ...(plan.gasPlanLinks ?? []).filter(
      (reference) => reference.gasPlanId !== gasPlan.entityId,
    ),
    {
      gasPlanId: gasPlan.entityId,
      linkedAt: new Date().toISOString(),
      name: gasPlan.name,
      notes: gasPlan.notes,
      warnings: [...gasPlan.warnings],
    },
  ];
  return saveEnrichedDivePlan({
    ...plan,
    entityId: plan.entityId,
    gasPlanLinks,
  });
}
