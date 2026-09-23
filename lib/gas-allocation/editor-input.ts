import type { RecreationalGasInput } from '../offline/recreational-gas-planner';
import {
  projectGasCylinder,
  type GasPlanRecord,
  type GasPlanCylinder,
  type RmvBaseline,
} from '../offline/planning-pages';
import {
  deriveCylinderInspectionSchedule,
  type CylinderEquipmentRecord,
  type CylinderFillRecord,
  type GasAnalysisRecord,
} from '../offline/loadouts-gas';
import type { Stored } from '../offline/dive-planning';
import { emptyAllocation, type AllocationMetadata } from './integration';
import type { AllocationCylinder, SupplyMode } from './model';
export function initialRecreationalInput(
  item: GasPlanRecord | null,
  baseline: RmvBaseline,
): RecreationalGasInput {
  const saved = item?.recGasPlan101;
  return {
    mode: saved?.mode ?? (item?.multiLevel ? 'multilevel' : 'direct-ascent'),
    selectedBuhlmannModel: saved?.selectedBuhlmannModel ?? 'ZH-L16C',
    compareOtherModel: saved?.compareOtherModel ?? false,
    gfLow: saved?.gfLow ?? item?.gradientFactorLow ?? 40,
    gfHigh: saved?.gfHigh ?? item?.gradientFactorHigh ?? 85,
    waterType: saved?.waterType ?? 'salt',
    surfacePressureBar: saved?.surfacePressureBar ?? 1,
    plannedDepthM: saved?.plannedDepthM ?? item?.plannedDepthM ?? 30,
    conservatismM: saved?.conservatismM ?? 3,
    maxPpo2: saved?.maxPpo2 ?? 1.4,
    selectedGasLabel: saved?.selectedGasLabel ?? 'Air / EAN21',
    customGas: saved?.customGas ?? null,
    analysedGases: saved?.analysedGases ?? [],
    cylinderWaterVolumeL: saved?.cylinderWaterVolumeL ?? null,
    startPressureBar: saved?.startPressureBar ?? null,
    ownRmvLMin:
      saved?.ownRmvLMin ?? item?.rmvRateLitresMin ?? baseline.litresPerMinute,
    buddyRmvLMin: saved?.buddyRmvLMin ?? null,
    ownRmvSource:
      saved?.ownRmvSource ??
      (item?.rmvSource === 'manual'
        ? 'owner-entered'
        : item?.rmvSource === 'logbook-average' ||
            baseline.litresPerMinute != null
          ? 'profile-average'
          : 'unknown'),
    buddyRmvSource: saved?.buddyRmvSource ?? 'owner-fallback',
    reserveStrategy: saved?.reserveStrategy ?? 'most-conservative',
    ascentRateMMin: saved?.ascentRateMMin ?? item?.ascentRateMMin ?? 9,
    ownerMaxDurationMin: saved?.ownerMaxDurationMin ?? null,
    plannedWorkingTimeMin:
      saved?.plannedWorkingTimeMin ?? item?.plannedBottomTimeMin ?? null,
    routeSegments: saved?.routeSegments ?? [],
    repetitiveDive: saved?.repetitiveDive ?? false,
    cylinderSourceMode: 'manual',
  };
}
export function newAllocationCylinder(
  mode: SupplyMode,
  oxygen: number | null,
): AllocationCylinder {
  return {
    id: crypto.randomUUID(),
    snapshotId: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    canonicalId: null,
    label: '',
    mode,
    role: 'main',
    gas: { oxygen, helium: 0 },
    waterVolumeL: null,
    currentPressureBar: null,
    plannedStartPressureBar: null,
    ratedPressureBar: null,
    availableFrom: 'start',
    analysisConfirmed: false,
    conditionConfirmed: false,
    pressureToleranceBar: 5,
    analysisSource: 'unknown',
    analysedAt: null,
    cylinderType: 'unknown',
    fillSource: 'unknown',
  };
}
export function captureOwnedCylinder(
  row: AllocationCylinder,
  canonical: Stored<CylinderEquipmentRecord>,
  draft: GasPlanRecord,
  fills: Stored<CylinderFillRecord>[],
  analyses: Stored<GasAnalysisRecord>[],
): AllocationCylinder {
  const legacy: GasPlanCylinder = {
    id: row.id,
    sourceMode: 'owned',
    cylinderEquipmentId: canonical.entityId,
    role: 'primary',
  };
  const projection = projectGasCylinder(legacy, draft, fills, analyses, [
    canonical,
  ]);
  const schedule = deriveCylinderInspectionSchedule(canonical);
  return {
    ...row,
    snapshotId: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
    canonicalId: canonical.entityId,
    label: [canonical.cylinderNumber, canonical.name]
      .filter(Boolean)
      .join(' · '),
    waterVolumeL: canonical.waterVolumeLiters ?? null,
    ratedPressureBar: canonical.workingPressureBar ?? null,
    currentPressureBar: projection.startPressureEvidence.pressureBar,
    fillId: projection.fillId,
    analysisId: projection.analysisId,
    analysedAt:
      analyses.find((entry) => entry.entityId === projection.analysisId)
        ?.analysedAt ?? null,
    analysisSource: 'unknown',
    gas:
      row.mode === 'own-full'
        ? {
            oxygen: projection.mix?.oxygenFraction ?? null,
            helium: projection.mix?.heliumFraction ?? null,
          }
        : row.gas,
    analysisConfirmed:
      row.mode === 'own-full' && projection.analysisState === 'current',
    conditionConfirmed:
      canonical.cylinderStatus !== 'service' &&
      canonical.cylinderStatus !== 'retired' &&
      !canonical.retired &&
      Boolean(
        (canonical.hydroDueAt || schedule.hydroDueAt) &&
        String(canonical.hydroDueAt || schedule.hydroDueAt) >=
          new Date().toISOString().slice(0, 7) &&
        (canonical.visualDueAt || schedule.visualDueAt) &&
        String(canonical.visualDueAt || schedule.visualDueAt) >=
          new Date().toISOString().slice(0, 7),
      ),
    valve: canonical.valveType ?? null,
  };
}
/** Explicit owner upgrade only; no persistence, identity replacement or guessed fill/analysis. */
export function upgradeAllocation(
  draft: GasPlanRecord,
  fills: Stored<CylinderFillRecord>[],
  analyses: Stored<GasAnalysisRecord>[],
  equipment: Stored<CylinderEquipmentRecord>[],
): AllocationMetadata {
  const allocation = emptyAllocation();
  allocation.mode = draft.cylinders.length ? 'supplied' : 'requirements-only';
  allocation.cylinders = draft.cylinders.map((prior) => {
    const projection = projectGasCylinder(
        prior,
        draft,
        fills,
        analyses,
        equipment,
      ),
      canonical = equipment.find(
        (row) => row.entityId === prior.cylinderEquipmentId,
      ),
      rental = prior.rentalSnapshot;
    const row: AllocationCylinder = {
      ...newAllocationCylinder(
        prior.sourceMode === 'rental' ? 'hire' : 'own-full',
        projection.mix?.oxygenFraction ?? null,
      ),
      id: prior.id,
      canonicalId: canonical?.entityId ?? prior.cylinderEquipmentId ?? null,
      label: rental?.label || canonical?.name || prior.id,
      reserveFloorBar: prior.reservePressureBar ?? null,
      endPressureBar: prior.endPressureBar ?? null,
      turnPressureBar: prior.turnPressureBar ?? null,
      role:
        prior.role === 'stage'
          ? 'stage'
          : prior.role === 'bailout' || prior.role === 'backup'
            ? 'pony'
            : 'main',
      gas: {
        oxygen: projection.mix?.oxygenFraction ?? null,
        helium: projection.mix?.heliumFraction ?? null,
      },
      waterVolumeL:
        rental?.waterVolumeL ??
        prior.waterVolumeOverrideL ??
        canonical?.waterVolumeLiters ??
        null,
      currentPressureBar: projection.startPressureEvidence.pressureBar,
      plannedStartPressureBar:
        prior.startPressureBar ??
        rental?.startPressureBar ??
        projection.startPressureEvidence.pressureBar,
      ratedPressureBar:
        rental?.workingPressureBar ?? canonical?.workingPressureBar ?? null,
      analysisConfirmed: projection.analysisState === 'current',
      conditionConfirmed: false,
      fillId: projection.fillId,
      analysisId: projection.analysisId,
      analysedAt:
        rental?.analysedAt ??
        analyses.find((entry) => entry.entityId === projection.analysisId)
          ?.analysedAt ??
        null,
      analysisSource: rental?.analysisSource ?? 'unknown',
      cylinderType: rental?.cylinderType ?? 'unknown',
      fillSource: rental?.fillSource ?? 'unknown',
      ...(rental?.savedCylinderId
        ? { ownedCopyId: rental.savedCylinderId }
        : {}),
      notes: prior.notes ?? '',
    };
    return row;
  });
  // Legacy segment references remain in the record. Assignments and reserves require review.
  return allocation;
}
