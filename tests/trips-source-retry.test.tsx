import {afterEach,describe,expect,it,vi} from 'vitest';

// Exercise the root component's actual load/effect sequence without a DOM or child editors.
const harness=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,effects:[] as Array<()=>unknown>,refresh:null as null|(()=>void),registered:false,fail:true}));
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
vi.mock('../lib/offline/dive-planning',async importOriginal=>({...await importOriginal<typeof import('../lib/offline/dive-planning')>(),listDiveTrips:async()=>{if(harness.fail)throw Error('Fixture transport failure');return [source];},listDiveSites:async()=>[],listPeople:async()=>[],listEquipment:async()=>[],listEquipmentSets:async()=>[]}));
vi.mock('../lib/offline/trips-expeditions',async importOriginal=>({...await importOriginal<typeof import('../lib/offline/trips-expeditions')>(),listDiveExpeditionTrips:async()=>[]}));
import {TripsExpeditions} from '../components/trips-expeditions';

afterEach(()=>vi.unstubAllGlobals());
describe('Exact event conversion after a failed initial Trip load',()=>{
 it('retains the valid source endpoint for a successful retry and clears the failed-load message',async()=>{
  harness.slots=[];harness.cursor=0;harness.effects=[];harness.registered=false;harness.fail=true;
  vi.stubGlobal('window',{location:{search:'?section=Trips&fromEventId=exact-booking'}});
  vi.stubGlobal('requestAnimationFrame',(fn:()=>void)=>{fn();return 1;});vi.stubGlobal('cancelAnimationFrame',()=>{});
  const render=()=>{harness.cursor=0;const output=TripsExpeditions({});for(const effect of harness.effects.splice(0))effect();return output;};
  render();await new Promise(resolve=>setTimeout(resolve,0));render();
  expect(harness.slots).toContain('Trip records could not be loaded. Existing records are retained.');
  harness.fail=false;harness.refresh!();await new Promise(resolve=>setTimeout(resolve,0));render();
  const editor=render();
  expect(editor.props.sourceBooking?.entityId).toBe('exact-booking');
  expect(editor.props.sourceBooking?.notes).toBe('Keep original text');
  expect(harness.slots).not.toContain('Trip records could not be loaded. Existing records are retained.');
 });
});
