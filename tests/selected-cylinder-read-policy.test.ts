import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,saveLocalRecord,listLocalDiveRecords} from '../lib/offline/dive-store';
import {listCylinderInventory,saveCylinderProfile} from '../lib/offline/loadouts-gas';
import {saveReviewedCylinderNumber} from '../lib/cylinders/cylinder-number-persistence';

beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('read-policy-fixture');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
describe('explicit cylinder numbering instead of inventory repair',()=>{
 it('leaves duplicate, missing, invalid and one-digit labels byte-identical during repeated reads',async()=>{
  for(const [entityId,cylinderNumber] of [['a','03'],['b','3'],['c',null],['d','100']] as const)await saveLocalRecord('cylinder',{entityId,name:entityId,cylinderNumber,serialNumber:`fixture-${entityId}`});
  await saveLocalRecord('equipment',{entityId:'legacy',category:'Cylinder',name:'Legacy tank',cylinderNumber:'2'});
  const before=await zeustekDb.entities.toArray(),outbox=await zeustekDb.outbox.toArray(),pending=await zeustekDb.settings.where('key').startsWith('pending:').toArray();
  expect(await listCylinderInventory()).toHaveLength(5);await listCylinderInventory();
  expect(await zeustekDb.entities.toArray()).toEqual(before);expect(await zeustekDb.outbox.toArray()).toEqual(outbox);expect(await zeustekDb.settings.where('key').startsWith('pending:').toArray()).toEqual(pending);expect(fetch).not.toHaveBeenCalled();
 });
 it('reuses the first gap for explicit new saves, including concurrent saves, without renumbering existing tanks',async()=>{
  await saveLocalRecord('cylinder',{entityId:'one',name:'One',cylinderNumber:'01'});await saveLocalRecord('cylinder',{entityId:'three',name:'Three',cylinderNumber:'03'});
  await Promise.all([saveCylinderProfile({entityId:'new-a',name:'New A'}),saveCylinderProfile({entityId:'new-b',name:'New B'})]);
  const rows=await listCylinderInventory();expect(rows.find(row=>row.entityId==='three')?.cylinderNumber).toBe('03');expect(rows.filter(row=>row.entityId.startsWith('new-')).map(row=>row.cylinderNumber).sort((a,b)=>(a??'').localeCompare(b??''))).toEqual(['02','04']);
 });
 it('recovers the explicit-save queue after a rejected input',async()=>{
  await expect(saveCylinderProfile({name:''})).rejects.toThrow('name');await saveCylinderProfile({entityId:'valid',name:'Valid'});expect((await listCylinderInventory())[0]?.cylinderNumber).toBe('01');
 });
 it('changes only the reviewed label offline, preserving all canonical references and unknown fields',async()=>{
  await saveLocalRecord('equipment',{entityId:'legacy',name:'Legacy tank',category:'Cylinder',cylinderNumber:'03',futureFact:{keep:true}});
  for(const kind of ['cylinder-fill','gas-analysis','trip'])await saveLocalRecord(kind,{entityId:kind,cylinderEquipmentId:'legacy',cylinderId:'legacy'});
  const row=(await listCylinderInventory())[0]!,dependencies=await zeustekDb.entities.filter(item=>item.entityType!=='equipment').toArray();
  await saveReviewedCylinderNumber({entityId:row.entityId,recordStorageKind:'equipment',expectedNumber:'03',expectedModifiedAt:row.modifiedAt,requestedNumber:'02'});
  expect((await listLocalDiveRecords('equipment'))[0]).toMatchObject({entityId:'legacy',cylinderNumber:'02',futureFact:{keep:true}});expect(await zeustekDb.entities.filter(item=>item.entityType!=='equipment').toArray()).toEqual(dependencies);
  await expect(saveReviewedCylinderNumber({entityId:'legacy',recordStorageKind:'equipment',expectedNumber:'03',expectedModifiedAt:row.modifiedAt,requestedNumber:'04'})).rejects.toThrow('changed');
 });
});
