/** Appended to operator tombstone writes so a stale client cannot break live Person links. */
export const OPERATOR_DELETE_CONSTRAINT = " AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.kind='person' AND linked.deleted_at IS NULL AND (json_extract(linked.data_json,'$.operatorId')=? OR json_extract(linked.data_json,'$.currentDiveOperatorId')=?))"+
  " AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.kind='person-operator-link' AND linked.deleted_at IS NULL AND json_extract(linked.data_json,'$.operatorId')=?)"+
  " AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.kind='operator-operator-link' AND linked.deleted_at IS NULL AND (json_extract(linked.data_json,'$.fromOperatorId')=? OR json_extract(linked.data_json,'$.toOperatorId')=?))";
export const operatorDeleteBindings=(owner:string,id:string)=>[owner,id,id,owner,id,owner,id,id] as const;
export const PERSON_DELETE_CONSTRAINT = " AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.kind='person-operator-link' AND linked.deleted_at IS NULL AND json_extract(linked.data_json,'$.personId')=?)"+
  " AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.kind='dive' AND linked.deleted_at IS NULL AND (json_extract(linked.data_json,'$.diveLeaderId')=? OR EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(linked.data_json,'$.buddyIds'),'[]')) WHERE value=?) OR EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(linked.data_json,'$.diveTeamIds'),'[]')) WHERE value=?)))"+
  " AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.kind='trip' AND linked.deleted_at IS NULL AND (EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(linked.data_json,'$.personIds'),'[]')) WHERE value=?) OR EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(linked.data_json,'$.planTeam'),'[]')) WHERE json_extract(value,'$.personId')=?) OR EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(linked.data_json,'$.emergency.oxygenTrainedPersonIds'),'[]')) WHERE value=?)))"+
  " AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.kind='certification' AND linked.deleted_at IS NULL AND (json_extract(linked.data_json,'$.personId')=? OR json_extract(linked.data_json,'$.instructorId')=?))";
export const personDeleteBindings=(owner:string,id:string)=>[owner,id,owner,id,id,id,owner,id,id,id,owner,id,id] as const;
export function personReferencesOperator(record:unknown,id:string){
  if(!record||typeof record!=='object')return false;
  const value=record as {operatorId?:unknown;currentDiveOperatorId?:unknown};
  return value.operatorId===id||value.currentDiveOperatorId===id;
}
