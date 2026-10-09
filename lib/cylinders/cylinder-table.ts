import { deriveCylinderInspectionDisplay } from './inspection-display';
import type { CylinderColumn } from './cylinder-column-preferences';
import { deriveCylinderCurrentState, type CylinderEquipmentRecord, type CylinderFillRecord, type GasAnalysisRecord } from '../offline/loadouts-gas';
import type { Stored } from '../offline/dive-planning';

export type CylinderSort = { column: CylinderColumn; direction: 'ascending' | 'descending' };
export type CylinderTableRow = ReturnType<typeof buildCylinderTableRows>[number];

/** Reuse the displayed fill, analysis and inspection evidence for ordering. */
export function buildCylinderTableRows(
  cylinders: Array<Stored<CylinderEquipmentRecord>>,
  fills: Array<Stored<CylinderFillRecord>>,
  analyses: Array<Stored<GasAnalysisRecord>>,
) {
  return cylinders.map(item => {
    const state = deriveCylinderCurrentState(item, fills.filter(fill => fill.cylinderEquipmentId === item.entityId), analyses.filter(analysis => analysis.cylinderEquipmentId === item.entityId));
    const schedule = deriveCylinderInspectionDisplay(item);
    const cleanUntil = item.oxygenCleanUntil?.match(/^\d{4}-\d{2}/)?.[0];
    const nextTest = [schedule.nextHydroAt, schedule.visualDueAt, cleanUntil].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)))[0] ?? null;
    return { item, state, nextTest };
  });
}

export function nextCylinderSort(current: CylinderSort, column: CylinderColumn): CylinderSort {
  return { column, direction: current.column === column && current.direction === 'ascending' ? 'descending' : 'ascending' };
}

export function visibleCylinderSort(current: CylinderSort, columns: readonly CylinderColumn[]): CylinderSort {
  return columns.includes(current.column) ? current : { column: columns[0] ?? 'id', direction: 'ascending' };
}

function text(value: string | null | undefined) { return value?.trim() || null; }
function number(value: number | null | undefined) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function percentage(value: number | null | undefined) { const fraction = number(value); return fraction == null ? null : Math.round(fraction * 100); }

function valueForColumn({ item, state, nextTest }: CylinderTableRow, column: CylinderColumn): string | number | null {
  const fill = state.latestFill;
  const analysis = state.currentAnalysis ?? state.latestAnyAnalysis;
  switch (column) {
    case 'id': return typeof item.cylinderNumber === 'string' ? text(item.cylinderNumber) : null;
    case 'serial': return text(item.serialNumber);
    case 'gas': return fill ? state.declaredMixLabel : null;
    case 'oxygen': return percentage(analysis?.oxygenFraction);
    case 'helium': return percentage(analysis?.heliumFraction);
    case 'pressure': return number(fill?.pressureBar);
    case 'volume': return number(item.waterVolumeLiters);
    case 'oxygenClean': return item.oxygenClean ? 'Yes' : 'No';
    case 'analysis': return state.analysisState;
    case 'lastFill': return fill?.filledAt ? number(Date.parse(fill.filledAt)) : null;
    case 'fillLocation': return text(fill?.provider);
    case 'valve': return text(item.valveType);
    case 'nextTest': return nextTest;
  }
}

const naturalOrder = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' });

/** Sort a copy, keep equal values stable and missing values last in both directions. */
export function sortCylinderTableRows(rows: readonly CylinderTableRow[], sort: CylinderSort): CylinderTableRow[] {
  return [...rows].sort((left, right) => {
    const a = valueForColumn(left, sort.column);
    const b = valueForColumn(right, sort.column);
    if (a == null) return b == null ? 0 : 1;
    if (b == null) return -1;
    const order = typeof a === 'number' && typeof b === 'number' ? a - b : naturalOrder.compare(String(a), String(b));
    return sort.direction === 'ascending' ? order : -order;
  });
}
