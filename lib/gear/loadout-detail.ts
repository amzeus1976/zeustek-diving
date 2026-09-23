import {LOADOUT_SLOT_DEFINITIONS,normaliseReusableLoadout,type ReusableLoadoutRecord} from '../offline/loadouts-gas';
import type {EquipmentRecord,Stored} from '../offline/dive-planning';
/** Read-only projection; no legacy set is persisted or rewritten. */
export function loadoutDetailRows(loadout:Stored<ReusableLoadoutRecord>,equipment:Stored<EquipmentRecord>[]) {
  const normalised=normaliseReusableLoadout(loadout);
  return Object.entries(normalised.slots??{}).flatMap(([slot,value])=>{
    const ids=Array.isArray(value)?value:typeof value==='string'&&value?[value]:[];
    if(!ids.length)return [];
    return [{slot,label:LOADOUT_SLOT_DEFINITIONS.find(definition=>definition.key===slot)?.label??slot,
      items:ids.map(id=>{
        const item=equipment.find(gear=>gear.entityId===id);
        return {id,label:item?[item.name,item.manufacturer,item.model].filter(Boolean).join(' · '):'Unavailable saved item',available:!!item};
      })}];
  });
}
