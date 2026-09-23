import {describe,expect,it} from 'vitest';
import {loadoutDetailRows} from '../lib/gear/loadout-detail';
import type {ReusableLoadoutRecord} from '../lib/offline/loadouts-gas';
import type {EquipmentRecord,Stored} from '../lib/offline/dive-planning';
const set={entityId:'set-1',name:'Cold water',notes:'',equipmentIds:['mask','missing'],slots:{mask:'mask'},createdAt:'',modifiedAt:''} as Stored<ReusableLoadoutRecord>;
const gear=[{entityId:'mask',name:'My mask',category:'Mask',manufacturer:'Maker',model:'Clear'}] as Stored<EquipmentRecord>[];
describe('T14 read-only loadout source detail',()=>{
  it('resolves canonical item labels and retains missing historical references without writes',()=>{
    const before=structuredClone(set),rows=loadoutDetailRows(set,gear);
    expect(rows.find(row=>row.slot==='mask')?.items).toEqual([{id:'mask',label:'My mask · Maker · Clear',available:true}]);
    expect(rows.flatMap(row=>row.items).find(item=>item.id==='missing')).toMatchObject({available:false,label:'Unavailable saved item'});
    expect(set).toEqual(before);
  });
  it('keeps named custom slots and shows each canonical reference in its original slot',()=>{
    const rows=loadoutDetailRows({...set,equipmentIds:[],slots:{custom_tool:['mask','missing']}},gear);
    expect(rows.find(row=>row.slot==='custom_tool')).toMatchObject({label:'custom_tool',items:[{id:'mask'},{id:'missing'}]});
  });
});
