import 'fake-indexeddb/auto';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {BookingDetail} from '../components/planning/diving-calendar-bookings';
import type {CalendarBooking} from '../lib/planning/calendar-booking-workflow';

const event={entityId:'event',name:'Boat day',bookingKind:'dive',bookingStatus:'planned',startDate:'2026-10-10',endDate:'2026-10-10',notes:'Retain source text'} as CalendarBooking;
const canonicalPlan=()=>{const plan={...event,entityId:'plan'};delete plan.bookingKind;return plan;};
const render=(item:CalendarBooking,isCanonicalPlan=false)=>renderToStaticMarkup(<BookingDetail item={item} isCanonicalPlan={isCanonicalPlan} trips={[]} dives={[]} edit={()=>{}} refresh={async()=>{}} go={()=>{}}/>);

describe('Calendar actions retain canonical record ownership',()=>{
 it('Gas action links directly to Gas Planning with the exact canonical Plan ID',()=>{const html=render(canonicalPlan(),true);expect(html).toContain('href="?section=Gas+Planning&amp;newGasPlanFor=plan"');expect(html).toContain('Plan gas from this Dive Plan');});
 it('linked event Gas action uses its selected Plan, never the event ID, including encoded Unicode IDs',()=>{const item={...event,linkedDivePlanId:'Plan 船 & repeated'};const before=structuredClone(item),html=render(item);expect(html).toContain('href="?section=Gas+Planning&amp;newGasPlanFor=Plan+%E8%88%B9+%26+repeated"');expect(html).not.toContain('newGasPlanFor=event');expect(item).toEqual(before);});
 it('unlinked events and Trip projections cannot open a gas draft without an explicit Dive Plan',()=>{for(const item of [event,{...event,entityId:'holiday',calendarSource:'dive-trip' as const,linkedTripId:'holiday'}]){const html=render(item);expect(html).toContain('disabled=""');expect(html).toContain('Create or link a Dive Plan before planning gas.');expect(html).not.toContain('newGasPlanFor=');}});
 it('canonical Plan offers its exact planning workspace rather than misleading event deletion',()=>{const plan=canonicalPlan();const before=structuredClone(plan),html=render(plan,true);expect(html).toContain('Open Dive Plan to edit / delete');expect(html).not.toContain('>Delete event<');expect(html).not.toContain('Edit event');expect(plan).toEqual(before);});
 it('Plan projection does not offer event archive, cancellation or status changes',()=>{const html=render(canonicalPlan(),true);expect(html).not.toContain('Archive event');expect(html).not.toContain('Cancel event');expect(html).not.toContain('Mark complete');});
 it('an ordinary event retains explicit event editing and recoverable deletion',()=>{const before=structuredClone(event),html=render(event);expect(html).toContain('Edit event');expect(html).toContain('>Delete event<');expect(html).toContain('Archive event');expect(event).toEqual(before);});
 it('an event linked to a Plan remains independently editable and deletable through guarded review',()=>{const html=render({...event,linkedDivePlanId:'plan'});expect(html).toContain('>Delete event<');expect(html).toContain('Edit event');});
 it('a Trip projection keeps lifecycle controls in its canonical Trip workspace',()=>{const html=render({...event,entityId:'holiday',calendarSource:'dive-trip',linkedTripId:'holiday'});expect(html).toContain('Open Trip to edit / delete');expect(html).not.toContain('>Delete event<');expect(html).not.toContain('Archive event');});
});
