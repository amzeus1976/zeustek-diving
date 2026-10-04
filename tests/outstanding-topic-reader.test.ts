import 'fake-indexeddb/auto';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore} from '../lib/offline/dive-store';
import {readTopicSnapshot} from '../lib/insights/read-topic-snapshot';
const row=(id:string,kind:string,data:Record<string,unknown>,account='owner')=>({entityId:`dive:${account}:${id}`,module:`dive:${account}`,entityType:kind,schemaVersion:1,record:{entityId:id,...data},recordHash:'original',deleted:0 as const,updatedEventId:'',updatedAt:'2026-10-03T00:00:00Z'});
beforeEach(async()=>{configureDiveStore('owner');vi.stubGlobal('fetch',vi.fn());vi.stubGlobal('navigator',{onLine:true});vi.stubGlobal('window',new EventTarget());await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
it('reads only approved current-account source kinds without network or a persistent index',async()=>{
 await zeustekDb.entities.bulkPut([row('m','dive-media',{title:'Book'}),row('n','news-article',{title:'Cached news'}),row('secret','gmail-connection',{token:'dummy-only'}),row('foreign','dive-media',{title:'Foreign'},'other')]);
 const before=await Promise.all(zeustekDb.tables.map(table=>table.toArray()));
 const result=await readTopicSnapshot('owner');expect(result.records.map(item=>item.id)).toEqual(['m','n']);
 expect(JSON.stringify(result)).not.toMatch(/dummy-only|Foreign/);expect(fetch).not.toHaveBeenCalled();
 expect(await Promise.all(zeustekDb.tables.map(table=>table.toArray()))).toEqual(before);
});
it('rejects account changes and mismatched identities; coverage never claims uncached kinds complete',async()=>{
 await zeustekDb.entities.put({...row('m','dive-media',{}),record:{entityId:'wrong'}});
 const result=await readTopicSnapshot('owner');expect(result.records).toEqual([]);expect(result.coverage.every(row=>row.state==='unknown')).toBe(true);
 await expect(readTopicSnapshot('other')).rejects.toThrow('account');configureDiveStore('');await expect(readTopicSnapshot('owner')).rejects.toThrow('account');
});
it('bounds reads and excludes deleted, suppressed and known foreign ownership records',async()=>{
 await zeustekDb.entities.bulkPut([row('a','skill',{}),row('b','skill',{}),row('c','skill',{}),{...row('gone','dive-media',{}),deleted:1},row('hidden','news-article',{suppressedFromUse:true}),row('shared','training-progress',{householdOwnerId:'other'})]);
 await zeustekDb.settings.put({key:'cached:dive:owner:skill',value:true});
 const result=await readTopicSnapshot('owner',{perKindLimit:2});expect(result.records.map(item=>item.id)).toEqual(['a','b']);
 expect(result.coverage.find(item=>item.kind==='skill')).toMatchObject({state:'unknown',reason:'scan-limit'});
});
