import type { JsonValue } from '../offline/types';
import type { RecreationalGasInput } from '../offline/recreational-gas-planner';
import { DEFAULT_PLAN_CHECKLIST } from '../offline/dive-planning-centre';
import { normalisePlanTextFormats } from '../planning/formatted-text';
import type { PhoneDraftKind } from './phone-drafts';

export function basicGasInput(): RecreationalGasInput {
  return {
    mode: 'direct-ascent',
    selectedBuhlmannModel: 'ZH-L16C',
    compareOtherModel: false,
    gfLow: 40,
    gfHigh: 85,
    waterType: 'salt',
    surfacePressureBar: 1,
    plannedDepthM: 0,
    conservatismM: 3,
    maxPpo2: 1.4,
    selectedGasLabel: 'Air / EAN21',
    cylinderWaterVolumeL: null,
    startPressureBar: null,
    cylinderSourceMode: 'manual',
    cylinderSourceLabel: 'Owner-entered cylinder',
    pressureSource: 'Owner-entered planning pressure',
    ownRmvLMin: null,
    buddyRmvLMin: null,
    ownRmvSource: 'unknown',
    buddyRmvSource: 'unknown',
    reserveStrategy: 'most-conservative',
    ascentRateMMin: 9,
    ownerMaxDurationMin: null,
    plannedWorkingTimeMin: null,
    routeSegments: [],
    repetitiveDive: false,
  };
}
export function phoneGasInput(
  record: Record<string, JsonValue>,
): RecreationalGasInput {
  const saved = record.phoneGasInput || record.recGasPlan101;
  if (saved && typeof saved === 'object' && !Array.isArray(saved))
    return { ...basicGasInput(), ...saved } as unknown as RecreationalGasInput;
  const number = (key: string) =>
    typeof record[key] === 'number' ? (record[key] as number) : null;
  return {
    ...basicGasInput(),
    plannedDepthM: number('plannedDepthM') ?? 0,
    plannedWorkingTimeMin: number('plannedBottomTimeMin'),
    ownRmvLMin: number('rmvRateLitresMin'),
    ownRmvSource:
      number('rmvRateLitresMin') != null ? 'plan-snapshot' : 'unknown',
  };
}
/** Existing roles, leader flags and notes belong to the member, not the checkbox. */
export function updatePhoneTeam(
  record: Record<string, JsonValue>,
  ids: string[],
  selfIds: string[],
) {
  const previous = Array.isArray(record.planTeam)
    ? (record.planTeam as Array<Record<string, JsonValue>>)
    : [];
  return [...new Set(ids)].map(
    (id) =>
      previous.find((member) => member.personId === id) || {
        personId: id,
        role: selfIds.includes(id) ? 'self' : 'buddy',
      },
  );
}
/** Keep a single-day plan's date and time together without moving a multi-day end date. */
export function updatePhoneSchedule(
  record: Record<string, JsonValue>,
  field: 'startDate' | 'startAt',
  value: string,
): Record<string, JsonValue> {
  const previousDay =
    typeof record.startDate === 'string'
      ? record.startDate
      : typeof record.startAt === 'string'
        ? record.startAt.slice(0, 10)
        : '';
  const patch: Record<string, JsonValue> = { [field]: value };
  const nextDay = field === 'startDate' ? value : value.slice(0, 10);
  if (
    field === 'startDate' &&
    typeof record.startAt === 'string' &&
    record.startAt
  )
    patch.startAt = value ? `${value}${record.startAt.slice(10)}` : '';
  if (field === 'startAt' && value) patch.startDate = nextDay;
  if (record.endDate === previousDay) patch.endDate = nextDay;
  return patch;
}
export function basicPlanEditable(record: Record<string, unknown>) {
  return (
    !record.technicalMode &&
    !(Array.isArray(record.decoSchedule) && record.decoSchedule.length)
  );
}
export function basicGasEditable(record: Record<string, unknown>) {
  const snapshot = record.recGasPlan101 as
    | Partial<RecreationalGasInput>
    | undefined;
  return (
    (!snapshot || snapshot.mode === 'direct-ascent') &&
    !record.multiLevel &&
    !(Array.isArray(record.manualStops) && record.manualStops.length) &&
    !(Array.isArray(record.depthSegments) && record.depthSegments.length) &&
    !(
      Array.isArray(record.cylinders) &&
      (record.cylinders.length > 1 ||
        (record.cylinders.length > 0 && !snapshot))
    ) &&
    record.planningMethod !== 'buhlmann-zhl16c' &&
    !('allocationV1' in record)
  );
}
/** The basic editor starts from the full canonical record, preserving fields it does not expose. */
export function preparePhoneRecord(
  kind: PhoneDraftKind,
  record: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const result = { ...record };
  const name = kind === 'dive' ? result.site : result.name;
  if (typeof name !== 'string' || !name.trim())
    throw new Error(
      kind === 'dive' ? 'Choose a Site or enter its name.' : 'Enter a name.',
    );
  if (kind === 'dive') {
    if (
      typeof result.date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(result.date)
    )
      throw new Error('Choose the actual dive date.');
    for (const field of ['maxDepthM', 'bottomTimeMin', 'totalElapsedMin'])
      if (
        result[field] != null &&
        (typeof result[field] !== 'number' ||
          !Number.isFinite(result[field]) ||
          result[field] < 0)
      )
        throw new Error('Enter valid depth and duration values.');
    result.site = name.trim();
  } else result.name = name.trim();
  if (kind === 'trip') {
    if (!basicPlanEditable(result))
      throw new Error(
        'Open this technical plan in the full interface to edit it.',
      );
    if (!result.startDate && !result.startAt)
      throw new Error('Choose a planned date.');
    for (const field of ['plannedMaxDepthM', 'plannedDurationMin'])
      if (
        result[field] != null &&
        (typeof result[field] !== 'number' ||
          !Number.isFinite(result[field]) ||
          result[field] < 0)
      )
        throw new Error('Enter a valid planned depth and duration.');
    result.primaryObjective = 'Return safely to the surface';
    result.lifecycleStatus = 'draft';
    result.status = 'planned';
    if (!Array.isArray(result.checklist) || !result.checklist.length)
      result.checklist = DEFAULT_PLAN_CHECKLIST.map((item) => ({ ...item }));
    const formats = normalisePlanTextFormats(result.textFormatting);
    if (formats) result.textFormatting = formats as unknown as JsonValue;
    else delete result.textFormatting;
  }
  if (kind === 'gas-plan') {
    if (!basicGasEditable(result))
      throw new Error('Use the full interface for advanced gas planning.');
    if (result.phoneGasInput && !result.recGasPlan101)
      throw new Error(
        'Calculate the Gas Plan before saving. Your inputs remain in the device draft.',
      );
    result.status = 'draft';
    delete result.phoneGasInput;
  }
  return result;
}
