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
  deriveCylinderInspectionSchedule,
  gasMixLabel,
  listCylinderInventory,
  listCylinderFills,
  listGasAnalyses,
  type CylinderEquipmentRecord,
  type CylinderFillRecord,
  type GasAnalysisRecord,
} from './loadouts-gas';
import {
  maximumOperatingDepth,
  oxygenPartialPressure,
  nitrogenFraction,
  gasRequiredForSegments,
  gasVolumeLitres,
  validateMix,
  type GasDepthSegment,
  type ManualStop,
  type PlanningGasMix,
} from './gas-planning-foundation';
import type { RecreationalGasSnapshot } from './recreational-gas-planner';

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
  role: 'primary' | 'backup' | 'stage' | 'bottom' | 'travel' | 'deco' | 'bailout' | 'suit' | 'other';
  gasType?: 'air' | 'nitrox' | 'trimix' | 'heliox' | 'other' | null;
  manualOxygenFraction?: number | null;
  manualHeliumFraction?: number | null;
  mixSource?: 'analysis' | 'manual' | null;
  targetPpo2?: number | null;
  conservatismM?: number | null;
  depthM?: number | null;
  waterVolumeOverrideL?: number | null;
  startPressureBar?: number | null;
  startPressureSource?: 'plan-snapshot' | 'owner-override' | null;
  requiredValveType?: 'DIN' | 'A-CLAMP' | null;
  endPressureBar?: number | null;
  reservePressureBar?: number | null;
  turnPressureBar?: number | null;
  notes?: string | null;
}
export interface GasPlanRecord {
  /** Additive T12.6R snapshot in the existing gas-plan store. */
  recGasPlan101?: RecreationalGasSnapshot | null;
  name: string;
  divePlanId?: string | null;
  status: GasPlanStatus;
  plannedDepthM?: number | null;
  /** Owner-entered personal limit, independent of Site and team limits. */
  userMaxDepthM?: number | null;
  plannedBottomTimeMin?: number | null;
  depthSegments?: GasDepthSegment[];
  manualStops?: ManualStop[];
  multiLevel?: boolean;
  ascentRateMMin?: number | null;
  gradientFactorLow?: number | null;
  gradientFactorHigh?: number | null;
  /** Method provenance only. T12.5 does not calculate decompression obligations. */
  planningMethod?: 'agency-table' | 'buhlmann-zhl16c' | null;
  algorithmReference?: {
    implementation: string;
    version: string;
    sourceNote: string;
  } | null;
  reserveStrategy?: 'fixed' | 'thirds' | 'custom';
  safetyAcknowledgedAt?: string | null;
  /** User transcription from their own agency table; not an automated lookup. */
  tableReference?: {
    agency: 'PADI RDP' | 'PADI RDP Air' | 'PADI RDP EANx32' | 'SSI' | 'SSI Air/EANx' | 'US Navy Air' | 'Other';
    edition: string;
    pressureGroup: string;
    ndlMinutes: number | null;
    sourceNote: string;
  } | null;
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
    depthSegments: input.depthSegments ?? [],
    manualStops: input.manualStops ?? [],
    warnings: input.warnings ?? [],
    rmvSourceDiveIds: [...new Set(input.rmvSourceDiveIds ?? [])],
    notes: input.notes?.trim() ?? '',
  });
}

export interface GasCylinderProjection {
  mix: PlanningGasMix | null;
  mixProvenance: string;
  analysisState: 'current' | 'stale' | 'manual' | 'unknown';
  fillId: string | null;
  rootFillId: string | null;
  analysisId: string | null;
  startPressureEvidence: {
    kind:
      | 'plan-snapshot'
      | 'owner-override'
      | 'selected-fill'
      | 'current-pressure'
      | 'unavailable';
    pressureBar: number | null;
    eventId: string | null;
    label: string;
  };
  provenanceChain: string[];
  modM: number | null;
  ppo2AtDepth: number | null;
  nitrogenFraction: number | null;
  requiredLitres: number | null;
  volume: ReturnType<typeof gasVolumeLitres>;
  warnings: string[];
}

function rootFillId(fill: Stored<CylinderFillRecord> | null | undefined) {
  return fill ? fill.originFillId || fill.entityId : null;
}

function fillEventLabel(fill: Stored<CylinderFillRecord>) {
  if (fill.eventType === 'usage')
    return `${fill.pressureUsedBar ?? '—'} bar used at ${fill.filledAt} · pressure ${fill.pressureBar ?? '—'} bar · event ${fill.entityId}`;
  if (fill.eventType === 'adjustment')
    return `Remaining pressure adjusted at ${fill.filledAt} · pressure ${fill.pressureBar ?? '—'} bar · event ${fill.entityId}`;
  return `Pressure recorded at ${fill.filledAt} · ${fill.pressureBar ?? '—'} bar · event ${fill.entityId}`;
}

