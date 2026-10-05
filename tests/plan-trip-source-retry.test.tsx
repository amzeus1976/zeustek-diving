import {afterEach,describe,expect,it,vi} from 'vitest';

const harness=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,effects:[] as Array<()=>unknown>,trips:[] as unknown[],failTrip:false,refresh:null as null|(()=>Promise<void>)}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 useState:(initial:unknown)=>{const i=harness.cursor++;if(!(i in harness.slots))harness.slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [harness.slots[i],(next:unknown)=>{harness.slots[i]=typeof next==='function'?(next as (old:unknown)=>unknown)(harness.slots[i]):next;}];},
 useRef:(initial:unknown)=>{const i=harness.cursor++;if(!(i in harness.slots))harness.slots[i]={current:initial};return harness.slots[i];},useMemo:(read:()=>unknown)=>read(),useCallback:(fn:unknown)=>fn,useEffect:(fn:()=>unknown,deps:unknown[])=>{const i=harness.cursor++,old=harness.slots[i] as unknown[]|undefined;if(!old||deps.some((v,n)=>v!==old[n])){harness.slots[i]=deps;harness.effects.push(fn);}},
}));
vi.mock('../components/record-status',()=>({useRecordRefresh:(refresh:()=>Promise<void>)=>{harness.refresh=refresh;}}));
vi.mock('../lib/offline/dive-planning',async original=>({...await original<typeof import('../lib/offline/dive-planning')>(),listDiveSites:async()=>[],listPeople:async()=>[],listOperators:async()=>[]}));
vi.mock('../lib/offline/loadouts-gas',async original=>({...await original<typeof import('../lib/offline/loadouts-gas')>(),listReusableLoadouts:async()=>[],listCylinderFills:async()=>[],listGasAnalyses:async()=>[]}));
vi.mock('../lib/gear/read-cylinder-inventory',()=>({readCylinderInventory:async()=>[]}));
vi.mock('../lib/offline/dives',async original=>({...await original<typeof import('../lib/offline/dives')>(),listDives:async()=>[]}));
vi.mock('../lib/offline/dive-context',async original=>({...await original<typeof import('../lib/offline/dive-context')>(),listCanonicalSkills:async()=>[]}));
vi.mock('../lib/offline/trips-expeditions',async original=>({...await original<typeof import('../lib/offline/trips-expeditions')>(),listDiveExpeditionTrips:async()=>{if(harness.failTrip)throw Error('Fixture Trip load failure');return harness.trips;}}));
vi.mock('../lib/offline/planning-pages',async original=>({...await original<typeof import('../lib/offline/planning-pages')>(),listGasPlans:async()=>[]}));
vi.mock('../lib/planning/calendar-booking-workflow',async original=>({...await original<typeof import('../lib/planning/calendar-booking-workflow')>(),readCalendarSources:async()=>({entries:[],bookings:[]})}));
const plan=vi.hoisted(()=>({entityId:'selected-plan',name:'Repeated dive',startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Fixture Site',status:'planned',lifecycleStatus:'draft',notes:'Original notes',diveCentreIds:['centre-a'],planTeam:[],checklist:[],createdAt:'2026-10-05',modifiedAt:'2026-10-05'}));
vi.mock('../lib/offline/dive-planning-centre',async original=>({...await original<typeof import('../lib/offline/dive-planning-centre')>(),listEnrichedDivePlans:async()=>[plan]}));
import {DivePlanningCentre,PlanEditor} from '../components/dive-planning-centre';

type Node={type?:unknown;props?:Record<string,unknown>&{children?:unknown}};
function nodes(value:unknown):Node[]{if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object'||!('props' in value))return [];const node=value as Node;return [node,...nodes(node.props?.children)];}
async function mounted(fail=false){harness.slots=[];harness.cursor=0;harness.effects=[];harness.trips=[];harness.failTrip=fail;
 vi.stubGlobal('window',{location:{search:'?section=Dive+Plans&newPlanForTrip=exact-trip',pathname:'/'},history:{state:null,replaceState:(_a:unknown,_b:unknown,url:string)=>{window.location.search=url.includes('?')?'?'+url.split('?')[1]:'';}}});
 vi.stubGlobal('requestAnimationFrame',(fn:()=>void)=>{fn();return 1;});vi.stubGlobal('cancelAnimationFrame',()=>{});
 const render=()=>{harness.cursor=0;const output=DivePlanningCentre({convertToDive:()=>{}});for(const effect of harness.effects.splice(0))effect();return output;};render();await harness.refresh!().catch(()=>{});return render;
}
const trip={entityId:'exact-trip',name:'Exact reviewed Trip',startsOn:'2026-10-10',endsOn:'2026-10-12',siteIds:[],planIds:[],teamPersonIds:[],itinerary:[],status:'planned',destination:'Fixture harbour'};
afterEach(()=>vi.unstubAllGlobals());
describe('Exact Trip-backed Plan creation source',()=>{
 it('missing requested Trip cannot display or duplicate an unrelated saved Plan',async()=>{const render=await mounted(),tree=nodes(render());expect(tree.some(node=>node.props?.role==='alert'&&String(node.props.children).includes('source Trip'))).toBe(true);expect(tree.some(node=>node.type==='button'&&node.props?.children==='Duplicate plan')).toBe(false);expect(tree.some(node=>node.type===PlanEditor)).toBe(false);expect(window.location.search).toContain('newPlanForTrip=exact-trip');});
 it('failed Trip load keeps the exact source request and an explicit retry path',async()=>{const render=await mounted(true),tree=nodes(render());expect(tree.some(node=>node.props?.role==='alert'&&String(node.props.children).includes('source Trip'))).toBe(true);expect(tree.some(node=>node.type==='button'&&node.props?.children==='Refresh source Trip')).toBe(true);expect(tree.some(node=>node.type==='button'&&node.props?.children==='Duplicate plan')).toBe(false);expect(window.location.search).toContain('newPlanForTrip=exact-trip');});
 it('retry opens only the exact recovered Trip draft and consumes the URL after successful source resolution',async()=>{const render=await mounted(true);render();harness.failTrip=false;harness.trips=[{...trip,entityId:'different-trip'},trip];await harness.refresh!();render();const editor=render();expect(editor.type).toBe(PlanEditor);expect(editor.props.item).toBeNull();expect(editor.props.newPlanTripId).toBe('exact-trip');expect(editor.props.trips.map((t:{entityId:string})=>t.entityId)).toContain('exact-trip');expect(window.location.search).not.toContain('newPlanForTrip');});
});
