import { zeustekDb } from './db';
import { currentDiveAccount, deleteLocalRecord, diveOperation, listLocalDiveRecords, saveLocalRecord } from './dive-store';
import { recordHash } from './canonical';
import type { DiveRecord } from './dives';
import type { DiveTripRecord } from './dive-planning';
import { saveDivePerspective } from './dive-perspectives';

export interface CanonicalSkillRecord {
  entityId: string;
  skillKey?: string;
  key?: string;
  name?: string;
  title?: string;
  group?: string;
  description?: string;
  competenceDefinitions?: {
    foundation?: string;
    developing?: string;
    competent?: string;
    advanced?: string;
    mastered?: string;
  };
  archived?: boolean;
  archivedAt?: string | null;
  createdAt?: string;
  modifiedAt?: string;
}

export const CANONICAL_SKILL_GROUPS = ['Buoyancy & trim','Propulsion','DSMB & ascent','Gas sharing','Navigation','Drysuit','Rescue','Equipment failures','Technical drills','Leadership & Pro','Environmental & conservation','Other'] as const;
export const CANONICAL_SKILLS_CHANGED_EVENT = 'zeustek:skills-changed';
export const SKILL_COMPETENCE_LEVELS = ['foundation', 'developing', 'competent', 'advanced', 'mastered'] as const;
export type SkillCompetenceLevel = typeof SKILL_COMPETENCE_LEVELS[number];

export interface SkillEvidenceOption {
  entityId: string;
  label: string;
}

/** Shared evidence, not a second skills catalogue or copied course progress. */
export interface SkillEvidenceRecord {
  entityId: string;
  skillKey: string;
  userId?: string;
  performedAt?: string;
  diveId?: string | null;
  planId?: string | null;
  assessment?: string;
  environment?: string;
  equipmentSetId?: string | null;
  /** Stable canonical level for new evidence; numbers are retained for legacy six-point records. */
  competenceLevel?: SkillCompetenceLevel | number | null;
  confidenceLevel?: number | null;
  evaluatorPersonId?: string | null;
  attachmentIds?: string[];
  notes?: string;
  createdAt?: string;
  modifiedAt?: string;
}
export type DiveSkillEvidenceInput = Omit<SkillEvidenceRecord, 'entityId' | 'userId' | 'diveId' | 'createdAt' | 'modifiedAt'> & { entityId?: string };

export const skillRecordKey = (skill: CanonicalSkillRecord) => skill.skillKey || skill.key || skill.entityId;
export const skillRecordName = (skill: CanonicalSkillRecord) => skill.name || skill.title || 'Unnamed skill';
export const skillRecordGroup = (skill: CanonicalSkillRecord) => skill.group?.trim() || 'Uncategorised';
export const canonicalSkillGroups = (skills: readonly CanonicalSkillRecord[]) =>
  [...new Set(skills.map(skillRecordGroup))].sort((a, b) => a.localeCompare(b, 'en-GB'));
export const skillRecordLabel = (skill: CanonicalSkillRecord) => `${skillRecordGroup(skill)} — ${skillRecordName(skill)}`;
export const normaliseCanonicalSkillName = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ');
const skillNameIdentity = (value: string) => normaliseCanonicalSkillName(value).toLocaleLowerCase('en-GB');
export const resolveCanonicalSkillReference = (reference: string, skills: CanonicalSkillRecord[]) =>
  skills.find(skill => [skill.entityId, skill.skillKey, skill.key].filter(Boolean).includes(reference));
export const skillEvidenceDisplayName = (evidence: SkillEvidenceRecord, skills: CanonicalSkillRecord[]) => {
  const skill = resolveCanonicalSkillReference(evidence.skillKey, skills);
  return skill ? skillRecordName(skill) : 'Unknown / unavailable Skill';
};
export const isSkillCompetenceLevel = (value: unknown): value is SkillCompetenceLevel =>
  typeof value === 'string' && (SKILL_COMPETENCE_LEVELS as readonly string[]).includes(value);
export const skillCompetenceLevelLabel = (value: SkillCompetenceLevel) => value.charAt(0).toUpperCase() + value.slice(1);
export const skillCompetenceDefinition = (skill: CanonicalSkillRecord | undefined, level: SkillCompetenceLevel) =>
  skill?.competenceDefinitions?.[level]?.trim() || '';
