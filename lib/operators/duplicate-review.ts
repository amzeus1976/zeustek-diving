const normal=(text:string|undefined)=>text?.normalize('NFKC').toLocaleLowerCase('en-GB').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ')??'';
const personName=(row:{name:string;displayName?:string;forename?:string;surname?:string})=>normal(row.displayName||[row.forename,row.surname].filter(Boolean).join(' ')||row.name);
export function reviewPersonDuplicates<T extends {entityId:string;name:string;displayName?:string;forename?:string;surname?:string;email?:string}>(draft:{name:string;displayName?:string;forename?:string;surname?:string;email?:string},people:ReadonlyArray<T>):T[]{
  const name=personName(draft),email=normal(draft.email);
  return people.filter(row=>(Boolean(name)&&personName(row)===name)||(Boolean(email)&&normal(row.email)===email));
}
export function reviewEntityDuplicates<T extends {entityId:string;name:string;location?:string;town?:string;email?:string}>(draft:{name:string;location?:string;town?:string;email?:string;website?:string},entities:ReadonlyArray<T>):T[]{
  const name=normal(draft.name),place=normal(draft.location||draft.town),email=normal(draft.email);
  return entities.filter(row=>Boolean(name)&&normal(row.name)===name&&((Boolean(place)&&normal(row.location||row.town)===place)||(Boolean(email)&&normal(row.email)===email)||(!place&&!row.location&&!row.town)));
}
