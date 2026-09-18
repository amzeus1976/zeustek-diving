import { listDiveTrips, saveDiveTrip, type DiveTripRecord, type DiveSiteRecord, type Stored } from './dive-planning';
import { createDiveDraftFromPlan } from './dive-context';
import type { DiveRecord } from './dives';
import type { LoadoutApplication } from './loadouts-gas';
import type { PlannedCylinderAssignment } from './technical-workspace';

export type PlanLifecycleStatus = 'draft' | 'planned' | 'ready' | 'in_progress' | 'completed' | 'cancelled';
export interface PlanTeamMember {
  personId: string;
  role: string;
  notes?: string | null;
  teamLead?: boolean;
  rescueDiverStatus?: 'yes' | 'no' | 'unknown';
  certifiedDepthM?: number | null;
  capabilityEvidence?: string | null;
  specialties?: string | null;
}
export interface PlanConditionSnapshot {
  capturedAt?: string | null;
  provenance?: 'recorded' | 'imported' | 'calculated' | 'inferred' | 'forecast' | 'seasonal';
  weather?: string | null;
  airTemperatureC?: number | null;
  waterTemperatureC?: number | null;
  waveHeightM?: number | null;
  visibilityM?: number | null;
  swellHeightM?: number | null;
  currentStrength?: string | null;
  tideSummary?: string | null;
  notes?: string | null;
}
export interface PlanHumanFactors {
  objective?: string | null;
  keyRisks?: string[];
  mitigations?: string[];
  pressures?: string[];
  taskLoading?: string | null;
  stopAbortCriteria?: string[];
  teamConcerns?: string[];
  communicationPlan?: string | null;
  decisionPoints?: string | null;
  lostBuddyPlan?: string | null;
  lostGasPlan?: string | null;
  surfaceProtocol?: string | null;
  overheadPrompt?: string | null;
  reviewNotes?: string | null;
}
export interface PlanEmergency {
  oxygenFirstAid?: string | null;
  emergencyContact?: string | null;
  evacuation?: string | null;
  alternateSite?: string | null;
  notes?: string | null;
  hospitalsClinics?: string | null;
  emsNumber?: string | null;
  searchRescueProvider?: string | null;
  hyperbaricPathway?: string | null;
  insuranceProvider?: string | null;
  oxygenLocationQuantity?: string | null;
  oxygenTrainedPersonIds?: string[];
}
export interface PlanEquipmentReadiness {
  additionalItems?: string[];
  bcdWing?: string | null;
  regulator?: string | null;
  exposureSuit?: string | null;
  backupAirSource?: string | null;
  emergencyOxygen?: string | null;
  otherItems?: string | null;
}
export interface PlanChecklistItem { id: string; label: string; completed: boolean }
export interface PlanGasReference {
  gasPlanId: string;
  linkedAt: string;
  name: string;
  notes: string;
  warnings: string[];
}
export interface EnrichedDivePlanExtension {
  lifecycleStatus?: PlanLifecycleStatus;
  tripId?: string | null;
  objective?: string | null;
  primaryObjective?: string;
  aim?: string | null;
  goals?: string[];
  secondaryObjectives?: string[];
  diveNumberOfDay?: number | null;
  multiLevel?: boolean;
  plannedMaxDepthM?: number | null;
  maxTotalDurationMin?: number | null;
  plannedDurationMin?: number | null;
  plannedRuntimeMin?: number | null;
  entryType?: string | null;
  permitRequired?: boolean | null;
  permitConfirmed?: boolean | null;
  entryCost?: string | null;
  minimumVisibilityM?: number | null;
  maximumWaveHeightM?: number | null;
  maximumSwellHeightM?: number | null;
  unacceptableCurrent?: string | null;
  planTeam?: PlanTeamMember[];
  equipmentSetId?: string | null;
  equipmentSetIds?: string[];
  equipmentIds?: string[];
  equipmentSetApplications?: LoadoutApplication[];
  equipmentReadiness?: PlanEquipmentReadiness;
  cylinderAssignments?: PlannedCylinderAssignment[];
  conditions?: PlanConditionSnapshot;
  humanFactors?: PlanHumanFactors;
  emergency?: PlanEmergency;
  checklist?: PlanChecklistItem[];
  plannedSkillKeys?: string[];
  gasPlanLinks?: PlanGasReference[];
  technicalMode?: boolean;
  decoSchedule?: Array<{ depthM: number | null; durationMin: number | null; gas?: string }>;
}
export type EnrichedDivePlan = DiveTripRecord & EnrichedDivePlanExtension;
export type StoredEnrichedDivePlan = Stored<EnrichedDivePlan>;

