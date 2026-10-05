/** Canonical trip records back both Dive Plans and Calendar events. */
export const planningRecordDeletionGuarded=(kind:string)=>kind==='trip'||kind==='dive-trip';
export function planningRecordHasDiveLinks(value:unknown):boolean {
 if(!value||typeof value!=='object')return false;
 const ids=(value as {linkedDiveIds?:unknown}).linkedDiveIds;
 return Array.isArray(ids)&&ids.some(id=>typeof id==='string'&&id.trim().length>0);
}
export function referencesPlanningRecord(kind:string, value:unknown, id:string):boolean {
 if(!value||typeof value!=='object')return false;
 const data=value as Record<string,unknown>;
 if(kind==='dive')return data.originatingPlanId===id;
 if(kind==='gas-plan')return data.divePlanId===id;
 if(kind==='skill_evidence')return data.planId===id;
 if(kind==='trip')return data.linkedDivePlanId===id;
 if(kind!=='dive-trip')return false;
 return data.originCalendarBookingId===id || ['planIds','calendarBookingIds'].some(key=>Array.isArray(data[key])&&(data[key] as unknown[]).includes(id)) || (Array.isArray(data.itinerary)&&data.itinerary.some(row=>row&&typeof row==='object'&&(row as {calendarBookingId?:unknown}).calendarBookingId===id));
}
export const PLANNING_DELETE_CONSTRAINT=" AND NOT EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(data_json,'$.linkedDiveIds'),'[]')) WHERE type='text' AND length(trim(value))>0) AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.id!=? AND linked.deleted_at IS NULL AND ((linked.kind='dive' AND json_extract(linked.data_json,'$.originatingPlanId')=?) OR (linked.kind='gas-plan' AND json_extract(linked.data_json,'$.divePlanId')=?) OR (linked.kind='skill_evidence' AND json_extract(linked.data_json,'$.planId')=?) OR (linked.kind='trip' AND json_extract(linked.data_json,'$.linkedDivePlanId')=?) OR (linked.kind='dive-trip' AND (json_extract(linked.data_json,'$.originCalendarBookingId')=? OR EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(linked.data_json,'$.planIds'),'[]')) WHERE value=?) OR EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(linked.data_json,'$.calendarBookingIds'),'[]')) WHERE value=?) OR EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(linked.data_json,'$.itinerary'),'[]')) WHERE json_extract(value,'$.calendarBookingId')=?)))))";
export const planningDeleteBindings=(owner:string,id:string)=>[owner,id,id,id,id,id,id,id,id,id];
