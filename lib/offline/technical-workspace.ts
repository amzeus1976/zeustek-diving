import { listRecords, removeRecord, saveRecord, type CertificationRecord, type DiveTripRecord, type EquipmentSetRecord, type Stored } from './dive-planning';
import type { DiveRecord } from './dives';
import {
  SKILL_COMPETENCE_LEVELS,
  resolveCanonicalSkillReference,
  skillRecordGroup,
  skillRecordKey,
  skillRecordName,
  type CanonicalSkillRecord,
  type SkillCompetenceLevel,
  type SkillEvidenceRecord,
} from './dive-context';
import type { CurrencyPolicyRecord, SkillCurrencyProjection } from './skills-currency';
import type { ReusableLoadoutRecord } from './loadouts-gas';

export type RequirementState = 'satisfied' | 'not_satisfied' | 'unknown' | 'manual_review';
export type RequirementKind = 'certification' | 'count' | 'recency' | 'assessment' | 'document' | 'manual';

export interface TechnicalRequirementDefinition {
  key: string;
  label: string;
  kind: RequirementKind;
  rule: Record<string, unknown>;
  notes?: string;
}

export interface ReferenceRequirementSetRecord {
  agency: string;
  pathwayKey: string;
  pathwayLabel?: string;
  versionLabel: string;
  effectiveFrom: string | null;
  effectiveTo?: string | null;
  sourceCitation: string | null;
  sourceUrl?: string | null;
  notes?: string;
  requirements: TechnicalRequirementDefinition[];
  capturedAt: string;
  createdAt: string;
  modifiedAt: string;
}

export interface RequirementEvidenceLink {
  kind: 'dive' | 'certification' | 'skill-evidence' | 'equipment-set' | 'manual';
  id?: string;
  label: string;
}

export interface EvaluatedRequirement {
  requirement: TechnicalRequirementDefinition;
  state: RequirementState;
  detail: string;
  evidence: RequirementEvidenceLink[];
}

export interface PathwayReadiness {
  set: Stored<ReferenceRequirementSetRecord>;
  state: RequirementState;
  percent: number;
  satisfied: number;
  total: number;
  requirements: EvaluatedRequirement[];
}

export interface TechnicalEvaluationContext {
  dives: Array<DiveRecord & { entityId: string }>;
  certifications: Array<Stored<CertificationRecord>>;
  skills: CanonicalSkillRecord[];
  evidence: SkillEvidenceRecord[];
  equipmentSets: Array<Stored<EquipmentSetRecord>>;
  asOf?: Date;
}

export const listReferenceRequirementSets = () => listRecords<ReferenceRequirementSetRecord>('reference-requirement-set');
export const deleteReferenceRequirementSet = removeRecord;

