'use client';
import {chooseDiveEntity,diveEntityChoices,type DiveEntitySelection} from '@/lib/operators/dive-log-selection';
import type {OperatorRecord,Stored} from '@/lib/offline/dive-planning';
export function DiveEntitySelect({kind,entities,value,onChange,disabled=false}:{kind:'operator'|'vessel';entities:ReadonlyArray<Stored<OperatorRecord>>;value:DiveEntitySelection;onChange:(value:DiveEntitySelection)=>void;disabled?:boolean}){
 const choices=diveEntityChoices(entities,kind,value);const label=kind==='operator'?'Dive operator':'Vessel';
 return <label>{label}<select aria-label={label} value={value.id?`entity:${value.id}`:value.name?'legacy':''} disabled={disabled} onChange={event=>onChange(chooseDiveEntity(event.target.value,choices,value))}>
  <option value="">Not recorded</option>{choices.map(choice=><option key={choice.value} value={choice.value}>{choice.label}</option>)}
 </select><small>{kind==='vessel'?'Boats and liveaboards from Dive Centres.':'Organisations from Dive Centres.'}</small></label>;
}
