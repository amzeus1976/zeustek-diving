import Dexie from 'dexie';
import {zeustekDb} from './db';
import {mutateEntity} from './mutations';
import {recordHash} from './canonical';
import {currentDiveAccount,flushDiveChanges,refreshDiveRecords} from './dive-store';
import type {EntityRow,JsonValue} from './types';
import {PLANNING_LINK_FIELDS,planningFieldTargets,removePlanningFieldTarget} from '../planning/planning-link-fields';
import {workflowDestinationUrl} from '../workflow/workflow-destination';

type Endpoint={id:string;kind:string;name:string;available:boolean;href:string};
type Reference={sourceId:string;sourceKind:string;fieldIndex:number;targetId:string};
export type PlanningConnection={key:string;account:string;other:Endpoint;references:Reference[];versions:Array<{id:string;hash:string}>};
const text=(value:unknown,fallback='')=>typeof value==='string'||typeof value==='number'?String(value):fallback;
const kinds=[...new Set(PLANNING_LINK_FIELDS.flatMap(spec=>[spec.kind,spec.targetKind]))];
function endpoint(kind:string,id:string,row?:EntityRow):Endpoint{
 const data=(row?.record??{}) as Record<string,unknown>;
 const route=kind==='training-progress'?'Course Map':kind==='certification'?'Training':kind==='gas-plan'?'Gas Planning':kind==='dive-trip'?'Trips':kind==='dive'?'Logbook':kind==='skill_evidence'?'Skills & Currency':!('bookingKind' in data)?'Dive Plans':'Diving Calendar & Bookings';
 const type=kind==='training-progress'?'Planned Training':kind==='certification'?'Certification':kind==='gas-plan'?'Gas Plan':kind==='dive-trip'?'Trip':kind==='dive'?'Logged Dive':kind==='skill_evidence'?'Skill evidence':'Dive Plan / event';
 const name=text(data.name)||text(data.courseTitle)||text(data.title)||(kind==='dive'?`${text(data.date)} · ${text(data.site,'Dive')}`:type);
 return{id,kind,name:row?`${type} · ${name}`:`Unavailable ${type}`,available:Boolean(row),href:'/'+workflowDestinationUrl({route,recordId:kind==='skill_evidence'?(text(data.skillId)||text(data.skillKey)||id):id,...(kind==='skill_evidence'?{params:{evidenceId:id}}:kind==='training-progress'?{params:{trainingId:id}}:{})})};
}
async function liveRows(account:string){return(await zeustekDb.entities.where('module').equals(`dive:${account}`).toArray()).filter(row=>!row.deleted&&row.record&&kinds.includes(row.entityType as typeof kinds[number]));}
export async function readPlanningConnections(id:string,refresh=false){
 const account=currentDiveAccount();if(!account)throw new Error('Sign in to review planning links.');
 if(refresh)await Promise.all(kinds.map(kind=>refreshDiveRecords(kind,true)));
 if(currentDiveAccount()!==account)throw new Error('The account changed. Reopen these links.');
 const rows=await liveRows(account),target=rows.find(row=>row.entityId===`dive:${account}:${id}`);if(!target)throw new Error('This record is unavailable. Refresh its workspace.');
 const byId=new Map(rows.map(row=>[String((row.record as Record<string,unknown>).entityId),row]));
 const grouped=new Map<string,PlanningConnection>();
 for(const row of rows){const data=row.record as Record<string,unknown>,sourceId=String(data.entityId);
  for(const [fieldIndex,spec] of PLANNING_LINK_FIELDS.entries()){if(row.entityType!==spec.kind)continue;
   for(const targetId of planningFieldTargets(data,spec)){
    if(sourceId!==id&&targetId!==id)continue;
    const otherId=sourceId===id?targetId:sourceId,otherKind=sourceId===id?spec.targetKind:spec.kind;
    const key=JSON.stringify([id,otherId].sort());let connection=grouped.get(key);
    if(!connection){connection={key,account,other:endpoint(otherKind,otherId,byId.get(otherId)),references:[],versions:[]};grouped.set(key,connection);}
    connection.references.push({sourceId,sourceKind:spec.kind,fieldIndex,targetId});
   }
  }
 }
 for(const connection of grouped.values()){
  for(const sourceId of new Set([id,connection.other.id,...connection.references.map(ref=>ref.sourceId)])){const row=byId.get(sourceId);if(row)connection.versions.push({id:sourceId,hash:await recordHash(row.record)});}
 }
 return{target:endpoint(target.entityType,id,target),connections:[...grouped.values()].sort((a,b)=>a.other.name.localeCompare(b.other.name))};
}
/** Atomic device edits with the existing owner-scoped revision/outbox architecture. Cloud conflicts remain reviewable. */
export async function unlinkPlanningConnection(connection:PlanningConnection){
 const account=connection.account,accountModule=`dive:${account}`;
 const sameAccount=()=>{if(!account||currentDiveAccount()!==account)throw new Error('The account changed. Reopen these links.');};sameAccount();
 if(!connection.references.length)throw new Error('Refresh these links before unlinking.');
 await zeustekDb.transaction('rw',[zeustekDb.entities,zeustekDb.events,zeustekDb.eventParents,zeustekDb.entityHeads,zeustekDb.outbox,zeustekDb.settings,zeustekDb.syncState],async()=>{
  sameAccount();const current=new Map<string,EntityRow>();
  for(const version of connection.versions){const row=await zeustekDb.entities.get(`${accountModule}:${version.id}`);if(!row||row.deleted||!row.record||await Dexie.waitFor(recordHash(row.record))!==version.hash)throw new Error('A linked record changed. Refresh and review it before unlinking.');current.set(version.id,row);}
  const patches=new Map<string,Record<string,unknown>>();
  for(const ref of connection.references){const spec=PLANNING_LINK_FIELDS[ref.fieldIndex],row=current.get(ref.sourceId);if(!spec||!row||row.entityType!==ref.sourceKind||spec.kind!==ref.sourceKind)throw new Error('Refresh these links before unlinking.');const data=patches.get(ref.sourceId)??row.record as Record<string,unknown>;if(!planningFieldTargets(data,spec).includes(ref.targetId))throw new Error('This link changed. Refresh before unlinking.');patches.set(ref.sourceId,removePlanningFieldTarget(data,spec,ref.targetId));}
  for(const [id,data] of patches){sameAccount();const row=current.get(id)!,localId=`${accountModule}:${id}`;const queued=(await zeustekDb.settings.get(`pending:${localId}`))?.value as Record<string,JsonValue>|undefined;if(queued?.state==='conflict')throw new Error('Review the pending sync differences for this record before unlinking.');const record=JSON.parse(JSON.stringify({...data,modifiedAt:new Date().toISOString()})) as JsonValue;const pending={id,kind:row.entityType,record,baseModifiedAt:queued?queued.baseModifiedAt:typeof(data.modifiedAt)==='string'?data.modifiedAt:null,token:crypto.randomUUID(),state:'pending'};
   await mutateEntity({entityId:localId,module:accountModule,entityType:row.entityType,schemaVersion:row.schemaVersion,operation:'update',record,pendingSync:{key:`pending:${localId}`,value:pending as JsonValue}});
  }sameAccount();
 });
 window.dispatchEvent(new Event('zeustek-records-updated'));void flushDiveChanges();
}