export async function saveReferenceRequirementSet(input: Omit<ReferenceRequirementSetRecord, 'createdAt' | 'modifiedAt'> & { entityId?: string }) {
  if (input.entityId) throw new Error('Captured snapshots are immutable. Capture a new version instead.');
  const existing = await listReferenceRequirementSets();
  if (existing.some(set => set.agency.trim().toLowerCase() === input.agency.trim().toLowerCase() && set.pathwayKey.trim().toLowerCase() === input.pathwayKey.trim().toLowerCase() && set.versionLabel.trim().toLowerCase() === input.versionLabel.trim().toLowerCase())) throw new Error('This reference version already exists. Use a new version label; historical snapshots are never overwritten.');
  if (input.sourceUrl) { const url = new URL(input.sourceUrl);if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a valid HTTP or HTTPS source URL.'); }
  if (!input.agency.trim() || !input.pathwayKey.trim() || !input.versionLabel.trim()) throw new Error('Agency, pathway key and version label are required.');
  if (!Array.isArray(input.requirements)) throw new Error('Requirements must be an array.');
  const seen = new Set<string>();
  for (const requirement of input.requirements) {
    if (!requirement || !['certification','count','recency','assessment','document','manual'].includes(requirement.kind) || !requirement.rule || typeof requirement.rule !== 'object' || Array.isArray(requirement.rule)) throw new Error('Each requirement needs a supported kind and an object rule.');
    if (!requirement.key?.trim() || !requirement.label?.trim()) throw new Error('Every requirement needs a key and label.');
    if (seen.has(requirement.key)) throw new Error(`Duplicate requirement key: ${requirement.key}`);
    seen.add(requirement.key);
  }
  return saveRecord('reference-requirement-set', {
    ...input,
    agency: input.agency.trim(), pathwayKey: input.pathwayKey.trim(), pathwayLabel: input.pathwayLabel?.trim() || '', versionLabel: input.versionLabel.trim(),
    sourceCitation: input.sourceCitation?.trim() || null,
    capturedAt: input.capturedAt || new Date().toISOString(),
  });
}

export function isTechnicalDive(dive: DiveRecord) {
  return Boolean(dive.isTechnicalDive || dive.decoDive || dive.diveMode === 'technical' || dive.diveMode === 'technical-training' || dive.decoStops?.length || dive.gradientFactorLow != null || dive.gradientFactorHigh != null || (dive.cylinders?.length ?? 0) > 1);
}

export function technicalDiveMetrics(dives: Array<DiveRecord & { entityId: string }>) {
  const technical = dives.filter(isTechnicalDive);
  const deco = dives.filter((dive) => Boolean(dive.decoDive || (dive.decoStops?.length ?? 0) > 0));
  return { totalDives: dives.length, technicalDives: technical.length, decoDives: deco.length, deepestM: dives.reduce((max,dive)=>Math.max(max,dive.maxDepthM ?? 0),0) };
}

function numberRule(rule: Record<string, unknown>, key: string) {
  const value = rule[key];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
function stringRule(rule: Record<string, unknown>, key: string) {
  const value = rule[key]; return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function stringArrayRule(rule: Record<string, unknown>, key: string) {
  const value=rule[key]; return Array.isArray(value) ? value.filter((item):item is string=>typeof item==='string'&&Boolean(item.trim())).map((item)=>item.trim()) : [];
}

const competenceRank = new Map(SKILL_COMPETENCE_LEVELS.map((level,index)=>[level,index]));
function evidenceForSkillKey(skillKey:string, context:TechnicalEvaluationContext){
  const skill=resolveCanonicalSkillReference(skillKey,context.skills); if(!skill)return [];
  const aliases=new Set([skill.entityId,skill.skillKey,skill.key,skillRecordKey(skill)].filter((value):value is string=>Boolean(value)));
  const asOf = (context.asOf ?? new Date()).getTime();
  return context.evidence.filter((item)=>aliases.has(item.skillKey) && item.performedAt && Number.isFinite(Date.parse(item.performedAt)) && Date.parse(item.performedAt) <= asOf);
}

export function evaluateTechnicalRequirement(requirement: TechnicalRequirementDefinition, context: TechnicalEvaluationContext): EvaluatedRequirement {
  const asOf=context.asOf??new Date();const rule=requirement.rule??{};
  if(requirement.kind==='certification'){
    const titles=stringArrayRule(rule,'anyTitleIncludes').map((value)=>value.toLocaleLowerCase('en-GB'));const agency=stringRule(rule,'agency')?.toLocaleLowerCase('en-GB');
    if(!titles.length)return{requirement,state:'unknown',detail:'Certification rule has no title match terms.',evidence:[]};
    const match=context.certifications.find((cert)=>{const haystack=`${cert.certification} ${cert.level}`.toLocaleLowerCase('en-GB');return(!agency||cert.agency.toLocaleLowerCase('en-GB')===agency)&&titles.some((term)=>haystack.includes(term));});
    return match?{requirement,state:'satisfied',detail:`Matched certification: ${match.certification||match.level}.`,evidence:[{kind:'certification',id:match.entityId,label:match.certification||match.level}]}:{requirement,state:'not_satisfied',detail:'No matching certification record is currently available.',evidence:[]};
  }
  if(requirement.kind==='count'){
    const metric=stringRule(rule,'metric');const min=numberRule(rule,'min');if(!metric||min==null)return{requirement,state:'unknown',detail:'Count rule is incomplete.',evidence:[]};
    let count:number|null=null;let matching:Array<DiveRecord&{entityId:string}>=[];
    if(metric==='logged-dives'){matching=context.dives;count=matching.length;}else if(metric==='technical-dives'){matching=context.dives.filter(isTechnicalDive);count=matching.length;}else if(metric==='deco-dives'){matching=context.dives.filter((dive)=>Boolean(dive.decoDive||(dive.decoStops?.length??0)>0));count=matching.length;}else if(metric==='dives-depth-at-least'){const depth=numberRule(rule,'depthM');if(depth==null)return{requirement,state:'unknown',detail:'Depth-count rule has no depthM.',evidence:[]};matching=context.dives.filter((dive)=>(dive.maxDepthM??0)>=depth);count=matching.length;}
    if(count==null)return{requirement,state:'unknown',detail:`Unsupported count metric: ${metric}.`,evidence:[]};
    return{requirement,state:count>=min?'satisfied':'not_satisfied',detail:`${count} recorded; captured requirement is ${min}.`,evidence:matching.slice(0,8).map((dive)=>({kind:'dive',id:dive.entityId,label:`${dive.date} · ${dive.site}`}))};
  }
  if(requirement.kind==='recency'){
    const skillKey=stringRule(rule,'skillKey');const maxAgeDays=numberRule(rule,'maxAgeDays');if(!skillKey||maxAgeDays==null)return{requirement,state:'unknown',detail:'Recency rule is incomplete.',evidence:[]};
    const latest=[...evidenceForSkillKey(skillKey,context)].filter((item)=>item.performedAt&&Date.parse(item.performedAt)<=asOf.getTime()).sort((a,b)=>String(b.performedAt??'').localeCompare(String(a.performedAt??'')))[0];
    if(!latest?.performedAt)return{requirement,state:'not_satisfied',detail:'No qualifying Skill evidence is recorded.',evidence:[]};
    const age=Math.floor((asOf.getTime()-Date.parse(latest.performedAt))/86_400_000);return{requirement,state:age<=maxAgeDays?'satisfied':'not_satisfied',detail:`Latest evidence is ${age} day${age===1?'':'s'} old; captured maximum is ${maxAgeDays}.`,evidence:[{kind:'skill-evidence',id:latest.entityId,label:new Date(latest.performedAt).toLocaleDateString('en-GB')}]};
  }
  if(requirement.kind==='assessment'){
    const skillKey=stringRule(rule,'skillKey');const minimum=stringRule(rule,'minCompetence') as SkillCompetenceLevel|null;if(!skillKey||!minimum||!competenceRank.has(minimum))return{requirement,state:'unknown',detail:'Assessment rule is incomplete or has an unsupported competence level.',evidence:[]};
    const evaluatorRequired=rule.evaluatorRequired===true;const matches=evidenceForSkillKey(skillKey,context).filter((item)=>typeof item.competenceLevel==='string'&&competenceRank.has(item.competenceLevel as SkillCompetenceLevel)&&(!evaluatorRequired||Boolean(item.evaluatorPersonId))).sort((a,b)=>String(b.performedAt??'').localeCompare(String(a.performedAt??'')));
    const passing=matches.find((item)=>(competenceRank.get(item.competenceLevel as SkillCompetenceLevel)??-1)>=(competenceRank.get(minimum)??99));return passing?{requirement,state:'satisfied',detail:`Evidence meets captured minimum ${minimum}${evaluatorRequired?' with evaluator recorded':''}.`,evidence:[{kind:'skill-evidence',id:passing.entityId,label:passing.performedAt?new Date(passing.performedAt).toLocaleDateString('en-GB'):'Skill evidence'}]}:{requirement,state:'not_satisfied',detail:`No evidence currently meets captured minimum ${minimum}${evaluatorRequired?' with evaluator recorded':''}.`,evidence:matches.slice(0,3).map((item)=>({kind:'skill-evidence',id:item.entityId,label:item.performedAt?new Date(item.performedAt).toLocaleDateString('en-GB'):'Skill evidence'}))};
  }
  if(requirement.kind==='manual'){
    const state=stringRule(rule,'status');if(state&&['satisfied','not_satisfied','unknown','manual_review'].includes(state))return{requirement,state:state as RequirementState,detail:stringRule(rule,'detail')??'Manual captured status.',evidence:[{kind:'manual',label:'Manual review'}]};
    return{requirement,state:'manual_review',detail:'This captured requirement requires manual review.',evidence:[{kind:'manual',label:'Manual review'}]};
  }
  return{requirement,state:'manual_review',detail:'Document requirements are not inferred automatically; review the captured source/evidence.',evidence:[{kind:'manual',label:'Document/manual review'}]};
}

export function evaluatePathwayReadiness(set: Stored<ReferenceRequirementSetRecord>, context: TechnicalEvaluationContext): PathwayReadiness {
  const requirements=set.requirements.map((requirement)=>evaluateTechnicalRequirement(requirement,context));const satisfied=requirements.filter((item)=>item.state==='satisfied').length;const total=requirements.length;const percent=total?Math.round(satisfied/total*100):0;
  const state:RequirementState=total===0?'unknown':requirements.every((item)=>item.state==='satisfied')?'satisfied':requirements.some((item)=>item.state==='not_satisfied')?'not_satisfied':requirements.some((item)=>item.state==='manual_review')?'manual_review':'unknown';
  return{set,state,percent,satisfied,total,requirements};
}

export const TECHNICAL_DRILL_TERMS=['shutdown','s-drill','s drill','long hose','stage','gas switch','dsmb','deco stop','task load','valve drill','bubble check'];
export function isTechnicalSkill(skill:CanonicalSkillRecord){const text=`${skillRecordGroup(skill)} ${skillRecordName(skill)}`.toLocaleLowerCase('en-GB');return skillRecordGroup(skill).toLocaleLowerCase('en-GB').includes('technical')||TECHNICAL_DRILL_TERMS.some((term)=>text.includes(term));}

export function technicalDrillCurrency(skills:CanonicalSkillRecord[], projections:Array<{skill:CanonicalSkillRecord;projection:SkillCurrencyProjection}>){const keys=new Set(skills.filter(isTechnicalSkill).map((skill)=>skill.entityId));return projections.filter((row)=>keys.has(row.skill.entityId)).sort((a,b)=>{const priority={ 'needs-practice':0,'due-soon':1,'not-assessed':2,current:3 } as const;return priority[a.projection.status]-priority[b.projection.status];});}

export function isTechnicalLoadout(loadout:ReusableLoadoutRecord){const haystack=`${loadout.name} ${loadout.intendedUse??''} ${(loadout.environmentTags??[]).join(' ')}`.toLocaleLowerCase('en-GB');return /\b(tec|technical|twinset|sidemount|stage|deco|trimix)\b/.test(haystack);}
export function configurationCompetence(loadouts:Array<Stored<ReusableLoadoutRecord>>,skills:CanonicalSkillRecord[],evidence:SkillEvidenceRecord[],asOf=new Date()){return loadouts.filter(isTechnicalLoadout).map((loadout)=>{const linked=evidence.filter((item)=>item.equipmentSetId===loadout.entityId&&item.performedAt&&Number.isFinite(Date.parse(item.performedAt))&&Date.parse(item.performedAt)<=asOf.getTime());const technical=linked.filter((item)=>{const skill=resolveCanonicalSkillReference(item.skillKey,skills);return Boolean(skill&&isTechnicalSkill(skill));}).sort((a,b)=>String(b.performedAt??'').localeCompare(String(a.performedAt??'')));return{loadout,evidenceCount:technical.length,latestEvidence:technical[0]??null};});}

export interface PlannedCylinderAssignment { id?:string; cylinderEquipmentId?:string; fillId?:string|null; analysisId?:string|null; role?:string; gasLabel?:string; startPressureBar?:number|null; switchDepthM?:number|null; }
export interface TechnicalPlanExtension { technicalMode?:boolean; maxDepthM?:number|null; bottomTimeMin?:number|null; plannedRuntimeMin?:number|null; cylinderAssignments?:PlannedCylinderAssignment[] | undefined; decoSchedule?:Array<{depthM:number|null;durationMin:number|null;gas?:string}> | undefined; }
export function technicalPlans(plans:Array<Stored<DiveTripRecord & TechnicalPlanExtension>>){return plans.filter((plan)=>plan.technicalMode===true||(plan.cylinderAssignments?.length??0)>0||(plan.decoSchedule?.length??0)>0);}

export function recentTechnicalPractice(dives:Array<DiveRecord&{entityId:string}>,limit=8){return dives.filter(isTechnicalDive).sort((a,b)=>`${b.date}T${b.timeIn??''}`.localeCompare(`${a.date}T${a.timeIn??''}`)).slice(0,limit);}

export const TECH_PATHWAY_STARTERS=[{key:'tec40',label:'Tec 40'},{key:'tec45',label:'Tec 45'},{key:'tec50',label:'Tec 50'}] as const;
export function emptyRequirementSet(pathwayKey:string,pathwayLabel:string):Omit<ReferenceRequirementSetRecord,'createdAt'|'modifiedAt'>{return{agency:'',pathwayKey,pathwayLabel,versionLabel:`captured-${new Date().toISOString().slice(0,7)}`,effectiveFrom:null,effectiveTo:null,sourceCitation:null,requirements:[],capturedAt:new Date().toISOString()};}

export type TechnicalWorkspaceInputs = { currencyPolicies:Array<Stored<CurrencyPolicyRecord>> };
