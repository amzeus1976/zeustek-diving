import 'fake-indexeddb/auto';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {BookingDetail} from '../components/planning/diving-calendar-bookings';
import type {CalendarBooking} from '../lib/planning/calendar-booking-workflow';

const event={entityId:'event',name:'Boat day',bookingKind:'dive',bookingStatus:'planned',startDate:'2026-10-10',endDate:'2026-10-10',notes:'Retain source text'} as CalendarBooking;
const canonicalPlan=()=>{const plan={...event,entityId:'plan'};delete plan.bookingKind;return plan;};
const render=(item:CalendarBooking,isCanonicalPlan=false)=>renderToStaticMarkup(<BookingDetail item={item} isCanonicalPlan={isCanonicalPlan} trips={[]} dives={[]} edit={()=>{}} refresh={async()=>{}} go={()=>{}}/>);

describe('Calendar actions retain canonical record ownership',()=>{
 it('canonical Plan offers its exact planning workspace rather than misleading event deletion',()=>{const plan=canonicalPlan();const before=structuredClone(plan),html=render(plan,true);expect(html).toContain('Open Dive Plan to edit / delete');expect(html).not.toContain('>Delete event<');expect(html).not.toContain('Edit event');expect(plan).toEqual(before);});
 it('Plan projection does not offer event archive, cancellation or status changes',()=>{const html=render(canonicalPlan(),true);expect(html).not.toContain('Archive event');expect(html).not.toContain('Cancel event');expect(html).not.toContain('Mark complete');});
 it('an ordinary event retains explicit event editing and recoverable deletion',()=>{const before=structuredClone(event),html=render(event);expect(html).toContain('Edit event');expect(html).toContain('>Delete event<');expect(html).toContain('Archive event');expect(event).toEqual(before);});
 it('an event linked to a Plan remains independently editable and deletable through guarded review',()=>{const html=render({...event,linkedDivePlanId:'plan'});expect(html).toContain('>Delete event<');expect(html).toContain('Edit event');});
 it('a Trip projection keeps lifecycle controls in its canonical Trip workspace',()=>{const html=render({...event,entityId:'holiday',calendarSource:'dive-trip',linkedTripId:'holiday'});expect(html).toContain('Open Trip to edit / delete');expect(html).not.toContain('>Delete event<');expect(html).not.toContain('Archive event');});
});