export const DEFAULT_PLAN_CHECKLIST: PlanChecklistItem[] = [
  { id: 'site-conditions', label: 'Site and conditions reviewed', completed: false },
  { id: 'team', label: 'Team and roles confirmed', completed: false },
  { id: 'equipment', label: 'Equipment and gas confirmed', completed: false },
  { id: 'emergency', label: 'Emergency arrangements reviewed', completed: false },
  { id: 'briefing', label: 'Briefing / stop-abort criteria agreed', completed: false },
];

export function normalisePlan(plan: StoredEnrichedDivePlan): StoredEnrichedDivePlan {
  const lifecycleStatus: PlanLifecycleStatus = plan.lifecycleStatus ?? (
    plan.status === 'completed' ? 'completed' : plan.status === 'confirmed' ? 'planned' : 'draft'
  );
  return {
    ...plan,
    lifecycleStatus,
    primaryObjective: plan.primaryObjective ?? 'Return safely to the surface',
    aim: plan.aim ?? plan.objective ?? '',
    goals: plan.goals ?? [],
    secondaryObjectives: plan.secondaryObjectives ?? [],
    equipmentReadiness: plan.equipmentReadiness ?? {},
    planTeam: plan.planTeam ?? [],
    equipmentSetIds: [...new Set([...(plan.equipmentSetIds ?? []), ...(plan.equipmentSetId ? [plan.equipmentSetId] : [])])],
    checklist: plan.checklist?.length ? plan.checklist : DEFAULT_PLAN_CHECKLIST.map((item) => ({ ...item })),
    plannedSkillKeys: [...new Set(plan.plannedSkillKeys ?? [])],
    humanFactors: plan.humanFactors ?? {},
    emergency: plan.emergency ?? {},
    conditions: plan.conditions ?? {},
  };
}

/** Advisory only: missing evidence remains unknown, never a passed check. */
export function teamDepthAssessment(
  team: PlanTeamMember[] = [],
  people: Array<{ entityId: string; name: string }> = [],
) {
  const nameFor = (personId: string) => people.find((person) => person.entityId === personId)?.name || `Person ${personId.slice(-8)}`;
  const divingTeam = team.filter((row) => (row.role ?? '').trim().toLowerCase() !== 'surface support');
  const known = divingTeam.filter((row) => row.certifiedDepthM != null && Number.isFinite(row.certifiedDepthM) && row.certifiedDepthM > 0);
  const limitM = known.length ? Math.min(...known.map((row) => row.certifiedDepthM!)) : null;
  return {
    limitM,
    limitingDivers: limitM == null ? [] : known.filter((row) => row.certifiedDepthM === limitM).map((row) => ({ name: nameFor(row.personId), depthM: limitM, evidence: row.capabilityEvidence?.trim() || null })),
    unknownDivers: divingTeam.filter((row) => row.certifiedDepthM == null || !Number.isFinite(row.certifiedDepthM) || row.certifiedDepthM <= 0).map((row) => nameFor(row.personId)),
  };
}

