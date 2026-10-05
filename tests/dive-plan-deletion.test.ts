import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {configureDiveStore,saveLocalRecord,deleteLocalRecord,listLocalDiveRecords} from '../lib/offline/dive-store';
import {zeustekDb} from '../lib/offline/db';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('delete-plan-test');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
describe('Dive Plan deletion preserves references',()=>{
 it.each(['trip','dive-trip'] as const)('retains a logged Dive until its inbound %s association is explicitly unlinked',async kind=>{await saveLocalRecord('dive',{entityId:'logged-dive',site:'Site'});await saveLocalRecord(kind,{entityId:'event',name:'Event',linkedDiveIds:['logged-dive']});await expect(deleteLocalRecord('logged-dive')).rejects.toThrow(/linked|unlink/i);expect(await listLocalDiveRecords('dive')).toHaveLength(1);await saveLocalRecord(kind,{entityId:'event',name:'Event',linkedDiveIds:[]});await deleteLocalRecord('logged-dive');expect(await listLocalDiveRecords('dive')).toHaveLength(0);expect(await listLocalDiveRecords(kind)).toHaveLength(1);});
 it.each(['trip','dive-trip'] as const)('retains a %s Calendar event whose only Dive association is its own linkedDiveIds',async(kind)=>{
  await saveLocalRecord(kind,{entityId:'event',name:'Event',linkedDiveIds:['logged-dive']});
  await saveLocalRecord('dive',{entityId:'logged-dive',site:'Site'});
  await expect(deleteLocalRecord('event')).rejects.toThrow(/linked|unlink/i);
  expect(await zeustekDb.entities.get('dive:delete-plan-test:event')).toMatchObject({deleted:0});
  expect(await listLocalDiveRecords('dive')).toHaveLength(1);
 });
 it.each(['trip','dive-trip'] as const)('deletes an unlinked %s only, retaining other records and recoverable history',async(kind)=>{await saveLocalRecord(kind,{entityId:'plan',name:'Dummy plan',linkedDiveIds:[]});await saveLocalRecord(kind,{entityId:'other',name:'Other'});await deleteLocalRecord('plan');expect((await listLocalDiveRecords(kind)).map(row=>row.entityId)).toEqual(['other']);expect(await zeustekDb.entities.get('dive:delete-plan-test:plan')).toMatchObject({deleted:1});expect(fetch).not.toHaveBeenCalled();});
 it.each([
  ['dive',{originatingPlanId:'plan'}],['gas-plan',{divePlanId:'plan'}],['trip',{linkedDivePlanId:'plan'}],['dive-trip',{planIds:['plan']}],['dive-trip',{calendarBookingIds:['plan']}],['dive-trip',{originCalendarBookingId:'plan'}],['dive-trip',{itinerary:[{calendarBookingId:'plan'}]}],['skill_evidence',{planId:'plan'}],
 ] as const)('retains a plan referenced by %s',async(kind,data)=>{await saveLocalRecord('trip',{entityId:'plan',name:'Dummy plan'});await saveLocalRecord(kind,{entityId:'dependency',...data});await expect(deleteLocalRecord('plan')).rejects.toThrow(/linked|unlink/i);expect(await zeustekDb.entities.get('dive:delete-plan-test:plan')).toMatchObject({deleted:0});expect(await listLocalDiveRecords(kind)).toHaveLength(kind==='trip'?2:1);});
});
