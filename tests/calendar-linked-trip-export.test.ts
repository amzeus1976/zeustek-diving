import {describe,expect,it} from 'vitest';
import {buildCalendarPreview,DEFAULT_CALENDAR_OPTIONS,type CalendarSourceRecord} from '../lib/calendar/calendar-model';
import {renderCalendar} from '../lib/calendar/calendar-ical';
const booking={kind:'trip',id:'event-a',data:{name:'Original 🐬 event',bookingKind:'dive',startDate:'2026-10-10',endDate:'2026-10-10',startAt:'2026-10-10T08:30',endAt:'2026-10-10T16:00',siteName:'Public test harbour',locationName:'Public test harbour',bookingStatus:'confirmed',notes:'Private notes',linkedDiveIds:['private-dive-id']}};
const converted={kind:'dive-trip',id:'trip-a',data:{name:'Original 🐬 event',startsOn:'2026-10-10',endsOn:'2026-10-10',status:'confirmed',originCalendarBookingId:'event-a',calendarBookingIds:['event-a'],itinerary:[{id:'calendar-event:event-a',calendarBookingId:'event-a',kind:'dive',title:'Original 🐬 event',startsAt:'2026-10-10T08:30',endsAt:'2026-10-10T16:00'}]}};
const snapshot=(records:CalendarSourceRecord[]=[booking,converted])=>({accountId:'dummy-owner',snapshotAt:'2026-10-04T12:00:00Z',records,completeKinds:['trip','dive-trip','equipment','cylinder','certification']});
describe('Google-compatible booking / Trip export',()=>{
 it.each(['bookings','trips','itinerary'] as const)('applies canonical cancellation to %s selection while retaining original UID and time',async category=>{
  const cancelled={...converted,data:{...converted.data,status:'cancelled'}};
  const options={...DEFAULT_CALENDAR_OPTIONS,categories:[category]};
  expect((await buildCalendarPreview(snapshot([booking,cancelled]),options)).events).toHaveLength(0);
  const original=await buildCalendarPreview(snapshot([booking]),DEFAULT_CALENDAR_OPTIONS);
  const included=await buildCalendarPreview(snapshot([booking,cancelled]),{...options,includeCancelled:true});
  expect(included.events).toHaveLength(1);expect(included.events[0]).toMatchObject({uid:original.events[0]!.uid,start:original.events[0]!.start,end:original.events[0]!.end,status:'CANCELLED'});
 });
 it.each(['bookings','trips','itinerary'] as const)('excludes completed converted Trips from %s unless history is selected',async category=>{
  const completed={...converted,data:{...converted.data,status:'completed'}};
  const options={...DEFAULT_CALENDAR_OPTIONS,categories:[category]};
  expect((await buildCalendarPreview(snapshot([booking,completed]),options)).events).toHaveLength(0);
  expect((await buildCalendarPreview(snapshot([booking,completed]),{...options,includeHistory:true})).events).toHaveLength(1);
 });
 it('uses the canonical draft status for a conversion instead of promoting it to confirmed',async()=>{
  const draft={...converted,data:{...converted.data,status:'draft'}};
  expect((await buildCalendarPreview(snapshot([booking,draft]),DEFAULT_CALENDAR_OPTIONS)).events[0]?.status).toBe('TENTATIVE');
 });

 it('exports a converted event once, preserving its pre-conversion UID and saved time',async()=>{
  const original=await buildCalendarPreview(snapshot([booking]),DEFAULT_CALENDAR_OPTIONS);
  const after=await buildCalendarPreview(snapshot(),DEFAULT_CALENDAR_OPTIONS);
  expect(after.events).toHaveLength(1);expect(after.events[0]?.uid).toBe(original.events[0]?.uid);expect(after.events[0]?.start).toEqual(original.events[0]?.start);expect(after.events[0]?.end).toEqual(original.events[0]?.end);
 });
 it('keeps converted events included when only Trips are selected',async()=>{
  const preview=await buildCalendarPreview(snapshot(),{...DEFAULT_CALENDAR_OPTIONS,categories:['trips']});expect(preview.events).toHaveLength(1);expect(preview.events[0]?.precision).toBe('minute');
 });
 it('includes an independently created Trip and keeps private details out of the actual ICS',async()=>{
  const separate={...converted,id:'independent-trip',data:{name:'New Trip',startsOn:'2026-11-01',endsOn:'2026-11-03',status:'planned'}};
  const preview=await buildCalendarPreview(snapshot([booking,separate]),DEFAULT_CALENDAR_OPTIONS);expect(preview.events).toHaveLength(2);
  const ics=renderCalendar(preview.events,Object.fromEntries(preview.events.map(e=>[e.uid,0])),'2026-10-04T12:00:00Z');expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);expect(ics).not.toContain('Private notes');expect(ics).not.toContain('private-dive-id');expect(ics).not.toContain('Original 🐬 event');
 });
 it('does not collapse a distinct spanning Trip merely because it links an event',async()=>{
  const linked={...converted,data:{...converted.data,originCalendarBookingId:undefined,name:'Larger expedition',startsOn:'2026-10-08',endsOn:'2026-10-14',itinerary:[]}};
  expect((await buildCalendarPreview(snapshot([booking,linked]),DEFAULT_CALENDAR_OPTIONS)).events).toHaveLength(2);
 });
 it('retains owner-edited itinerary times rather than hiding them behind imported provenance',async()=>{
  const changed={...converted,data:{...converted.data,itinerary:[{...converted.data.itinerary[0],startsAt:'2026-10-11T08:30',endsAt:'2026-10-11T16:00'}]}};
  const preview=await buildCalendarPreview(snapshot([booking,changed]),DEFAULT_CALENDAR_OPTIONS);expect(preview.events).toHaveLength(2);expect(preview.events.some(event=>event.start.value.startsWith('20261011'))).toBe(true);
 });
 it('exports an imported event with its stable original identity for itinerary-only selections',async()=>{
  const original=await buildCalendarPreview(snapshot([booking]),DEFAULT_CALENDAR_OPTIONS);
  const preview=await buildCalendarPreview(snapshot(),{...DEFAULT_CALENDAR_OPTIONS,categories:['itinerary']});
  expect(preview.events).toHaveLength(1);expect(preview.events[0]?.uid).toBe(original.events[0]?.uid);expect(preview.events[0]?.precision).toBe('minute');
 });
});