export const listCanonicalSkills = () => listLocalDiveRecords<CanonicalSkillRecord>('skill');
export const listSkillEvidence = () => listLocalDiveRecords<SkillEvidenceRecord>('skill_evidence');

export interface SkillBatchPreview {
  submittedCount: number;
  blankCount: number;
  newSkills: string[];
  existingSkills: string[];
  duplicateSkills: string[];
}

export function previewCanonicalSkillBatch(value: string, existing: CanonicalSkillRecord[]): SkillBatchPreview {
  const existingNames = new Map(existing.map(skill => [skillNameIdentity(skillRecordName(skill)), skillRecordName(skill)]));
  const seen = new Map<string, string>();
  const preview: SkillBatchPreview = { submittedCount: 0, blankCount: 0, newSkills: [], existingSkills: [], duplicateSkills: [] };
  for (const line of value.split(/\r?\n/)) {
    const name = normaliseCanonicalSkillName(line);
    if (!name) { preview.blankCount += 1; continue; }
    preview.submittedCount += 1;
    const identity = skillNameIdentity(name);
    if (existingNames.has(identity)) { preview.existingSkills.push(name); continue; }
    if (seen.has(identity)) { preview.duplicateSkills.push(name); continue; }
    seen.set(identity, name); preview.newSkills.push(name);
  }
  return preview;
}

export interface CanonicalSkillInput {
  name: string;
  group?: string;
  description?: string;
  competenceDefinitions?: CanonicalSkillRecord['competenceDefinitions'];
}

const cleanCompetenceDefinitions = (value: CanonicalSkillRecord['competenceDefinitions'] = {}) => ({
  foundation: value.foundation?.trim() || '', developing: value.developing?.trim() || '',
  competent: value.competent?.trim() || '', advanced: value.advanced?.trim() || '', mastered: value.mastered?.trim() || '',
});

export async function createCanonicalSkill(input: CanonicalSkillInput): Promise<CanonicalSkillRecord> {
  const name = normaliseCanonicalSkillName(input.name);
  if (!name) throw new Error('Enter a skill name.');
  const skills = await listCanonicalSkills();
  const match = skills.find(skill => skillNameIdentity(skillRecordName(skill)) === skillNameIdentity(name));
  if (match) return match;
  const entityId = crypto.randomUUID();
  await diveOperation(`skill:create:${name.toLocaleLowerCase('en-GB')}`, 'Creating skill locally…', () => saveLocalRecord('skill', {
    entityId,
    skillKey: entityId,
    name,
    group: input.group?.trim() || 'Other',
    description: input.description?.trim() || '',
    competenceDefinitions: cleanCompetenceDefinitions(input.competenceDefinitions),
  }));
  return (await listCanonicalSkills()).find(skill => skill.entityId === entityId) ?? { entityId, skillKey: entityId, name, group: input.group?.trim() || 'Other', description: input.description?.trim() || '', competenceDefinitions: cleanCompetenceDefinitions(input.competenceDefinitions) };
}

export async function createCanonicalSkills(names: string[], group = 'Other'): Promise<CanonicalSkillRecord[]> {
  const created: CanonicalSkillRecord[] = [];
  for (const name of names) created.push(await createCanonicalSkill({ name, group }));
  return created;
}

export async function updateCanonicalSkill(entityId: string, input: CanonicalSkillInput): Promise<CanonicalSkillRecord> {
  const skills = await listCanonicalSkills();
  const current = skills.find(skill => skill.entityId === entityId);
  if (!current) throw new Error('This Skill is no longer available on this device.');
  const name = normaliseCanonicalSkillName(input.name);
  if (!name) throw new Error('Enter a skill name.');
  if (skills.some(skill => skill.entityId !== entityId && skillNameIdentity(skillRecordName(skill)) === skillNameIdentity(name))) throw new Error('A canonical Skill with that name already exists.');
  await diveOperation(`skill:update:${entityId}`, 'Updating skill locally…', () => saveLocalRecord('skill', {
    ...current,
    entityId,
    name,
    group: input.group?.trim() || 'Other',
    description: input.description?.trim() || '',
    competenceDefinitions: cleanCompetenceDefinitions(input.competenceDefinitions),
  }));
  return (await listCanonicalSkills()).find(skill => skill.entityId === entityId) ?? { ...current, name, group: input.group?.trim() || 'Other', description: input.description?.trim() || '', competenceDefinitions: cleanCompetenceDefinitions(input.competenceDefinitions) };
}

