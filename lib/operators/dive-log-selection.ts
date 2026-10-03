import type {OperatorRecord,Stored} from '../offline/dive-planning';
import {OPERATOR_TYPES} from './dive-centres';
export interface DiveEntitySelection {id?:string|undefined;name:string}
export interface DiveEntityChoice extends DiveEntitySelection {value:string;label:string;retained?:boolean}
const vesselTypes=new Set<OperatorRecord['operatorType']>(['dive-boat','liveaboard','charter-boat']);
/** Names are display snapshots, never a substitute for a canonical identity. Reading does not bind legacy names. */
export function diveEntityChoices(rows:ReadonlyArray<Stored<OperatorRecord>>,kind:'operator'|'vessel',saved:DiveEntitySelection):DiveEntityChoice[]{
 const eligible=rows.filter(row=>row.active!==false&&(kind==='vessel'?vesselTypes.has(row.operatorType):!vesselTypes.has(row.operatorType)));
 const choices:DiveEntityChoice[]=eligible.map(row=>({id:row.entityId,name:row.name,value:`entity:${row.entityId}`,label:[row.name,OPERATOR_TYPES.find(([type])=>type===row.operatorType)?.[1]??'Unclassified',row.location||row.town].filter(Boolean).join(' · ')})).sort((a,b)=>a.label.localeCompare(b.label)||a.id.localeCompare(b.id));
 if(saved.id){
  const index=choices.findIndex(row=>row.id===saved.id);
  const current=rows.find(row=>row.entityId===saved.id);
  const retained={...saved,value:`entity:${saved.id}`,retained:true,label:`${saved.name||current?.name||'Saved entity'} · ${current?'Saved association':'Unavailable saved entity'}`};
  if(index<0)choices.unshift(retained);else choices[index]={...choices[index],...retained};
 }else if(saved.name)choices.unshift({name:saved.name,value:'legacy',label:`${saved.name} · Historical entry`,retained:true});
 return choices;
}
export function chooseDiveEntity(value:string,choices:ReadonlyArray<DiveEntityChoice>,previous:DiveEntitySelection):DiveEntitySelection{
 if(!value)return {name:''};
 const choice=choices.find(row=>row.value===value);
 if(!choice)throw new Error('The selected Dive Entity is unavailable. Refresh the list.');
 if(choice.retained)return {...previous};
 return {id:choice.id,name:choice.name};
}
export function diveReferencesOperator(record:unknown,id:string){
 if(!record||typeof record!=='object')return false;
 const value=record as {operatorId?:unknown;vesselId?:unknown};return value.operatorId===id||value.vesselId===id;
}
