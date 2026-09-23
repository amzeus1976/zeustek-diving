import {
  assessGasAllocation,
  ALLOCATION_VERSION,
  type AllocationPlan,
  type AllocationCylinder,
  type AllocationStatus,
} from './model';
import {
  selectReserve,
  type RouteSegment,
} from '../offline/recreational-gas-reserve';
import {
  REC_GAS_VERSION,
  type RecreationalGasInput,
  type RecreationalGasSnapshot,
} from '../offline/recreational-gas-planner';
import type {
  GasPlanRecord,
  GasPlanCylinder,
  RentalCylinderSnapshot,
} from '../offline/planning-pages';

export interface AllocationMetadata extends AllocationPlan {
  referenceSupplyId?: string;
  workingSupplyId?: string;
  savedAt?: string;
  engineVersion?: string;
  assessment?: ReturnType<typeof allocationReadiness>;
}
export type AllocatedGasPlan = GasPlanRecord & {
  entityId?: string;
  allocationV1?: AllocationMetadata;
};
export const emptyAllocation = (): AllocationMetadata => ({
  version: ALLOCATION_VERSION,
  mode: 'requirements-only',
  cylinders: [],
  manifolds: [],
  reserves: [],
  scenarios: [],
  switches: [],
});
export function allocationSegments(
  input: RecreationalGasInput,
  allocation: AllocationMetadata,
): RouteSegment[] {
  return input.mode === 'direct-ascent'
    ? [
        {
          id: 'working',
          label: 'End of planned working time',
          depthM: input.plannedDepthM,
          minutes: input.plannedWorkingTimeMin,
          startDepthM: input.plannedDepthM,
          endDepthM: input.plannedDepthM,
          cylinderId: allocation.workingSupplyId ?? null,
          stressFactor: 1,
          buddySharing: false,
          directAscentPossible: true,
        },
      ]
    : input.routeSegments;
}
export function accessibleSupplies(allocation: AllocationMetadata) {
  const grouped = new Set(
    allocation.manifolds.flatMap((row) => row.cylinderIds),
  );
  return [
    ...allocation.cylinders
      .filter((row) => !grouped.has(row.id))
      .map((row) => ({
        id: row.id,
        label: row.label || row.id,
        members: [row],
      })),
    ...allocation.manifolds.map((group) => ({
      id: group.id,
      label: group.label,
      members: allocation.cylinders.filter((row) =>
        group.cylinderIds.includes(row.id),
      ),
    })),
  ];
}
function available(row: AllocationCylinder) {
  const pressure =
    row.mode !== 'own-empty' && row.currentPressureBar != null
      ? Math.min(row.currentPressureBar, row.plannedStartPressureBar ?? 0)
      : (row.plannedStartPressureBar ?? 0);
  return Math.max(0, (row.waterVolumeL ?? 0) * pressure);
}
export function allocationContext(
  input: RecreationalGasInput,
  snapshot: RecreationalGasSnapshot | null,
  allocation: AllocationMetadata,
) {
  const floors = accessibleSupplies(allocation).map((supply) => {
    const thirds =
      input.reserveStrategy === 'calculated'
        ? 0
        : snapshot
          ? (selectReserve(
              supply.members.reduce((total, row) => total + available(row), 0),
              snapshot.reserve,
              'thirds',
            ).thirdsLitres ?? NaN)
          : NaN;
    const customPressure = Math.max(
        0,
        ...supply.members.map((row) => row.reserveFloorBar ?? 0),
      ),
      volume = supply.members.reduce(
        (total, row) => total + (row.waterVolumeL ?? 0),
        0,
      );
    return {
      supplyId: supply.id,
      litres: Math.max(thirds, customPressure * volume),
    };
  });
  return {
    segments: allocationSegments(input, allocation),
    ownRmvLMin: input.ownRmvLMin,
    buddyRmvLMin: input.buddyRmvLMin,
    waterType: input.waterType,
    surfacePressureBar: input.surfacePressureBar,
    reserveMinimumL:
      snapshot?.reserve.selectedLitres ?? snapshot?.reserve.totalLitres ?? null,
    maxPpo2: input.maxPpo2,
    reserveFloors: floors,
    plannedMaxDepthM: input.plannedDepthM,
  };
}
/** Supply reference supports the existing single-supply comparison; independent supplies are never combined here. */
export function allocationEngineInput(
  input: RecreationalGasInput,
  allocation: AllocationMetadata,
): RecreationalGasInput {
  const reference = accessibleSupplies(allocation).find(
    (row) => row.id === allocation.referenceSupplyId,
  );
  const group = allocation.manifolds.find(
      (row) => row.id === allocation.referenceSupplyId,
    ),
    members = reference?.members ?? [];
  const invalidReference =
    allocation.referenceSupplyId &&
    (!reference?.members.length ||
      (group &&
        (!group.connected ||
          group.operatingState !== 'open' ||
          group.cylinderIds.length !== 2 ||
          new Set(group.cylinderIds).size !== 2 ||
          members.length !== 2 ||
          members.some((row) => row.role !== 'main') ||
          members[0]?.gas.oxygen !== members[1]?.gas.oxygen ||
          members[0]?.gas.helium !== members[1]?.gas.helium ||
          members[0]?.plannedStartPressureBar !==
            members[1]?.plannedStartPressureBar ||
          (members.every((row) => row.mode !== 'own-empty') &&
            members[0]?.currentPressureBar !==
              members[1]?.currentPressureBar) ||
          members[0]?.availableFrom !== members[1]?.availableFrom)));
  if (invalidReference)
    return {
      ...input,
      cylinderSourceMode: 'manual',
      cylinderSourceId: null,
      cylinderSourceLabel: 'Invalid reference configuration',
      cylinderWaterVolumeL: null,
      startPressureBar: null,
      sourceWarnings: [
        'Verify the reference supply accessibility configuration before using its capacity.',
      ],
    };
  if (!reference?.members.length)
    return {
      ...input,
      cylinderSourceMode: 'manual',
      cylinderSourceId: null,
      cylinderSourceLabel: 'Requirements only / reference capacity',
      pressureSource: 'Owner-entered reference capacity',
      sourceWarnings: [],
    };
  const volume = reference.members.reduce(
      (total, row) => total + (row.waterVolumeL ?? 0),
      0,
    ),
    litres = reference.members.reduce(
      (total, row) => total + available(row),
      0,
    );
  return {
    ...input,
    cylinderSourceMode: 'manual',
    cylinderSourceId: reference.id,
    cylinderSourceLabel: reference.label,
    cylinderWaterVolumeL: volume || null,
    startPressureBar: volume > 0 ? litres / volume : null,
    pressureSource:
      'Explicit allocation reference; independent supplies assessed separately',
    sourceWarnings: [],
  };
}
export function allocationReadiness(
  input: RecreationalGasInput,
  snapshot: RecreationalGasSnapshot | null,
  allocation: AllocationMetadata,
) {
  const allocationResult = assessGasAllocation(
    allocation,
    allocationContext(input, snapshot, allocation),
  );
  const physiologicalReasons: string[] = [];
  const gas = snapshot?.gasCandidates.find((row) => row.selected);
  if (!snapshot || !gas || gas.ndl.state !== 'available')
    physiologicalReasons.push(
      'The selected frozen Bühlmann NDL is unavailable; no physiological Ready assessment is possible.',
    );
  if (
    gas &&
    (gas.ppo2AtPlannedDepth > input.maxPpo2 ||
      gas.ppo2AtConservativeDepth > input.maxPpo2 ||
      gas.modM < input.plannedDepthM)
  )
    physiologicalReasons.push(
      'Selected gas exceeds the frozen MOD/PPO₂ assessment.',
    );
  if (input.plannedWorkingTimeMin == null || input.plannedWorkingTimeMin <= 0)
    physiologicalReasons.push('Enter the planned working time.');
  const routeMinutes = input.routeSegments.reduce(
    (total, row) => total + (row.durationMin ?? row.minutes ?? 0),
    0,
  );
  if (
    input.mode !== 'direct-ascent' &&
    input.plannedWorkingTimeMin != null &&
    routeMinutes > input.plannedWorkingTimeMin + 1e-7
  )
    physiologicalReasons.push(
      'The complete route exceeds the declared working time; its physiological exposure has not been validated.',
    );
  if (
    gas?.ndl.minutes != null &&
    input.plannedWorkingTimeMin != null &&
    input.plannedWorkingTimeMin > gas.ndl.minutes
  )
    physiologicalReasons.push(
      'Planned working time exceeds the selected frozen NDL.',
    );
  if (
    input.ownerMaxDurationMin != null &&
    input.plannedWorkingTimeMin != null &&
    input.plannedWorkingTimeMin > input.ownerMaxDurationMin
  )
    physiologicalReasons.push(
      'Planned working time exceeds the owner duration limit.',
    );
  const ids = new Set([
    ...allocationSegments(input, allocation).flatMap((row) =>
      row.cylinderId ? [row.cylinderId] : [],
    ),
    ...allocation.reserves.map((row) => row.supplyId),
    ...allocation.scenarios
      .filter((row) => row.selected)
      .flatMap((row) => [
        ...row.assignments.map((item) => item.supplyId),
        ...row.reserves.map((item) => item.supplyId),
      ]),
  ]);
  const used = accessibleSupplies(allocation)
    .filter((row) => ids.has(row.id))
    .flatMap((row) => row.members);
  if (
    used.some(
      (row) =>
        row.gas.helium !== 0 ||
        row.gas.oxygen == null ||
        !gas ||
        Math.abs(row.gas.oxygen - gas.oxygenFraction) > 1e-7,
    )
  )
    physiologicalReasons.push(
      'Different-gas or helium supply physiology is unsupported. Explicit switches receive no NDL, decompression or physiological credit; allocation sufficiency alone cannot mean Ready.',
    );
  if (input.repetitiveDive)
    physiologicalReasons.push(
      'Residual nitrogen is unknown for this repetitive plan.',
    );
  const status: AllocationStatus = physiologicalReasons.length
    ? 'BLOCKED'
    : allocationResult.status;
  return {
    version: ALLOCATION_VERSION,
    engineVersion: REC_GAS_VERSION,
    status,
    physiologicalStatus: physiologicalReasons.length
      ? ('BLOCKED' as const)
      : ('PASS' as const),
    physiologicalReasons,
    allocation: allocationResult,
  };
}
function legacyCylinder(
  row: AllocationCylinder,
  prior: GasPlanCylinder | undefined,
): GasPlanCylinder {
  const owned = row.mode === 'own-empty' || row.mode === 'own-full';
  const rental: RentalCylinderSnapshot = {
    ...prior?.rentalSnapshot,
    label: row.label,
    cylinderType:
      row.cylinderType ?? prior?.rentalSnapshot?.cylinderType ?? 'unknown',
    waterVolumeL: row.waterVolumeL,
    workingPressureBar: row.ratedPressureBar,
    startPressureBar: row.plannedStartPressureBar,
    remainingPressureBar: row.currentPressureBar,
    valveType:
      row.valve === 'DIN' || row.valve === 'A-CLAMP' ? row.valve : 'unknown',
    gasType: row.gas.oxygen === 0.21 ? 'air' : 'nitrox',
    oxygenFraction: row.gas.oxygen,
    heliumFraction: row.gas.helium,
    analysisStatus: row.analysisConfirmed ? 'current' : 'missing',
    analysisSource:
      row.analysisSource ?? prior?.rentalSnapshot?.analysisSource ?? 'unknown',
    analysedAt: row.analysisConfirmed
      ? (row.analysedAt ?? prior?.rentalSnapshot?.analysedAt ?? row.capturedAt)
      : null,
    fillSource:
      row.fillSource ??
      prior?.rentalSnapshot?.fillSource ??
      (row.mode === 'hire' ? 'dive-centre' : 'unknown'),
    notes: row.notes ?? '',
    ...(row.ownedCopyId ? { savedCylinderId: row.ownedCopyId } : {}),
  };
  return {
    ...prior,
    id: row.id,
    reservePressureBar:
      row.reserveFloorBar !== undefined
        ? row.reserveFloorBar
        : (prior?.reservePressureBar ?? null),
    endPressureBar:
      row.endPressureBar !== undefined
        ? row.endPressureBar
        : (prior?.endPressureBar ?? null),
    turnPressureBar:
      row.turnPressureBar !== undefined
        ? row.turnPressureBar
        : (prior?.turnPressureBar ?? null),
    sourceMode: owned ? 'owned' : 'rental',
    cylinderEquipmentId: owned ? row.canonicalId : null,
    fillId: owned ? (row.fillId ?? null) : null,
    analysisId: owned ? (row.analysisId ?? null) : null,
    role:
      row.role === 'stage'
        ? 'stage'
        : row.role === 'pony'
          ? 'bailout'
          : row.role === 'main'
            ? 'primary'
            : 'bottom',
    rentalSnapshot: owned ? null : rental,
    waterVolumeOverrideL: row.waterVolumeL,
    startPressureBar: row.plannedStartPressureBar,
    startPressureSource: 'plan-snapshot',
    manualOxygenFraction: row.gas.oxygen,
    manualHeliumFraction: row.gas.helium,
    mixSource: row.mode === 'own-full' ? 'analysis' : 'manual',
    notes: row.notes ?? prior?.notes ?? '',
  };
}
export function gasPlanWithAllocation(
  draft: GasPlanRecord,
  input: RecreationalGasInput,
  snapshot: RecreationalGasSnapshot,
  allocation: AllocationMetadata,
): AllocatedGasPlan {
  const assessment = allocationReadiness(input, snapshot, allocation);
  if (draft.status === 'ready' && assessment.status !== 'PASS')
    throw new Error(
      'Cannot mark Ready: resolve allocation, evidence and physiological requirements.',
    );
  return {
    ...draft,
    plannedDepthM: input.plannedDepthM,
    plannedBottomTimeMin: input.plannedWorkingTimeMin,
    rmvRateLitresMin: input.ownRmvLMin,
    gradientFactorLow: input.gfLow,
    gradientFactorHigh: input.gfHigh,
    ascentRateMMin: input.ascentRateMMin,
    recGasPlan101: snapshot,
    cylinders: allocation.cylinders.map((row) =>
      legacyCylinder(
        row,
        draft.cylinders.find((prior) => prior.id === row.id),
      ),
    ),
    allocationV1: {
      ...allocation,
      savedAt: new Date().toISOString(),
      engineVersion: REC_GAS_VERSION,
      assessment,
    },
  };
}
