import {zeustekDb} from '../offline/db';
import {currentDiveAccount} from '../offline/dive-store';
import type {CalendarSourceRecord,CalendarSourceSnapshot} from '../calendar/calendar-model';

/** Deliberately excludes settings, connection, key and ingestion records. */
export const DATA_REVIEW_KINDS = ['dive','equipment','equipment-event','equipment-set','cylinder','cylinder-fill','gas-analysis','gas-plan','site','trip','dive-trip','certification','training-progress','person','operator','person-operator-link','operator-operator-link','skill','skill_evidence','computer-import','computer-profile','import-resolution'] as const;
const sharedKinds=new Set(['equipment','equipment-event','equipment-set']);
type CoverageReason='not-cached'|'scan-limit'|'invalid-record'|'ownership-unknown'|'shared-records-excluded'|'suppressed-records-excluded';
export interface SnapshotCoverage {kind:string;inspected:number;state:'complete'|'unknown';reasons:CoverageReason[]}
export interface ImageEvidence {recordId:string;field:string;state:'local-present'|'remote-unverified'|'missing'}
export interface OwnerDataSnapshot extends CalendarSourceSnapshot {coverage:SnapshotCoverage[];imageEvidence:ImageEvidence[]}
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const safeLimit=(value:number|undefined,fallback:number,max:number)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0?Math.min(value,max):fallback;

/** Reads the last device snapshot, not a live cloud audit. Never refreshes, repairs or records a diagnostic. */
export async function readOwnerDataSnapshot(accountId:string,options:{perKindLimit?:number;recordLimit?:number}={}):Promise<OwnerDataSnapshot>{
 const assertAccount=()=>{if(!accountId||currentDiveAccount()!==accountId)throw new Error('The account changed. Reopen the review in the current account.');};
 assertAccount();
 const perKindLimit=safeLimit(options.perKindLimit,5000,5000),recordLimit=safeLimit(options.recordLimit,25000,25000),accountModule=`dive:${accountId}`;
 const result:OwnerDataSnapshot={accountId,snapshotAt:new Date().toISOString(),records:[],completeKinds:[],coverage:[],imageEvidence:[]};
 const records:CalendarSourceRecord[]=[];
 await zeustekDb.transaction('r',zeustekDb.entities,zeustekDb.settings,zeustekDb.diveImages,async()=>{
  let bytes=0;
  for(const kind of DATA_REVIEW_KINDS){
   const reasons=new Set<CoverageReason>();
   if((await zeustekDb.settings.get(`cached:${accountModule}:${kind}`))?.value!==true)reasons.add('not-cached');
   const limit=Math.min(perKindLimit,Math.max(0,recordLimit-records.length));
   const rows=await zeustekDb.entities.where('[module+entityType]').equals([accountModule,kind]).limit(limit+1).toArray();
   if(rows.length>limit)reasons.add('scan-limit');
   for(const row of rows.slice(0,limit)){
    if(row.deleted)continue;
    if(!object(row.record)||!row.entityId.startsWith(`${accountModule}:`)){reasons.add('invalid-record');continue;}
    const data=row.record,id=row.entityId.slice(accountModule.length+1);
    if(!id||data.entityId!==id){reasons.add('invalid-record');continue;}
    if(data.suppressedFromUse){reasons.add('suppressed-records-excluded');continue;}
    if(data.householdOwnedByMe===false||(typeof data.householdOwnerId==='string'&&data.householdOwnerId!==accountId)){reasons.add('shared-records-excluded');continue;}
    if(sharedKinds.has(kind)&&(data.householdOwnerId!==accountId||data.householdOwnedByMe!==true)){reasons.add('ownership-unknown');continue;}
    const size=new TextEncoder().encode(JSON.stringify(data)).byteLength;
    if(size>1024*1024||bytes+size>32*1024*1024){reasons.add('scan-limit');continue;}
    bytes+=size;
    records.push({kind,id,data,...(typeof data.createdAt==='string'?{createdAt:data.createdAt}:{}),modifiedAt:typeof data.modifiedAt==='string'?data.modifiedAt:row.updatedAt});
   }
   const coverage:SnapshotCoverage={kind,inspected:rows.slice(0,limit).length,state:reasons.size?'unknown':'complete',reasons:[...reasons]};
   result.coverage.push(coverage);if(coverage.state==='complete')(result.completeKinds as string[]).push(kind);
  }
  const imageRequests:Array<{recordId:string;field:string;attachmentId:string;hasRemote:boolean}>=[];
  for(const row of records){
   for(const field of ['cardFront','cardBack','profileImage','diveMapImage']){
    const image=row.data[field];if(!object(image))continue;
    imageRequests.push({recordId:row.id,field,attachmentId:typeof image.attachmentId==='string'?image.attachmentId:'',hasRemote:typeof image.remoteKey==='string'&&Boolean(image.remoteKey)});
   }
   if(typeof row.data.profileImageId==='string'&&row.data.profileImageId&&!row.data.profileImage)imageRequests.push({recordId:row.id,field:'profileImageId',attachmentId:row.data.profileImageId,hasRemote:true});
   if(typeof row.data.imageKey==='string'&&row.data.imageKey)result.imageEvidence.push({recordId:row.id,field:'imageKey',state:'remote-unverified'});
  }
  const bounded=imageRequests.slice(0,5000),ids=[...new Set(bounded.map(item=>item.attachmentId).filter(Boolean))];
  const local=new Map<string,boolean>();
  for(let offset=0;offset<ids.length;offset+=200){
   const images=await zeustekDb.diveImages.bulkGet(ids.slice(offset,offset+200));
   for(const image of images)if(image?.account===accountId&&image.blob.size>0)local.set(image.id,true);
  }
  result.imageEvidence.push(...imageRequests.map((item,index)=>({recordId:item.recordId,field:item.field,state:index>=5000?'remote-unverified':local.has(item.attachmentId)?'local-present':item.hasRemote?'remote-unverified':'missing'} as ImageEvidence)));
 });
 assertAccount();result.records=records;
 result.imageEvidence.sort((a,b)=>a.recordId.localeCompare(b.recordId)||['cardFront','cardBack','profileImage','diveMapImage','profileImageId','imageKey'].indexOf(a.field)-['cardFront','cardBack','profileImage','diveMapImage','profileImageId','imageKey'].indexOf(b.field));
 return result;
}
