import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, readDiveConflict, resolveDiveConflict } from '../lib/offline/dive-store';

const key='pending:dive:review-owner:fixture-event';
const original={id:'fixture-event',kind:'equipment-event',record:{title:'Device service',modifiedAt:'2026-10-03T10:00:00Z'},baseModifiedAt:'2026-10-02T10:00:00Z',token:'fixture-revision',state:'conflict'};
beforeEach(async()=>{
  vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});configureDiveStore('review-owner');
  await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();
  await zeustekDb.settings.put({key,value:original});
});
afterEach(()=>vi.unstubAllGlobals());
describe('reviewed version and account boundaries',()=>{
  it('discards a comparison when the signed-in account changes while its cloud body is read',async()=>{
    vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>{configureDiveStore('different-owner');return {items:[{id:'fixture-event',title:'Private cloud service'}]};}})));
    await expect(readDiveConflict(key)).rejects.toThrow(/account changed/i);
    expect((await zeustekDb.settings.get(key))?.value).toEqual(original);
  });
  it('requires another review when the cloud revision changed after the displayed preview',async()=>{
    const reviewed={id:'fixture-event',title:'Reviewed cloud service',modifiedAt:'2026-10-03T10:00:00Z'};
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({items:[{...reviewed,title:'A newer cloud edit',modifiedAt:'2026-10-03T11:00:00Z'}]})));
    await expect(resolveDiveConflict(key,'fixture-revision','local',reviewed)).rejects.toThrow(/cloud.*changed|reopen/i);
    expect((await zeustekDb.settings.get(key))?.value).toEqual(original);
    expect(await zeustekDb.settings.where('key').startsWith('conflict-archive:').count()).toBe(0);
  });
  it('preserves the local/cloud archive when the exact reviewed revision is explicitly accepted',async()=>{
    const reviewed={id:'fixture-event',title:'Reviewed cloud service',modifiedAt:'2026-10-03T10:00:00Z'};
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({items:[reviewed]})));
    await resolveDiveConflict(key,'fixture-revision','local',reviewed);
    expect((await zeustekDb.settings.get(key))?.value).toMatchObject({state:'pending',record:original.record,baseModifiedAt:reviewed.modifiedAt});
    expect((await zeustekDb.settings.get('conflict-archive:dive:review-owner:fixture-event:fixture-revision'))?.value).toMatchObject({pending:original,cloud:reviewed,choice:'local'});
  });
});
