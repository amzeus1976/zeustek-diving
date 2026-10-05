import {PLANNING_LINK_FIELDS,planningFieldTargets,type PlanningLinkField} from './planning-link-fields';
/** Canonical trip records back both Dive Plans and Calendar events. */
export const planningRecordDeletionGuarded=(kind:string)=>kind==='trip'||kind==='dive-trip'||kind==='gas-plan'||kind==='dive'||kind==='training-progress'||kind==='certification';
export function planningRecordHasDiveLinks(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 const ids=(value as {linkedDiveIds?:unknown}).linkedDiveIds;
 return Array.isArray(ids)&&ids.some(id=>typeof id==='string'&&id.trim().length>0);
}
// Logged Dives retain their existing recoverable deletion behaviour. Calendar/Trip
// inbound links are guarded below; historical originatingPlanId is not a delete lock.
export function planningRecordHasConnections(kind:string,value:unknown):boolean{return kind!=='dive'&&Boolean(value&&typeof value==='object'&&PLANNING_LINK_FIELDS.some(spec=>spec.kind===kind&&planningFieldTargets(value as Record<string,unknown>,spec).length));}
export function referencesPlanningRecord(kind:string,value:unknown,id:string):boolean{return Boolean(value&&typeof value==='object'&&PLANNING_LINK_FIELDS.some(spec=>spec.kind===kind&&planningFieldTargets(value as Record<string,unknown>,spec).includes(id)));}
function sqlReference(spec:PlanningLinkField,alias:string,target:boolean){
 const root=alias?`${alias}.`:'';
 if(spec.array||spec.itemField){const value=spec.itemField?`json_extract(value,'$.${spec.itemField}')`:'value';return `EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(${root}data_json,'$.${spec.field}'),'[]')) WHERE ${target?`${value}=?`:spec.itemField?`json_type(value,'$.${spec.itemField}')='text' AND length(trim(${value}))>0`:`type='text' AND length(trim(value))>0`})`;}
 const value=`json_extract(${root}data_json,'$.${spec.field}')`;
 return target?`${value}=?`:`json_type(${root}data_json,'$.${spec.field}')='text' AND length(trim(${value}))>0`;
}
export const PLANNING_DELETE_CONSTRAINT=` AND NOT COALESCE((${PLANNING_LINK_FIELDS.filter(spec=>spec.kind!=='dive'&&planningRecordDeletionGuarded(spec.kind)).map(spec=>`(kind='${spec.kind}' AND ${sqlReference(spec,'',false)})`).join(' OR ')}),0) AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.id!=? AND linked.deleted_at IS NULL AND (${PLANNING_LINK_FIELDS.map(spec=>`(linked.kind='${spec.kind}' AND ${sqlReference(spec,'linked',true)})`).join(' OR ')}))`;
export const planningDeleteBindings=(owner:string,id:string)=>[owner,id,...PLANNING_LINK_FIELDS.map(()=>id)];
