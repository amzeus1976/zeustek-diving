import {describe, expect, it} from 'vitest';
import {calendarEntries, linkedCalendarTripId, mergeBookingIntoTrip, tripDraftFromBooking, eventTextPreview, normaliseCalendarDiveIds} from '../lib/planning/calendar-booking-workflow';
import type {StoredDivingCalendarBooking} from '../lib/offline/planning-pages';
import type {DiveExpeditionTripRecord} from '../lib/offline/trips-expeditions';
import type {Stored} from '../lib/offline/dive-planning';
import {workflowDestinationUrl,parseWorkflowDestination} from '../lib/workflow/workflow-destination';

const at='2026-10-04T12:00:00Z';
const event=(extra={})=>({entityId:'booking-a',name:'Farne weekend',startDate:'2026-10-10',endDate:'2026-10-11',startAt:'2026-10-10T08:30',endAt:'2026-10-11T17:00',siteName:'Farne Islands',locationName:'Seahouses',siteId:'site-a',personIds:['human-a'],buddy:'Owner-entered buddy text',notes:'Long source notes\nRetain Unicode 🐬',bookingKind:'dive',bookingStatus:'confirmed',status:'confirmed',createdAt:at,modifiedAt:at,...extra} as StoredDivingCalendarBooking);
const trip=(extra={})=>({entityId:'trip-a',name:'Existing holiday',destination:'Existing destination',startsOn:'2026-10-01',endsOn:'2026-10-20',status:'planned',teamPersonIds:['human-b'],siteIds:['site-b'],planIds:[],itinerary:[],bookings:[],packingEquipmentSetIds:[],packingItems:[],gasLogistics:[],documentAttachmentIds:[],notes:'Owner notes',createdAt:at,modifiedAt:at,...extra} as Stored<DiveExpeditionTripRecord>);

