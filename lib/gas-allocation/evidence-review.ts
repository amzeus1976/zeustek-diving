import type { Stored } from '../offline/dive-planning';
import {
  deriveCylinderInspectionSchedule,
  type CylinderEquipmentRecord,
  type CylinderFillRecord,
  type GasAnalysisRecord,
} from '../offline/loadouts-gas';
import {
  projectGasCylinder,
  type GasPlanRecord,
} from '../offline/planning-pages';
import type { AllocationMetadata } from './integration';
/** Read-only comparison. Never refreshes snapshot identity or canonical records. */
export function reviewAllocationEvidence(
  allocation: AllocationMetadata,
  draft: GasPlanRecord,
  equipment: Stored<CylinderEquipmentRecord>[],
  fills: Stored<CylinderFillRecord>[],
  analyses: Stored<GasAnalysisRecord>[],
  asOf = new Date().toISOString(),
): AllocationMetadata {
  return {
    ...allocation,
    cylinders: allocation.cylinders.map((row) => {
      if (row.mode !== 'own-full' && row.mode !== 'own-empty') return row;
      const cylinder = equipment.find(
          (item) => item.entityId === row.canonicalId,
        ),
        problems: string[] = [];
      if (!cylinder)
        return {
          ...row,
          blockedReasons: [
            'Canonical cylinder is missing. Review this supply; the original snapshot is retained.',
          ],
        };
      const projected = projectGasCylinder(
        {
          id: row.id,
          sourceMode: 'owned',
          cylinderEquipmentId: cylinder.entityId,
          role: 'primary',
        },
        draft,
        fills,
        analyses,
        equipment,
      );
      if (
        cylinder.waterVolumeLiters !== row.waterVolumeL ||
        cylinder.workingPressureBar !== row.ratedPressureBar ||
        projected.startPressureEvidence.pressureBar !==
          row.currentPressureBar ||
        projected.fillId !== row.fillId
      )
        problems.push(
          'Canonical capacity, pressure or fill evidence has changed. Refresh this snapshot explicitly and review every assignment.',
        );
      if (
        row.mode === 'own-full' &&
        (projected.analysisState !== 'current' ||
          projected.analysisId !== row.analysisId ||
          projected.mix?.oxygenFraction !== row.gas.oxygen ||
          projected.mix?.heliumFraction !== row.gas.helium)
      )
        problems.push(
          'Current analysis has changed or is no longer valid for this fill. Refresh and verify the actual gas.',
        );
      if (
        cylinder.retired ||
        cylinder.cylinderStatus === 'retired' ||
        cylinder.cylinderStatus === 'service'
      )
        problems.push(
          'Canonical cylinder is retired or requires service. Select a serviceable supply.',
        );
      const schedule = deriveCylinderInspectionSchedule(cylinder),
        month = asOf.slice(0, 7),
        hydro = cylinder.hydroDueAt || schedule.hydroDueAt,
        visual = cylinder.visualDueAt || schedule.visualDueAt;
      if (row.conditionConfirmed && (!hydro || !visual))
        problems.push(
          'Previously confirmed inspection evidence is now missing. Verify and explicitly refresh this cylinder snapshot.',
        );
      if (
        (hydro && hydro.slice(0, 7) < month) ||
        (visual && visual.slice(0, 7) < month)
      )
        problems.push(
          'A recorded cylinder inspection is overdue for the planned use date. Resolve the inspection before use.',
        );
      return { ...row, blockedReasons: problems };
    }),
  };
}