export function assessPlanSiteAndTeam(plan: EnrichedDivePlan, site?: DiveSiteRecord | null, people: Array<{ entityId: string; name: string }> = []): string[] {
  const warnings: string[] = [];
  const depth = plan.plannedMaxDepthM;
  if (!site) warnings.push('Site reference unavailable; Site conditions cannot be verified.');
  if (depth == null) warnings.push('Planned maximum depth not recorded.');
  if (depth != null && site?.maxDepthM != null && depth > site.maxDepthM) warnings.push('Planned depth exceeds the recorded Site maximum depth.');
  const teamDepth = teamDepthAssessment(plan.planTeam, people);
  if (depth != null && teamDepth.limitM != null && depth > teamDepth.limitM) warnings.push(people.length
    ? `Planned ${depth} m exceeds limiting diver ${teamDepth.limitingDivers.map((row) => row.name).join(', ')}: recorded ${teamDepth.limitM} m (owner-entered, unverified). Confirm evidence.`
    : 'Planned depth exceeds a recorded team capability; confirm training evidence.');
  if (teamDepth.unknownDivers.length) warnings.push(people.length
    ? `Unknown depth capability: ${teamDepth.unknownDivers.join(', ')}. Do not treat this as a pass.`
    : 'At least one team depth capability is unknown.');
  if (plan.permitRequired && !plan.permitConfirmed) warnings.push('Access permit required but not confirmed.');
  if (plan.minimumVisibilityM != null && plan.conditions?.visibilityM != null && plan.conditions.visibilityM < plan.minimumVisibilityM) warnings.push('Expected visibility is below the plan threshold.');
  if (plan.maximumWaveHeightM != null && plan.conditions?.waveHeightM != null && plan.conditions.waveHeightM > plan.maximumWaveHeightM) warnings.push('Expected waves exceed the plan threshold.');
  if (plan.maximumSwellHeightM != null && plan.conditions?.swellHeightM != null && plan.conditions.swellHeightM > plan.maximumSwellHeightM) warnings.push('Expected swell exceeds the plan threshold.');
  if (plan.unacceptableCurrent && plan.conditions?.currentStrength?.trim().toLowerCase() === plan.unacceptableCurrent.trim().toLowerCase()) warnings.push('Expected current matches the plan no-go threshold.');
  if (!plan.emergency?.emergencyContact && !plan.emergency?.emsNumber) warnings.push('Emergency contact or local EMS number not recorded.');
  return warnings;
}

export async function listEnrichedDivePlans() {
  return (await listDiveTrips())
    .filter((plan) => !('bookingKind' in plan))
    .map((plan) => normalisePlan(plan as StoredEnrichedDivePlan));
}

export interface PlanReadiness {
  state: 'draft' | 'needs-attention' | 'ready';
  completed: number;
  total: number;
  percent: number;
  warnings: string[];
}
export function evaluatePlanReadiness(plan: EnrichedDivePlan): PlanReadiness {
  const checklist = plan.checklist ?? [];
  const checks: Array<[boolean, string]> = [
    [Boolean(plan.siteId || plan.siteName?.trim()), 'Choose a dive Site.'],
    [Boolean(plan.startAt || plan.startDate), 'Set the planned start date/time.'],
    [Boolean((plan.planTeam?.length ?? 0) || plan.buddy?.trim()), 'Confirm at least one team/buddy reference.'],
    [Boolean(plan.equipmentSetId || plan.equipmentSetIds?.length || plan.equipmentIds?.length), 'Choose a loadout or equipment.'],
    [Boolean(plan.emergency?.emergencyContact || plan.emergency?.oxygenFirstAid || plan.emergency?.notes), 'Record emergency arrangements.'],
    [Boolean(plan.humanFactors?.stopAbortCriteria?.length || plan.humanFactors?.keyRisks?.length), 'Record key risks or stop/abort criteria.'],
  ];
  if (plan.technicalMode) {
    checks.push(
      [Boolean((plan.plannedMaxDepthM ?? plan.maxDepthM) != null && (plan.plannedDurationMin ?? plan.bottomTimeMin ?? plan.plannedRuntimeMin) != null), 'Record the separately validated technical depth and time/runtime.'],
      [Boolean(plan.cylinderAssignments?.length && plan.cylinderAssignments.every((assignment) => assignment.cylinderEquipmentId)), 'Link every planned cylinder to canonical Equipment.'],
      [Boolean(plan.cylinderAssignments?.length && plan.cylinderAssignments.every((assignment) => assignment.fillId && assignment.analysisId)), 'Link current fill and analysis evidence for every planned cylinder.'],
    );
  }
  const completed = checks.filter(([ok]) => ok).length + checklist.filter((item) => item.completed).length;
  const total = checks.length + checklist.length;
  const warnings = checks.filter(([ok]) => !ok).map(([, label]) => label);
  if (checklist.some((item) => !item.completed)) warnings.push(`${checklist.filter((item) => !item.completed).length} checklist item(s) incomplete.`);
  const percent = total ? Math.round(completed / total * 100) : 0;
  return { state: percent === 100 ? 'ready' : percent >= 60 ? 'needs-attention' : 'draft', completed, total, percent, warnings };
}