describe('Calendar event / canonical Trip workflow',()=>{
 it('marks duplicate conversions for review even with an explicit legacy link or missing inverse provenance',()=>{
  for(const legacy of [undefined,'converted-a']){
   const source=event({linkedTripId:legacy});
   const a=trip({...tripDraftFromBooking(source),entityId:'converted-a',status:'cancelled',calendarBookingIds:[]});
   const b=trip({...tripDraftFromBooking(source),entityId:'converted-b',status:'completed',calendarBookingIds:[]});
   const before=structuredClone([source,a,b]);const entries=calendarEntries([source],[a,b]);
   expect(entries[0]?.calendarLinkConflict).toBe(true);expect(entries[0]?.calendarStatusTripId).toBeUndefined();
   expect([source,a,b]).toEqual(before);
  }
 });
 it.each(['cancelled','completed','draft','active'] as const)('shows the canonical converted Trip status %s without changing source records',status=>{
  const source=event({bookingStatus:'confirmed',status:'confirmed'});const converted=trip({...tripDraftFromBooking(source),entityId:'converted',status});const before=structuredClone([source,converted]);
  const entry=calendarEntries([source],[converted])[0]!;
  expect(entry.bookingStatus).toBe(status==='draft'?'idea':status==='active'?'confirmed':status);
  expect([source,converted]).toEqual(before);
 });

 it('carries the exact source event through canonical cross-workspace navigation',()=>{
  const destination=workflowDestinationUrl({route:'Trips',params:{fromEventId:'booking-a'}});
  expect(new URLSearchParams(destination.slice(1)).get('fromEventId')).toBe('booking-a');expect(parseWorkflowDestination(destination).params?.fromEventId).toBe('booking-a');
 });
 it('caps long Unicode text and many-line text while preserving the source',()=>{
  const text='🐬'.repeat(500);const result=eventTextPreview(text);
  expect(result.truncated).toBe(true);expect(Array.from(result.preview).length).toBeLessThanOrEqual(320);expect(result.preview).not.toContain('�');expect(text).toBe('🐬'.repeat(500));
  expect(eventTextPreview('line\n'.repeat(30)).truncated).toBe(true);
  expect(eventTextPreview('Short notes')).toEqual({preview:'Short notes',truncated:false});
 });
 it('creates a reviewable Trip draft with source details and exact canonical IDs',()=>{
  const original=event();const before=structuredClone(original);const draft=tripDraftFromBooking(original);
  expect(draft).toMatchObject({name:original.name,destination:'Seahouses',startsOn:original.startDate,endsOn:original.endDate,status:'confirmed',siteIds:['site-a'],teamPersonIds:['human-a'],notes:original.notes,originCalendarBookingId:'booking-a',calendarBookingIds:['booking-a']});
  expect(draft.itinerary).toHaveLength(1);expect(draft.itinerary[0]).toMatchObject({title:original.name,startsAt:original.startAt,endsAt:original.endAt,location:'Seahouses',notes:original.notes});expect(original).toEqual(before);
 });
 it('imports details into an existing Trip without overwriting owner summary or existing itinerary',()=>{
  const existing=trip({itinerary:[{id:'owner-leg',kind:'travel',title:'Keep this leg'}]});const before=structuredClone(existing);
  const merged=mergeBookingIntoTrip(existing,event());
  expect(merged).toMatchObject({name:'Existing holiday',destination:'Existing destination',startsOn:'2026-10-01',endsOn:'2026-10-20',notes:'Owner notes',siteIds:['site-b','site-a'],teamPersonIds:['human-b','human-a'],calendarBookingIds:['booking-a']});
  expect(merged.itinerary).toHaveLength(2);expect(merged.itinerary[0]?.title).toBe('Keep this leg');expect(existing).toEqual(before);
 });
 it('fills blank Trip summary values and never duplicates the source itinerary on repeated links',()=>{
  const first=mergeBookingIntoTrip(trip({name:'',destination:'',startsOn:null,endsOn:null,notes:''}),event());
  const again=mergeBookingIntoTrip({...first,createdAt:at,modifiedAt:at} as Stored<DiveExpeditionTripRecord>,event());
  expect(first).toMatchObject({name:'Farne weekend',destination:'Seahouses',startsOn:'2026-10-10',endsOn:'2026-10-11',notes:event().notes});expect(again.itinerary).toEqual(first.itinerary);expect(again.calendarBookingIds).toEqual(['booking-a']);
 });
 it('shows newly created Trips as calendar events with canonical Trip editing',()=>{
  const rows=calendarEntries([], [trip()]);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({entityId:'trip-a',calendarSource:'dive-trip',linkedTripId:'trip-a',name:'Existing holiday',startDate:'2026-10-01',endDate:'2026-10-20'});
 });
 it('keeps converted bookings as one calendar identity and exposes their new Trip link',()=>{
  const converted=trip({...tripDraftFromBooking(event()),entityId:'new-trip'});const rows=calendarEntries([event()], [converted]);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({entityId:'booking-a',linkedTripId:'new-trip'});
 });
 it('retains linked events and a different spanning Trip as distinct dates',()=>{
  const target=trip({calendarBookingIds:['booking-a']});expect(calendarEntries([event()], [target])).toHaveLength(2);
 });
 it('does not hide a converted Trip after its owner deliberately changes its date range',()=>{
  const changed=trip({...tripDraftFromBooking(event()),entityId:'new-trip',endsOn:'2026-10-14'});
  expect(calendarEntries([event()], [changed])).toHaveLength(2);
 });
 it('transfers existing logged Dive links without turning a club meeting into a Dive',()=>{
  const draft=tripDraftFromBooking(event({bookingKind:'club',linkedDiveIds:['dive-a','dive-b']}));
  expect(draft.linkedDiveIds).toEqual(['dive-a','dive-b']);expect(draft.itinerary[0]?.kind).toBe('meeting');
 });
 it('keeps a converted Trip readable when its historical source is unavailable',()=>{
  expect(calendarEntries([], [trip({originCalendarBookingId:'missing',calendarBookingIds:['missing']})])).toHaveLength(1);
 });
 it('preserves explicit legacy links and reports ambiguous inverse links instead of selecting another Trip',()=>{
  expect(linkedCalendarTripId(event({linkedTripId:'legacy'}),[trip()])).toBe('legacy');
  expect(linkedCalendarTripId(event(),[trip({calendarBookingIds:['booking-a']}),trip({entityId:'trip-b',calendarBookingIds:['booking-a']})])).toBeNull();
 });
 it('retains zero/one/many Dive IDs, removes duplicates and unlinks only the selected association',()=>{
  expect(normaliseCalendarDiveIds([])).toEqual([]);expect(normaliseCalendarDiveIds(['a','b','a',''])).toEqual(['a','b']);expect(normaliseCalendarDiveIds(['b'])).toEqual(['b']);
 });
});
