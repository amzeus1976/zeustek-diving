import {afterEach,describe,expect,it,vi} from 'vitest';
import {conditionReading,type ConditionsSnapshot} from '../lib/weather/conditions-model';
import {refreshPlanWeatherFields,editPlanWeatherField} from '../lib/plan-weather';
import type {StoredEnrichedDivePlan} from '../lib/offline/dive-planning-centre';

const hooks=vi.hoisted(()=>({slots:[] as unknown[],cursor:0}));
const weather=vi.hoisted(()=>({forecast:vi.fn()}));
const persistence=vi.hoisted(()=>({save:vi.fn(async(_input:unknown)=>({id:'plan-a'}))}));
vi.mock('react',async original=>({...await original<typeof import('react')>(),
 useState:(initial:unknown)=>{const index=hooks.cursor++;if(!(index in hooks.slots))hooks.slots[index]=typeof initial==='function'?(initial as ()=>unknown)():initial;return [hooks.slots[index],(next:unknown)=>{hooks.slots[index]=typeof next==='function'?(next as (value:unknown)=>unknown)(hooks.slots[index]):next;}];},
 useRef:(initial:unknown)=>{const index=hooks.cursor++;if(!(index in hooks.slots))hooks.slots[index]={current:initial};return hooks.slots[index];},
 useMemo:(read:()=>unknown)=>read(),useCallback:(fn:unknown)=>fn,useEffect:()=>{},
}));
vi.mock('../lib/weather/client-provider',()=>({weatherProvider:()=>weather}));
vi.mock('../lib/planning/calendar-plan-creation',()=>({savePlanDraftWithConnections:persistence.save}));
import {PlanEditor} from '../components/dive-planning-centre';
import {RecordEditorWorkspace} from '../components/shared/record-editor-workspace';

type Node={type?:unknown;props?:Record<string,unknown>&{children?:unknown}};
function nodes(value:unknown):Node[]{if(Array.isArray(value))return value.flatMap(nodes);if(!value||typeof value!=='object'||!('props' in value))return [];const node=value as Node;return [node,...nodes(node.props?.children)];}
function text(value:unknown):string{if(Array.isArray(value))return value.map(text).join('');if(value&&typeof value==='object'&&'props' in value)return text((value as Node).props?.children);return typeof value==='string'?value:'';}
function fixture(){
 const snapshot:ConditionsSnapshot={version:1,retrievedAt:'2026-10-06T08:00:00Z',request:{latitude:55,longitude:-2,siteId:'site-a',siteName:'Fixture coast',siteType:'coastal',provider:'open-meteo',date:'2026-10-10',time:'12:00',mode:'forecast',marine:true},readings:Array.from({length:2353},()=>conditionReading('air-temperature',12,'celsius',{label:'Fixture provider',provider:'open-meteo',kind:'model',classification:'forecast',validAt:'2026-10-10T12:00:00Z',retrievedAt:'2026-10-06T08:00:00Z',observedAt:null,url:'https://example.invalid',resolution:'hourly',latitude:55,longitude:-2,timeZone:'UTC',depth:{kind:'surface'}})!),diagnostics:[]};
 const plan:StoredEnrichedDivePlan={entityId:'plan-a',name:'Fixture plan',startDate:'2026-10-10',endDate:'2026-10-10',siteId:'site-a',siteName:'Fixture coast',status:'planned',buddy:'',notes:'Original notes',planTeam:[],checklist:[],conditions:{weather:'Saved sky',airTemperatureC:12,weatherAvailability:'available',provenance:'forecast',sourceDetail:'Fixture provider',conditionsV1:snapshot},createdAt:'2026-10-06',modifiedAt:'2026-10-06'};
 return {plan,snapshot};
}
function mount(plan:StoredEnrichedDivePlan,copy=false){
 hooks.slots=[];hooks.cursor=0;weather.forecast.mockReset();persistence.save.mockClear();vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-06T09:00:00Z'));
 const props:Parameters<typeof PlanEditor>[0]={item:copy?null:plan,...(copy?{copyFrom:plan}:{}),sites:[{entityId:'site-a',name:'Fixture coast',location:'Fixture port',access:'',hazards:'',notes:'',maxDepthM:20,siteType:'shore',waterType:'salt',latitude:55,longitude:-2,createdAt:'2026-10-06',modifiedAt:'2026-10-06'}],people:[],loadouts:[],trips:[],skills:[],gasPlans:[],close:()=>{},saved:()=>{}};
 const render=()=>{hooks.cursor=0;return nodes(PlanEditor(props));};
 const workspace=()=>render().find(node=>node.type===RecordEditorWorkspace)!;
 const input=(name:string)=>{const label=render().find(node=>node.type==='label'&&text(node.props?.children).startsWith(name))!;return nodes(label.props?.children).find(node=>node.type==='input')!;};
 return {render,workspace,input};
}
afterEach(()=>{vi.restoreAllMocks();vi.useRealTimers();});

