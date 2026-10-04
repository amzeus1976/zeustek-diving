import {describe,expect,it} from 'vitest';
import {buildCalendarPreview,DEFAULT_CALENDAR_OPTIONS} from '../lib/calendar/calendar-model';
import {renderCalendar} from '../lib/calendar/calendar-ical';
const booking={kind:'trip',id:'event-a',data:{name:'Original 🐬 event',bookingKind:'dive',startDate:'2026-10-10',endDate:'2026-10-10',startAt:'2026-10-10T08:30',endAt:'2026-10-10T16:00',siteName:'Public test harbour',locationName:'Public test harbour',bookingStatus:'confirmed',notes:'Private notes',linkedDiveIds:['private-dive-id']}};
const converted={kind:'dive-trip',id:'trip-a',data:{name:'Original 🐬 event',startsOn:'2026-10-10',endsOn:'2026-10-10',status:'confirmed',originCalendarBookingId:'event-a',calendarBookingIds:['event-a'],itinerary:[{id:'calendar-event:event-a',calendarBookingId:'event-a',kind:'dive',title:'Original 🐬 event',startsAt:'2026-10-10T08:30',endsAt:'2026-10-10T16:00'}]}};
const snapshot=(records=[booking,converted])=>({accountId:'dummy-owner',snapshotAt:'2026-10-04T12:00:00Z',records,completeKinds:['trip','dive-trip','equipment','cylinder','certification']});
describe('Google-compatible booking / Trip export',()=>{
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
});
