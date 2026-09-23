import {
  saveEnrichedDivePlan,
  type PlanReadiness,
  type StoredEnrichedDivePlan,
} from '../offline/dive-planning-centre';
import type { StoredGasPlanRecord } from '../offline/planning-pages';
import type { AllocatedGasPlan, allocationReadiness } from './integration';
import type { AllocationStatus } from './model';
export function applyAllocationReadiness(
  base: PlanReadiness,
  allocations: Array<{ name: string; status: AllocationStatus }>,
): PlanReadiness {
  if (!allocations.length) return base;
  const completed =
      base.completed +
      allocations.filter((row) => row.status === 'PASS').length,
    total = base.total + allocations.length,
    percent = Math.round((completed / total) * 100);
  return {
    ...base,
    completed,
    total,
    percent,
    state:
      completed === total
        ? 'ready'
        : percent >= 60
          ? 'needs-attention'
          : 'draft',
    warnings: [
      ...base.warnings,
      ...allocations
        .filter((row) => row.status !== 'PASS')
        .map(
          (row) =>
            `${row.name}: linked gas allocation is ${row.status}. Resolve its individual supply and physiological assessment before marking the Dive Plan ready.`,
        ),
    ],
  };
}
export function allocationPlanReference(
  gas: AllocatedGasPlan & { entityId: string },
  result: ReturnType<typeof allocationReadiness>,
  linkedAt = new Date().toISOString(),
) {
  return {
    gasPlanId: gas.entityId,
    name: gas.name,
    notes: gas.notes,
    linkedAt,
    warnings: [
      ...result.physiologicalReasons,
      ...result.allocation.reasons,
      ...result.allocation.cylinders.flatMap((row) => row.reasons),
    ],
    allocationSummary: {
      version: gas.allocationV1?.version,
      status: result.status,
      physiologicalStatus: result.physiologicalStatus,
      cylinders: result.allocation.cylinders.map((row) => ({
        id: row.id,
        status: row.status,
        availableLitres: row.availableLitres,
        requiredLitres: row.requiredLitres,
        reserveLitres: row.reserveLitres,
      })),
    },
  };
}
export async function saveAllocationNotesToDivePlan(
  plan: StoredEnrichedDivePlan,
  gas: StoredGasPlanRecord,
  result: ReturnType<typeof allocationReadiness>,
) {
  return saveEnrichedDivePlan({
    ...plan,
    entityId: plan.entityId,
    gasPlanLinks: [
      ...(plan.gasPlanLinks ?? []).filter(
        (row) => row.gasPlanId !== gas.entityId,
      ),
      allocationPlanReference(gas, result),
    ],
  });
}
