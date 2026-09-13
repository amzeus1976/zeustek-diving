import 'fake-indexeddb/auto';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {cacheCloudRecords} from '../lib/offline/cache-cloud-records';
import {summedRuntime,diveCompleteness} from '../lib/dive-record-details';
import type {EntityRow} from '../lib/offline/types';
const row=(id:string):EntityRow=>({entityId:id,module:'test',entityType:'site',schemaVersion:1,record:{name:id},recordHash:'',deleted:0,updatedAt:'2026-09-08',updatedEventId:''});
beforeEach(async()=>{await zeustekDb.open();await zeustekDb.entities.clear();await zeustekDb.settings.clear();});
afterEach(()=>vi.restoreAllMocks());
it('caches 1674 records without a bulk write and preserves pending local changes',async()=>{
 const rows=Array.from({length:1674},(_,i)=>row(String(i)));
 await zeustekDb.entities.put({...row('1'),record:{name:'Unsent edit'}});
 await zeustekDb.settings.put({key:'pending:1',value:true});
 const bulk=vi.spyOn(zeustekDb.entities,'bulkPut');
 await cacheCloudRecords('test','site',rows);
 expect(await zeustekDb.entities.count()).toBe(1674);
 expect((await zeustekDb.entities.get('1'))?.record).toEqual({name:'Unsent edit'});
 expect(bulk).not.toHaveBeenCalled();
});
it('retries a transient transaction error',async()=>{
 const put=vi.spyOn(zeustekDb.entities,'put');put.mockRejectedValueOnce(new Error('UnknownError: in-progress transaction'));
 await cacheCloudRecords('test','site',[row('a')]);expect(await zeustekDb.entities.get('a')).toBeDefined();
});
it('does not mark existing records absent after an incomplete download',async()=>{
 await zeustekDb.entities.put(row('keep'));
 vi.spyOn(zeustekDb.entities,'put').mockRejectedValue(new Error('QuotaExceededError'));
 await expect(cacheCloudRecords('test','site',[row('new')])).rejects.toThrow();
 expect((await zeustekDb.entities.get('keep'))?.deleted).toBe(0);
});
it('does not overwrite a newer local revision with an older cloud response',async()=>{
 await zeustekDb.entities.put({...row('a'),updatedAt:'2026-09-09',record:{name:'New'}});
 await cacheCloudRecords('test','site',[row('a')]);
 expect((await zeustekDb.entities.get('a'))?.record).toEqual({name:'New'});
});
it('adds only recorded bottom, deco and safety durations',()=>{
 expect(summedRuntime(40,[{actualDurationMin:7,durationMin:5}],3)).toBe(50);
 expect(summedRuntime(40,[{durationMin:5}],3)).toBeNull();
 expect(summedRuntime(null,[],0)).toBeNull();
 expect(summedRuntime(40,[],0)).toBe(40);
});
it('distinguishes missing and partial weather and gear',()=>{
 expect(diveCompleteness({} as any)).toEqual({Weather:'missing',Gear:'missing',Gas:'missing'});
 expect(diveCompleteness({weather:'Sunny'} as any).Weather).toBe('partial');
 expect(diveCompleteness({weather:'Sunny',airTemperatureC:0,windSpeedKnots:0} as any).Weather).toBe('recorded');
});
