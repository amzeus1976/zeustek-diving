import {INSIGHT_AWARD_DEFINITIONS} from './insight-awards';
import {headlineAnalytics, diveRuntimeMinutes, type DiveWithId} from '../offline/experience-analytics';
import {resolvePersonDisplayAwards} from '../people/certification-evidence';
import type {CertificationRecord,PersonRecord} from '../offline/dive-planning';
import {resolveTopBuddy} from '../people/top-buddy';
import {personDisplayName} from '../offline/people-profiles';
export type HeadlineContext = {dives:DiveWithId[]; owner:(Partial<PersonRecord>&{entityId?:string})|null; certifications:Array<CertificationRecord&{entityId?:string}>;people?:Array<PersonRecord&{entityId:string}>};
export type InsightHeadline = {id:string;label:string;value:string;sourceKind:'dive'|'certification'|'person';sourceIds:string[];sourceLabel:string;explanation:string;personId?:string};
const number=(value:number|null,unit='')=>value==null?'Not recorded':`${Number(value.toFixed(2))}${unit?' '+unit:''}`;
export function resolveInsightHeadline(id:string, context:HeadlineContext):InsightHeadline|null {
  const definition=INSIGHT_AWARD_DEFINITIONS.find(item=>item[0]===id);
  if(!definition)return null;
  const result=(value:string,sourceIds:string[],explanation:string,sourceKind:InsightHeadline['sourceKind']='dive'):InsightHeadline=>({id,label:definition[1],value,sourceKind,sourceIds,sourceLabel:sourceKind==='certification'?`${sourceIds.length} source Certification record${sourceIds.length===1?'':'s'}`:sourceKind==='person'?'Owner-entered Person profile':`${sourceIds.length} source Dive${sourceIds.length===1?'':'s'}`,explanation});
  if(id==='topBuddy'){
    const buddy=resolveTopBuddy(context.people??[],context.dives,context.owner);
    if(!buddy)return result('No buddy evidence',[],'No non-owner Person has a saved buddy link in this Dive scope. Team membership alone is not buddy evidence.');
    return {...result(personDisplayName(buddy.person),buddy.sourceDiveIds,buddy.source==='owner-selected'?'Selected in My Profile. The count and supporting Dives use the active scope; this is not an inferred ranking.':'Most saved buddy links in the active Dive scope, counted once per Dive. Instructors may also be buddies. Equal counts use display name as a stable tie-break.'),personId:buddy.person.entityId,sourceLabel:`${buddy.count} Dive${buddy.count===1?'':'s'} together${buddy.source==='owner-selected'?' · Owner-selected':''}`};
  }
  if(id.startsWith('highest')){
    const awards=context.owner?resolvePersonDisplayAwards(context.owner,context.certifications):null;
    const award=id==='highestRecCert'?awards?.rec:id==='highestTecCert'?awards?.tec:awards?.pro;
    if(award?.record){const record=award.record as CertificationRecord&{entityId?:string};return result(award.title,record.entityId?[record.entityId]:[],'Ranked canonical Certification evidence for the owner. Display rank grants no depth permission or professional capability. The Dive scope does not filter awards.','certification');}
    if(award?.source==='owner-entered'&&context.owner?.entityId)return result(award.title,[context.owner.entityId],'Owner-entered summary; no associated canonical Certification evidence is available.','person');
    return result('Not recorded',[],'No associated canonical award evidence is available.','certification');
  }
  const dives=context.dives, h=headlineAnalytics(dives);
  const observations={divesLogged:h.totalDives,maxDepth:h.maxDepthM,averageDepth:h.averageDepthM,totalTime:h.totalDiveTimeMin,bestSac:h.bestSacBarMin,averageSac:h.averageSacBarMin,bestRmv:h.bestRmvLMin,averageRmv:h.averageRmvLMin};
  if(id in observations){const observation=observations[id as keyof typeof observations];return result(number(observation.value,observation.unit==='dives'?'':observation.unit),observation.sourceDiveIds,'Derived from recorded inputs in the active Dive scope. Missing evidence is excluded, never treated as zero.');}
  if(id==='longestDive'||id==='averageTime'){
    const recorded=dives.flatMap(dive=>{const value=diveRuntimeMinutes(dive);return value==null?[]:[{id:dive.entityId,value}];});
    const value=recorded.length?(id==='longestDive'?Math.max(...recorded.map(item=>item.value)):recorded.reduce((sum,item)=>sum+item.value,0)/recorded.length):null;
    return result(number(value,'min'),recorded.map(item=>item.id),'Recorded elapsed runtime, with bottom-time fallback only where elapsed runtime is absent.');
  }
  const types:Record<string,RegExp>={poolDives:/pool/i,shoreDives:/shore/i,boatDives:/boat/i,nightDives:/night/i,wreckDives:/^wreck$/i,wreckPenetrationDives:/wreck penetration/i,cavernDives:/cavern/i,caveDives:/^cave$/i};
  const matches=dives.filter(dive=>{
    if(id==='recreationalDives')return !dive.diveMode?.startsWith('technical');
    if(id==='technicalDives')return Boolean(dive.diveMode?.startsWith('technical'));
    if(id==='saltwaterDives')return dive.waterType==='Saltwater';
    if(id==='freshwaterDives')return dive.waterType==='Freshwater';
    if(id==='otherWaterDives')return !['Saltwater','Freshwater'].includes(dive.waterType??'');
    if(/^deep\d+$/.test(id))return dive.maxDepthM!=null&&Number.isFinite(dive.maxDepthM)&&dive.maxDepthM>=Number(id.slice(4));
    if(id==='unknownOtherDives')return !dive.diveTypes?.length;
    return (dive.diveTypes??[]).some(value=>types[id]?.test(value.trim()));
  });
  return result(String(matches.length),matches.map(dive=>dive.entityId),'Matching canonical Dives in the active scope; each Dive is counted once.');
}
