import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({slots:[] as unknown[],cursor:0}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),useId:()=> 'journey',useState:(initial:unknown)=>{const i=state.cursor++;if(!(i in state.slots))state.slots[i]=initial;return [state.slots[i],(next:unknown)=>{state.slots[i]=typeof next==='function'?(next as (previous:unknown)=>unknown)(state.slots[i]):next;}];}}));
import {TripGettingThere} from '../components/trip-getting-there';
import type {DiveSiteRecord,Stored} from '../lib/offline/dive-planning';
type Node={type?:unknown;props?:Record<string,unknown>&{children?:unknown}};
function nodes(value:unknown):Node[]{if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object'||!('props' in value))return [];const node=value as Node;return [node,...nodes(node.props?.children)];}
const sites=[{entityId:'site-a',name:'Pier',postcode:'AA1 1AA'},{entityId:'site-b',name:'Harbour',postcode:'BB2 2BB'}] as Array<Stored<DiveSiteRecord>>;
function mount(arrivalPoint='',arrivalSource:'site'|'owner'='owner'){
 const onArrivalChange=vi.fn((next:string,source?:'site'|'owner')=>{arrivalPoint=next;arrivalSource=source??'owner';});
 const render=()=>{state.cursor=0;return nodes(TripGettingThere({siteIds:['site-a','site-b'],sites,people:[],arrivalPoint,arrivalSource,onArrivalChange}));};
 const select=(id:string)=>{const input=render().find(n=>n.props?.id==='journey-destination')!;(input.props!.onChange as (event:{target:{value:string}})=>void)({target:{value:id}});};
 return {render,select,onArrivalChange,replace:(next:string)=>{arrivalPoint=next;}};
}
beforeEach(()=>{state.slots=[];state.cursor=0;});
describe('controlled Trip arrival selector',()=>{
 it.each([['empty','', 'owner'],['derived','Previous road','site']] as const)('retains the exact selected Site and View Site after %s arrival is filled',(_label,point,source)=>{const ui=mount(point,source);ui.select('site-a');const tree=ui.render();expect(tree.find(n=>n.props?.id==='journey-destination')!.props!.value).toBe('site-a');expect(tree.some(n=>n.props?.children==='View Site'&&String(n.props.href).includes('siteId=site-a'))).toBe(true);expect(ui.onArrivalChange).toHaveBeenLastCalledWith('AA1 1AA','site');ui.select('site-b');expect(ui.render().find(n=>n.props?.id==='journey-destination')!.props!.value).toBe('site-b');expect(ui.onArrivalChange).toHaveBeenLastCalledWith('BB2 2BB','site');});
 it('keeps a manual harbour unchanged while a Site is explicitly reviewed',()=>{const ui=mount('My reviewed harbour','owner');ui.select('site-b');expect(ui.render().find(n=>n.props?.id==='journey-destination')!.props!.value).toBe('site-b');expect(ui.onArrivalChange).not.toHaveBeenCalled();});
 it('does not retain a stale Site choice after another control changes the arrival',()=>{const ui=mount();ui.select('site-a');ui.replace('New owner address');expect(ui.render().find(n=>n.props?.id==='journey-destination')!.props!.value).toBe('custom');});
});
