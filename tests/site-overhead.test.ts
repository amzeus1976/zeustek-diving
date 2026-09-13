import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,listLocalDiveRecords,saveLocalRecord} from '../lib/offline/dive-store';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
import {DIVE_RECORD_KINDS,recordIdentity} from '../lib/record-identity';
import {OVERHEAD_KIND,listOverheadProfiles,overheadLink,removeOverheadProfile,saveOverheadProfile,validateOverheadProfile,type SiteOverheadProfile} from '../lib/offline/site-overhead';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('overhead-test');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
const base:SiteOverheadProfile={siteId:'legacy-site-id',featureType:'Wreck',depthMinM:18,depthMaxM:34};
describe('optional canonical Site overhead profile',()=>{
  it('registers a child kind/natural key and extensible Draft2020 schema without a new Site store',()=>{
    expect(DIVE_RECORD_KINDS).toContain(OVERHEAD_KIND);expect(recordIdentity(OVERHEAD_KIND,base)).toBe(base.siteId);
    const schema=JSON.parse(readFileSync(new URL('../lib/schemas/dive.site_overhead_profile.schema.json',import.meta.url),'utf8'));
    const validate=new Ajv2020({validateFormats:false}).compile(schema);expect(validate({...base,futureFact:{retain:true}})).toBe(true);expect(validate({notes:'Missing site'})).toBe(false);expect(validate({...base,depthMinM:-1})).toBe(false);
  });
  it('keeps ordinary Sites unchanged, saves/edits/reopens offline, preserves unknown fields/history and backups',async()=>{
    await saveLocalRecord('site',{entityId:base.siteId,name:'Original wreck',hazards:'Existing hazard',history:'Stable identity'});
    const original=(await listLocalDiveRecords('site'))[0];
    const saved=await saveOverheadProfile({...base,futureFact:{keep:true},hazards:[{id:'hazard',label:'Silt',future:'retain'}]});
    const p=(await listOverheadProfiles())[0]!;await saveOverheadProfile({...p,notes:'Updated'});
    expect((await listOverheadProfiles())[0]).toMatchObject({entityId:saved.id,futureFact:{keep:true},hazards:[{future:'retain'}]});
    expect((await listLocalDiveRecords('site'))[0]).toEqual(original);expect(await zeustekDb.events.where('entityId').equals(`dive:overhead-test:${saved.id}`).count()).toBe(2);
    const backup=await localBackupPayload();for(const table of zeustekDb.tables)await table.clear();await restoreLocalPayload(backup);zeustekDb.close();await zeustekDb.open();expect(await listOverheadProfiles()).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();configureDiveStore('other');expect(await listOverheadProfiles()).toHaveLength(0);
  });
  it('rejects duplicate profiles including concurrent creation rather than overwriting another child',async()=>{
    await saveLocalRecord('site',{entityId:base.siteId,name:'Original'});
    const results=await Promise.all([saveOverheadProfile({...base}),saveOverheadProfile({...base})]);expect(new Set(results.map(r=>r.id)).size).toBe(1);expect(await listOverheadProfiles()).toHaveLength(1);
    await expect(saveOverheadProfile({...base})).rejects.toThrow('matching record');
  });
  it('rejects missing/wrong Site, invalid depth/dates/zones/new Dive links and immutable Site reassignment',async()=>{
    await expect(saveOverheadProfile(base)).rejects.toThrow('unavailable');await saveLocalRecord('person',{entityId:base.siteId,name:'Not a Site'});await expect(saveOverheadProfile(base)).rejects.toThrow('unavailable');
    for(const patch of [{depthMinM:35},{depthMinM:NaN},{siteId:' bad '},{hazards:[{id:'h',label:'',zone:'exterior'}]},{observations:[{id:'o',date:'2026-02-30',notes:'Notes'}]}])expect(()=>validateOverheadProfile({...base,...patch} as SiteOverheadProfile)).toThrow();
    await saveLocalRecord('site',{entityId:'actual-site',name:'Original'});await expect(saveOverheadProfile({...base,siteId:'actual-site',observations:[{id:'o',date:'2026-09-13',notes:'Recorded',diveId:'missing'}]})).rejects.toThrow('Dive is unavailable');
    const saved=await saveOverheadProfile({...base,siteId:'actual-site'});await expect(saveOverheadProfile({...base,entityId:saved.id})).rejects.toThrow('different Site');
  });
  it('keeps dated observations/canonical Dive/media refs separate from stable Site history; removal affects child only',async()=>{
    await saveLocalRecord('site',{entityId:base.siteId,name:'Original',history:'Stable'});await saveLocalRecord('dive',{entityId:'legacy-dive',date:'2026-09-13',notes:'Original dive notes'});
    const before=await listLocalDiveRecords('dive');const saved=await saveOverheadProfile({...base,attachmentIds:['original-asset'],observations:[{id:'o',date:'2026-09-13',observer:'Gemma',notes:'Conditions changed',diveId:'legacy-dive'}]});
    expect((await listOverheadProfiles())[0]).toMatchObject({observations:[{diveId:'legacy-dive'}],attachmentIds:['original-asset']});expect(await listLocalDiveRecords('dive')).toEqual(before);expect(await zeustekDb.attachmentChunks.count()).toBe(0);
    await removeOverheadProfile(saved.id);expect(await listOverheadProfiles()).toHaveLength(0);expect(await listLocalDiveRecords('site')).toHaveLength(1);expect(await listLocalDiveRecords('dive')).toEqual(before);
  });
  it('retains unchanged unavailable legacy references on edit and canonical deep links',async()=>{
    await saveLocalRecord(OVERHEAD_KIND,{...base,entityId:'old-child',observations:[{id:'old-o',date:'2026-09-12',notes:'Historical',diveId:'missing-dive'}]});const p=(await listOverheadProfiles())[0]!;await saveOverheadProfile({...p,notes:'Offline edit'});expect((await listOverheadProfiles())[0]?.observations?.[0]?.diveId).toBe('missing-dive');expect(overheadLink('old id')).toBe('/?section=Sites&siteId=old%20id&view=overhead');
  });
});