export async function saveEnrichedDivePlan(input: Omit<EnrichedDivePlan, 'createdAt' | 'modifiedAt'> & { entityId?: string }) {
  if (!input.name.trim()) throw new Error('Enter a plan name.');
  if (!input.startDate && !input.startAt) throw new Error('Choose a planned date.');
  const lifecycleStatus = input.lifecycleStatus ?? 'draft';
  const legacyStatus: DiveTripRecord['status'] = lifecycleStatus === 'completed' ? 'completed' : lifecycleStatus === 'ready' || lifecycleStatus === 'in_progress' || lifecycleStatus === 'planned' ? 'confirmed' : 'planned';
  return saveDiveTrip({
    ...input,
    name: input.name.trim(),
    siteName: input.siteName?.trim() || '',
    buddy: input.buddy?.trim() || '',
    notes: input.notes?.trim() || '',
    status: legacyStatus,
    lifecycleStatus,
    primaryObjective: 'Return safely to the surface',
    aim: input.aim ?? input.objective ?? '',
    goals: input.goals ?? [],
    secondaryObjectives: input.secondaryObjectives ?? [],
    equipmentReadiness: input.equipmentReadiness ?? {},
    planTeam: input.planTeam ?? [],
    equipmentSetIds: [...new Set([...(input.equipmentSetIds ?? []), ...(input.equipmentSetId ? [input.equipmentSetId] : [])])],
    checklist: input.checklist?.length ? input.checklist : DEFAULT_PLAN_CHECKLIST.map((item) => ({ ...item })),
    plannedSkillKeys: [...new Set(input.plannedSkillKeys ?? [])],
    conditions: input.conditions ?? {},
    humanFactors: input.humanFactors ?? {},
    emergency: input.emergency ?? {},
  } as EnrichedDivePlan & { entityId?: string });
}

export async function setPlanLifecycleStatus(plan: StoredEnrichedDivePlan, lifecycleStatus: PlanLifecycleStatus) {
  return saveEnrichedDivePlan({ ...plan, entityId: plan.entityId, lifecycleStatus });
}

export async function createDiveDraftFromEnrichedPlan(planId: string): Promise<Partial<DiveRecord>> {
  const [base, plans] = await Promise.all([createDiveDraftFromPlan(planId), listEnrichedDivePlans()]);
  const plan = plans.find((item) => item.entityId === planId);
  if (!plan) throw new Error('This Dive Plan is no longer available on this device.');
  const equipmentSetId = plan.equipmentSetId ?? plan.equipmentSetIds?.[0];
  return {
    ...base,
    maxDepthM: plan.plannedMaxDepthM ?? null,
    bottomTimeMin: plan.plannedDurationMin ?? null,
    plannedRuntimeMin: plan.plannedRuntimeMin ?? null,
    isTechnicalDive: plan.technicalMode ?? false,
    diveMode: plan.technicalMode ? 'technical' : 'recreational',
    ...(equipmentSetId ? { equipmentSetId } : {}),
    equipmentSetIds: plan.equipmentSetIds ?? [],
    equipmentIds: plan.equipmentIds ?? [],
    equipmentSetApplications: plan.equipmentSetApplications ?? [],
    notes: [base.notes, plan.objective ? `Plan objective: ${plan.objective}` : '', plan.humanFactors?.stopAbortCriteria?.length ? `Stop / abort: ${plan.humanFactors.stopAbortCriteria.join('; ')}` : ''].filter(Boolean).join('\n\n'),
  };
}
