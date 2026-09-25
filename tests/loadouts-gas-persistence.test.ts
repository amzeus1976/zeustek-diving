import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,listLocalDiveRecords,saveLocalRecord} from '../lib/offline/dive-store';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
import {createDiveDraftFromPlan,loadOriginatingPlan} from '../lib/offline/dive-context';
import {deleteEquipmentSet,saveEquipment} from '../lib/offline/dive-planning';
import {applyReusableLoadout,cloneReusableLoadout,deriveCylinderCurrentState,deriveCylinderInspectionSchedule,listCylinderFills,listCylinderInventory,listGasAnalyses,listReusableLoadouts,recordCylinderGasUsage,saveCylinderFill,saveCylinderProfile,saveGasAnalysis,saveReusableLoadout} from '../lib/offline/loadouts-gas';
import {deriveCylinderInspectionDisplay} from '../lib/cylinders/inspection-display';
import {cylinderReadinessWarnings} from '../lib/offline/planning-pages';
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
  it('stores new physical cylinders in their own table while retaining legacy Equipment cylinders',async()=>{
    await saveCylinderProfile({entityId:'canonical-cylinder',name:'12L backgas',manufacturer:'Faber',serialNumber:'CYL-001',threadType:'M25 x 2',countryCode:'UK',cylinderMaterial:'Steel',waterVolumeLiters:12,emptyWeightKg:14.2,wallThicknessMm:4.1,workingPressureBar:232,testPressureBar:348,birthDate:'2024-02',hydroTestStamps:[{facility:'TEST',testedAt:'2025-08-01',stampMark:'TEST 25/08'}],visualInspection:{inspectedAt:'2026-01-01',dueAt:'2028-07-01',stickerColour:'Blue quadrant sticker'}});
    await saveLocalRecord('equipment',{entityId:'legacy-cylinder',name:'Legacy ali cylinder',category:'Cylinder',serialNumber:'LEG-1'});
    expect(await listLocalDiveRecords('cylinder')).toHaveLength(1);
    const inventory=await listCylinderInventory();
    expect(inventory.map((item)=>[item.entityId,item.recordStorageKind])).toEqual(expect.arrayContaining([['canonical-cylinder','cylinder'],['legacy-cylinder','equipment']]));
    expect(inventory.find((item)=>item.entityId==='canonical-cylinder')).toMatchObject({threadType:'M25 x 2',testPressureBar:348,visualInspection:{stickerColour:'Blue quadrant sticker'}});
    expect(await listLocalDiveRecords('equipment')).toHaveLength(1);
  });
  it('records pressure used or remaining without losing the current fill analysis provenance',async()=>{
    const fill=await saveCylinderFill({cylinderEquipmentId:'usage-cylinder',filledAt:'2026-09-01T10:00:00Z',pressureBar:232,oxygenFraction:.32,heliumFraction:0,provider:'Test fill',notes:'',source:'recorded'});
    await saveGasAnalysis({cylinderEquipmentId:'usage-cylinder',fillId:fill.id,analysedAt:'2026-09-01T10:05:00Z',oxygenFraction:.32,heliumFraction:0,analysedByPersonId:null,attachmentIds:[],notes:''});
    await recordCylinderGasUsage({cylinderEquipmentId:'usage-cylinder',recordedAt:'2026-09-01T12:00:00Z',pressureUsedBar:82,notes:'Dive use'});
    let state=deriveCylinderCurrentState({waterVolumeLiters:12},await listCylinderFills(),await listGasAnalyses());
    expect(state.latestFill).toMatchObject({pressureBar:150,eventType:'usage',pressureUsedBar:82,originFillId:fill.id});
    expect(state.analysisState).toBe('current');
    await recordCylinderGasUsage({cylinderEquipmentId:'usage-cylinder',recordedAt:'2026-09-01T13:00:00Z',remainingPressureBar:100,notes:'Gauge reading'});
    state=deriveCylinderCurrentState({waterVolumeLiters:12},await listCylinderFills(),await listGasAnalyses());
    expect(state.latestFill).toMatchObject({pressureBar:100,eventType:'adjustment',pressureUsedBar:50,originFillId:fill.id});
    expect(state.analysisState).toBe('current');
  });
  it('assigns a separate incrementing cylinder ID and derives the alternating month-only test cycle',async()=>{
    await saveCylinderProfile({name:'First cylinder',serialNumber:'SERIAL-A',valveType:'DIN',lastTestType:'hydro',lastTestAt:'2026-02'});
    await saveCylinderProfile({name:'Second cylinder',serialNumber:'SERIAL-B',valveType:'A-CLAMP',lastTestType:'visual',lastTestAt:'2028-08'});
    const inventory=(await listCylinderInventory()).sort((left,right)=>String(left.cylinderNumber).localeCompare(String(right.cylinderNumber)));
    expect(inventory.map((item)=>[item.cylinderNumber,item.serialNumber,item.valveType])).toEqual([['01','SERIAL-A','DIN'],['02','SERIAL-B','A-CLAMP']]);
    expect(inventory[0]).toMatchObject({lastTestType:'hydro',lastTestAt:'2026-02',hydroDueAt:'2031-02',visualDueAt:'2028-08'});
    expect(inventory[1]).toMatchObject({lastTestType:'visual',lastTestAt:'2028-08',hydroDueAt:null,visualDueAt:'2031-02'});
    expect(deriveCylinderInspectionSchedule({hydroTestAt:'2026-02',visualTestAt:'2028-08'})).toEqual({latestHydro:'2026-02',latestVisualQualifyingTest:'2028-08',hydroDueAt:'2031-02',visualDueAt:'2031-02'});
  });
  it('makes hydro the next test 30 months after a visual without inventing a previous hydro',async()=>{
    const saved=await saveCylinderProfile({name:'Visual-only cylinder',lastTestType:'visual',lastTestAt:'2024-10'});
    const cylinder=(await listCylinderInventory()).find((item)=>item.entityId===saved.id)!;
    expect(cylinder).toMatchObject({lastTestType:'visual',lastTestAt:'2024-10',hydroTestAt:null,hydroDueAt:null,visualDueAt:'2027-04'});
    expect(deriveCylinderInspectionDisplay(cylinder)).toMatchObject({nextHydroAt:'2027-04',nextTestType:'hydro',hydroEvidenceKnown:false});
    expect(cylinderReadinessWarnings(cylinder,null,'2026-09-25T00:00:00Z')).toContain('Cylinder hydro test date/due date is missing.');
    expect(deriveCylinderInspectionDisplay({hydroTestAt:'2024-01',visualTestAt:'2028-01',lastTestType:'visual',lastTestAt:'2028-01'})).toMatchObject({latestHydro:'2024-01',nextHydroAt:'2029-01',visualDueAt:'2030-07',hydroEvidenceKnown:true});
  });
  it('uses the unoccupied ID 02 for a new cylinder without changing existing IDs',async()=>{
    await saveLocalRecord('equipment',{entityId:'first-cylinder',name:'First',category:'Cylinder',cylinderNumber:'01'});
    await saveLocalRecord('cylinder',{entityId:'third-cylinder',name:'Third',category:'Cylinder',cylinderNumber:'03'});
    const created=await saveCylinderProfile({name:'New second cylinder',serialNumber:'NEW-SECOND'});
    const inventory=await listCylinderInventory();
    expect(inventory.find((item)=>item.entityId===created.id)?.cylinderNumber).toBe('02');
    expect(inventory.map((item)=>[item.entityId,item.cylinderNumber])).toEqual(expect.arrayContaining([
      ['first-cylinder','01'],['third-cylinder','03'],[created.id,'02'],
    ]));
  });
  it('keeps a two-digit cylinder ID stable on edit and never reuses a retired cylinder ID',async()=>{
    const first=await saveCylinderProfile({name:'First cylinder',serialNumber:'SERIAL-A'});
    const second=await saveCylinderProfile({name:'Second cylinder',serialNumber:'SERIAL-B'});
    await saveCylinderProfile({entityId:first.id,name:'First cylinder retired',serialNumber:'SERIAL-A',cylinderNumber:'99',cylinderStatus:'retired',retired:true});
    const third=await saveCylinderProfile({name:'Third cylinder',serialNumber:'SERIAL-C'});
    const inventory=(await listCylinderInventory()).sort((left,right)=>String(left.cylinderNumber).localeCompare(String(right.cylinderNumber)));
    expect(inventory.map((item)=>[item.entityId,item.cylinderNumber])).toEqual([
      [first.id,'01'],
      [second.id,'02'],
      [third.id,'03'],
    ]);
  });
  it('assigns permanent two-digit IDs to pre-existing cylinder records that do not have one',async()=>{
    await saveLocalRecord('cylinder',{entityId:'legacy-missing',name:'Legacy missing ID',category:'Cylinder',serialNumber:'LEGACY-A'});
    await saveLocalRecord('equipment',{entityId:'legacy-one-digit',name:'Legacy 12L cylinder',category:'Cylinder',cylinderNumber:'2',serialNumber:'LEGACY-B'});
    const firstRead=(await listCylinderInventory()).sort((left,right)=>left.entityId.localeCompare(right.entityId));
    expect(firstRead.map((item)=>[item.entityId,item.cylinderNumber])).toEqual([
      ['legacy-missing','01'],
      ['legacy-one-digit','02'],
    ]);
    zeustekDb.close();await zeustekDb.open();
    const reopened=(await listCylinderInventory()).sort((left,right)=>left.entityId.localeCompare(right.entityId));
    expect(reopened.map((item)=>[item.entityId,item.cylinderNumber])).toEqual([
      ['legacy-missing','01'],
      ['legacy-one-digit','02'],
    ]);
  });
  it('rejects cross-cylinder or pre-fill analyses without creating evidence',async()=>{
    const fill=await saveCylinderFill({cylinderEquipmentId:'a',filledAt:'2026-09-01T10:00:00Z',pressureBar:200,oxygenFraction:.21,heliumFraction:0,provider:'',notes:'',source:'recorded'});
    const input={cylinderEquipmentId:'b',fillId:fill.id,analysedAt:'2026-09-01T10:10:00Z',oxygenFraction:.21,heliumFraction:0,analysedByPersonId:null,attachmentIds:[],notes:''};
    await expect(saveGasAnalysis(input)).rejects.toThrow('different cylinder');
    await expect(saveGasAnalysis({...input,cylinderEquipmentId:'a',analysedAt:'2026-09-01T09:00:00Z'})).rejects.toThrow('predate');
    expect(await listGasAnalyses()).toHaveLength(0);
  });
});
