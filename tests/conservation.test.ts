import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,saveLocalRecord,listLocalDiveRecords} from '../lib/offline/dive-store';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
import {ACTIVITY_TYPES,CONSERVATION_KIND,PROGRAMME_KIND,captureProgramme,conservationLink,conservationSummary,listConservation,listProgrammes,programmeProgress,removeConservation,saveConservation,validateActivity,type ConservationActivity,type ProgrammeReference} from '../lib/offline/conservation';
import {DIVE_RECORD_KINDS} from '../lib/record-identity';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const ids={activity:'10000000-0000-4000-8000-000000000001',site:'10000000-0000-4000-8000-000000000002',dive:'10000000-0000-4000-8000-000000000003',person:'10000000-0000-4000-8000-000000000004',asset:'10000000-0000-4000-8000-000000000005'};
const base={activityType:'marine-life' as const,occurredAt:'2026-09-12T10:00:00Z',speciesOrSubject:'Turtle',notes:'Observed, not independently verified'};
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('conservation-test');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
describe('shared conservation records',()=>{
  it('accepts the namespaced schema and registers additive kinds without a new database',()=>{
    const schema=JSON.parse(readFileSync(new URL('../lib/schemas/dive.conservation_activity.schema.json',import.meta.url),'utf8'));
    const ajv=new Ajv2020({validateFormats:false});const validate=ajv.compile(schema);
    expect(validate({...base,futureField:{retain:true}})).toBe(true);expect(validate({activityType:'other'})).toBe(false);
    expect(DIVE_RECORD_KINDS).toContain(CONSERVATION_KIND);expect(DIVE_RECORD_KINDS).toContain(PROGRAMME_KIND);
  });
  it('records every activity type offline, keeps optional historical/unknown fields, and survives reopen/backup',async()=>{
    for(const [activityType]of ACTIVITY_TYPES)await saveConservation({...base,activityType});
    expect(await listConservation()).toHaveLength(7);expect(fetch).not.toHaveBeenCalled();
    const activity=(await listConservation())[0]!;
    await saveLocalRecord(CONSERVATION_KIND,{entityId:activity.entityId,futureField:{keep:'yes'},debris:{operation:'survey',massKg:2,futureDebris:'keep'}});
    await saveConservation({...activity,notes:'Later notes'});
    expect((await listConservation()).find(a=>a.entityId===activity.entityId)).toMatchObject({futureField:{keep:'yes'},debris:{futureDebris:'keep'}});
    const backup=await localBackupPayload();for(const table of zeustekDb.tables)await table.clear();await restoreLocalPayload(backup);
    await zeustekDb.close();await zeustekDb.open();expect(await listConservation()).toHaveLength(7);expect(fetch).not.toHaveBeenCalled();
    configureDiveStore('other-account');expect(await listConservation()).toHaveLength(0);
  });
  it('links canonical Dive/Site/Person/media IDs without copying or mutating their records',async()=>{
    for(const [entityId,kind]of [[ids.site,'site'],[ids.dive,'dive'],[ids.person,'person']])await saveLocalRecord(kind!,{entityId:entityId!,name:'Existing original'});
    const originals=(await zeustekDb.entities.toArray()).map(r=>r.record);
    await saveConservation({...base,siteId:ids.site,diveId:ids.dive,participantPersonIds:[ids.person],attachmentIds:[ids.asset]});
    const activity=(await listConservation())[0]!;
    expect(activity).toMatchObject({siteId:ids.site,diveId:ids.dive,participantPersonIds:[ids.person],attachmentIds:[ids.asset]});
    expect(await zeustekDb.entities.count()).toBe(4);expect(await zeustekDb.attachmentChunks.count()).toBe(0);
    await removeConservation(activity.entityId);
    expect(await listConservation()).toHaveLength(0);
    expect((await zeustekDb.entities.toArray()).filter(r=>r.entityType!==CONSERVATION_KIND).map(r=>r.record)).toEqual(originals);
    expect(await zeustekDb.events.where('entityId').equals(`dive:conservation-test:${activity.entityId}`).count()).toBe(2);
  });
  it('validates dates, numeric debris, opaque ref syntax and missing/deleted/wrong-kind records before writing',async()=>{
    for(const bad of [{occurredAt:'not-date'},{occurredAt:'2026-02-30T10:00:00Z'},{activityType:'fake'},{siteId:' invalid reference '},{debris:{operation:'removal',massKg:-1}},{debris:{operation:'survey',count:1.5}}])expect(()=>validateActivity({...base,...bad} as never)).toThrow();
    await expect(saveConservation({...base,siteId:ids.site})).rejects.toThrow('unavailable');
    await saveLocalRecord('person',{entityId:ids.site,name:'Wrong kind'});
    await expect(saveConservation({...base,siteId:ids.site})).rejects.toThrow('unavailable');
    await expect(saveConservation({...base,entityId:ids.activity})).rejects.toThrow('Load this activity');
    expect(await listConservation()).toHaveLength(0);
  });
  it('persists no Dive, oldest/latest legacy Dive IDs, exact duplicate-date selection, edits and clear without creating Dives',async()=>{
    const dives=[
      {entityId:'legacy-oldest',date:'2025-01-02',timeIn:'09:00',site:'Same Site',diveNumber:1},
      {entityId:'legacy-same-a',date:'2026-09-05',timeIn:'11:58',site:'St Abbs Harbour – East',diveNumber:64},
      {entityId:'legacy-same-b',date:'2026-09-05',timeIn:'14:10',site:'St Abbs Harbour – East',diveNumber:65},
      {entityId:'legacy-latest',date:'2026-09-12',timeIn:'16:45',site:'Latest Site',diveNumber:66},
    ];
    for(const dive of dives)await saveLocalRecord('dive',dive);
    const noLink=await saveConservation({...base,speciesOrSubject:'No Dive',diveId:null});
    expect((await listConservation()).find(item=>item.entityId===noLink.id)?.diveId).toBeNull();
    const oldest=await saveConservation({...base,speciesOrSubject:'Oldest',diveId:'legacy-oldest'});
    const latest=await saveConservation({...base,speciesOrSubject:'Latest',diveId:'legacy-latest'});
    expect((await listConservation()).find(item=>item.entityId===oldest.id)?.diveId).toBe('legacy-oldest');
    expect((await listConservation()).find(item=>item.entityId===latest.id)?.diveId).toBe('legacy-latest');
    const duplicate=await saveConservation({...base,speciesOrSubject:'Exact duplicate-date choice',diveId:'legacy-same-b'});
    expect((await listConservation()).find(item=>item.entityId===duplicate.id)?.diveId).toBe('legacy-same-b');
    const reopened=(await listConservation()).find(item=>item.entityId===latest.id)!;
    await saveConservation({...reopened,diveId:'legacy-oldest'});
    expect((await listConservation()).find(item=>item.entityId===latest.id)?.diveId).toBe('legacy-oldest');
    await saveConservation({...reopened,diveId:null});
    expect((await listConservation()).find(item=>item.entityId===latest.id)?.diveId).toBeNull();
    await expect(saveConservation({...base,diveId:'unresolved-dive'})).rejects.toThrow('unavailable');
    expect(await listLocalDiveRecords('dive')).toHaveLength(4);
    await zeustekDb.close();await zeustekDb.open();
    expect((await listConservation()).find(item=>item.entityId===duplicate.id)?.diveId).toBe('legacy-same-b');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('retains an unchanged unavailable historical reference without fabricating a new Site',async()=>{
    await saveLocalRecord(CONSERVATION_KIND,{...base,entityId:ids.activity,siteId:ids.site,participantPersonIds:[ids.person],attachmentIds:[ids.asset],futureField:'keep'});
    await saveConservation({...base,entityId:ids.activity,siteId:ids.site,participantPersonIds:[ids.person],notes:'Edited offline'});
    expect((await listConservation())[0]).toMatchObject({siteId:ids.site,attachmentIds:[ids.asset],futureField:'keep'});
    expect(await listLocalDiveRecords('site')).toHaveLength(0);
  });
  it('separates surveys/removals, flags unknown mass and counts unique observation subjects/Dives',()=>{
    const activities=[
      {...base,entityId:ids.activity,diveId:ids.dive},{...base,entityId:ids.site,diveId:ids.dive,speciesOrSubject:' turtle '},
      {...base,entityId:ids.person,activityType:'learning',speciesOrSubject:'Shark course'},
      {...base,entityId:ids.asset,activityType:'debris',debris:{operation:'survey',massKg:100,count:50}},
      {...base,entityId:'a',activityType:'debris',debris:{operation:'removal',massKg:2.5,count:3}},
      {...base,entityId:'b',activityType:'debris',debris:{operation:'removal',massKg:null,count:null}},
    ] as ConservationActivity[];
    expect(conservationSummary(activities,10)).toMatchObject({activities:6,observations:2,subjects:1,observationDives:1,totalDives:10,removedMassKg:2.5,removedItems:3,unknownMass:1});
    expect(conservationSummary([],0).removedMassKg).toBe(0);
  });
  it('captures new sourced programme versions, retains old links and derives progress without certification writes',async()=>{
    const definition={agency:'Local project',pathwayKey:'Debris evidence',versionLabel:'v1',effectiveFrom:null,sourceCitation:'Owner captured requirement, 2026-09-12',requirements:[{key:'actions',label:'Record one debris action',kind:'count' as const,rule:{activityType:'debris' as const,target:1}}]};
    const first=await captureProgramme(definition);const refs=await listProgrammes();
    await saveConservation({...base,activityType:'debris',programmeVersionId:first.id});
    expect(programmeProgress(refs[0]!,await listConservation())[0]?.state).toBe('satisfied');
    await captureProgramme({...definition,versionLabel:'v2',requirements:[{...definition.requirements[0]!,rule:{activityType:'debris',target:2}}]});
    const latest=await listProgrammes();expect(latest).toHaveLength(2);expect(latest.find(p=>p.entityId===first.id)?.requirements[0]?.rule.target).toBe(1);
    expect(programmeProgress(latest.find(p=>p.entityId!==first.id)!,await listConservation())[0]).toMatchObject({count:0,state:'not_satisfied'});
    await expect(captureProgramme(definition)).rejects.toThrow('already exists');
    expect(await listLocalDiveRecords('certification')).toHaveLength(0);
    expect(programmeProgress({entityId:'bad',requirements:[{label:'Unknown',rule:{target:0}}]} as ProgrammeReference,[])[0]?.state).toBe('unknown');
  });
  it('uses canonical existing-record routes, not separate conservation copies',()=>{
    expect(conservationLink('Logbook',ids.dive)).toBe(`/?section=Logbook&diveId=${ids.dive}`);
    expect(conservationLink('Sites',ids.site)).toBe(`/?section=Sites&siteId=${ids.site}`);
    expect(conservationLink('People',ids.person)).toBe(`/?section=People&personId=${ids.person}`);
  });
});
