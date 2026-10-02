import 'fake-indexeddb/auto';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore} from '../lib/offline/dive-store';
import {readOwnerDataSnapshot} from '../lib/data-health/read-owner-snapshot';

const row=(id:string,kind:string,data:Record<string,unknown>,account='owner')=>({entityId:`dive:${account}:${id}`,module:`dive:${account}`,entityType:kind,schemaVersion:1,record:{entityId:id,...data},recordHash:'original',deleted:0 as const,updatedEventId:'',updatedAt:'2026-10-02T00:00:00Z'});
beforeEach(async()=>{configureDiveStore('owner');vi.stubGlobal('fetch',vi.fn());vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('window',new EventTarget());await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
it('uses a bounded account-scoped read transaction without cloud reads or any persistent change',async()=>{
 await zeustekDb.entities.bulkPut([row('d','dive',{date:'2026-10-01'}),row('p','person',{name:'Human'}),row('foreign','dive',{},'another'),row('secret','gmail-connection',{refreshToken:'dummy-only'}),row('key','integration-key',{token:'dummy-only'})]);
 await zeustekDb.settings.put({key:'cached:dive:owner:dive',value:true});
 await zeustekDb.outbox.put({objectId:'pending',objectKind:'event',createdAt:'2026-10-02',attemptCount:0,nextAttemptAt:0,state:'pending'});
 const before=await Promise.all(zeustekDb.tables.map(table=>table.toArray()));
 const first=await readOwnerDataSnapshot('owner'),second=await readOwnerDataSnapshot('owner');
 expect(first.records.map(item=>item.id)).toEqual(['d','p']);expect(second.records).toEqual(first.records);
 expect(first.completeKinds).toContain('dive');expect(first.completeKinds).not.toContain('person');
 expect(JSON.stringify(first)).not.toMatch(/dummy-only|secret|foreign|integration-key/);
 expect(await Promise.all(zeustekDb.tables.map(table=>table.toArray()))).toEqual(before);expect(fetch).not.toHaveBeenCalled();
});
it('excludes known foreign shared gear and explains unverified legacy ownership without publishing private fields',async()=>{
 await zeustekDb.entities.bulkPut([row('own','equipment',{householdOwnerId:'owner',householdOwnedByMe:true,name:'Own'}),row('shared','equipment',{householdOwnerId:'other',householdOwnedByMe:false,name:'Secret other owner'}),row('legacy','equipment',{name:'Legacy unverified'}),row('ordinary','person',{name:'Person'})]);
 await zeustekDb.settings.put({key:'cached:dive:owner:equipment',value:true});
 const result=await readOwnerDataSnapshot('owner');expect(result.records.map(item=>item.id)).toEqual(['own','ordinary']);
 expect(result.completeKinds).not.toContain('equipment');expect(result.coverage.find(item=>item.kind==='equipment')?.reasons).toContain('ownership-unknown');
 expect(JSON.stringify(result.coverage)).not.toMatch(/Secret other owner|Legacy unverified/);
 expect(result.coverage.every(item=>Object.keys(item).every(key=>['kind','inspected','state','reasons'].includes(key)))).toBe(true);
});
it('does not call imageSource or fetch remote images and exposes only local/remote/missing evidence states',async()=>{
 await zeustekDb.entities.put(row('award','certification',{cardFront:{attachmentId:'front',remoteKey:'private/path',zoom:1,x:50,y:50},cardBack:{attachmentId:'missing',zoom:1,x:50,y:50},imageKey:'private-legacy'}));
 await zeustekDb.diveImages.put({id:'front',account:'owner',blob:new Blob(['dummy'],{type:'image/png'}),name:'private.png',createdAt:'2026-10-02'});
 const result=await readOwnerDataSnapshot('owner');expect(result.imageEvidence).toEqual([{recordId:'award',field:'cardFront',state:'local-present'},{recordId:'award',field:'cardBack',state:'missing'},{recordId:'award',field:'imageKey',state:'remote-unverified'}]);
 expect(JSON.stringify(result.imageEvidence)).not.toMatch(/private|attachmentId|remoteKey|\.png/);expect(fetch).not.toHaveBeenCalled();
});
it('marks truncated, malformed and mismatched identities Unknown rather than claiming complete coverage',async()=>{
 await zeustekDb.entities.bulkPut([row('a','dive',{}),row('b','dive',{}),row('c','dive',{})]);await zeustekDb.settings.put({key:'cached:dive:owner:dive',value:true});
 const capped=await readOwnerDataSnapshot('owner',{perKindLimit:2});expect(capped.records).toHaveLength(2);expect(capped.completeKinds).not.toContain('dive');expect(capped.coverage.find(item=>item.kind==='dive')?.reasons).toContain('scan-limit');
 await zeustekDb.entities.put({...row('x','person',{}),record:{entityId:'wrong'}});
 const malformed=await readOwnerDataSnapshot('owner');expect(malformed.records.some(item=>item.id==='wrong'||item.id==='x')).toBe(false);expect(malformed.coverage.find(item=>item.kind==='person')?.reasons).toContain('invalid-record');
});
it('rejects unsigned and switched accounts without revealing the preceding account cache',async()=>{
 await zeustekDb.entities.put(row('d','dive',{}));await expect(readOwnerDataSnapshot('other')).rejects.toThrow('account');configureDiveStore('');await expect(readOwnerDataSnapshot('owner')).rejects.toThrow('account');
});
it('treats an uncached legacy media portrait as remotely unverified rather than missing',async()=>{
 await zeustekDb.entities.put(row('p','person',{profileImageId:'legacy-private-media'}));
 const result=await readOwnerDataSnapshot('owner');expect(result.imageEvidence).toEqual([{recordId:'p',field:'profileImageId',state:'remote-unverified'}]);expect(fetch).not.toHaveBeenCalled();
});
it('keeps excluded historical endpoints from being asserted deleted in complete coverage',async()=>{
 await zeustekDb.entities.put(row('suppressed','skill',{suppressedFromUse:true,name:'Hidden history'}));await zeustekDb.settings.put({key:'cached:dive:owner:skill',value:true});
 const result=await readOwnerDataSnapshot('owner');expect(result.records).toEqual([]);expect(result.completeKinds).not.toContain('skill');expect(result.coverage.find(item=>item.kind==='skill')?.reasons).toContain('suppressed-records-excluded');
});