function selectedFillEvidence(
  cylinder: GasPlanCylinder,
  fills: Array<Stored<CylinderFillRecord>>,
) {
  const cylinderFills = fills
    .filter((row) => row.cylinderEquipmentId === cylinder.cylinderEquipmentId)
    .sort((a, b) => b.filledAt.localeCompare(a.filledAt));
  const latestEvent = cylinderFills[0] ?? null;
  const selectedEvent = cylinder.fillId
    ? cylinderFills.find((row) => row.entityId === cylinder.fillId) ?? null
    : latestEvent;
  const selectedRootId = rootFillId(selectedEvent);
  const currentRootId = rootFillId(latestEvent);
  const rootFill = selectedRootId
    ? cylinderFills.find((row) => row.entityId === selectedRootId) ?? selectedEvent
    : null;
  const selectedChain = selectedRootId
    ? cylinderFills
        .filter((row) => rootFillId(row) === selectedRootId)
        .sort((a, b) => a.filledAt.localeCompare(b.filledAt))
    : [];
  return {
    cylinderFills,
    latestEvent,
    selectedEvent,
    selectedRootId,
    currentRootId,
    rootFill,
    selectedChain,
    selectedChainIsCurrent: Boolean(
      selectedEvent && selectedRootId && selectedRootId === currentRootId,
    ),
  };
}

function analysisForFillChain(
  evidence: ReturnType<typeof selectedFillEvidence>,
  cylinder: GasPlanCylinder,
  analyses: Array<Stored<GasAnalysisRecord>>,
) {
  if (!evidence.rootFill || !evidence.selectedChainIsCurrent) return null;
  const eligible = analyses
    .filter(
      (row) =>
        row.cylinderEquipmentId === evidence.rootFill?.cylinderEquipmentId &&
        row.fillId === evidence.selectedRootId &&
        !row.markedStaleAt &&
        Date.parse(row.analysedAt) >= Date.parse(evidence.rootFill?.filledAt ?? ''),
    )
    .sort((a, b) => b.analysedAt.localeCompare(a.analysedAt));
  if (cylinder.analysisId)
    return eligible.find((row) => row.entityId === cylinder.analysisId) ?? null;
  return eligible[0] ?? null;
}

function monthAt(value: string) {
  return value.slice(0, 7);
}

export function cylinderReadinessWarnings(
  cylinder: Stored<CylinderEquipmentRecord>,
  mix: PlanningGasMix | null,
  asOf = new Date().toISOString(),
  requiredValveType?: GasPlanCylinder['requiredValveType'],
) {
  const warnings: string[] = [];
  const schedule = deriveCylinderInspectionSchedule(cylinder);
  const currentMonth = monthAt(asOf);
  const hydroDue = cylinder.hydroDueAt ?? schedule.hydroDueAt;
  const visualDue = cylinder.visualDueAt ?? schedule.visualDueAt;
  if (!hydroDue) warnings.push('Cylinder hydro test date/due date is missing.');
  else if (hydroDue < currentMonth)
    warnings.push(`Cylinder hydro test is overdue (due ${hydroDue}).`);
  if (!visualDue)
    warnings.push('Cylinder visual inspection date/due date is missing.');
  else if (visualDue < currentMonth)
    warnings.push(`Cylinder visual inspection is overdue (due ${visualDue}).`);
  if (cylinder.valveType !== 'DIN' && cylinder.valveType !== 'A-CLAMP')
    warnings.push('Cylinder valve type is unknown.');
  else if (requiredValveType && cylinder.valveType !== requiredValveType)
    warnings.push(
      `Cylinder valve type ${cylinder.valveType} does not match required ${requiredValveType}.`,
    );
  if ((mix?.oxygenFraction ?? 0) > 0.4) {
    if (!cylinder.oxygenClean)
      warnings.push(
        'Cylinder has no current O₂-clean evidence for the selected oxygen-rich mix.',
      );
    else if (!cylinder.oxygenCleanUntil)
      warnings.push(
        'Cylinder O₂-clean expiry is missing for the selected oxygen-rich mix.',
      );
    else if (monthAt(cylinder.oxygenCleanUntil) < currentMonth)
      warnings.push(
        `Cylinder O₂-clean evidence is overdue for the selected oxygen-rich mix (due ${monthAt(cylinder.oxygenCleanUntil)}).`,
      );
  }
  if (cylinder.cylinderStatus === 'service')
    warnings.push('Cylinder is marked as requiring service.');
  if (cylinder.cylinderStatus === 'retired' || cylinder.retired)
    warnings.push('Cylinder is retired and must not be planned for use.');
  return warnings;
}