export async function setCanonicalSkillArchived(entityId: string, archived: boolean): Promise<CanonicalSkillRecord> {
  const skill = (await listCanonicalSkills()).find(item => item.entityId === entityId);
  if (!skill) throw new Error('This Skill is no longer available on this device.');
  await diveOperation(`skill:archive:${entityId}`, archived ? 'Archiving skill locally…' : 'Restoring skill locally…', () => saveLocalRecord('skill', {
    ...skill,
    entityId,
    archived,
    archivedAt: archived ? new Date().toISOString() : null,
  }));
  return (await listCanonicalSkills()).find(item => item.entityId === entityId) ?? { ...skill, archived, archivedAt: archived ? new Date().toISOString() : null };
}

export interface ArchivedSkillCleanupItem { skill: CanonicalSkillRecord; referenceCount: number }
export interface ArchivedSkillCleanupPreview {
  archivedCount: number;
  eligible: ArchivedSkillCleanupItem[];
  protected: ArchivedSkillCleanupItem[];
}

function countSkillReferences(value: unknown, aliases: Set<string>, key = ''): number {
  if (Array.isArray(value)) return value.reduce((count, item) => count + countSkillReferences(item, aliases, key), 0);
  if (!value || typeof value !== 'object') return typeof value === 'string' && /skill.*(?:id|key|ref)/i.test(key) && aliases.has(value) ? 1 : 0;
  return Object.entries(value as Record<string, unknown>).reduce((count, [childKey, child]) => count + countSkillReferences(child, aliases, childKey), 0);
}

export async function previewUnusedArchivedSkills(): Promise<ArchivedSkillCleanupPreview> {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to review archived Skills.');
  const skills = await listCanonicalSkills();
  const archived = skills.filter(skill => skill.archived);
  const rows = (await zeustekDb.entities.where('module').equals(`dive:${account}`).toArray()).filter(row => !row.deleted && row.record && row.entityType !== 'skill');
  const items = archived.map(skill => {
    const aliases = new Set([skill.entityId, skill.skillKey, skill.key].filter((value): value is string => Boolean(value)));
    return { skill, referenceCount: rows.reduce((count, row) => count + countSkillReferences(row.record, aliases), 0) };
  });
  return { archivedCount: archived.length, eligible: items.filter(item => item.referenceCount === 0), protected: items.filter(item => item.referenceCount > 0) };
}

export async function deleteUnusedArchivedSkills(entityIds: string[]): Promise<number> {
  const selected = new Set(entityIds);
  const preview = await previewUnusedArchivedSkills();
  const eligible = preview.eligible.filter(item => selected.has(item.skill.entityId));
  if (eligible.length !== selected.size) throw new Error('The archived Skill references changed. Review the cleanup list again.');
  for (const item of eligible) await diveOperation(`skill:delete:${item.skill.entityId}`, 'Deleting unused archived Skill locally…', () => deleteLocalRecord(item.skill.entityId));
  return eligible.length;
}

async function diveEvidenceIds(diveId: string): Promise<string[]> {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to edit this Dive.');
  const entity = await zeustekDb.entities.get(`dive:${account}:${diveId}`);
  if (!entity || entity.deleted || entity.entityType !== 'dive' || !entity.record) throw new Error('Load this Dive before recording skill evidence.');
  const dive = entity.record as unknown as DiveRecord;
  return dive.debrief?.skillEvidenceIds ?? [];
}

function validateConfidenceLevel(value: number | null | undefined) {
  if (value != null && (!Number.isInteger(value) || value < 0 || value > 5)) throw new Error('Confidence must be between 0 and 5.');
}

