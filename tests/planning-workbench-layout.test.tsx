import {afterEach,describe,expect,it,vi} from 'vitest';

const harness=vi.hoisted(()=>({slots:[] as unknown[],cursor:0,refresh:null as null|(()=>Promise<void>)}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 useState:(initial:unknown)=>{const i=harness.cursor++;if(!(i in harness.slots))harness.slots[i]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [harness.slots[i],(next:unknown)=>{harness.slots[i]=typeof next==='function'?(next as (old:unknown)=>unknown)(harness.slots[i]):next;}];},
 useRef:(initial:unknown)=>{const i=harness.cursor++;if(!(i in harness.slots))harness.slots[i]={current:initial};return harness.slots[i];},useMemo:(read:()=>unknown)=>read(),useCallback:(fn:unknown)=>fn,useEffect:()=>{},
}));
vi.mock('../components/record-status',()=>({useRecordRefresh:(refresh:()=>Promise<void>)=>{harness.refresh=refresh;}}));
vi.mock('../lib/offline/dive-planning',async original=>({...await original<typeof import('../lib/offline/dive-planning')>(),listDiveSites:async()=>[],listPeople:async()=>[],listOperators:async()=>[]}));
vi.mock('../lib/offline/loadouts-gas',async original=>({...await original<typeof import('../lib/offline/loadouts-gas')>(),listReusableLoadouts:async()=>[],listCylinderFills:async()=>[],listGasAnalyses:async()=>[]}));
vi.mock('../lib/gear/read-cylinder-inventory',()=>({readCylinderInventory:async()=>[]}));
vi.mock('../lib/offline/dives',async original=>({...await original<typeof import('../lib/offline/dives')>(),listDives:async()=>[]}));
vi.mock('../lib/offline/dive-context',async original=>({...await original<typeof import('../lib/offline/dive-context')>(),listCanonicalSkills:async()=>[]}));
vi.mock('../lib/offline/trips-expeditions',async original=>({...await original<typeof import('../lib/offline/trips-expeditions')>(),listDiveExpeditionTrips:async()=>[]}));
vi.mock('../lib/offline/planning-pages',async original=>({...await original<typeof import('../lib/offline/planning-pages')>(),listGasPlans:async()=>[]}));
vi.mock('../lib/planning/calendar-booking-workflow',async original=>({...await original<typeof import('../lib/planning/calendar-booking-workflow')>(),readCalendarSources:async()=>({entries:[],bookings:[]})}));
const plan=vi.hoisted(()=>({entityId:'selected-plan',name:'Repeated dive',startDate:'2026-10-10',endDate:'2026-10-10',siteName:'Fixture Site',status:'planned',lifecycleStatus:'draft',notes:'Original notes',diveCentreIds:['centre-a'],planTeam:[],checklist:[],createdAt:'2026-10-05',modifiedAt:'2026-10-05'}));
vi.mock('../lib/offline/dive-planning-centre',async original=>({...await original<typeof import('../lib/offline/dive-planning-centre')>(),listEnrichedDivePlans:async()=>[plan]}));
import {DivePlanningCentre,PlanEditor} from '../components/dive-planning-centre';
import {PlanningDiveCentres} from '../components/planning/planning-dive-centres';

type Node={type?:unknown;props?:Record<string,unknown>&{children?:unknown}};
function nodes(value:unknown):Node[]{if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object'||!('props' in value))return [];const node=value as Node;return [node,...nodes(node.props?.children)];}
async function mounted(){harness.slots=[];harness.cursor=0;vi.stubGlobal('window',{location:{search:'?section=Dive+Plans&planId=selected-plan'}});const render=()=>{harness.cursor=0;return DivePlanningCentre({convertToDive:()=>{}});};render();await harness.refresh!();return render;}
afterEach(()=>vi.unstubAllGlobals());
describe('Selected Plan workbench and repeat action',()=>{
 it('keeps three ordered summary cards and four full-width disclosures, with centre contacts inside Team',async()=>{
  const render=await mounted(),tree=nodes(render()),cards=tree.filter(node=>typeof node.props?.title==='string'&&String(node.props.title).toUpperCase()===node.props.title);
  expect(cards.map(node=>node.props!.title)).toEqual(['SITE & CONDITIONS','EQUIPMENT READINESS','TEAM & ROLES','LINKED GAS PLANS','SAFETY & HF (INTEGRATED)','EMERGENCY & CHECKLISTS','PLAN NOTES']);
  expect(cards.slice(0,3).every(node=>!node.props!.fullWidth)).toBe(true);expect(cards.slice(3).every(node=>node.props!.fullWidth===true)).toBe(true);
  const contacts=nodes(cards[2]?.props?.children).find(node=>node.type===PlanningDiveCentres);expect(contacts?.props?.ids).toEqual(['centre-a']);
 });
 it('the visible Duplicate plan action opens a new editor with the exact selected source and leaves the original untouched',async()=>{
  const render=await mounted(),before=JSON.stringify(plan),action=nodes(render()).find(node=>node.type==='button'&&node.props?.children==='Duplicate plan');expect(action).toBeDefined();(action!.props!.onClick as ()=>void)();const editor=render();expect(editor.type).toBe(PlanEditor);expect(editor.props.item).toBeNull();expect(editor.props.copyFrom).toBe(plan);expect(JSON.stringify(plan)).toBe(before);
 });
});