export function cylinderPickerSummary(
  cylinder: Stored<CylinderEquipmentRecord>,
  fills: Array<Stored<CylinderFillRecord>>,
  analyses: Array<Stored<GasAnalysisRecord>>,
  asOf = new Date().toISOString(),
) {
  const evidence = selectedFillEvidence(
    { id: 'picker', role: 'primary', cylinderEquipmentId: cylinder.entityId },
    fills,
  );
  const analysis = analysisForFillChain(
    evidence,
    { id: 'picker', role: 'primary', cylinderEquipmentId: cylinder.entityId },
    analyses,
  );
  const mix = analysis
    ? gasMixLabel(analysis.oxygenFraction, analysis.heliumFraction)
    : evidence.selectedEvent
      ? gasMixLabel(
          evidence.selectedEvent.oxygenFraction,
          evidence.selectedEvent.heliumFraction,
        )
      : 'No gas';
  const schedule = deriveCylinderInspectionSchedule(cylinder);
  const visualDue = cylinder.visualDueAt ?? schedule.visualDueAt;
  const testState = !visualDue
    ? 'visual date missing'
    : visualDue < monthAt(asOf)
      ? `visual overdue ${visualDue}`
      : `visual due ${visualDue}`;
  return [
    `Cyl ${cylinder.cylinderNumber || cylinder.entityId}`,
    cylinder.waterVolumeLiters == null ? 'volume unknown' : `${cylinder.waterVolumeLiters} L`,
    mix,
    evidence.selectedEvent?.pressureBar == null
      ? 'pressure unknown'
      : `${evidence.selectedEvent.pressureBar} bar`,
    analysis ? 'analysis current' : 'analysis missing/stale',
    testState,
  ].join(' · ');
}

