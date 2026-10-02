import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, saveLocalRecord, listLocalDiveRecords, deleteLocalRecord, flushDiveChanges, pendingDiveChanges } from '../lib/offline/dive-store';
import { localBackupPayload, restoreLocalPayload } from '../lib/offline/local-backup';
import { storeDiveImage } from '../lib/offline/dive-images';
import { createComputerEvidenceStore } from '../lib/offline/evidence-attachments';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected fixture request.'); }));
  configureDiveStore('test-account');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});

describe('record-change notifications from sync', () => {
  const notification = () => {
    const listener = vi.fn();
    window.addEventListener('zeustek-records-updated', listener);
    return listener;
  };
  const snapshotTables = () => Promise.all(zeustekDb.tables.map(table => table.toArray()));
  const putEvidence = (owner = 'test-account') => createComputerEvidenceStore(owner).put({ ownerKind: 'computer-profile', ownerId: 'dummy-profile', fileName: 'dummy.json', mimeType: 'application/json', bytes: new TextEncoder().encode('{"samples":[1]}') });

  it('leaves every table unchanged and emits no record notification for repeated empty online flushes', async () => {
    const before = await snapshotTables(), updated = notification();
    vi.stubGlobal('navigator', { onLine: true });
    await flushDiveChanges(); await flushDiveChanges();
    expect(updated).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    expect(await snapshotTables()).toEqual(before);
  });

  it('does not repeatedly notify for an existing conflict-only queue', async () => {
    await zeustekDb.settings.put({ key: 'pending:dive:test-account:dummy', value: { id: 'dummy', kind: 'operator', record: { name: 'Retained local source' }, baseModifiedAt: null, token: 'original', state: 'conflict', error: 'Retained conflict' } });
    const before = await snapshotTables(), updated = notification();
    vi.stubGlobal('navigator', { onLine: true });
    await flushDiveChanges();
    expect(updated).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    expect(await snapshotTables()).toEqual(before);
  });

  it('still notifies when a real saved record is acknowledged without rewriting immutable history', async () => {
    const saved = await saveLocalRecord('operator', { name: 'Dummy pending centre', location: 'Dummy location' });
    const events = await zeustekDb.events.toArray(), outbox = await zeustekDb.outbox.toArray(), updated = notification();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ updatedAt: Date.parse('2026-10-02T12:00:00Z') })));
    vi.stubGlobal('navigator', { onLine: true });
    await flushDiveChanges();
    expect(updated).toHaveBeenCalledTimes(1);
    expect(await pendingDiveChanges()).toEqual([]);
    expect((await zeustekDb.entities.get(`dive:test-account:${saved.id}`))?.record).toMatchObject({ name: 'Dummy pending centre', modifiedAt: '2026-10-02T12:00:00.000Z' });
    expect(await zeustekDb.events.toArray()).toEqual(events); expect(await zeustekDb.outbox.toArray()).toEqual(outbox);
    expect(fetch).toHaveBeenCalledWith('/api/dive-data', expect.objectContaining({ method: 'POST' }));
  });

  it('still notifies a new conflict state while retaining the local record and queue', async () => {
    const saved = await saveLocalRecord('operator', { name: 'Dummy source', location: 'Dummy location' }), before = await zeustekDb.entities.toArray(), updated = notification();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Dummy cloud conflict' }, { status: 409 })));
    vi.stubGlobal('navigator', { onLine: true });
    await flushDiveChanges();
    expect(updated).toHaveBeenCalledTimes(1);
    expect((await pendingDiveChanges())[0]?.value).toMatchObject({ id: saved.id, state: 'conflict', error: 'Dummy cloud conflict' });
    expect(await zeustekDb.entities.toArray()).toEqual(before);
  });

  it('notifies only a successful evidence upload and leaves canonical records, history and permissions unchanged', async () => {
    const id = await putEvidence(), protectedTables = [zeustekDb.entities, zeustekDb.events, zeustekDb.outbox, zeustekDb.users, zeustekDb.settings];
    const before = await Promise.all(protectedTables.map(table => table.toArray())), updated = notification();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id })));
    vi.stubGlobal('navigator', { onLine: true });
    await flushDiveChanges();
    expect(updated).toHaveBeenCalledTimes(1);
    expect(await zeustekDb.attachments.get(id)).toMatchObject({ state: 'acknowledged' });
    expect(await zeustekDb.diveImages.get(id)).toMatchObject({ account: 'test-account', remoteKey: id });
    expect(await Promise.all(protectedTables.map(table => table.toArray()))).toEqual(before);
    await flushDiveChanges(); expect(updated).toHaveBeenCalledTimes(1); expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/media', expect.objectContaining({ method: 'POST' }));
  });

  it('retains denied evidence for retry without a false record-change notification', async () => {
    const id = await putEvidence(), before = await snapshotTables(), updated = notification();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Denied' }, { status: 403 })));
    vi.stubGlobal('navigator', { onLine: true });
    await flushDiveChanges();
    expect(updated).not.toHaveBeenCalled(); expect(await snapshotTables()).toEqual(before);
    expect(await zeustekDb.attachments.get(id)).toMatchObject({ state: 'pending' });
  });

  it.each(['other-account', ''])('does not flush attachments or notify after the account changes to %j during a record request', async nextAccount => {
    await saveLocalRecord('operator', { name: 'Dummy queued source', location: 'Dummy location' });
    const oldEvidence = await putEvidence(), otherEvidence = await putEvidence('other-account'), updated = notification();
    let respond!: (response: Response) => void, started!: () => void;
    const pending = new Promise<void>(resolve => { started = resolve; });
    const network = vi.fn((url: string) => url === '/api/dive-data' ? new Promise<Response>(resolve => { respond = resolve; started(); }) : Promise.resolve(Response.json({ id: otherEvidence })));
    vi.stubGlobal('fetch', network); vi.stubGlobal('navigator', { onLine: true });
    const flushing = flushDiveChanges(); await pending; configureDiveStore(nextAccount);
    respond(Response.json({ updatedAt: Date.now() })); await flushing;
    expect(updated).not.toHaveBeenCalled(); expect(network).toHaveBeenCalledTimes(1);
    expect(await zeustekDb.attachments.get(oldEvidence)).toMatchObject({ state: 'pending' });
    expect(await zeustekDb.attachments.get(otherEvidence)).toMatchObject({ state: 'pending' });
  });

  it('stops an evidence batch without acknowledging or notifying after its account changes', async () => {
    const first = await putEvidence(), second = await putEvidence(), before = await snapshotTables(), updated = notification();
    let respond!: (response: Response) => void, started!: () => void, requestedId: string;
    const pending = new Promise<void>(resolve => { started = resolve; });
    const network = vi.fn((_url: string, options: RequestInit) => new Promise<Response>(resolve => {
      const uploadId = (options.body as FormData).get('uploadId'); requestedId = typeof uploadId === 'string' ? uploadId : ''; respond = resolve; started();
    }));
    vi.stubGlobal('fetch', network); vi.stubGlobal('navigator', { onLine: true });
    const flushing = flushDiveChanges(); await pending; configureDiveStore('other-account');
    respond(Response.json({ id: requestedId! })); await flushing;
    expect(updated).not.toHaveBeenCalled(); expect(network).toHaveBeenCalledTimes(1);
    expect(await snapshotTables()).toEqual(before);
    for (const id of [first, second]) expect(await zeustekDb.attachments.get(id)).toMatchObject({ state: 'pending' });
  });

  it('notifies a completed acknowledgement even if a later queued record remains after a network error', async () => {
    await saveLocalRecord('operator', { name: 'Dummy first source', location: 'Dummy location' });
    await saveLocalRecord('operator', { name: 'Dummy second source', location: 'Dummy location' });
    const updated = notification(), operation = vi.fn(); window.addEventListener('zeustek-operation', operation);
    const network = vi.fn().mockResolvedValueOnce(Response.json({ updatedAt: Date.now() })).mockRejectedValueOnce(new TypeError('Dummy transport failure'));
    vi.stubGlobal('fetch', network); vi.stubGlobal('navigator', { onLine: true });
    await flushDiveChanges();
    expect(updated).toHaveBeenCalledTimes(1); expect(await pendingDiveChanges()).toHaveLength(1);
    expect(operation).toHaveBeenCalledWith(expect.objectContaining({ detail: { state: 'error', message: 'Dummy transport failure' } }));
  });

  it('stops before sending a record when the account switches during its image preparation', async () => {
    const image = await storeDiveImage(new File(['dummy image'], 'dummy.png', { type: 'image/png' }), 'test-account');
    await saveLocalRecord('certification', { certification: 'Dummy award', cardFront: image });
    const updated = notification(); let respond!: (response: Response) => void, started!: () => void;
    const pending = new Promise<void>(resolve => { started = resolve; });
    const network = vi.fn((url: string) => url === '/api/cert-image' ? new Promise<Response>(resolve => { respond = resolve; started(); }) : Promise.resolve(Response.json({ updatedAt: Date.now() })));
    vi.stubGlobal('fetch', network); vi.stubGlobal('navigator', { onLine: true });
    const flushing = flushDiveChanges(); await pending; configureDiveStore('other-account');
    respond(Response.json({ imageKey: 'dummy-remote-key' })); await flushing;
    expect(updated).not.toHaveBeenCalled(); expect(network).toHaveBeenCalledTimes(1);
    expect((await zeustekDb.settings.where('key').startsWith('pending:dive:test-account:').toArray())).toHaveLength(1);
  });

  it('does not upload an old account image when the account switches during its local Blob read', async () => {
    const image = await storeDiveImage(new File(['dummy image'], 'dummy.png', { type: 'image/png' }), 'test-account');
    await saveLocalRecord('certification', { certification: 'Dummy award', cardFront: image });
    const local = await zeustekDb.diveImages.get(image.attachmentId), before = await snapshotTables(), updated = notification();
    let respond!: (value: typeof local) => void, started!: () => void;
    const pending = new Promise<void>(resolve => { started = resolve; });
    const lookup = vi.spyOn(zeustekDb.diveImages, 'get').mockImplementationOnce(() => { started(); return new Promise<typeof local>(resolve => { respond = resolve; }) as ReturnType<typeof zeustekDb.diveImages.get>; });
    const network = vi.fn(async () => Response.json({ imageKey: 'dummy-key', updatedAt: Date.now() }));
    vi.stubGlobal('fetch', network); vi.stubGlobal('navigator', { onLine: true });
    try {
      const flushing = flushDiveChanges(); await pending; configureDiveStore('other-account'); respond(local); await flushing;
      expect(network).not.toHaveBeenCalled(); expect(updated).not.toHaveBeenCalled(); expect(await snapshotTables()).toEqual(before);
    } finally { lookup.mockRestore(); }
  });

  it.each([200, 409])('does not acknowledge or mark conflict after account changes during response JSON (%i)', async status => {
    await saveLocalRecord('operator', { name: 'Dummy retained source', location: 'Dummy location' });
    const before = await snapshotTables(), updated = notification();
    const response = Response.json({}, { status }); let respond!: (value: unknown) => void, started!: () => void;
    const pending = new Promise<void>(resolve => { started = resolve; });
    vi.spyOn(response, 'json').mockImplementation(() => { started(); return new Promise(resolve => { respond = resolve; }); });
    vi.stubGlobal('fetch', vi.fn(async () => response)); vi.stubGlobal('navigator', { onLine: true });
    const flushing = flushDiveChanges(); await pending; configureDiveStore('other-account');
    respond({ updatedAt: Date.now(), error: 'Dummy conflict' }); await flushing;
    expect(updated).not.toHaveBeenCalled(); expect(await snapshotTables()).toEqual(before);
  });

  it('does not surface a late request error in another account', async () => {
    await saveLocalRecord('operator', { name: 'Dummy retained source', location: 'Dummy location' });
    const operation = vi.fn(); window.addEventListener('zeustek-operation', operation);
    let reject!: (error: Error) => void, started!: () => void; const pending = new Promise<void>(resolve => { started = resolve; });
    vi.stubGlobal('fetch', vi.fn(() => new Promise((_resolve, failed) => { reject = failed; started(); }))); vi.stubGlobal('navigator', { onLine: true });
    const flushing = flushDiveChanges(); await pending; configureDiveStore('other-account'); reject(new TypeError('Old account request failed')); await flushing;
    expect(operation).not.toHaveBeenCalled();
  });
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