function validateCompetenceLevel(value: SkillEvidenceRecord['competenceLevel']) {
  if (value == null || isSkillCompetenceLevel(value)) return;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5) return;
  throw new Error('Competence must be a recognised level.');
}

/** One domain path owns both evidence.diveId and Dive.debrief.skillEvidenceIds. */
export async function saveDiveSkillEvidence(diveId: string, input: DiveSkillEvidenceInput): Promise<{ evidence: SkillEvidenceRecord; evidenceIds: string[] }> {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to record skill evidence.');
  const skills = await listCanonicalSkills();
  if (!skills.some(skill => skillRecordKey(skill) === input.skillKey)) throw new Error('Choose a saved canonical Skill.');
  if (!input.performedAt?.trim() || !Number.isFinite(Date.parse(input.performedAt))) throw new Error('Record a valid date and time for the skill practice.');
  validateCompetenceLevel(input.competenceLevel);
  validateConfidenceLevel(input.confidenceLevel);
  const existing = input.entityId ? (await listSkillEvidence()).find(item => item.entityId === input.entityId) : undefined;
  if (input.entityId && !existing) throw new Error('This evidence is no longer available on this device.');
  if (existing?.diveId && existing.diveId !== diveId) throw new Error('This evidence is already linked to another Dive.');
  const entityId = input.entityId || crypto.randomUUID();
  await diveOperation(`skill-evidence:save:${entityId}`, input.entityId ? 'Updating skill evidence locally…' : 'Recording skill evidence locally…', () => saveLocalRecord('skill_evidence', {
    ...input,
    entityId,
    userId: account,
    diveId,
    planId: input.planId ?? null,
    equipmentSetId: input.equipmentSetId ?? null,
    evaluatorPersonId: input.evaluatorPersonId ?? null,
    attachmentIds: input.attachmentIds ?? existing?.attachmentIds ?? [],
  }));
  const evidenceIds = [...new Set([...(await diveEvidenceIds(diveId)), entityId])];
  await saveDivePerspective(diveId, { debrief: { skillEvidenceIds: evidenceIds } });
  const evidence = (await listSkillEvidence()).find(item => item.entityId === entityId);
  if (!evidence) throw new Error('Skill evidence was saved but could not be reopened.');
  return { evidence, evidenceIds };
}

export async function linkSkillEvidenceToDive(diveId: string, evidenceId: string): Promise<{ evidence: SkillEvidenceRecord; evidenceIds: string[] }> {
  const evidence = (await listSkillEvidence()).find(item => item.entityId === evidenceId);
  if (!evidence) throw new Error('This evidence is no longer available on this device.');
  return saveDiveSkillEvidence(diveId, { ...evidence, entityId: evidence.entityId });
}

export async function unlinkSkillEvidenceFromDive(diveId: string, evidenceId: string): Promise<string[]> {
  const evidenceIds = (await diveEvidenceIds(diveId)).filter(id => id !== evidenceId);
  await saveDivePerspective(diveId, { debrief: { skillEvidenceIds: evidenceIds } });
  const evidence = (await listSkillEvidence()).find(item => item.entityId === evidenceId);
  if (evidence?.diveId === diveId) await diveOperation(`skill-evidence:unlink:${evidenceId}`, 'Unlinking skill evidence locally…', () => saveLocalRecord('skill_evidence', { ...evidence, entityId: evidenceId, diveId: null }));
  return evidenceIds;
}

export async function deleteDiveSkillEvidence(diveId: string, evidenceId: string): Promise<string[]> {
  const evidenceIds = await unlinkSkillEvidenceFromDive(diveId, evidenceId);
  if ((await listSkillEvidence()).some(item => item.entityId === evidenceId)) await diveOperation(`skill-evidence:delete:${evidenceId}`, 'Deleting skill evidence locally…', () => deleteLocalRecord(evidenceId));
  return evidenceIds;
}

