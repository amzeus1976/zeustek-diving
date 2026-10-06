import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,saveLocalRecord} from '../lib/offline/dive-store';
import {createDiveBackup,restoreDiveBackup} from '../lib/offline/cloud-platform';
import {createDiveDraftFromEnrichedPlan} from '../lib/offline/dive-planning-centre';
import {loadOriginatingPlan} from '../lib/offline/dive-context';
import {listDives} from '../lib/offline/dives';
import {packConditionsRecord} from '../lib/weather/conditions-storage';
import {planTextFromPlain} from '../lib/planning/formatted-text';

beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('backup-owner');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
const cloudRow=(id:string,kind:string,record:Record<string,unknown>)=>({id,kind,dataJson:JSON.stringify(packConditionsRecord(kind,record)),createdAt:100,updatedAt:200});
const restore=async(blob:Blob)=>{vi.stubGlobal('navigator',{onLine:false});return restoreDiveBackup(new File([await blob.text()],'fixture.backup'),'fixture passphrase');};

describe('Cloud-only packed rows in encrypted local backups',()=>{
 it('expands a cloud-only Dive and Plan before encrypted backup, preserving notes, formatting, weather and immutable provenance on another device',async()=>{
  const notes='x'.repeat(67000),weather={version:1,request:{date:'2026-10-10'},readings:Array.from({length:3000},(_,index)=>({id:'fixture-'+index,value:index,provenance:'Fixture only. '.repeat(20)}))};
  await saveLocalRecord('trip',{entityId:'cloud-plan',name:'Fixture Plan',notes,textFormatting:{notes:planTextFromPlain(notes)},conditions:{conditionsV1:weather}});
  const source=(await zeustekDb.entities.get('dive:backup-owner:cloud-plan'))!.record as Record<string,unknown>;
  const draft=await createDiveDraftFromEnrichedPlan('cloud-plan'),dive={...draft,entityId:'cloud-dive',site:'Fixture coast',date:'2026-10-10',maxDepthM:12,bottomTimeMin:38,gas:'Air',notes:draft.notes!};
  const rows=[cloudRow('cloud-plan','trip',source),cloudRow('cloud-dive','dive',dive)];expect(rows[1]!.dataJson).toContain('notesFromPlan');expect(rows[1]!.dataJson).toContain('planTextPacked');
  for(const table of zeustekDb.tables)await table.clear();vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('fetch',vi.fn(async()=>Response.json({records:rows})));
  const blob=await createDiveBackup('fixture passphrase');expect((await blob.text())).not.toContain(notes);
  expect(await restore(blob)).toMatchObject({restored:2,conflicts:0});
  const restored=(await listDives())[0]!;expect(restored.notes).toBe(dive.notes);expect(restored).not.toHaveProperty('notesFromPlan');
  expect(await loadOriginatingPlan(restored)).toMatchObject({notes,textFormatting:source.textFormatting,conditions:{conditionsV1:weather}});
  const restoredPlan=(await zeustekDb.entities.get('dive:backup-owner:cloud-plan'))!.record as Record<string,unknown>;expect(restoredPlan.conditions).toEqual(source.conditions);
 });
 it('keeps the local-only fallback complete and accurately labelled when any cloud-only packed row is corrupt',async()=>{
  await saveLocalRecord('trip',{entityId:'local-plan',name:'Local fixture',notes:'Keep exact'});
  const rows=[cloudRow('cloud-first','trip',{name:'Cloud fixture'}),{...cloudRow('bad','dive',{}),dataJson:JSON.stringify({notesFromPlan:{version:2,parts:[{field:'equipmentIds'}]}})}];
  vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('fetch',vi.fn(async()=>Response.json({records:rows})));
  const blob=await createDiveBackup('fixture passphrase');expect(JSON.parse(await blob.text()).coverage).not.toContain('Cloud records plus');
  for(const table of zeustekDb.tables)await table.clear();expect(await restore(blob)).toMatchObject({restored:1,conflicts:0});
  expect(await zeustekDb.entities.get('dive:backup-owner:local-plan')).toBeTruthy();expect(await zeustekDb.entities.get('dive:backup-owner:cloud-first')).toBeUndefined();expect(await zeustekDb.entities.get('dive:backup-owner:bad')).toBeUndefined();
 });
});
