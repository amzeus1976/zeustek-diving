import {afterEach,describe,expect,it,vi} from 'vitest';

// Exercise the root component's actual load/effect sequence without a DOM or child editors.
const harness=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,effects:[] as Array<()=>unknown>,refresh:null as null|(()=>void),registered:false,fail:true,bookingExtra:{} as Record<string,unknown>,trips:[] as unknown[]}));
vi.mock('react',async importOriginal=>{
 const actual=await importOriginal<typeof import('react')>();
 return {...actual,
  useState:(initial:unknown)=>{const i=harness.cursor++;if(!(i in harness.slots))harness.slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [harness.slots[i],(next:unknown)=>{harness.slots[i]=typeof next==='function'?(next as (old:unknown)=>unknown)(harness.slots[i]):next;}];},
  useRef:(initial:unknown)=>{const i=harness.cursor++;if(!(i in harness.slots))harness.slots[i]={current:initial};return harness.slots[i];},
  useMemo:(read:()=>unknown)=>read(),useCallback:(fn:unknown)=>fn,
  useEffect:(fn:()=>unknown,deps:unknown[])=>{const i=harness.cursor++;const old=harness.slots[i] as unknown[]|undefined;if(!old||deps.some((v,n)=>v!==old[n])){harness.slots[i]=deps;harness.effects.push(fn);}},
 };
});
vi.mock('../components/record-status',async importOriginal=>({...await importOriginal<typeof import('../components/record-status')>(),useRecordRefresh:(refresh:()=>void)=>{harness.refresh=refresh;if(!harness.registered){harness.registered=true;harness.effects.push(refresh);}}}));
vi.mock('../lib/offline/dive-store',async importOriginal=>({...await importOriginal<typeof import('../lib/offline/dive-store')>(),currentDiveAccount:()=> 'dummy-owner'}));
const source={entityId:'exact-booking',name:'Dummy event',startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Dummy site',notes:'Keep original text',status:'confirmed',bookingStatus:'confirmed',bookingKind:'dive'};
vi.mock('../lib/offline/dive-planning',async importOriginal=>({...await importOriginal<typeof import('../lib/offline/dive-planning')>(),listDiveTrips:async()=>{if(harness.fail)throw Error('Fixture transport failure');return [{...source,...harness.bookingExtra},{entityId:'legacy-plan',name:'Legacy canonical Plan',startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Dummy site'}];},listOperators:async()=>[],listDiveSites:async()=>[],listPeople:async()=>[],listEquipment:async()=>[],listEquipmentSets:async()=>[]}));
vi.mock('../lib/offline/trips-expeditions',async importOriginal=>({...await importOriginal<typeof import('../lib/offline/trips-expeditions')>(),listDiveExpeditionTrips:async()=>harness.trips}));
import {TripsExpeditions} from '../components/trips-expeditions';

afterEach(()=>vi.unstubAllGlobals());
function initialise(fail=false){
 harness.slots=[];harness.cursor=0;harness.effects=[];harness.registered=false;harness.fail=fail;harness.bookingExtra={};harness.trips=[];
 vi.stubGlobal('window',{location:{search:'?section=Trips&fromEventId=exact-booking'}});
 vi.stubGlobal('requestAnimationFrame',(fn:()=>void)=>{fn();return 1;});vi.stubGlobal('cancelAnimationFrame',()=>{});
 return ()=>{harness.cursor=0;const output=TripsExpeditions({});for(const effect of harness.effects.splice(0))effect();return output;};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function itemInTree(node:unknown):{entityId:string}|undefined{
 if(Array.isArray(node)){for(const child of node){const found=itemInTree(child);if(found)return found;}return;}
 if(!node||typeof node!=='object'||!('props' in node))return;
 const props=(node as {props:{item?:{entityId:string};children?:unknown}}).props;
 return props.item??itemInTree(props.children);
}
const fixtureTrip=(entityId:string)=>({entityId,name:'Existing dummy Trip',status:'planned',startsOn:'2026-10-10',endsOn:'2026-10-10',originCalendarBookingId:'exact-booking',calendarBookingIds:['exact-booking'],teamPersonIds:[],siteIds:[],planIds:[],itinerary:[],bookings:[],packingEquipmentSetIds:[],packingItems:[],gasLogistics:[],documentAttachmentIds:[],createdAt:'2026-10-05T00:00:00Z',modifiedAt:'2026-10-05T00:00:00Z'});
describe('Exact event conversion after a failed initial Trip load',()=>{
 it('keeps the source booking for conversion but excludes it from linked Dive Plan choices',async()=>{
  const render=initialise();render();await tick();render();const editor=render();
  expect(editor.props.sourceBooking?.entityId).toBe('exact-booking');
  expect(editor.props.plans.map((plan:{entityId:string})=>plan.entityId)).toEqual(['legacy-plan']);
 });
 it('reports conflicting conversions before opening an explicitly linked Trip',async()=>{
  const render=initialise();harness.bookingExtra={linkedTripId:'trip-a'};harness.trips=[fixtureTrip('trip-a'),fixtureTrip('trip-b')];
  render();await tick();render();const output=render();
  expect(harness.slots).toContain('Multiple Trip associations need review before creating another Trip.');
  expect(itemInTree(output)).toBeUndefined();expect(output.props.sourceBooking).toBeUndefined();
 });
 it('retries the exact endpoint when a linked Trip was initially absent from a successful source load',async()=>{
  const render=initialise();harness.bookingExtra={linkedTripId:'trip-a'};
  render();await tick();render();render();
  expect(harness.slots).toContain('The linked Trip is unavailable. The original event is retained.');
  harness.trips=[fixtureTrip('trip-a')];harness.refresh!();await tick();render();const output=render();
  expect(itemInTree(output)?.entityId).toBe('trip-a');
  expect(harness.slots).not.toContain('The linked Trip is unavailable. The original event is retained.');
 });
 it('retains the valid source endpoint for a successful retry and clears the failed-load message',async()=>{
  const render=initialise(true);
  render();await new Promise(resolve=>setTimeout(resolve,0));render();
  expect(harness.slots).toContain('Trip records could not be loaded. Existing records are retained.');
  harness.fail=false;harness.refresh!();await new Promise(resolve=>setTimeout(resolve,0));render();
  const editor=render();
  expect(editor.props.sourceBooking?.entityId).toBe('exact-booking');
  expect(editor.props.sourceBooking?.notes).toBe('Keep original text');
  expect(harness.slots).not.toContain('Trip records could not be loaded. Existing records are retained.');
 });
});
