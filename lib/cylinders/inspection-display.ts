import {deriveCylinderInspectionSchedule, type CylinderEquipmentRecord} from '../offline/loadouts-gas';

function month(value?: string | null) {
  const match = value?.match(/^(\d{4})-(0[1-9]|1[0-2])(?:$|-)/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function plusThirtyMonths(value: string) {
  const year = Number(value.slice(0, 4));
  const number = Number(value.slice(5, 7));
  const date = new Date(Date.UTC(year, number - 1 + 30, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Display-only next-test schedule. It never certifies or saves missing hydro evidence. */
export function deriveCylinderInspectionDisplay(cylinder: Partial<CylinderEquipmentRecord>) {
  const verified = deriveCylinderInspectionSchedule(cylinder);
  const latestVisual = [
    month(cylinder.visualTestAt),
    month(cylinder.visualInspection?.inspectedAt),
    cylinder.lastTestType === 'visual' ? month(cylinder.lastTestAt) : null,
  ].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const afterVisual = latestVisual && (!verified.latestHydro || latestVisual > verified.latestHydro)
    ? plusThirtyMonths(latestVisual)
    : null;
  const nextHydroAt = [verified.hydroDueAt, afterVisual]
    .filter((value): value is string => Boolean(value)).sort()[0] ?? null;
  return {
    ...verified,
    nextHydroAt,
    hydroEvidenceKnown: Boolean(verified.latestHydro),
    nextTestType: nextHydroAt && (!verified.visualDueAt || nextHydroAt <= verified.visualDueAt)
      ? 'hydro' as const
      : verified.visualDueAt ? 'visual' as const : null,
  };
}
