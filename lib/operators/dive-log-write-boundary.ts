/** Validate new/changed links in the same SQL statement as the Dive write. Unchanged historical links remain readable/saveable. */
export function diveEntityWriteConstraint(kind:string,input:unknown,prior:unknown,owner:string):{sql:string;bindings:string[]}{
 const guard={sql:'',bindings:[] as string[]};if(kind!=='dive'||!input||typeof input!=='object')return guard;
 const data=input as Record<string,unknown>;const old=prior&&typeof prior==='object'?prior as Record<string,unknown>:{};
 for(const field of ['operatorId','vesselId']){
  const id=data[field];if(id===undefined||id===null||id==='')continue;
  if(typeof id!=='string'||id.length>256||Array.from(id).some(char=>char.charCodeAt(0)<32))throw new Error('Select a valid Dive Entity reference.');
  if(id===old[field])continue;
  guard.sql+=" AND EXISTS (SELECT 1 FROM dive_records parent WHERE parent.id=? AND parent.user_id=? AND parent.kind='operator' AND parent.deleted_at IS NULL)";guard.bindings.push(id,owner);
 }
 return guard;
}