/** Keeps composition evidence attached to its root fill through usage-only pressure events. */
export function projectGasCylinder(
  cylinder: GasPlanCylinder,
  plan: Pick<GasPlanRecord, 'plannedDepthM' | 'plannedBottomTimeMin' | 'rmvRateLitresMin' | 'depthSegments'> & { cylinders?: GasPlanCylinder[] },
  fills: Array<Stored<CylinderFillRecord>>,
  analyses: Array<Stored<import('./loadouts-gas').GasAnalysisRecord>>,
  equipment: Array<Stored<CylinderEquipmentRecord>>,
  asOf = new Date().toISOString(),
): GasCylinderProjection {
  const warnings: string[] = [];
  const evidence = selectedFillEvidence(cylinder, fills);
  const fill = evidence.selectedEvent;
  const selectedFillIsOlder = Boolean(fill && !evidence.selectedChainIsCurrent);
  const selectedPressureEventIsOlder = Boolean(
    cylinder.fillId &&
      fill &&
      evidence.latestEvent &&
      evidence.selectedChainIsCurrent &&
      fill.entityId !== evidence.latestEvent.entityId,
  );
  const chosenAnalysis = cylinder.analysisId ? analyses.find((row) => row.entityId === cylinder.analysisId) ?? null : null;
  const analysis = analysisForFillChain(evidence, cylinder, analyses);
  if (!fill) warnings.push('No current fill evidence.');
  if (selectedFillIsOlder) warnings.push('Selected fill is older than the latest recorded fill; its analysis is not current evidence.');
  if (selectedPressureEventIsOlder)
    warnings.push(
      'Selected pressure event is older than the latest pressure event for this fill chain.',
    );
  if (chosenAnalysis && !analysis) warnings.push('Selected analysis is stale or belongs to another fill.');
  const manual = cylinder.mixSource === 'manual';
  const candidateMix = manual
    ? { oxygenFraction: cylinder.manualOxygenFraction ?? Number.NaN, heliumFraction: cylinder.manualHeliumFraction ?? Number.NaN }
    : analysis
      ? { oxygenFraction: analysis.oxygenFraction ?? Number.NaN, heliumFraction: analysis.heliumFraction ?? Number.NaN }
      : null;
  const mix = candidateMix && validateMix(candidateMix) ? candidateMix : null;
  const analysisState = manual ? 'manual' : analysis ? 'current' : chosenAnalysis || analyses.some((row) => row.cylinderEquipmentId === cylinder.cylinderEquipmentId) ? 'stale' : 'unknown';
  if (!mix) {
    warnings.push('No valid current gas analysis or explicitly recorded manual mix.');
    if (fill) warnings.push('Current fill chain has no valid analysis provenance.');
  }
  if (manual) warnings.push('Manual mix is not verified analysis evidence.');
  const depthM = cylinder.depthM ?? plan.plannedDepthM ?? null;
  const targetPpo2 = cylinder.targetPpo2 ?? 1.4;
  const modM = mix ? maximumOperatingDepth(mix, targetPpo2) : null;
  const ppo2AtDepth = mix ? oxygenPartialPressure(mix, depthM) : null;
  if (depthM != null && modM != null && depthM > modM) warnings.push('Planned depth exceeds calculated MOD for the chosen target PPO₂.');
  if (ppo2AtDepth != null && ppo2AtDepth > targetPpo2) warnings.push('Calculated PPO₂ exceeds the chosen target.');
  const item = equipment.find((row) => row.entityId === cylinder.cylinderEquipmentId);
  const pressureBar = cylinder.startPressureBar ?? (selectedFillIsOlder ? null : fill?.pressureBar) ?? null;
  const startPressureKind = cylinder.startPressureBar != null
    ? cylinder.startPressureSource === 'owner-override'
      ? 'owner-override'
      : 'plan-snapshot'
    : cylinder.fillId
      ? 'selected-fill'
      : fill
        ? 'current-pressure'
        : 'unavailable';
  const startPressureEvidence: GasCylinderProjection['startPressureEvidence'] = {
    kind: startPressureKind,
    pressureBar,
    eventId: fill?.entityId ?? null,
    label:
      startPressureKind === 'owner-override'
        ? 'Owner-entered override'
        : startPressureKind === 'plan-snapshot'
          ? 'Explicit plan snapshot'
          : startPressureKind === 'selected-fill'
            ? `Selected fill/pressure event ${fill?.entityId ?? ''}`.trim()
            : startPressureKind === 'current-pressure'
              ? `Current cylinder pressure · ${fill?.eventType ?? 'fill'} event ${fill?.entityId ?? ''}`.trim()
              : 'No pressure evidence',
  };
  const volume = gasVolumeLitres(cylinder.waterVolumeOverrideL ?? item?.waterVolumeLiters, pressureBar, cylinder.reservePressureBar);
  if (!volume) warnings.push('Cylinder water volume, start pressure or reserve is missing/invalid.');
  if (item) warnings.push(...cylinderReadinessWarnings(item, mix, asOf, cylinder.requiredValveType));
  const multiCylinder = (plan.cylinders?.length ?? 1) > 1;
  const assignedSegments = plan.depthSegments?.length && plan.depthSegments.every((row) => row.gasCylinderId && plan.cylinders?.some((item) => item.id === row.gasCylinderId));
  const segments = plan.depthSegments?.length
    ? plan.depthSegments.filter((row) => multiCylinder ? row.gasCylinderId === cylinder.id : !row.gasCylinderId || row.gasCylinderId === cylinder.id)
    : [{ id: 'single-level', depthM, minutes: plan.plannedBottomTimeMin ?? null }];
  const requiredLitres = multiCylinder && !assignedSegments ? null : segments.length ? gasRequiredForSegments(plan.rmvRateLitresMin, segments) : null;
  if (multiCylinder && !assignedSegments) warnings.push('Total gas needed unavailable until depth/time segments are assigned to a cylinder.');
  if (requiredLitres != null && volume && requiredLitres > volume.usableLitres) warnings.push('Estimated gas required exceeds usable gas after reserve.');
  const provenanceChain = evidence.rootFill
    ? [
        `Filled at ${evidence.rootFill.location || evidence.rootFill.provider || 'location not recorded'} on ${evidence.rootFill.filledAt} · fill ${evidence.rootFill.entityId} · source ${evidence.rootFill.source}`,
        ...(analysis
          ? [
              `analysed at ${analysis.analysedAt} · analysis ${analysis.entityId} · O₂ ${Math.round((analysis.oxygenFraction ?? 0) * 100)}% · He ${Math.round((analysis.heliumFraction ?? 0) * 100)}% · analyser ${analysis.analysedByPersonId || 'not recorded'} · source ${analysis.source ?? 'recorded'}`,
            ]
          : []),
        ...evidence.selectedChain
          .filter((row) => row.entityId !== evidence.rootFill?.entityId)
          .map(fillEventLabel),
      ]
    : [];
  return {
    mix,
    mixProvenance: manual ? 'Manual entry, not verified analysis' : analysis ? `Analysis ${analysis.entityId} · ${analysis.analysedAt}` : 'No current analysis',
    analysisState,
    fillId: fill?.entityId ?? null,
    rootFillId: evidence.selectedRootId,
    analysisId: analysis?.entityId ?? null,
    startPressureEvidence,
    provenanceChain,
    modM,
    ppo2AtDepth,
    nitrogenFraction: mix ? nitrogenFraction(mix) : null,
    requiredLitres,
    volume,
    warnings,
  };
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
    | 'plannedDepthM'
    | 'plannedBottomTimeMin'
    | 'rmvRateLitresMin'
    | 'depthSegments'
    | 'cylinders'
  >,
  fills: Array<Stored<CylinderFillRecord>>,
  equipment: Array<Stored<CylinderEquipmentRecord>> = [],
  analyses: Array<Stored<GasAnalysisRecord>> = [],
  asOf = new Date().toISOString(),
) {
  const warnings: string[] = [];
  if (!input.cylinders.length) warnings.push('No cylinders selected.');
  if (input.plannedDepthM == null || input.plannedBottomTimeMin == null)
    warnings.push('Depth/time incomplete; gas needed cannot be trusted.');
  if (input.rmvRateLitresMin == null)
    warnings.push('Using no RMV baseline; enter a conservative override.');
  for (const cylinder of input.cylinders) {
    const fill = selectedFillEvidence(cylinder, fills).selectedEvent;
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
    warnings.push(
      ...projectGasCylinder(
        cylinder,
        input,
        fills,
        analyses,
        equipment,
        asOf,
      ).warnings,
    );
  }
  return [...new Set(warnings)];
}

