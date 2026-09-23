import {LOADOUT_SLOT_DEFINITIONS,filterEquipmentForSlot,type LoadoutSlotDefinition} from '../offline/loadouts-gas';
import type {EquipmentRecord,Stored} from '../offline/dive-planning';
/** Correct Other's UI choices without changing the frozen gas/loadout module. */
export function loadoutSlotChoices(definition:LoadoutSlotDefinition,equipment:Stored<EquipmentRecord>[],selectedIds:string[]=[]){
  if(definition.key!=='other')return filterEquipmentForSlot(definition,equipment,selectedIds);
  return equipment.filter(item=>{
    if(selectedIds.includes(item.entityId))return true;
    if(item.retired)return false;
    const category=item.category.trim().toLocaleLowerCase('en-GB');
    return !LOADOUT_SLOT_DEFINITIONS.some(slot=>slot.key!=='other'&&slot.categoryHints.some(hint=>category.includes(hint)));
  });
}