export async function createDiveDraftFromPlan(planId: string): Promise<Partial<DiveRecord>> {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to use this Dive Plan.');
  const key = `dive:${account}:${planId}`;
  let entity = await zeustekDb.entities.get(key);
  if (!entity || entity.deleted || entity.entityType !== 'trip' || !entity.record) throw new Error('Load this Dive Plan before creating a log.');
  let event = entity.updatedEventId ? await zeustekDb.events.get(entity.updatedEventId) : undefined;
  // Legacy cloud projections have no immutable local revision. Retain a revision
  // through the SAME Plan mutation API/ID before linking it, never a copied Plan.
  if (!event || event.recordHash !== await recordHash(entity.record)) {
    if (currentDiveAccount() !== account) throw new Error('Account changed. Reopen this Dive Plan.');
    await saveLocalRecord('trip', { entityId: planId });
    entity = await zeustekDb.entities.get(key);
    event = entity?.updatedEventId ? await zeustekDb.events.get(entity.updatedEventId) : undefined;
  }
  if (currentDiveAccount() !== account || !entity?.record || entity.deleted || !event?.record || event.entityId !== key || event.recordHash !== await recordHash(entity.record)) throw new Error('The Plan changed while preparing this log. Reopen it and try again.');
  const plan = entity.record as unknown as DiveTripRecord;
  const start = plan.startAt || plan.startDate;
  return {
    site: plan.siteName || plan.name, siteId: plan.siteId ?? '',
    originatingPlanId: planId,
    originatingPlanRevision: { eventId: event.eventId, recordHash: event.recordHash, modifiedAt: plan.modifiedAt },
    date: start?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    timeIn: start?.includes('T') ? start.slice(11, 16) : '',
    notes: [plan.notes, `Created from dive plan: ${plan.name}`].filter(Boolean).join('\n\n'),
    source: 'manual', gas: 'Air',
    ...('equipmentIds' in plan && Array.isArray(plan.equipmentIds) ? { equipmentIds: [...plan.equipmentIds] as string[] } : {}),
    ...('equipmentSetIds' in plan && Array.isArray(plan.equipmentSetIds) ? { equipmentSetIds: [...plan.equipmentSetIds] as string[] } : {}),
    ...('equipmentSetId' in plan && typeof plan.equipmentSetId === 'string' ? { equipmentSetId: plan.equipmentSetId } : {}),
    ...('equipmentSetApplications' in plan && Array.isArray(plan.equipmentSetApplications) ? { equipmentSetApplications: structuredClone(plan.equipmentSetApplications) as NonNullable<DiveRecord['equipmentSetApplications']> } : {}),
  };
}

/** Resolve the immutable revision, NEVER substitute a later editable Plan. */
export async function loadOriginatingPlan(dive: DiveRecord): Promise<DiveTripRecord | null> {
  const revision = dive.originatingPlanRevision;
  const account = currentDiveAccount();
  if (!account || !dive.originatingPlanId || !revision) return null;
  const event = await zeustekDb.events.get(revision.eventId);
  if (currentDiveAccount() !== account || !event?.record || event.entityId !== `dive:${account}:${dive.originatingPlanId}` || event.entityType !== 'trip' || event.recordHash !== revision.recordHash || await recordHash(event.record) !== revision.recordHash) return null;
  return event.record as unknown as DiveTripRecord;
}

export function planComparison(plan: DiveTripRecord, dive: DiveRecord): Array<[string, string, string]> {
  const enriched = plan as DiveTripRecord & { plannedMaxDepthM?: number; plannedDurationMin?: number };
  return [
    ['Site', plan.siteName || 'Not recorded', dive.site || 'Not recorded'],
    ['Start', plan.startAt || plan.startDate || 'Not recorded', [dive.date, dive.timeIn].filter(Boolean).join(' ') || 'Not recorded'],
    ['Buddy / team', plan.buddy || 'Not recorded', 'See recorded Dive team'],
    ['Maximum depth', enriched.plannedMaxDepthM == null ? 'Not recorded' : `${enriched.plannedMaxDepthM} m`, dive.maxDepthM == null ? 'Not recorded' : `${dive.maxDepthM} m`],
    ['Dive duration', enriched.plannedDurationMin == null ? 'Not recorded' : `${enriched.plannedDurationMin} min`, (dive.totalElapsedMin ?? dive.bottomTimeMin) == null ? 'Not recorded' : `${dive.totalElapsedMin ?? dive.bottomTimeMin} min`],
  ];
}