describe('Static weather in the Dive Plan editor',()=>{
 it('opens with saved values and source, without mounting provider readings or requesting weather',()=>{
  const {plan,snapshot}=fixture(),editor=mount(plan),tree=editor.render();
  expect(tree.some(node=>node.props?.snapshot===snapshot)).toBe(false);
  expect(tree.some(node=>node.type==='input'&&node.props?.value==='Saved sky')).toBe(true);
  expect(tree.some(node=>node.type==='small'&&text(node.props?.children).includes('Fixture provider'))).toBe(true);
  expect(weather.forecast).not.toHaveBeenCalled();
 });
 it('keeps the large immutable provider response out of edit comparisons and retains it in the draft',()=>{
  const {plan,snapshot}=fixture(),editor=mount(plan),workspace=editor.workspace();
  expect(JSON.stringify(workspace.props?.value).length).toBeLessThan(10000);
  expect(workspace.props?.dirty).toBe(false);
  (editor.input('Name').props!.onChange as (event:unknown)=>void)({target:{value:'Edited name'}});
  expect(JSON.stringify(editor.workspace().props?.value)).toContain('Edited name');
  expect(plan.conditions?.conditionsV1).toBe(snapshot);
  expect(snapshot.readings).toHaveLength(2353);
  expect(weather.forecast).not.toHaveBeenCalled();
 });
 it('initializes a duplicated Plan once while typing, instead of cloning its original weather for each character',()=>{
  const {plan}=fixture(),clone=vi.spyOn(globalThis,'structuredClone'),editor=mount(plan,true);
  editor.render();expect(clone).toHaveBeenCalledTimes(1);
  for(const name of ['A','AB','ABC']){(editor.input('Name').props!.onChange as (event:unknown)=>void)({target:{value:name}});editor.render();}
  expect(clone).toHaveBeenCalledTimes(1);
  expect(plan.name).toBe('Fixture plan');
 });
 it('fetches only when Refresh Weather is clicked, protects entered measurements and marks the replacement snapshot dirty',async()=>{
  const {plan,snapshot}=fixture();plan.conditions!.weatherValueOrigins={weather:'weather',airTemperatureC:'owner'};const editor=mount(plan);
  weather.forecast.mockResolvedValue({provider:'Fixture provider',logConditions:{weatherSummary:'New sky',airTemperatureC:14},conditionsV1:{...snapshot,retrievedAt:'2026-10-06T09:00:00Z'}});
  editor.render();expect(weather.forecast).not.toHaveBeenCalled();
  const refresh=editor.render().find(node=>node.type==='button'&&text(node.props?.children)==='Refresh Weather');
  expect(refresh).toBeDefined();await (refresh!.props!.onClick as ()=>Promise<void>)();
  await Promise.resolve();
  expect(weather.forecast).toHaveBeenCalledTimes(1);
  expect(editor.workspace().props?.dirty).toBe(true);
  expect(editor.render().some(node=>node.type==='input'&&node.props?.value==='New sky')).toBe(true);
  expect((editor.workspace().props!.value as {draft:StoredEnrichedDivePlan}).draft.conditions?.airTemperatureC).toBe(12);
  expect(plan.conditions?.conditionsV1).toBe(snapshot);
 });
 it('retains the saved values and snapshot when an explicit refresh fails',async()=>{
  const {plan,snapshot}=fixture(),editor=mount(plan);weather.forecast.mockRejectedValue(new Error('Weather unavailable'));
  const refresh=editor.render().find(node=>node.type==='button'&&/Refresh Weather|Get Weather/.test(text(node.props?.children)))!;
  await (refresh.props!.onClick as ()=>Promise<void>)();await Promise.resolve();
  const value=editor.workspace().props!.value as {draft:StoredEnrichedDivePlan};
  expect(value.draft.conditions?.weather).toBe('Saved sky');expect(value.draft.conditions?.airTemperatureC).toBe(12);
  expect(plan.conditions?.conditionsV1).toBe(snapshot);expect(weather.forecast).toHaveBeenCalledTimes(1);
 });
 it('saves the complete untouched weather snapshot alongside the edited text',async()=>{
  const {plan,snapshot}=fixture(),editor=mount(plan);
  (editor.input('Name').props!.onChange as (event:unknown)=>void)({target:{value:'Edited name 🌊'}});
  await (editor.workspace().props!.save as ()=>Promise<void>)();
  expect(persistence.save).toHaveBeenCalledTimes(1);
  const saved=persistence.save.mock.calls[0]![0] as StoredEnrichedDivePlan;
  expect(saved.name).toBe('Edited name 🌊');expect(saved.conditions?.conditionsV1).toBe(snapshot);
  expect(saved.conditions?.conditionsV1?.readings).toHaveLength(2353);expect(weather.forecast).not.toHaveBeenCalled();
 });
 it('refreshes provider-origin summaries while keeping owner-entered and unlabelled legacy values',()=>{
  const next={weather:'New sky',airTemperatureC:14};
  expect(refreshPlanWeatherFields({weather:'Old sky',airTemperatureC:12,weatherValueOrigins:{weather:'weather',airTemperatureC:'owner'}},next)).toMatchObject({weather:'New sky',airTemperatureC:12});
  expect(refreshPlanWeatherFields({weather:'Legacy sky'},next).weather).toBe('Legacy sky');
  expect(refreshPlanWeatherFields({weather:'Old sky',weatherValueOrigins:{weather:'weather'}},{}).weather).toBe('Old sky');
 });
 it('refreshes tagged marine measurements, preserves manual edits and retains missing marine coverage',()=>{
  const {snapshot}=fixture(),reading=conditionReading('wave-height',1,'meters',{...snapshot.readings[0]!,depth:{kind:'surface'}})!;
  const current={waveHeightM:1,weatherFieldSources:{waveHeightM:reading}};
  const next={capturedAt:snapshot.retrievedAt,conditionsV1:{...snapshot,readings:[{...reading,value:2}]}};
  expect(refreshPlanWeatherFields(current,next).waveHeightM).toBe(2);
  expect(refreshPlanWeatherFields(editPlanWeatherField(current,'waveHeightM',1.5,snapshot.retrievedAt),next).waveHeightM).toBe(1.5);
  expect(refreshPlanWeatherFields(current,{...next,conditionsV1:{...snapshot,readings:[]}}).waveHeightM).toBe(1);
 });
 it('retains a manually edited seasonal sky after Refresh Weather',async()=>{
  const {plan,snapshot}=fixture();plan.conditions!.provenance='seasonal';plan.conditions!.weatherValueOrigins={weather:'weather'};
  const editor=mount(plan);weather.forecast.mockResolvedValue({weatherContext:'seasonal',provider:'Fixture provider',logConditions:{weatherSummary:'Provider sky',airTemperatureC:14},conditionsV1:snapshot});
  (editor.input('Weather / surface').props!.onChange as (event:unknown)=>void)({target:{value:'My local observation'}});
  const refresh=editor.render().find(node=>node.type==='button'&&text(node.props?.children)==='Refresh Weather')!;
  await (refresh.props!.onClick as ()=>Promise<void>)();await Promise.resolve();
  const value=editor.workspace().props!.value as {draft:StoredEnrichedDivePlan};
  expect(value.draft.conditions?.weather).toBe('My local observation');expect(value.draft.conditions?.weatherValueOrigins?.weather).toBe('owner');
 });
});
