import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,listLocalDiveRecords,saveLocalRecord} from '../lib/offline/dive-store';
import {localBackupPayload,restoreLocalPayload} from '../lib/offline/local-backup';
import {readCalendarSources,saveCalendarDiveLinks,linkCalendarBookingToTrip,tripDraftFromBooking,setCalendarEntryStatus} from '../lib/planning/calendar-booking-workflow';
import {listDiveExpeditionTrips,saveDiveExpeditionTrip} from '../lib/offline/trips-expeditions';
const account='calendar-link-fixture';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore(account);await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
async function seed(){
 await saveLocalRecord('trip',{entityId:'event-a',name:'Dummy two-Dive day',startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Dummy Site',buddy:'Retain owner text',notes:'Retain original notes',status:'confirmed',bookingStatus:'confirmed',bookingKind:'dive',futureField:{keep:true}});
 for(const id of ['dive-a','dive-b'])await saveLocalRecord('dive',{entityId:id,date:'2026-10-10',site:'Dummy Site',notes:'Original Dive',diveTeamIds:['self']});
 return (await readCalendarSources()).entries[0]!;
}
describe('Canonical calendar / Dive / Trip persistence',()=>{
 it.each(['completed','cancelled','archived'] as const)('rejects a stale unconverted event %s action after another tab converts it',async status=>{
  const stale=await seed();await saveDiveExpeditionTrip(tripDraftFromBooking(stale));
  const before=await localBackupPayload();
  await expect(setCalendarEntryStatus(stale,status)).rejects.toThrow('changed');
  const after=await localBackupPayload();expect({...after,exportedAt:before.exportedAt}).toEqual(before);
 });
 it('blocks ambiguous calendar status actions without selecting or rewriting either offline conversion',async()=>{
  const original=await seed();const draft=tripDraftFromBooking(original);
  await saveDiveExpeditionTrip({...draft,entityId:'duplicate-a',status:'cancelled'});
  await saveDiveExpeditionTrip({...draft,entityId:'duplicate-b',status:'completed'});
  const entry=(await readCalendarSources()).entries[0]!;const before=await localBackupPayload();
  await expect(setCalendarEntryStatus(entry,'cancelled')).rejects.toThrow('Multiple Trip associations');
  const after=await localBackupPayload();expect({...after,exportedAt:before.exportedAt}).toEqual(before);
 });
 it('changes converted Trip status through its calendar event without rewriting original booking evidence',async()=>{
  const original=await seed();await saveDiveExpeditionTrip(tripDraftFromBooking(original));const before=await listLocalDiveRecords('trip');
  await setCalendarEntryStatus((await readCalendarSources()).entries[0]!,'cancelled');
  expect((await listDiveExpeditionTrips())[0]?.status).toBe('cancelled');expect((await readCalendarSources()).entries[0]?.bookingStatus).toBe('cancelled');expect(await listLocalDiveRecords('trip')).toEqual(before);
 });
 it('rejects a stale converted Trip status edit while retaining both canonical records',async()=>{
  const original=await seed();await saveDiveExpeditionTrip(tripDraftFromBooking(original));const stale=(await readCalendarSources()).entries[0]!;
  const current=(await listDiveExpeditionTrips())[0]!;await saveDiveExpeditionTrip({...current,status:'completed'});const before=await listLocalDiveRecords('dive-trip');
  await expect(setCalendarEntryStatus(stale,'cancelled')).rejects.toThrow('changed');expect(await listLocalDiveRecords('dive-trip')).toEqual(before);
 });

 it('reads without writes and links zero, one or several Dives without changing any endpoint',async()=>{
  const entry=await seed();const dives=await listLocalDiveRecords('dive');const count=await zeustekDb.events.count();
  await readCalendarSources();await readCalendarSources();expect(await zeustekDb.events.count()).toBe(count);
  await saveCalendarDiveLinks(entry,['dive-a','dive-b','dive-a']);
  let current=(await readCalendarSources()).entries[0]!;expect(current.linkedDiveIds).toEqual(['dive-a','dive-b']);expect(current).toMatchObject({buddy:'Retain owner text',notes:'Retain original notes',futureField:{keep:true}});
  await saveCalendarDiveLinks(current,['dive-b']);current=(await readCalendarSources()).entries[0]!;expect(current.linkedDiveIds).toEqual(['dive-b']);
  await saveCalendarDiveLinks(current,[]);expect((await readCalendarSources()).entries[0]!.linkedDiveIds).toEqual([]);expect(await listLocalDiveRecords('dive')).toEqual(dives);expect(fetch).not.toHaveBeenCalled();
 });
 it('rejects an unavailable or foreign Dive without altering the saved event',async()=>{
  const entry=await seed();configureDiveStore('another-owner');await saveLocalRecord('dive',{entityId:'foreign-dive',date:'2026-10-10',site:'Private'});configureDiveStore(account);
  const before=await listLocalDiveRecords('trip');await expect(saveCalendarDiveLinks(entry,['foreign-dive'])).rejects.toThrow('unavailable');expect(await listLocalDiveRecords('trip')).toEqual(before);
 });
 it('retains historical missing links until explicitly unlinked and rejects stale edits',async()=>{
  const entry=await seed();await saveLocalRecord('trip',{...entry,linkedDiveIds:['historical-missing'],modifiedAt:'old'});
  const current=(await readCalendarSources()).entries[0]!;await saveCalendarDiveLinks(current,['historical-missing','dive-a']);
  await expect(saveCalendarDiveLinks(current,['dive-b'])).rejects.toThrow('changed');expect((await readCalendarSources()).entries[0]!.linkedDiveIds).toEqual(['historical-missing','dive-a']);
 });
 it('creates one canonical Trip from an event and includes it immediately without duplicating the event',async()=>{
  const entry=await seed();await saveCalendarDiveLinks(entry,['dive-a','dive-b']);const current=(await readCalendarSources()).entries[0]!;
  const bookingBefore=await listLocalDiveRecords('trip');const saved=await saveDiveExpeditionTrip(tripDraftFromBooking(current));
  const sources=await readCalendarSources();expect(sources.entries).toHaveLength(1);expect(sources.entries[0]?.linkedTripId).toBe(saved.id);expect(sources.trips[0]?.linkedDiveIds).toEqual(['dive-a','dive-b']);expect(await listLocalDiveRecords('trip')).toEqual(bookingBefore);
 });
 it('links an existing Trip using one parent save and preserves dates, notes and original event',async()=>{
  const entry=await seed();const {originCalendarBookingId:_origin,...draft}=tripDraftFromBooking(entry);const saved=await saveDiveExpeditionTrip({...draft,calendarBookingIds:[],itinerary:[],name:'Existing holiday',notes:'Keep Trip notes',startsOn:'2026-10-01',endsOn:'2026-10-20'});
  const before=await listLocalDiveRecords('trip');await linkCalendarBookingToTrip(entry,saved.id);await linkCalendarBookingToTrip(entry,saved.id);
  const trip=(await listDiveExpeditionTrips())[0]!;expect(trip).toMatchObject({name:'Existing holiday',notes:'Keep Trip notes',startsOn:'2026-10-01',endsOn:'2026-10-20',calendarBookingIds:['event-a']});expect(trip.itinerary).toHaveLength(1);expect(trip.itinerary[0]?.notes).toBe('Retain original notes');expect(await listLocalDiveRecords('trip')).toEqual(before);expect((await readCalendarSources()).entries).toHaveLength(2);
 });
 it('restores ordinary links and conversion provenance without losing unknown fields or changing owner scope',async()=>{
  const entry=await seed();await saveCalendarDiveLinks(entry,['dive-a','dive-b']);await saveDiveExpeditionTrip(tripDraftFromBooking((await readCalendarSources()).entries[0]!));
  const backup=await localBackupPayload();for(const table of zeustekDb.tables)await table.clear();await restoreLocalPayload(backup);
  const sources=await readCalendarSources();expect(sources.entries[0]).toMatchObject({entityId:'event-a',linkedDiveIds:['dive-a','dive-b'],futureField:{keep:true}});expect(sources.trips[0]?.originCalendarBookingId).toBe('event-a');
  configureDiveStore('other-owner');expect((await readCalendarSources()).entries).toHaveLength(0);
 });
});
