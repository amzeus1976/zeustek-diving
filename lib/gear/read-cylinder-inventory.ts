import {listLocalDiveRecords} from '../offline/dive-store';
import {isCylinderEquipment,type CylinderEquipmentRecord} from '../offline/loadouts-gas';
import type {EquipmentRecord,Stored} from '../offline/dive-planning';
/** Planning reads must never invoke the legacy ID-repair writer. Missing IDs stay visible. */
export async function readCylinderInventory(){
 const [cylinders,equipment]=await Promise.all([listLocalDiveRecords<CylinderEquipmentRecord>('cylinder'),listLocalDiveRecords<EquipmentRecord>('equipment')]);
 const ids=new Set(cylinders.map(row=>row.entityId));
 return [...cylinders.map(row=>({...row,recordStorageKind:'cylinder' as const})),...equipment.filter(isCylinderEquipment).filter(row=>!ids.has(row.entityId)).map(row=>({...row,recordStorageKind:'equipment' as const}) as Stored<CylinderEquipmentRecord>&{recordStorageKind:'equipment'})];
}
