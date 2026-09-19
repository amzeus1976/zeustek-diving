import {
  listRecords,
  removeRecord,
  saveRecord,
  type DiveTripRecord,
  type EquipmentRecord,
  type EquipmentSetRecord,
  type PersonRecord,
  type Stored,
} from './dive-planning';
import type { DiveRecord } from './dives';

export type LoadoutSlotValue = string | string[] | null;
export type LoadoutSlots = Record<string, LoadoutSlotValue>;

export interface ReusableLoadoutRecord extends EquipmentSetRecord {
  description?: string | null;
  intendedUse?: string | null;
  environmentTags?: string[];
  slots?: LoadoutSlots;
  cameraVideoItemIds?: string[];
  otherItemIds?: string[];
}

export interface LoadoutSlotDefinition {
  key: string;
  label: string;
  group: string;
  multiple?: boolean;
  categoryHints: string[];
}

export const LOADOUT_SLOT_DEFINITIONS: LoadoutSlotDefinition[] = [
  { key: 'exposure.suit', label: 'Exposure suit', group: 'Exposure', categoryHints: ['drysuit', 'wetsuit', 'exposure'] },
  { key: 'exposure.undersuit', label: 'Undersuit', group: 'Exposure', categoryHints: ['undersuit', 'undergarment', 'thermal'] },
  { key: 'exposure.boots', label: 'Boots', group: 'Exposure', categoryHints: ['boot'] },
  { key: 'exposure.gloves', label: 'Gloves', group: 'Exposure', categoryHints: ['glove'] },
  { key: 'exposure.hood', label: 'Hood', group: 'Exposure', categoryHints: ['hood'] },
  { key: 'personal.fins', label: 'Fins', group: 'Personal kit', categoryHints: ['fin'] },
  { key: 'personal.mask', label: 'Mask', group: 'Personal kit', categoryHints: ['mask'] },
  { key: 'personal.backup_mask', label: 'Backup mask', group: 'Personal kit', categoryHints: ['mask'] },
  { key: 'personal.buoyancy', label: 'BCD / wing / harness', group: 'Personal kit', categoryHints: ['bcd', 'wing', 'harness', 'backplate'] },
  { key: 'instruments.computer_primary', label: 'Primary computer', group: 'Instruments', categoryHints: ['computer'] },
  { key: 'instruments.computer_backup', label: 'Backup computer', group: 'Instruments', categoryHints: ['computer'] },
  { key: 'instruments.compass', label: 'Compass', group: 'Instruments', categoryHints: ['compass'] },
  { key: 'regs.primary.first_stage_1', label: 'Primary first stage', group: 'Primary regulators', categoryHints: ['first stage'] },
  { key: 'regs.primary.second_stage_1', label: 'Primary second stage', group: 'Primary regulators', categoryHints: ['second stage'] },
  { key: 'regs.primary.second_stage_2', label: 'Primary alternate / octopus', group: 'Primary regulators', categoryHints: ['second stage'] },
  { key: 'regs.primary.pressure_gauge', label: 'Primary SPG / pressure gauge', group: 'Primary regulators', categoryHints: ['gauge', 'spg'] },
  { key: 'regs.primary.hoses', label: 'Primary hoses', group: 'Primary regulators', multiple: true, categoryHints: ['hose'] },
  { key: 'regs.secondary.first_stage_1', label: 'Secondary first stage', group: 'Secondary regulators', categoryHints: ['first stage'] },
  { key: 'regs.secondary.second_stage_1', label: 'Secondary second stage 1', group: 'Secondary regulators', categoryHints: ['second stage'] },
  { key: 'regs.secondary.second_stage_2', label: 'Secondary second stage 2', group: 'Secondary regulators', categoryHints: ['second stage'] },
  { key: 'regs.secondary.pressure_gauge', label: 'Secondary SPG / pressure gauge', group: 'Secondary regulators', categoryHints: ['gauge', 'spg'] },
  { key: 'regs.secondary.hoses', label: 'Secondary hoses', group: 'Secondary regulators', multiple: true, categoryHints: ['hose'] },
  { key: 'lights.primary', label: 'Primary light', group: 'Lights', categoryHints: ['light', 'torch'] },
  { key: 'lights.backup_1', label: 'Backup light 1', group: 'Lights', categoryHints: ['light', 'torch'] },
  { key: 'lights.backup_2', label: 'Backup light 2', group: 'Lights', categoryHints: ['light', 'torch'] },
  { key: 'lights.strobe', label: 'Strobe', group: 'Lights', categoryHints: ['strobe'] },
  { key: 'lights.marker', label: 'Marker light', group: 'Lights', categoryHints: ['marker', 'light'] },
  { key: 'camera_video', label: 'Camera / video', group: 'Camera / video', multiple: true, categoryHints: ['camera', 'housing', 'video'] },
  { key: 'cylinders.backgas', label: 'Backgas cylinder(s)', group: 'Cylinders', multiple: true, categoryHints: ['cylinder', 'tank'] },
  { key: 'cylinders.stage', label: 'Stage / deco cylinder(s)', group: 'Cylinders', multiple: true, categoryHints: ['cylinder', 'tank'] },
  { key: 'other', label: 'Everything else', group: 'Other', multiple: true, categoryHints: [] },
];

