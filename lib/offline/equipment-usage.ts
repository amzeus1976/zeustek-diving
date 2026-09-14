import type { DiveRecord } from './dives';
import type { EquipmentRecord, Stored } from './dive-planning';

export function equipmentUsedOnDive(
  dive: DiveRecord,
  equipment: Stored<EquipmentRecord>,
) {
  if (Array.isArray(dive.equipmentIds))
    return dive.equipmentIds.includes(equipment.entityId);
  if (dive.hireGear) return false;
  return !equipment.purchasedAt || equipment.purchasedAt <= dive.date;
}

// Explicit selections are used for recent dates; legacy estimated use counts remain intact.
// The recent-date count is validated against the compact card at responsive widths.
export function equipmentRecentDates(equipment: Stored<EquipmentRecord>, dives: Array<DiveRecord & { entityId: string }>, count = 5) {
  return [...new Set(dives.filter(dive => dive.equipmentIds?.includes(equipment.entityId)).map(dive => dive.date))].sort().reverse().slice(0, count);
}

export function equipmentDiveCount(
  equipment: Stored<EquipmentRecord>,
  dives: Array<DiveRecord & { entityId: string }>,
  throughDate?: string,
) {
  return dives.filter(
    (dive) =>
      (!throughDate || dive.date <= throughDate) &&
      equipmentUsedOnDive(dive, equipment),
  ).length;
}

export function equipmentServiceStatus(
  equipment: Stored<EquipmentRecord>,
  dives: Array<DiveRecord & { entityId: string }>,
) {
  if (equipment.serviceRequired === false) {
    return {
      uses: equipmentDiveCount(equipment, dives),
      dateDue: '',
      serviceBaseline: '',
      baselineKind: null,
      dueAt: null,
      remaining: null,
      state: 'current',
    } as const;
  }
  const today = new Date().toISOString().slice(0, 10);
  const serviceBaseline = equipment.lastServiceAt || equipment.purchasedAt || '';
  const calculatedDateDue = serviceBaseline && equipment.serviceIntervalMonths
    ? addMonths(serviceBaseline, equipment.serviceIntervalMonths)
    : '';
  const dateDue = equipment.nextServiceAt || calculatedDateDue;
  const uses = equipmentDiveCount(equipment, dives);
  const usesAtBaseline = equipment.lastServiceAt
    ? (equipment.divesAtLastService ?? equipmentDiveCount(equipment, dives, serviceBaseline))
    : serviceBaseline
      ? equipmentDiveCount(equipment, dives, serviceBaseline)
      : 0;
  const dueAt = equipment.serviceIntervalDives
    ? usesAtBaseline + equipment.serviceIntervalDives
    : null;
  const useDue = dueAt != null && uses >= dueAt;
  const calendarOverdue = Boolean(dateDue && dateDue < today);
  const calendarSoon = Boolean(
    dateDue &&
    dateDue >= today &&
    new Date(`${dateDue}T12:00:00`).getTime() - Date.now() <=
      30 * 24 * 60 * 60 * 1000,
  );
  return {
    uses,
    dateDue,
    serviceBaseline,
    baselineKind: equipment.lastServiceAt ? 'service' : serviceBaseline ? 'purchase' : null,
    dueAt,
    remaining: dueAt == null ? null : Math.max(0, dueAt - uses),
    state:
      useDue || calendarOverdue ? 'overdue' : calendarSoon ? 'due' : 'current',
  } as const;
}

/**
 * Overview projection only: scheduled-service kit with a meaningful due date.
 * Never infer serviceability from category and never persist this ordering.
 */
export function overviewServiceItems(
  equipment: Array<Stored<EquipmentRecord>>,
  dives: Array<DiveRecord & { entityId: string }>,
  limit = 8,
) {
  const priority = { overdue: 0, due: 1, current: 2 } as const;
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
  };
  return equipment
    .filter((item) => !item.retired && item.serviceRequired === true)
    .filter(item => item.nextServiceAt ? validDate(item.nextServiceAt)
      : validDate(item.lastServiceAt || item.purchasedAt || '') && Number.isFinite(item.serviceIntervalMonths)
        && Number(item.serviceIntervalMonths) > 0)
    .map((item) => ({ item, service: equipmentServiceStatus(item, dives) }))
    .filter(({ service }) => Boolean(service.dateDue))
    .sort((left, right) =>
      priority[left.service.state] - priority[right.service.state]
      || left.service.dateDue.localeCompare(right.service.dateDue)
      || left.item.name.localeCompare(right.item.name),
    )
    .slice(0, Math.max(0, limit))
    .map(({ item }) => item);
}

export function nextServiceDateFromBaseline(
  equipment: Pick<EquipmentRecord, 'serviceIntervalMonths'>,
  baseline: string,
) {
  return baseline && equipment.serviceIntervalMonths
    ? addMonths(baseline, equipment.serviceIntervalMonths)
    : '';
}

function addMonths(value: string, months: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setMonth(date.getMonth() + months);
  return date.toISOString().slice(0, 10);
}
