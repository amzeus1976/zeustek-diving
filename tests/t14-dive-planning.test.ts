import 'fake-indexeddb/auto';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {zeustekDb} from '../lib/offline/db';
import {configureDiveStore,saveLocalRecord,pendingDiveChanges} from '../lib/offline/dive-store';
import {createDiveDraftFromEnrichedPlan} from '../lib/offline/dive-planning-centre';
import {loadOriginatingPlan} from '../lib/offline/dive-context';
import {listDives,type DiveRecord} from '../lib/offline/dives';
import {linkLoggedDiveToPlan,plannedOxygenTeam} from '../lib/planning/dive-plan-workflow';
import {weatherRequestIdentity,LatestWeatherRequest} from '../lib/weather/provider-contract';
import {readCylinderInventory} from '../lib/gear/read-cylinder-inventory';
import {weatherProvider} from '../lib/weather/client-provider';
beforeEach(async()=>{vi.stubGlobal('window',new EventTarget());vi.stubGlobal('navigator',{onLine:false});vi.stubGlobal('fetch',vi.fn());configureDiveStore('t14-plan');await zeustekDb.open();for(const table of zeustekDb.tables)await table.clear();});
afterEach(()=>vi.unstubAllGlobals());
const plan={entityId:'plan',name:'Original plan',planType:'day-dive',startDate:'2026-09-23',siteName:'Fixture site',siteId:'s',status:'confirmed',lifecycleStatus:'ready',notes:'Original intent',plannedMaxDepthM:20,modifiedAt:'2026-09-01',createdAt:'2026-09-01'};
const legacy=()=>zeustekDb.entities.put({entityId:'dive:t14-plan:plan',module:'dive:t14-plan',entityType:'trip',schemaVersion:1,record:plan,recordHash:'',deleted:0,updatedEventId:'',updatedAt:plan.modifiedAt});
describe('T14 Dive Planning save boundaries',()=>{
 it('reads legacy cylinder IDs without invoking repair writes',async()=>{
  await saveLocalRecord('cylinder',{entityId:'c',name:'Unnumbered cylinder'});
  const before=await zeustekDb.entities.toArray(),pending=await pendingDiveChanges();
  expect((await readCylinderInventory())[0]).toMatchObject({entityId:'c',recordStorageKind:'cylinder'});
  expect(await zeustekDb.entities.toArray()).toEqual(before);expect(await pendingDiveChanges()).toEqual(pending);
 });
 it('opens a legacy Plan log without saving, repairing or changing lifecycle; cancelled drafts have no effect',async()=>{
  await legacy();const before=await zeustekDb.entities.toArray();
  const draft=await createDiveDraftFromEnrichedPlan('plan');
  expect(draft.maxDepthM).toBe(20);expect(await zeustekDb.entities.toArray()).toEqual(before);
  expect(await pendingDiveChanges()).toEqual([]);expect(await zeustekDb.events.count()).toBe(0);expect(fetch).not.toHaveBeenCalled();
  await saveLocalRecord('trip',{entityId:'plan',notes:'Later',plannedMaxDepthM:35});
  expect(await loadOriginatingPlan(draft as DiveRecord)).toMatchObject({notes:'Original intent',plannedMaxDepthM:20});
  const tampered=structuredClone(draft);tampered.originatingPlanRevision!.snapshot!.record.notes='Forged';
  expect(await loadOriginatingPlan(tampered as DiveRecord)).toBeNull();
 });
 it('links only the selected existing Dive, preserves recorded facts and refuses replacing a different origin',async()=>{
  await legacy();await saveLocalRecord('dive',{entityId:'dive',site:'Observed site',date:'2026-09-22',notes:'Recorded',maxDepthM:18,unknownField:'keep'});
  const dive=(await listDives())[0]!;await linkLoggedDiveToPlan('plan','dive',dive.modifiedAt);
  expect((await listDives())[0]).toMatchObject({site:'Observed site',notes:'Recorded',maxDepthM:18,unknownField:'keep',originatingPlanId:'plan'});
  expect((await zeustekDb.entities.get('dive:t14-plan:plan'))?.record).toEqual(plan);
  await saveLocalRecord('trip',{...plan,entityId:'other'});
  await expect(linkLoggedDiveToPlan('other','dive',(await listDives())[0]!.modifiedAt)).rejects.toThrow(/already linked/i);
 });
 it('rejects stale or missing selections without creating a Dive',async()=>{
  await legacy();await saveLocalRecord('dive',{entityId:'dive',site:'Original',date:'2026-09-22'});
  await expect(linkLoggedDiveToPlan('plan','dive','old')).rejects.toThrow(/changed/i);
  await expect(linkLoggedDiveToPlan('plan','missing','old')).rejects.toThrow(/available/i);
  expect((await listDives())[0]?.originatingPlanId).toBeUndefined();
 });
 it('restricts oxygen-trained selections to the planned team and removes departed members',()=>{
  expect(plannedOxygenTeam([{personId:'a',role:'Buddy'},{personId:'b',role:'Surface support'}],['b','c','b'])).toEqual(['b']);
  expect(plannedOxygenTeam([],['b'])).toEqual([]);
 });
});
describe('T14 explicit weather requests',()=>{
 it('calls only the server provider boundary and reports failures without inventing a snapshot',async()=>{
  const request={mode:'seasonal',provider:'open-meteo',siteId:'s',date:'2026-10-20',time:'14:00',latitude:50,longitude:-2,marine:true};
  const transport=vi.mocked(fetch);transport.mockResolvedValue(new Response(JSON.stringify({error:'Rate limit'}),{status:429}));
  await expect(weatherProvider('open-meteo').forecast(request)).rejects.toThrow('Rate limit');
  const url=String(transport.mock.calls[0]?.[0]);expect(url).toContain('/api/conditions?');expect(url).toContain('mode=seasonal');expect(url).toContain('marine=true');expect(url).toContain('provider=open-meteo');
 });
 it('keys the complete requested time, location, mode and provider',()=>{
  const request={mode:'auto',provider:'open-meteo',siteId:'s',date:'2026-09-24',time:'10:00',latitude:50,longitude:-2};
  for(const change of [{time:'11:00'},{provider:'met-office'},{mode:'manual'},{latitude:51}])expect(weatherRequestIdentity({...request,...change})).not.toBe(weatherRequestIdentity(request));
 });
 it('rejects superseded requests even if a transport ignores abort',()=>{
  const latest=new LatestWeatherRequest();const first=latest.begin('old');const second=latest.begin('new');
  expect(first.signal.aborted).toBe(true);expect(latest.accepts(first,'old')).toBe(false);expect(latest.accepts(second,'new')).toBe(true);
  latest.invalidate();expect(latest.accepts(second,'new')).toBe(false);
 });
});