export interface CylinderEquipmentRecord extends EquipmentRecord {
  recordStorageKind?: 'cylinder' | 'equipment';
  threadType?: string | null;
  countryCode?: string | null;
  waterVolumeLiters?: number | null;
  workingPressureBar?: number | null;
  testPressureBar?: number | null;
  cylinderMaterial?: string | null;
  emptyWeightKg?: number | null;
  wallThicknessMm?: number | null;
  birthDate?: string | null;
  valveType?: string | null;
  oxygenClean?: boolean | null;
  oxygenCleanUntil?: string | null;
  hydroTestAt?: string | null;
  hydroDueAt?: string | null;
  visualTestAt?: string | null;
  visualDueAt?: string | null;
  tareKg?: number | null;
  owner?: string | null;
  cylinderStatus?: 'active' | 'service' | 'retired' | 'unknown';
  hydroTestStamps?: Array<{ facility: string; testedAt: string; stampMark: string; notes?: string }>;
  visualInspection?: { inspectedAt?: string | null; dueAt?: string | null; stickerColour?: string | null; notes?: string | null };
}

export interface CylinderFillRecord {
  cylinderEquipmentId: string;
  filledAt: string;
  pressureBar: number | null;
  oxygenFraction: number | null;
  heliumFraction: number | null;
  provider: string | null;
  notes: string | null;
  source: 'recorded' | 'imported';
  createdAt: string;
  modifiedAt: string;
}

