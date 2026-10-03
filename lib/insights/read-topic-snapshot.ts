import {zeustekDb} from '../offline/db';
import {currentDiveAccount} from '../offline/dive-store';
import type {TopicSnapshot} from './topic-explorer';
export const TOPIC_SOURCE_KINDS=['question-set','test-attempt','question-review-state','dive-media','news-article','skill','skill_evidence','training-progress','certification','person','dive','site'] as const;
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
/** Cached canonical evidence only. Never calls list/refresh/seed, ingestion, images or mutation helpers. */
export async function readTopicSnapshot(accountId:string,options:{perKindLimit?:number}={}):Promise<TopicSnapshot>{
 const assertAccount=()=>{if(!accountId||currentDiveAccount()!==accountId)throw new Error('The account changed. Reopen Topic Explorer in the current account.');};
 assertAccount();const accountModule=`dive:${accountId}`,limit=Math.min(3000,Number.isSafeInteger(options.perKindLimit)&&Number(options.perKindLimit)>0?Number(options.perKindLimit):3000);
 const result:TopicSnapshot={accountId,snapshotAt:new Date().toISOString(),records:[],coverage:[]};let bytes=0;
 await zeustekDb.transaction('r',zeustekDb.entities,zeustekDb.settings,async()=>{
  for(const kind of TOPIC_SOURCE_KINDS){
   let reason=(await zeustekDb.settings.get(`cached:${accountModule}:${kind}`))?.value===true?'':'not-cached';
   const rows=await zeustekDb.entities.where('[module+entityType]').equals([accountModule,kind]).limit(limit+1).toArray();
   if(rows.length>limit)reason='scan-limit';
   for(const row of rows.slice(0,limit)){
    if(row.deleted)continue;
    if(!object(row.record)||!row.entityId.startsWith(`${accountModule}:`)){reason='invalid-record';continue;}
    const id=row.entityId.slice(accountModule.length+1),data=row.record;
    if(!id||data.entityId!==id){reason='invalid-record';continue;}
    if(data.suppressedFromUse){reason='excluded-history';continue;}
    if(data.householdOwnedByMe===false||typeof data.householdOwnerId==='string'&&data.householdOwnerId!==accountId||typeof data.userId==='string'&&data.userId!==accountId){reason='foreign-record-excluded';continue;}
    const size=new TextEncoder().encode(JSON.stringify(data)).byteLength;
    if(size>1024*1024||bytes+size>32*1024*1024||result.records.length>=24000){reason='scan-limit';continue;}
    bytes+=size;result.records.push({kind,id,data});
   }
   result.coverage.push({kind,state:reason?'unknown':'complete',...(reason?{reason}:{})});
  }
 });
 assertAccount();return result;
}
