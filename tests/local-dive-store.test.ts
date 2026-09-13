import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, saveLocalRecord, listLocalDiveRecords, deleteLocalRecord, flushDiveChanges, pendingDiveChanges } from '../lib/offline/dive-store';
import { localBackupPayload, restoreLocalPayload } from '../lib/offline/local-backup';
import { storeDiveImage } from '../lib/offline/dive-images';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  configureDiveStore('test-account');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('offline dive records', () => {
  it('includes and restores both sides of archived conflict reviews',async()=>{
    const key='conflict-archive:dive:test-account:example:review';
    await zeustekDb.settings.put({key,value:{local:{name:'Local'},cloud:{name:'Cloud'},choice:'local'}});
    const backup=await localBackupPayload();await zeustekDb.settings.delete(key);
    await restoreLocalPayload(backup);
    expect((await zeustekDb.settings.get(key))?.value).toEqual({local:{name:'Local'},cloud:{name:'Cloud'},choice:'local'});
  });
  it('retains a newer edit when an older in-flight save returns a conflict',async()=>{
    const item=await saveLocalRecord('operator',{name:'Original',location:'Test'});
    let respond!:(value:Response)=>void;
    let started!:()=>void; const requestStarted=new Promise<void>(resolve=>{started=resolve;});
    vi.stubGlobal('fetch',vi.fn((_url,options)=>options?.method==='POST'?new Promise<Response>(resolve=>{respond=resolve;started();}):Promise.resolve(Response.json({items:[]}))));
    vi.stubGlobal('navigator',{onLine:true});
    const flushing=flushDiveChanges();await requestStarted;
    await saveLocalRecord('operator',{entityId:item.id,name:'Newer local edit',location:'Test'});
    respond(Response.json({error:'Stale revision'},{status:409}));await flushing;
    const pending=(await pendingDiveChanges())[0]?.value as {record:{name:string};state:string};
    expect(pending.record.name).toBe('Newer local edit');expect(pending.state).toBe('conflict');
  });
  it('saves, reads and queues locally without a network request', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    await saveLocalRecord('operator', {name:'Test dive centre',location:'Test location'});
    expect(await listLocalDiveRecords('operator')).toHaveLength(1);
    expect(await zeustekDb.events.count()).toBe(1);
    expect(await zeustekDb.settings.where('key').startsWith('pending:dive:test-account:').count()).toBe(1);
    expect(network).not.toHaveBeenCalled();
  });
  it('never waits for the cloud when an uncached related list is empty',async()=>{
    vi.stubGlobal('navigator',{onLine:true});
    vi.stubGlobal('fetch',()=>new Promise(()=>{}));
    const result=await Promise.race([listLocalDiveRecords('trip'),new Promise(resolve=>setTimeout(()=>resolve('blocked'),200))]);
    expect(result).toEqual([]);
  });
  it('preserves deletions in immutable history and excludes them from lists', async () => {
    const record = await saveLocalRecord('operator', {name:'Recoverable',location:'Test location'});
    await deleteLocalRecord(record.id);
    expect(await listLocalDiveRecords('operator')).toEqual([]);
    expect(await zeustekDb.events.count()).toBe(2);
    expect((await zeustekDb.entities.toArray())[0]?.deleted).toBe(1);
  });
  it('gives concurrent mutations unique logical times', async () => {
    await Promise.all(Array.from({length:8},(_,i)=>saveLocalRecord('operator',{name:`Centre ${i}`,location:'Test location'})));
    const events = await zeustekDb.events.toArray();
    expect(new Set(events.map(event=>event.lamport)).size).toBe(8);
  });
  it('round-trips records, history, tombstones and local images in a backup', async () => {
    const image = await storeDiveImage(new File(['image-test'], 'test.png', {type:'image/png'}),'test-account');
    await saveLocalRecord('certification',{certification:'Test card',cardFront:image});
    const deleted = await saveLocalRecord('operator',{name:'Deleted example',location:'Test location'});
    await deleteLocalRecord(deleted.id);
    const backup = await localBackupPayload();
    for (const table of zeustekDb.tables) await table.clear();
    const result = await restoreLocalPayload(backup);
    expect(result).toEqual({restored:2,skipped:0,conflicts:0});
    expect(await zeustekDb.events.count()).toBe(3);
    expect(await zeustekDb.entityHeads.count()).toBe(2);
    expect(await zeustekDb.diveImages.count()).toBe(1);
    expect(await listLocalDiveRecords('operator')).toEqual([]);
  });
  it('rejects malformed images before writing records and keeps existing differences', async () => {
    await saveLocalRecord('operator',{entityId:'stable-id',name:'Original',location:'Test location'});
    const backup = await localBackupPayload();
    const malformed = {...backup,images:[{id:'broken',account:'test-account',mimeType:'image/png',bytes:'!not-base64!'}]};
    await expect(restoreLocalPayload(malformed)).rejects.toThrow('invalid data');
    expect(await zeustekDb.entities.count()).toBe(1);
    await saveLocalRecord('operator',{entityId:'stable-id',name:'Edited',location:'Test location'});
    expect((await restoreLocalPayload(backup)).conflicts).toBe(1);
    expect((await listLocalDiveRecords<{name:string}>('operator'))[0]?.name).toBe('Edited');
  });
});