export interface GasAnalysisRecord {
  cylinderEquipmentId: string;
  fillId: string | null;
  analysedAt: string;
  oxygenFraction: number | null;
  heliumFraction: number | null;
  analysedByPersonId: string | null;
  attachmentIds: string[];
  notes: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface LoadoutApplication {
  id: string;
  equipmentSetId: string;
  appliedAt: string;
  slots: LoadoutSlots;
  overrideSlots: LoadoutSlots;
}

export interface LoadoutTargetExtension {
  equipmentSetId?: string;
  equipmentSetIds?: string[];
  equipmentIds?: string[];
  equipmentSetApplications?: LoadoutApplication[];
}

export type LoadoutTargetKind = 'dive' | 'trip';

export const listReusableLoadouts = () => listRecords<ReusableLoadoutRecord>('equipment-set');
export const listCylinders = () => listRecords<CylinderEquipmentRecord>('cylinder');
export async function listCylinderInventory() {
  const [cylinders, equipment] = await Promise.all([listCylinders(), listRecords<EquipmentRecord>('equipment')]);
  const canonical = cylinders.map((item) => ({ ...item, recordStorageKind: 'cylinder' as const }));
  const ids = new Set(canonical.map((item) => item.entityId));
  const legacy = equipment.filter(isCylinderEquipment).filter((item) => !ids.has(item.entityId)).map((item) => ({ ...item, recordStorageKind: 'equipment' as const } as Stored<CylinderEquipmentRecord>));
  return [...canonical, ...legacy];
}
export const listCylinderFills = () => listRecords<CylinderFillRecord>('cylinder-fill');
export const listGasAnalyses = () => listRecords<GasAnalysisRecord>('gas-analysis');
export const deleteCylinderFill = removeRecord;
export const deleteGasAnalysis = removeRecord;
export const deleteCylinder = removeRecord;

const text = (value: unknown) =>
  typeof value === 'string' ? value.normalize('NFKC').trim().toLocaleLowerCase('en-GB') : '';

export function isCylinderEquipment(item: Pick<EquipmentRecord, 'category' | 'name'>) {
  const haystack = `${text(item.category)} ${text(item.name)}`;
  return /\b(cylinder|tank)\b/.test(haystack);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function flattenSlotEquipmentIds(slots: LoadoutSlots | undefined) {
  if (!slots) return [];
  return unique(
    Object.values(slots).flatMap((value) =>
      Array.isArray(value) ? value : typeof value === 'string' && value ? [value] : [],
    ),
  );
}

export function normaliseReusableLoadout(record: Stored<ReusableLoadoutRecord>): Stored<ReusableLoadoutRecord> {
  const slots: LoadoutSlots = record.slots && typeof record.slots === 'object' ? { ...record.slots } : {};
  const assigned = new Set(flattenSlotEquipmentIds(slots));
  const cameraVideoItemIds = unique(record.cameraVideoItemIds ?? []);
  const explicitOther = unique(record.otherItemIds ?? []);
  const legacyUnassigned = (record.equipmentIds ?? []).filter(
    (id) => !assigned.has(id) && !cameraVideoItemIds.includes(id) && !explicitOther.includes(id),
  );
  if (!Object.hasOwn(slots, 'camera_video')) slots.camera_video = cameraVideoItemIds;
  if (!Object.hasOwn(slots, 'other')) slots.other = unique([...explicitOther, ...legacyUnassigned]);
  return {
    ...record,
    slots,
    environmentTags: unique(record.environmentTags ?? []),
    cameraVideoItemIds: flattenSlotEquipmentIds({ camera_video: slots.camera_video ?? [] }),
    otherItemIds: flattenSlotEquipmentIds({ other: slots.other ?? [] }),
  };
}

export interface ReusableLoadoutInput {
  entityId?: string;
  name: string;
  description?: string | null;
  intendedUse?: string | null;
  environmentTags?: string[];
  slots: LoadoutSlots;
  cameraVideoItemIds?: string[];
  otherItemIds?: string[];
  notes?: string;
  iconMediaId?: string;
}

export async function saveReusableLoadout(input: ReusableLoadoutInput) {
  if (!input.name.trim()) throw new Error('Enter a loadout name.');
  const cameraIds = Object.hasOwn(input.slots, 'camera_video') ? flattenSlotEquipmentIds({ camera_video: input.slots.camera_video ?? [] }) : input.cameraVideoItemIds ?? [];
  const otherIds = Object.hasOwn(input.slots, 'other') ? flattenSlotEquipmentIds({ other: input.slots.other ?? [] }) : input.otherItemIds ?? [];
  const equipmentIds = unique([
    ...flattenSlotEquipmentIds(input.slots),
    ...cameraIds,
    ...otherIds,
  ]);
  return saveRecord('equipment-set', {
    ...input,
    name: input.name.trim(),
    description: input.description?.trim() || '',
    intendedUse: input.intendedUse?.trim() || '',
    environmentTags: unique((input.environmentTags ?? []).map((value) => value.trim())),
    cameraVideoItemIds: unique(cameraIds),
    otherItemIds: unique(otherIds),
    equipmentIds,
    notes: input.notes?.trim() || '',
  });
}

export async function cloneReusableLoadout(loadout: Stored<ReusableLoadoutRecord>, name?: string) {
  const normalised = normaliseReusableLoadout(loadout);
  return saveReusableLoadout({
    name: name?.trim() || `${normalised.name} copy`,
    description: normalised.description ?? '',
    intendedUse: normalised.intendedUse ?? '',
    environmentTags: normalised.environmentTags ?? [],
    slots: normalised.slots ?? {},
    cameraVideoItemIds: normalised.cameraVideoItemIds ?? [],
    otherItemIds: normalised.otherItemIds ?? [],
    notes: normalised.notes ?? '',
    ...(normalised.iconMediaId ? { iconMediaId: normalised.iconMediaId } : {}),
  });
}

export interface LoadoutValidationResult {
  missingEquipmentIds: string[];
  retiredEquipmentIds: string[];
  warnings: string[];
  referencedItemCount: number;
}

export function validateReusableLoadout(
  loadout: Pick<ReusableLoadoutRecord, 'slots' | 'cameraVideoItemIds' | 'otherItemIds' | 'equipmentIds'>,
  equipment: Array<Stored<EquipmentRecord>>,
): LoadoutValidationResult {
  const ids = unique([
    ...flattenSlotEquipmentIds(loadout.slots),
    ...(loadout.cameraVideoItemIds ?? []),
    ...(loadout.otherItemIds ?? []),
    ...(loadout.slots ? [] : loadout.equipmentIds ?? []),
  ]);
  const byId = new Map(equipment.map((item) => [item.entityId, item]));
  const missingEquipmentIds = ids.filter((id) => !byId.has(id));
  const retiredEquipmentIds = ids.filter((id) => byId.get(id)?.retired);
  const invalidSlots = LOADOUT_SLOT_DEFINITIONS.filter(definition => definition.categoryHints.length > 0 && flattenSlotEquipmentIds({ slot: loadout.slots?.[definition.key] ?? [] }).some(id => {
    const item = byId.get(id);
    if (!item) return false;
    const haystack = `${text(item.category)} ${text(item.name)} ${text(item.manufacturer)} ${text(item.model)}`;
    return !definition.categoryHints.some(hint => haystack.includes(hint));
  }));
  const warnings = [
    ...(ids.length === 0 ? ['No equipment has been assigned yet.'] : []),
    ...(missingEquipmentIds.length ? [`${missingEquipmentIds.length} referenced item(s) are unavailable on this device.`] : []),
    ...(retiredEquipmentIds.length ? [`${retiredEquipmentIds.length} referenced item(s) are retired; historical selection is preserved.`] : []),
    ...invalidSlots.map(definition => `${definition.label}: selected equipment does not match this slot; review without changing the saved reference.`),
  ];
  return { missingEquipmentIds, retiredEquipmentIds, warnings, referencedItemCount: ids.length };
}

function fraction(value: number | null | undefined, label: string) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1.`);
  return value;
}

function validateMix(oxygen: number | null | undefined, helium: number | null | undefined) {
  const o2 = fraction(oxygen, 'Oxygen fraction');
  const he = fraction(helium, 'Helium fraction');
  if ((o2 ?? 0) + (he ?? 0) > 1.000001) throw new Error('Oxygen and helium fractions cannot exceed 1 in total.');
  return { oxygenFraction: o2, heliumFraction: he };
}

export async function saveCylinderFill(input: Omit<CylinderFillRecord, 'createdAt' | 'modifiedAt'> & { entityId?: string }) {
  if (!input.cylinderEquipmentId) throw new Error('Choose a cylinder.');
  if (!input.filledAt || !Number.isFinite(Date.parse(input.filledAt))) throw new Error('Record a valid fill date and time.');
  if (input.pressureBar != null && (!Number.isFinite(input.pressureBar) || input.pressureBar < 0 || input.pressureBar > 500)) throw new Error('Fill pressure must be between 0 and 500 bar.');
  const mix = validateMix(input.oxygenFraction, input.heliumFraction);
  return saveRecord('cylinder-fill', {
    ...input,
    ...mix,
    filledAt: new Date(input.filledAt).toISOString(),
    provider: input.provider?.trim() || '',
    notes: input.notes?.trim() || '',
  });
}

export async function saveGasAnalysis(input: Omit<GasAnalysisRecord, 'createdAt' | 'modifiedAt'> & { entityId?: string }) {
  if (!input.cylinderEquipmentId) throw new Error('Choose a cylinder.');
  if (!input.analysedAt || !Number.isFinite(Date.parse(input.analysedAt))) throw new Error('Record a valid analysis date and time.');
  const mix = validateMix(input.oxygenFraction, input.heliumFraction);
  if (mix.oxygenFraction == null && mix.heliumFraction == null) throw new Error('Record at least one analysed gas fraction.');
  if (input.fillId) {
    const fill = (await listCylinderFills()).find((candidate) => candidate.entityId === input.fillId);
    if (!fill) throw new Error('The linked fill is no longer available.');
    if (fill.cylinderEquipmentId !== input.cylinderEquipmentId) throw new Error('The linked fill belongs to a different cylinder.');
    if (Date.parse(input.analysedAt) < Date.parse(fill.filledAt)) throw new Error('Analysis cannot predate its linked fill.');
  }
  return saveRecord('gas-analysis', {
    ...input,
    ...mix,
    analysedAt: new Date(input.analysedAt).toISOString(),
    fillId: input.fillId || null,
    analysedByPersonId: input.analysedByPersonId || null,
    attachmentIds: unique(input.attachmentIds ?? []),
    notes: input.notes?.trim() || '',
  });
}

export async function saveCylinderProfile(
  input: Partial<CylinderEquipmentRecord> & Pick<CylinderEquipmentRecord, 'name'> & { entityId?: string },
) {
  if (!input.name.trim()) throw new Error('Enter a cylinder name.');
  for (const [label, value] of [['Water volume', input.waterVolumeLiters], ['Working pressure', input.workingPressureBar], ['Test pressure', input.testPressureBar], ['Empty weight', input.emptyWeightKg ?? input.tareKg], ['Wall thickness', input.wallThicknessMm]] as const) {
    if (value != null && (!Number.isFinite(Number(value)) || Number(value) <= 0)) throw new Error(`${label} must be a positive number or left blank.`);
  }
  const { recordStorageKind, ...storedInput } = input;
  const storageKind = recordStorageKind === 'equipment' ? 'equipment' : 'cylinder';
  return saveRecord(storageKind, {
    manufacturer: '', model: '', serialNumber: '', purchasedAt: '', lastServiceAt: '', nextServiceAt: '', notes: '', retired: false,
    ...storedInput,
    name: input.name.trim(),
    category: 'Cylinder',
    waterVolumeLiters: input.waterVolumeLiters == null ? null : Number(input.waterVolumeLiters),
    workingPressureBar: input.workingPressureBar == null ? null : Number(input.workingPressureBar),
    testPressureBar: input.testPressureBar == null ? null : Number(input.testPressureBar),
    emptyWeightKg: input.emptyWeightKg == null ? (input.tareKg == null ? null : Number(input.tareKg)) : Number(input.emptyWeightKg),
    tareKg: input.emptyWeightKg == null ? (input.tareKg == null ? null : Number(input.tareKg)) : Number(input.emptyWeightKg),
    wallThicknessMm: input.wallThicknessMm == null ? null : Number(input.wallThicknessMm),
  });
}

function byDateDescending<T>(items: T[], field: keyof T) {
  return [...items].filter(item => Number.isFinite(Date.parse(String(item[field])))).sort((left, right) => Date.parse(String(right[field])) - Date.parse(String(left[field])));
}

export interface CylinderCurrentState {
  latestFill: Stored<CylinderFillRecord> | null;
  currentAnalysis: Stored<GasAnalysisRecord> | null;
  latestAnyAnalysis: Stored<GasAnalysisRecord> | null;
  analysisState: 'current' | 'stale' | 'unknown';
  declaredMixLabel: string;
  analysedMixLabel: string;
  nitrogenFraction: number | null;
  approximateSurfaceLitres: number | null;
}

export function gasMixLabel(oxygenFraction: number | null | undefined, heliumFraction: number | null | undefined) {
  if (oxygenFraction == null && heliumFraction == null) return 'Unknown mix';
  if (oxygenFraction == null || heliumFraction == null) return `O₂ ${oxygenFraction == null ? 'unrecorded' : `${Math.round(oxygenFraction * 100)}%`} · He ${heliumFraction == null ? 'unrecorded' : `${Math.round(heliumFraction * 100)}%`}`;
  const o2 = oxygenFraction ?? 0;
  const he = heliumFraction ?? 0;
  if (he >= 0.005) return `Trimix ${Math.round(o2 * 100)}/${Math.round(he * 100)}`;
  if (o2 >= 0.98) return 'Oxygen';
  if (Math.abs(o2 - 0.21) <= 0.005) return 'Air';
  return `Nitrox ${Math.round(o2 * 100)}`;
}

export function nitrogenFraction(oxygenFraction: number | null | undefined, heliumFraction: number | null | undefined) {
  if (oxygenFraction == null || heliumFraction == null) return null;
  const result = 1 - (oxygenFraction ?? 0) - (heliumFraction ?? 0);
  return result >= 0 && result <= 1 ? result : null;
}

export function approximateSurfaceGasLitres(waterVolumeLiters: number | null | undefined, pressureBar: number | null | undefined) {
  if (waterVolumeLiters == null || pressureBar == null || waterVolumeLiters <= 0 || pressureBar < 0) return null;
  return waterVolumeLiters * pressureBar;
}

export function maximumOperatingDepthM(oxygenFraction: number | null | undefined, ppO2 = 1.4) {
  if (oxygenFraction == null || oxygenFraction <= 0 || ppO2 <= 0) return null;
  const result = (ppO2 / oxygenFraction - 1) * 10;
  return Number.isFinite(result) && result >= 0 ? result : null;
}

export function deriveCylinderCurrentState(
  cylinder: Pick<CylinderEquipmentRecord, 'waterVolumeLiters'>,
  fills: Array<Stored<CylinderFillRecord>>,
  analyses: Array<Stored<GasAnalysisRecord>>,
): CylinderCurrentState {
  const latestFill = byDateDescending(fills, 'filledAt')[0] ?? null;
  const latestAnyAnalysis = byDateDescending(analyses, 'analysedAt')[0] ?? null;
  const currentAnalysis = latestFill
    ? byDateDescending(analyses.filter((analysis) => analysis.fillId === latestFill.entityId && analysis.cylinderEquipmentId === latestFill.cylinderEquipmentId && Date.parse(analysis.analysedAt) >= Date.parse(latestFill.filledAt)), 'analysedAt')[0] ?? null
    : null;
  const analysisState: CylinderCurrentState['analysisState'] = currentAnalysis
    ? 'current'
    : latestAnyAnalysis
      ? 'stale'
      : 'unknown';
  const o2 = currentAnalysis?.oxygenFraction ?? null;
  const he = currentAnalysis?.heliumFraction ?? null;
  return {
    latestFill,
    currentAnalysis,
    latestAnyAnalysis,
    analysisState,
    declaredMixLabel: latestFill ? gasMixLabel(latestFill.oxygenFraction, latestFill.heliumFraction) : 'No fill recorded',
    analysedMixLabel: currentAnalysis ? gasMixLabel(o2, he) : analysisState === 'stale' ? 'Previous analysis is stale' : 'Not analysed',
    nitrogenFraction: currentAnalysis ? nitrogenFraction(o2, he) : null,
    approximateSurfaceLitres: latestFill ? approximateSurfaceGasLitres(cylinder.waterVolumeLiters, latestFill.pressureBar) : null,
  };
}

export function filterEquipmentForSlot(
  definition: LoadoutSlotDefinition,
  equipment: Array<Stored<EquipmentRecord>>,
  selectedIds: string[] = [],
) {
  const selected = new Set(selectedIds);
  return equipment.filter((item) => {
    if (selected.has(item.entityId)) return true;
    if (item.retired) return false;
    if (definition.categoryHints.length === 0) return true;
    const haystack = `${text(item.category)} ${text(item.name)} ${text(item.manufacturer)} ${text(item.model)}`;
    return definition.categoryHints.some((hint) => haystack.includes(hint));
  });
}

function resolveSlots(loadout: ReusableLoadoutRecord, overrides: LoadoutSlots): LoadoutSlots {
  const base = loadout.slots ?? {};
  const result: LoadoutSlots = { ...base };
  for (const [key, override] of Object.entries(overrides)) {
    if (override == null || (Array.isArray(override) && override.length === 0) || override === '') delete result[key];
    else result[key] = override;
  }
  return result;
}

export async function applyReusableLoadout(
  targetKind: LoadoutTargetKind,
  targetId: string,
  loadout: Stored<ReusableLoadoutRecord>,
  overrideSlots: LoadoutSlots = {},
) {
  const kind = targetKind === 'dive' ? 'dive' : 'trip';
  const records = await listRecords<(DiveRecord | DiveTripRecord) & LoadoutTargetExtension>(kind);
  const target = records.find((record) => record.entityId === targetId);
  if (!target) throw new Error(`The target ${targetKind === 'dive' ? 'Dive' : 'Plan'} is no longer available.`);
  const normalised = normaliseReusableLoadout(loadout);
  const slots = resolveSlots(normalised, overrideSlots);
  const appliedEquipmentIds = unique([
    ...flattenSlotEquipmentIds(slots),
  ]);
  const application: LoadoutApplication = {
    id: crypto.randomUUID(),
    equipmentSetId: loadout.entityId,
    appliedAt: new Date().toISOString(),
    slots,
    overrideSlots,
  };
  const equipmentSetIds = unique([...(target.equipmentSetIds ?? []), loadout.entityId]);
  const equipmentIds = unique([...(target.equipmentIds ?? []), ...appliedEquipmentIds]);
  const applications = [...(target.equipmentSetApplications ?? []), application];
  await saveRecord(kind, {
    ...target,
    entityId: target.entityId,
    equipmentSetId: target.equipmentSetId || loadout.entityId,
    equipmentSetIds,
    equipmentIds,
    equipmentSetApplications: applications,
  });
  return application;
}

export function personName(personId: string | null | undefined, people: Array<Stored<PersonRecord>>) {
  return people.find((person) => person.entityId === personId)?.name ?? '';
}
