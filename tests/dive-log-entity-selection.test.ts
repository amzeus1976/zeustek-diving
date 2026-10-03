import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {diveEntityChoices,chooseDiveEntity,type DiveEntitySelection} from '../lib/operators/dive-log-selection';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,cacheSavedRecord,saveLocalRecord} from '../lib/offline/dive-store';
import {saveOperator,deleteOperator,type OperatorRecord,type Stored} from '../lib/offline/dive-planning';
import {saveDive} from '../lib/offline/dives';
import {OPERATOR_DELETE_CONSTRAINT,operatorDeleteBindings} from '../lib/operators/operator-dependencies';

const entity=(id:string,type:OperatorRecord['operatorType'],name=id,active=true):Stored<OperatorRecord>=>({entityId:id,...(type?{operatorType:type}:{}),name,active,location:'Fixture port',website:'',notes:'',createdAt:'',modifiedAt:''});
describe('Dive Log selections use the canonical non-human entities',()=>{
 const rows=[entity('centre','dive-centre'),entity('resort','dive-resort'),entity('charter','charter-operator'),entity('boat','dive-boat'),entity('live','liveaboard'),entity('legacy-boat','charter-boat'),entity('unknown',undefined),entity('retired','dive-boat','Retired',false),entity('boat-2','dive-boat','boat')];
 it('offers organisations for operators and explicitly typed vessels for vessels',()=>{
  expect(diveEntityChoices(rows,'operator',{name:''}).map(x=>x.id)).toEqual(expect.arrayContaining(['centre','resort','charter','unknown']));
  expect(diveEntityChoices(rows,'operator',{name:''}).map(x=>x.id)).not.toContain('boat');
  expect(diveEntityChoices(rows,'vessel',{name:''}).map(x=>x.id).sort((a,b)=>(a??'').localeCompare(b??''))).toEqual(['boat','boat-2','legacy-boat','live']);
 });
 it('does not infer vessel types or merge two records because their names match',()=>{
  expect(diveEntityChoices([entity('untyped',undefined,'MV Example')],'vessel',{name:''})).toEqual([]);
  const matches=diveEntityChoices(rows,'vessel',{name:''}).filter(x=>x.name==='boat');expect(matches).toHaveLength(2);expect(new Set(matches.map(x=>x.value)).size).toBe(2);
 });
 it('preserves unlinked historical text without auto-matching or rewriting it',()=>{
  const selection={name:'centre'};const before=JSON.stringify(selection);const choices=diveEntityChoices(rows,'operator',selection);
  expect(choices.find(x=>x.value==='legacy')).toMatchObject({name:'centre',retained:true});expect(chooseDiveEntity('legacy',choices,selection)).toEqual(selection);expect(JSON.stringify(selection)).toBe(before);
 });
 it('retains inactive, reclassified and unavailable saved identities with their saved display text',()=>{
  for(const selection of [{id:'retired',name:'Retired at time of dive'},{id:'centre',name:'Previously a vessel'},{id:'gone',name:'Historical boat'}]){
   const choices=diveEntityChoices(rows,'vessel',selection);expect(choices.find(x=>x.value===`entity:${selection.id}`)).toMatchObject({id:selection.id,name:selection.name,retained:true});
   expect(chooseDiveEntity(`entity:${selection.id}`,choices,selection)).toEqual(selection);
  }
 });
 it('saves an explicitly selected identity plus its snapshot name, and clearing removes only that association',()=>{
  const previous:DiveEntitySelection={name:'Old manual entry'};const choices=diveEntityChoices(rows,'operator',previous);
  expect(chooseDiveEntity('entity:centre',choices,previous)).toEqual({id:'centre',name:'centre'});expect(chooseDiveEntity('',choices,previous)).toEqual({name:''});expect(()=>chooseDiveEntity('entity:missing',choices,previous)).toThrow(/unavailable/i);
 });
});

beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('dive-log-entities');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
describe('saved Dive Entity references stay safe',()=>{
 it('checks newly selected local IDs before any Dive write, while cache hydration does not require preloaded parents',async()=>{
  const before=JSON.stringify(await zeustekDb.entities.toArray());
  await expect(saveDive({site:'Fixture site',date:'2026-10-03',maxDepthM:10,bottomTimeMin:20,gas:'Air',notes:'',operatorId:'unavailable'})).rejects.toThrow(/unavailable/i);
  expect(JSON.stringify(await zeustekDb.entities.toArray())).toBe(before);
  await cacheSavedRecord('dive','historical-dive',{site:'Cached historical',operatorId:'historical-reference'});
  expect((await zeustekDb.entities.get('dive:dive-log-entities:historical-dive'))?.record).toMatchObject({operatorId:'historical-reference'});
  await saveLocalRecord('dive',{entityId:'historical-dive',notes:'An intentional note edit'});
  expect((await zeustekDb.entities.get('dive:dive-log-entities:historical-dive'))?.record).toMatchObject({operatorId:'historical-reference',notes:'An intentional note edit'});
 });
 it.each(['operatorId','vesselId'])('blocks local deletion of the exact %s without changing records',async field=>{
  const parent=await saveOperator({name:'Fixture entity',location:'Port',website:'',notes:''});await saveDive({site:'Fixture site',date:'2026-09-01',maxDepthM:10,bottomTimeMin:20,gas:'Air',notes:'',[field]:parent.id});
  const before=JSON.stringify(await zeustekDb.entities.toArray());await expect(deleteOperator(parent.id)).rejects.toThrow(/Dive record/i);expect(JSON.stringify(await zeustekDb.entities.toArray())).toBe(before);
 });
 it.each(['operatorId','vesselId'])('blocks a stale cloud deletion using %s only for the same owner',field=>{
  const db=new DatabaseSync(':memory:');try{
   db.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,data_json TEXT,deleted_at INTEGER)');const insert=db.prepare('INSERT INTO dive_records VALUES (?,?,?,?,NULL)');insert.run('entity','owner','operator','{}');insert.run('dive','owner','dive',JSON.stringify({[field]:'entity'}));
   const remove=db.prepare('UPDATE dive_records SET deleted_at=1 WHERE id=? AND user_id=?'+OPERATOR_DELETE_CONSTRAINT);expect(remove.run('entity','owner',...operatorDeleteBindings('owner','entity')).changes).toBe(0);
   db.prepare('UPDATE dive_records SET user_id=? WHERE id=?').run('other','dive');expect(remove.run('entity','owner',...operatorDeleteBindings('owner','entity')).changes).toBe(1);
  }finally{db.close();}
 });
});
