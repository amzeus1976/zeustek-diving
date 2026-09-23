/** Appended to operator tombstone writes so a stale client cannot break live Person links. */
export const OPERATOR_DELETE_CONSTRAINT = " AND NOT EXISTS (SELECT 1 FROM dive_records linked WHERE linked.user_id=? AND linked.kind='person' AND linked.deleted_at IS NULL AND (json_extract(linked.data_json,'$.operatorId')=? OR json_extract(linked.data_json,'$.currentDiveOperatorId')=?))";
export function personReferencesOperator(record:unknown,id:string){
  if(!record||typeof record!=='object')return false;
  const value=record as {operatorId?:unknown;currentDiveOperatorId?:unknown};
  return value.operatorId===id||value.currentDiveOperatorId===id;
}
