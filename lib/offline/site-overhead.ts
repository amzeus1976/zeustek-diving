import {currentDiveAccount,deleteLocalRecord,diveOperation,listLocalDiveRecords,saveLocalRecord} from './dive-store';
import {zeustekDb} from './db';

export const OVERHEAD_KIND='site-overhead-profile';
export type OverheadFact={id:string;label:string;notes?:string;zone?:'exterior'|'overhead'|undefined;[key:string]:unknown};
export type RouteObservation={id:string;date:string;notes:string;observer?:string;diveId?:string|null;[key:string]:unknown};
export interface SiteOverheadProfile {
  entityId?:string;siteId:string;featureType?:string|null;orientation?:string;dimensions?:string;
  depthMinM?:number|null;depthMaxM?:number|null;moorings?:string;exteriorNotes?:string;
  hazards?:OverheadFact[];entryExitPoints?:OverheadFact[];routeNotes?:OverheadFact[];
  trainingLimitations?:string[];trainedZones?:string;configurationNotes?:string;lineNotes?:string;emergencyNotes?:string;
  observations?:RouteObservation[];attachmentIds?:string[];notes?:string|null;createdAt?:string;modifiedAt?:string;
  [key:string]:unknown;
}
export const listOverheadProfiles=()=>listLocalDiveRecords<SiteOverheadProfile>(OVERHEAD_KIND);
export const overheadLink=(siteId:string)=>`/?section=Sites&siteId=${encodeURIComponent(siteId)}&view=overhead`;
const validRef=(id:unknown)=>typeof id==='string'&&id.length>0&&id.length<=240&&id.trim()===id&&!/[\u0000-\u001f\u007f]/.test(id);
export function validateOverheadProfile(input:SiteOverheadProfile){
  if(!validRef(input.siteId))throw new Error('Choose an existing Site.');
  for(const value of [input.depthMinM,input.depthMaxM])if(value!=null&&(!Number.isFinite(value)||value<0))throw new Error('Depth must be a non-negative number or unknown.');
  if(input.depthMinM!=null&&input.depthMaxM!=null&&input.depthMinM>input.depthMaxM)throw new Error('Minimum depth cannot exceed maximum depth.');
  for(const key of ['hazards','entryExitPoints','routeNotes'] as const){const facts=input[key];if(facts!=null&&(!Array.isArray(facts)||facts.some(f=>!f||typeof f.label!=='string'||!f.label.trim()||(f.zone!=null&&!['exterior','overhead'].includes(f.zone)))))throw new Error('Give each route, hazard and entry/exit point a label and valid zone.');}
  for(const observation of input.observations??[]){
    const time=Date.parse(observation.date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(observation.date)||!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==observation.date||!observation.notes?.trim())throw new Error('Each observation needs a valid date and notes.');
    if(observation.diveId!=null&&!validRef(observation.diveId))throw new Error('Choose an existing Dive reference.');
  }
  if(input.attachmentIds?.some(id=>!validRef(id)))throw new Error('Invalid attachment reference.');
}
export async function saveOverheadProfile(input:SiteOverheadProfile){
  validateOverheadProfile(input);
  const account=currentDiveAccount();if(!account)throw new Error('Sign in before saving a profile.');
  const old=input.entityId?await zeustekDb.entities.get(`dive:${account}:${input.entityId}`):undefined;
  if(input.entityId&&(!old||old.deleted||old.entityType!==OVERHEAD_KIND))throw new Error('Load this profile before editing.');
  const prior=old?.record as unknown as SiteOverheadProfile|undefined;
  if(prior&&prior.siteId!==input.siteId)throw new Error('A profile cannot be moved to a different Site.');
  const site=await zeustekDb.entities.get(`dive:${account}:${input.siteId}`);
  if((!site||site.deleted||site.entityType!=='site')&&!prior)throw new Error('The linked Site is unavailable. Load it before creating a profile.');
  for(const observation of input.observations??[]){if(!observation.diveId||prior?.observations?.some(o=>o.id===observation.id&&o.diveId===observation.diveId))continue;const dive=await zeustekDb.entities.get(`dive:${account}:${observation.diveId}`);if(!dive||dive.deleted||dive.entityType!=='dive')throw new Error('A linked Dive is unavailable. Load it or remove the new link.');}
  if(currentDiveAccount()!==account)throw new Error('Account changed. Reopen the profile.');
  // Stable Site natural key is also used by core sequential writes/duplicate detection.
  // All history/outbox/unknown top-level fields remain owned by the canonical API.
  return diveOperation(`overhead:${input.entityId??input.siteId}`,'Saving wreck profile locally…',()=>saveLocalRecord(OVERHEAD_KIND,{...input}));
}
export async function removeOverheadProfile(id:string){
  const row=await zeustekDb.entities.get(`dive:${currentDiveAccount()}:${id}`);
  if(!row||row.deleted||row.entityType!==OVERHEAD_KIND)throw new Error('Load this profile before removing it.');
  return diveOperation(`delete-overhead:${id}`,'Removing wreck profile locally…',()=>deleteLocalRecord(id));
}
