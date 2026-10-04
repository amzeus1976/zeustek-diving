import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,saveLocalRecord,flushDiveChanges,pendingDiveChanges} from '../lib/offline/dive-store';
import {syncReviewSummary} from '../lib/offline/sync-review';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});configureDiveStore('size-fixture-owner');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
describe('An oversized record cannot stall the sync queue',()=>{
 it('retains the entire rejected record for review and continues to the next unrelated record',async()=>{
  const notes='Retained owner notes '.repeat(15000);
  await saveLocalRecord('trip',{entityId:'oversized-plan',name:'Large Plan',notes});await saveLocalRecord('site',{entityId:'ordinary-site',name:'Small Site'});
  const fetcher=vi.fn(async(_url:unknown,init:RequestInit)=>{if(typeof init.body!=='string')throw new Error('Expected a JSON record request.');const body=JSON.parse(init.body);return body.id==='oversized-plan'?Response.json({error:'Record is too large'},{status:413}):Response.json({id:body.id,updatedAt:Date.now()});});
  vi.stubGlobal('fetch',fetcher);vi.stubGlobal('navigator',{onLine:true});await flushDiveChanges();
  const pending=await pendingDiveChanges();expect(fetcher).toHaveBeenCalledTimes(2);expect(pending).toHaveLength(1);expect(pending[0]?.value).toMatchObject({id:'oversized-plan',state:'conflict',error:'Record is too large',record:{notes}});
  await flushDiveChanges();expect(fetcher).toHaveBeenCalledTimes(2);expect((await zeustekDb.entities.get('dive:size-fixture-owner:oversized-plan'))?.record).toMatchObject({notes});
 });
 it('shows a safe explanation for the retained oversized record rather than a repeated generic toast',()=>{
  expect(syncReviewSummary({kind:'trip',record:{name:'Plan'},error:'Record is too large'}).message).toContain('upload limit');
 });
});