export async function planningPageSources() {
  const [bookings, gasPlans, divePlans, dives, fills, analyses, cylinders] =
    await Promise.all([
      listDivingCalendarBookings(),
      listGasPlans().catch(() => [] as StoredGasPlanRecord[]),
      listEnrichedDivePlans(),
      listDives(),
      listCylinderFills(),
      listGasAnalyses(),
      listCylinderInventory(),
    ]);
  return {
    bookings,
    gasPlans,
    divePlans,
    dives,
    fills,
    analyses,
    cylinders,
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
      ...(gasPlan.recGasPlan101 ? { recreationalSummary: {
        model: gasPlan.recGasPlan101.selectedBuhlmannModel,
        selectedGas: gasPlan.recGasPlan101.selectedGasLabel,
        ndlMinutes: gasPlan.recGasPlan101.gasCandidates.find(candidate => candidate.selected)?.ndl.minutes ?? null,
        gasLimitedTimeMin: gasPlan.recGasPlan101.gasCandidates.find(candidate => candidate.selected)?.gasLimitedTimeMin ?? null,
        reserveBar: gasPlan.recGasPlan101.reserve.selectedBar,
        limitingFactor: gasPlan.recGasPlan101.limitingFactor,
      } } : {}),
    },
  ];
  return saveEnrichedDivePlan({
    ...plan,
    entityId: plan.entityId,
    gasPlanLinks,
  });
}

/** Reconciles only canonical ID links. A Gas Plan linked to another Plan is never silently transferred. */
export async function saveDivePlanWithGasLinks(
  input: Parameters<typeof saveEnrichedDivePlan>[0],
  gasPlans: StoredGasPlanRecord[],
  selectedIds: string[],
) {
  const selected = new Set(selectedIds);
  for (const gas of gasPlans) {
    if (selected.has(gas.entityId) && gas.divePlanId && gas.divePlanId !== input.entityId)
      throw new Error(`${gas.name} already belongs to another Dive Plan. Unlink it there before linking here.`);
  }
  const existingLinks = new Map((input.gasPlanLinks ?? []).map((link) => [link.gasPlanId, link]));
  const linkedAt = new Date().toISOString();
  const gasPlanLinks = [...selected].map((gasPlanId) => {
    const gas = gasPlans.find((item) => item.entityId === gasPlanId);
    const previous = existingLinks.get(gasPlanId);
    return {
      gasPlanId,
      linkedAt: previous?.linkedAt ?? linkedAt,
      name: gas?.name ?? previous?.name ?? 'Unavailable Gas Plan',
      notes: gas?.notes ?? previous?.notes ?? '',
      warnings: gas?.warnings ?? previous?.warnings ?? [],
    };
  });
  const result = await saveEnrichedDivePlan({ ...input, gasPlanLinks });
  for (const gas of gasPlans) {
    if (selected.has(gas.entityId) && gas.divePlanId !== result.id)
      await saveGasPlan({ ...gas, entityId: gas.entityId, divePlanId: result.id });
    else if (!selected.has(gas.entityId) && gas.divePlanId === result.id)
      await saveGasPlan({ ...gas, entityId: gas.entityId, divePlanId: null });
  }
  return result;
}
