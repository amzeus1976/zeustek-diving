import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,listLocalDiveRecords,saveLocalRecord} from '../lib/offline/dive-store';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
import {createDiveDraftFromPlan,loadOriginatingPlan} from '../lib/offline/dive-context';
import {deleteEquipmentSet,saveEquipment} from '../lib/offline/dive-planning';
import {applyReusableLoadout,cloneReusableLoadout,deriveCylinderCurrentState,listCylinderFills,listGasAnalyses,listReusableLoadouts,saveCylinderFill,saveGasAnalysis,saveReusableLoadout,type ReusableLoadoutRecord} from '../lib/offline/loadouts-gas';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('t05-test');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
describe('T05 canonical offline records and historical assignments',()=>{
  it('creates/edits/clones loadouts offline with compatible IDs and preserves unknown facts',async()=>{
    await saveLocalRecord('equipment-set',{entityId:'set',name:'Old set',equipmentIds:['mask'],notes:'Keep',futureFact:{keep:true}});
    await saveReusableLoadout({entityId:'set',name:'Updated',slots:{'personal.mask':'mask'},notes:'Edited'});
    const set=(await listReusableLoadouts())[0]!;await cloneReusableLoadout(set);
    zeustekDb.close();await zeustekDb.open();expect(await listReusableLoadouts()).toHaveLength(2);
    expect((await listReusableLoadouts()).find(row=>row.entityId==='set')).toMatchObject({futureFact:{keep:true},equipmentIds:['mask']});
    expect(await zeustekDb.outbox.count()).toBeGreaterThanOrEqual(3);expect(fetch).not.toHaveBeenCalled();
  });
  it('applies stable slot IDs and explicit overrides, retains immutable Plan provenance, and never rewrites Dive history',async()=>{
    await saveLocalRecord('equipment',{entityId:'mask',name:'Original mask',category:'Mask'});
    await saveLocalRecord('equipment',{entityId:'backup',name:'Backup mask',category:'Mask'});
    await saveLocalRecord('trip',{entityId:'plan',name:'Original Plan',siteId:'original-site',siteName:'Original site',notes:'Keep',startDate:'2026-10-01',futureFact:{keep:true}});
    await saveLocalRecord('dive-trip',{entityId:'expedition',name:'Separate Trip',planIds:['plan']});
    await saveLocalRecord('site-overhead-profile',{entityId:'overhead',siteId:'original-site',history:'Keep'});
    await saveReusableLoadout({name:'Loadout',slots:{'personal.mask':'mask'}});
    const set=(await listReusableLoadouts())[0]!;
    await applyReusableLoadout('trip','plan',set,{'personal.mask':'backup'});
    const draft=await createDiveDraftFromPlan('plan');await saveLocalRecord('dive',{...draft,entityId:'dive'});
    const before=(await listLocalDiveRecords('dive'))[0]!;
    expect(draft.equipmentIds).toEqual(['backup']);expect(draft.equipmentSetApplications?.[0]?.slots).toEqual({'personal.mask':'backup',camera_video:[],other:[]});
    await saveReusableLoadout({entityId:set.entityId,name:'Changed loadout',slots:{'personal.mask':'mask'}});
    await saveLocalRecord('equipment',{entityId:'backup',name:'Renamed equipment'});
    await saveLocalRecord('trip',{entityId:'plan',name:'Later Plan edit'});
    await deleteEquipmentSet(set.entityId);
    expect((await listLocalDiveRecords('dive'))[0]).toEqual(before);
    expect(await loadOriginatingPlan(draft as Parameters<typeof loadOriginatingPlan>[0])).toMatchObject({name:'Original Plan',equipmentIds:['backup']});
    expect(await listLocalDiveRecords('equipment')).toHaveLength(2);expect(await listLocalDiveRecords('dive-trip')).toHaveLength(1);expect(await listLocalDiveRecords('site-overhead-profile')).toHaveLength(1);
  });
  it('persists fill/analysis history, marks a newer fill stale, and retains both through backup',async()=>{
    await saveLocalRecord('equipment',{entityId:'cylinder',name:'Physical cylinder',category:'Cylinder',waterVolumeLiters:12,futureFact:'Keep'});
    const first=await saveCylinderFill({cylinderEquipmentId:'cylinder',filledAt:'2026-09-01T10:00:00Z',pressureBar:200,oxygenFraction:.32,heliumFraction:0,provider:'Test only',notes:'',source:'recorded'});
    await saveGasAnalysis({cylinderEquipmentId:'cylinder',fillId:first.id,analysedAt:'2026-09-01T10:10:00Z',oxygenFraction:.32,heliumFraction:0,analysedByPersonId:null,attachmentIds:['sticker'],notes:''});
    await saveCylinderFill({cylinderEquipmentId:'cylinder',filledAt:'2026-09-02T10:00:00Z',pressureBar:220,oxygenFraction:.21,heliumFraction:0,provider:'Test only',notes:'',source:'recorded'});
    const backup=await localBackupPayload();for(const table of zeustekDb.tables)await table.clear();await restoreLocalPayload(backup);
    const fills=await listCylinderFills(),analyses=await listGasAnalyses();expect(fills).toHaveLength(2);expect(analyses[0]?.attachmentIds).toEqual(['sticker']);
    expect(deriveCylinderCurrentState({waterVolumeLiters:12},fills,analyses).analysisState).toBe('stale');
    await saveEquipment({entityId:'cylinder',name:'Legacy editor change',category:'Cylinder',manufacturer:'',model:'',serialNumber:'',purchasedAt:'',lastServiceAt:'',nextServiceAt:'',notes:'',retired:false});
    expect((await listLocalDiveRecords('equipment'))[0]).toMatchObject({waterVolumeLiters:12,futureFact:'Keep'});expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects cross-cylinder or pre-fill analyses without creating evidence',async()=>{
    const fill=await saveCylinderFill({cylinderEquipmentId:'a',filledAt:'2026-09-01T10:00:00Z',pressureBar:200,oxygenFraction:.21,heliumFraction:0,provider:'',notes:'',source:'recorded'});
    const input={cylinderEquipmentId:'b',fillId:fill.id,analysedAt:'2026-09-01T10:10:00Z',oxygenFraction:.21,heliumFraction:0,analysedByPersonId:null,attachmentIds:[],notes:''};
    await expect(saveGasAnalysis(input)).rejects.toThrow('different cylinder');
    await expect(saveGasAnalysis({...input,cylinderEquipmentId:'a',analysedAt:'2026-09-01T09:00:00Z'})).rejects.toThrow('predate');
    expect(await listGasAnalyses()).toHaveLength(0);
  });
});
