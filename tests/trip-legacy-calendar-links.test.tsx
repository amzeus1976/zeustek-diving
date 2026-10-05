import 'fake-indexeddb/auto';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {TripDetail} from '../components/trips-expeditions';
import {requestedCalendarEventId} from '../components/planning/diving-calendar-bookings';
import type {Stored,DiveTripRecord} from '../lib/offline/dive-planning';
import type {DiveExpeditionTripRecord} from '../lib/offline/trips-expeditions';

const trip={entityId:'holiday',name:'Holiday',destination:'Dummy coast',status:'planned',startsOn:'2026-10-10',endsOn:'2026-10-11',siteIds:[],teamPersonIds:[],planIds:['plan','event'],itinerary:[],bookings:[],packingEquipmentSetIds:[],packingItems:[],gasLogistics:[],documentAttachmentIds:[],notes:'Original text'} as unknown as Stored<DiveExpeditionTripRecord>;
const sources=[{entityId:'plan',name:'Canonical Plan'},{entityId:'event',name:'Legacy booking',bookingKind:'dive'}] as Array<Stored<DiveTripRecord>>;
const render=(item=trip,plans=sources)=>renderToStaticMarkup(<TripDetail item={item} plans={plans} sites={[]} people={[]} equipment={[]} equipmentSets={[]} currentUserId="dummy" close={()=>{}} edit={()=>{}} remove={()=>{}} togglePacked={()=>{}} addDocuments={async()=>{}} removeDocument={async()=>{}} changed={()=>{}}/>);
const target=(html:string,label:string)=>new URL([...html.matchAll(/href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].find(row=>row[2]?.includes(label))![1]!.replaceAll('&amp;','&'),'https://fixture.invalid').searchParams;
describe('Trip historical planning references retain exact source navigation',()=>{
 it('known Calendar entry keeps its label and opens Calendar rather than another Plan',()=>{const html=render(),route=target(html,'Legacy booking');expect(route.get('section')).toBe('Diving Calendar & Bookings');expect(requestedCalendarEventId('?'+route.toString())).toBe('event');expect(route.has('planId')).toBe(false);expect(html).not.toContain('Plan unavailable');});
 it('a canonical Plan retains its exact Dive Plans link',()=>{const route=target(render(),'Canonical Plan');expect(route.get('section')).toBe('Dive Plans');expect(route.get('planId')).toBe('plan');});
 it('a missing historical endpoint stays visible for reviewed unlinking',()=>{expect(render({...trip,planIds:['missing']})).toContain('Plan unavailable');});
 it('displaying legacy Calendar references never rewrites Trip or source data',()=>{const before=structuredClone({trip,sources});render();expect({trip,sources}).toEqual(before);});
});
