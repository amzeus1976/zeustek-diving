import { currentDiveAccount, deleteLocalRecord, diveOperation, listLocalDiveRecords, saveLocalRecord } from './dive-store';
import { zeustekDb } from './db';

export const CONSERVATION_KIND = 'conservation_activity';
export const PROGRAMME_KIND = 'conservation-programme';
export const ACTIVITY_TYPES = [
  ['marine-life', 'Marine-life observation'], ['debris', 'Debris survey / removal'],
  ['habitat', 'Habitat / coral observation'], ['citizen-science', 'Citizen-science record'],
  ['event', 'Conservation event'], ['learning', 'Learning / course evidence'], ['other', 'Other'],
] as const;
export type ActivityType = typeof ACTIVITY_TYPES[number][0];
export type VerificationState = 'recorded' | 'verified' | 'needs-review';
export interface ConservationActivity {
  entityId: string; activityType: ActivityType; occurredAt: string;
  siteId?: string | null; diveId?: string | null; participantPersonIds?: string[];
  speciesOrSubject?: string | null; tags?: string[];
  debris?: { operation: 'survey' | 'removal'; count?: number | null; massKg?: number | null; categories?: string[]; [key: string]: unknown } | null;
  externalReference?: string | null; attachmentIds?: string[]; notes?: string | null;
  verificationState?: VerificationState; programmeVersionId?: string | null;
  createdAt?: string; modifiedAt?: string; [key: string]: unknown;
}
export interface ProgrammeReference {
  entityId: string; agency: string; pathwayKey: string; versionLabel: string;
  effectiveFrom: string | null; sourceCitation: string;
  requirements: Array<{ key: string; label: string; kind: 'count'; rule: { activityType: ActivityType | 'all'; target: number } }>;
  [key: string]: unknown;
}
export const listConservation = () => listLocalDiveRecords<ConservationActivity>(CONSERVATION_KIND);
export const listProgrammes = () => listLocalDiveRecords<ProgrammeReference>(PROGRAMME_KIND);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const types = new Set<string>(ACTIVITY_TYPES.map(([key]) => key));
export function validateActivity(input: Partial<ConservationActivity>) {
  if (!types.has(String(input.activityType))) throw new Error('Choose an activity type.');
  if (!input.occurredAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(input.occurredAt) || !Number.isFinite(Date.parse(input.occurredAt)) || new Date(input.occurredAt.slice(0,10)).toISOString().slice(0,10)!==input.occurredAt.slice(0,10)) throw new Error('Choose a valid activity date and time.');
  for (const id of [input.entityId, input.siteId, input.diveId, ...(input.participantPersonIds ?? []), ...(input.attachmentIds ?? []), input.programmeVersionId]) if (id && !uuid.test(id)) throw new Error('Choose an existing record reference.');
  if (input.verificationState && !['recorded','verified','needs-review'].includes(input.verificationState)) throw new Error('Choose a verification state.');
  if (input.debris) {
    if (!['survey','removal'].includes(input.debris.operation)) throw new Error('Choose survey or removal.');
    for (const value of [input.debris.count,input.debris.massKg]) if (value != null && (!Number.isFinite(value) || value < 0)) throw new Error('Debris count and mass cannot be negative.');
    if (input.debris.count != null && !Number.isInteger(input.debris.count)) throw new Error('Debris item count must be a whole number.');
  }
}
async function existingReference(id: string | null | undefined, kind: string, account: string) {
  if (!id) return;
  const row = await zeustekDb.entities.get(`dive:${account}:${id}`);
  if (!row || row.deleted || row.entityType !== kind) throw new Error('A linked record is unavailable. Remove the link or load that record before saving.');
}
export async function saveConservation(input: Partial<ConservationActivity> & { activityType: ActivityType; occurredAt: string }) {
  validateActivity(input);
  const account = currentDiveAccount(); if (!account) throw new Error('Sign in before saving an activity.');
  const old = input.entityId ? await zeustekDb.entities.get(`dive:${account}:${input.entityId}`) : undefined;
  if (input.entityId && (!old || old.deleted || old.entityType !== CONSERVATION_KIND)) throw new Error('Load this activity before editing.');
  // Unavailable historical references may remain unchanged; never silently erase them.
  const prior = old?.record as unknown as ConservationActivity | undefined;
  if (input.siteId !== prior?.siteId) await existingReference(input.siteId,'site',account);
  if (input.diveId !== prior?.diveId) await existingReference(input.diveId,'dive',account);
  if (input.programmeVersionId !== prior?.programmeVersionId) await existingReference(input.programmeVersionId,PROGRAMME_KIND,account);
  for (const id of input.participantPersonIds ?? []) if (!prior?.participantPersonIds?.includes(id)) await existingReference(id,'person',account);
  if (currentDiveAccount() !== account) throw new Error('Account changed. Reopen this activity.');
  const data = { ...input, ...('debris' in input ? {debris:input.debris ? { ...prior?.debris, ...input.debris } : input.debris}: {}) };
  return diveOperation(`conservation:${input.entityId ?? JSON.stringify(input)}`, 'Saving conservation activity locally…', () => saveLocalRecord(CONSERVATION_KIND,data));
}
export async function removeConservation(id: string) {
  const account=currentDiveAccount(); const row=await zeustekDb.entities.get(`dive:${account}:${id}`);
  if (!row || row.deleted || row.entityType!==CONSERVATION_KIND) throw new Error('Load this activity before deleting.');
  return diveOperation(`delete-conservation:${id}`,'Deleting conservation activity locally…',()=>deleteLocalRecord(id));
}
/** Captures a NEW version; existing definitions/activity references are never rewritten. */
export async function captureProgramme(input: Omit<ProgrammeReference,'entityId'>) {
  if (!String(input.agency ?? '').trim() || !String(input.pathwayKey ?? '').trim() || !String(input.versionLabel ?? '').trim() || !String(input.sourceCitation ?? '').trim()) throw new Error('Programme name, agency, version and source citation are required.');
  const requirements=input.requirements as ProgrammeReference['requirements'];
  if (!Array.isArray(requirements) || !requirements.length || requirements.some(r=>r.kind!=='count'||!r.label.trim()||!Number.isInteger(r.rule.target)||r.rule.target<1||!(r.rule.activityType==='all'||types.has(r.rule.activityType)))) throw new Error('Record a labelled, positive whole-number activity requirement.');
  const programmes=await listProgrammes();
  if (programmes.some(p=>p.agency===input.agency&&p.pathwayKey===input.pathwayKey&&p.versionLabel===input.versionLabel)) throw new Error('That reference version already exists. Use a new version label.');
  return diveOperation(`programme:${JSON.stringify(input)}`,'Capturing programme reference locally…',()=>saveLocalRecord(PROGRAMME_KIND,input));
}
export function programmeProgress(reference: ProgrammeReference, activities: ConservationActivity[]) {
  return reference.requirements.map(requirement=>{
    const valid=Number.isInteger(requirement.rule?.target)&&requirement.rule.target>0;
    const count=valid?activities.filter(a=>a.programmeVersionId===reference.entityId&&(requirement.rule.activityType==='all'||a.activityType===requirement.rule.activityType)).length:0;
    return {label:requirement.label,count,target:requirement.rule?.target,state:valid ? count>=requirement.rule.target?'satisfied':'not_satisfied':'unknown'};
  });
}
export function conservationSummary(activities: ConservationActivity[], totalDives: number) {
  const observations=activities.filter(a=>['marine-life','habitat','citizen-science'].includes(a.activityType));
  const diveIds=new Set(observations.map(a=>a.diveId).filter(Boolean));
  const removals=activities.filter(a=>a.activityType==='debris'&&a.debris?.operation==='removal');
  const massKnown=removals.filter(a=>typeof a.debris?.massKg==='number'&&Number.isFinite(a.debris.massKg)&&a.debris.massKg>=0);
  return {activities:activities.length,observations:observations.length,observationDives:diveIds.size,totalDives,
    subjects:new Set(observations.map(a=>a.speciesOrSubject?.trim().toLocaleLowerCase()).filter(Boolean)).size,
    removedMassKg:massKnown.reduce((sum,a)=>sum+a.debris!.massKg!,0),unknownMass:removals.length-massKnown.length,
    removedItems:removals.reduce((sum,a)=>sum+(Number.isInteger(a.debris?.count)&&a.debris!.count!>=0?a.debris!.count!:0),0)};
}
export function conservationLink(section: 'Logbook'|'Sites'|'People', id: string) {
  return `/?${new URLSearchParams({section,[section==='Logbook'?'diveId':section==='Sites'?'siteId':'personId']:id})}`;
}
