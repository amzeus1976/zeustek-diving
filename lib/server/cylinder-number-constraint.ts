function label(value:unknown){
 if(typeof value!=='string'||!/^\d{1,2}$/.test(value.trim()))return null;
 const result=Number(value);return result>=1&&result<=99?result:null;
}
/** Append to the actual write, so a concurrent writer cannot pass an earlier read. */
export function cylinderNumberConstraint(kind:string,data:unknown,previous:unknown,id:string,owner:string,gearOwners:string[]){
 const next=data&&typeof data==='object'?data as Record<string,unknown>:null;
 const prior=previous&&typeof previous==='object'?previous as Record<string,unknown>:null;
 const category=typeof next?.category==='string'?next.category:'',name=typeof next?.name==='string'?next.name:'';
 const physical=kind==='cylinder'||kind==='equipment'&&/\b(cylinder|tank)\b/.test(`${category} ${name}`.normalize('NFKC').toLowerCase());
 const number=label(next?.cylinderNumber);
 // Missing/invalid historical labels remain readable/restorable, and ordinary
 // edits must not force a repair of an unchanged pre-existing duplicate.
 if(!physical||number===null||prior&&label(prior.cylinderNumber)===number)return {sql:'',bindings:[] as Array<string|number>};
 const owners=[...new Set([owner,...gearOwners])];
 const expression="trim(CAST(json_extract(sibling.data_json,'$.cylinderNumber') AS TEXT))";
 return {
  sql:` AND NOT EXISTS (SELECT 1 FROM dive_records AS sibling WHERE sibling.id!=? AND sibling.deleted_at IS NULL AND ((sibling.kind='cylinder' AND sibling.user_id=?) OR (sibling.kind='equipment' AND sibling.user_id IN (${owners.map(()=>'?').join(',')}))) AND json_valid(sibling.data_json) AND length(${expression}) BETWEEN 1 AND 2 AND ${expression} NOT GLOB '*[^0-9]*' AND CAST(${expression} AS INTEGER)=?)`,
  bindings:[id,owner,...owners,number] as Array<string|number>,
 };
}
