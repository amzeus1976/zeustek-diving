import {DatabaseSync} from 'node:sqlite';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({db:null as unknown as D1Database}));
vi.mock('cloudflare:workers',()=>({env:{get DB(){return fixture.db;}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner',email:'fixture@example.invalid'})}));
vi.mock('../lib/server/household',()=>({registerHouseholdUser:async()=>undefined,allowedHouseholdUser:()=>true,householdCanEditGear:async()=>false,householdAreaAccess:async()=>false,readHouseholdAreaUserIds:async()=>[],readHouseholdUserIds:async()=>['fixture-owner']}));
import {POST,GET} from '../app/api/dive-data/route';
import {GET as backup,POST as restore} from '../app/api/dive-backup/route';
import {fitPlanTextForSync} from '../lib/planning/plan-text-sync';
import {planTextFromPlain} from '../lib/planning/formatted-text';
let sqlite:DatabaseSync;
function database(){const prepare=(sql:string,args:unknown[]=[])=>({bind:(...values:unknown[])=>prepare(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),run:async()=>({meta:sqlite.prepare(sql).run(...args as never[])})});return {prepare,batch:async(statements:Array<{run:()=>Promise<unknown>}>)=>Promise.all(statements.map(item=>item.run()))} as unknown as D1Database;}
const conditions={version:1,request:{date:'2026-10-11',time:'12:00'},readings:Array.from({length:3000},(_,i)=>({id:`reading-${i}`,value:i,provenance:'Fixture atmospheric forecast — no real observation. '.repeat(8)})),diagnostics:[]};
const plan={entityId:'fixture-plan',name:'Fixture Plan',startDate:'2026-10-11',notes:'Owner-entered notes 海 🌊',conditions:{weather:'Fixture weather',conditionsV1:conditions}};
type PlanResponse={items:Array<typeof plan&{id:string}>};
const request=(data:unknown)=>new Request('https://fixture/api/dive-data',{method:'POST',body:JSON.stringify({id:'fixture-plan',kind:'trip',data,localMutation:true,baseModifiedAt:null})});
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');fixture.db=database();});afterEach(()=>sqlite.close());
describe('Actual Plan API and backup boundaries for packed conditions',()=>{
 it('accepts and restores derived Dives with near-limit Aim, Goals, human-factor and emergency text',async()=>{
  for(const [index,fields] of [{aim:'x'.repeat(185000)},{goals:['x'.repeat(185000),'','🌊']},{humanFactors:{stopAbortCriteria:['x'.repeat(185000)]}},{emergency:{notes:'x'.repeat(185000)}}].entries()){
   const source={entityId:'plan-'+index,name:'Boundary source',startDate:'2026-10-10',notes:'',...fields},id='dive-'+index;
   expect((await POST(new Request('https://fixture/api/dive-data',{method:'POST',body:JSON.stringify({id:source.entityId,kind:'trip',data:source,localMutation:true,baseModifiedAt:null})}))).status).toBe(200);
   const data={notes:index===2?'Created from Plan\n\nStop / abort: '+fields.humanFactors!.stopAbortCriteria[0]:'Created from Plan',editorFields:'q'.repeat(16000),originatingPlanId:source.entityId,originatingPlanRevision:{eventId:'event',recordHash:'hash',modifiedAt:'stamp',snapshot:{version:1,accountId:'fixture-owner',record:source}}};
   expect((await POST(new Request('https://fixture/api/dive-data',{method:'POST',body:JSON.stringify({id,kind:'dive',data,localMutation:true,baseModifiedAt:null})}))).status).toBe(200);
   const {items}=await (await GET(new Request('https://fixture/api/dive-data?kind=dive'))).json() as {items:Array<{id:string}>};expect(items.find(row=>row.id===id)).toMatchObject(data);
  }
 });
 it('packs a complete formatted source snapshot and accepts a derived Dive without losing any presentation or text',async()=>{
  const notes='x'.repeat(67000),snapshot={entityId:'fixture-plan',name:'Formatted fixture',notes},document=planTextFromPlain(notes);
  const dive={site:'Fixture coast',date:'2026-10-10',notes,originatingPlanId:'fixture-plan',originatingPlanRevision:{eventId:'source-event',recordHash:'source-hash',modifiedAt:'2026-10-06',snapshot:{version:1,accountId:'fixture-owner',recordHash:'snapshot-hash',record:snapshot}}};
  const write=(data:unknown)=>POST(new Request('https://fixture/api/dive-data',{method:'POST',body:JSON.stringify({id:'fixture-dive',kind:'dive',data,localMutation:true,baseModifiedAt:null})}));
  const oversized={...dive,originatingPlanRevision:{...dive.originatingPlanRevision,snapshot:{...dive.originatingPlanRevision.snapshot,record:{...snapshot,textFormatting:{notes:document}}}}};
  expect(JSON.stringify(oversized).length).toBeGreaterThan(200000);expect((await write(oversized)).status).toBe(200);
  const stored=sqlite.prepare('SELECT data_json AS dataJson FROM dive_records').get();expect(String(stored?.dataJson).length).toBeLessThan(200000);
  const {items}=await (await GET(new Request('https://fixture/api/dive-data?kind=dive'))).json() as {items:unknown[]};expect(items[0]).toMatchObject(oversized);
 });
 it('accepts the 100000-character plain fallback as a full derived Dive and preserves it through cloud backup restore',async()=>{
  const notes='  '+'x'.repeat(99996)+'  ',prepared=fitPlanTextForSync({...plan,notes,conditions:{},textFormatting:{notes:planTextFromPlain(notes)}});
  expect(prepared.formattingReduced).toBe(true);
  const data={site:'Fixture coast',date:'2026-10-10',notes:notes+'\n\nCreated from dive plan: Fixture',editorFields:'q'.repeat(12000),originatingPlanId:'fixture-plan',originatingPlanRevision:{eventId:'source-event',recordHash:'source-hash',modifiedAt:'2026-10-06',snapshot:{version:1,accountId:'fixture-owner',record:prepared.record}}};
  expect(JSON.stringify(data).length).toBeGreaterThan(200000);
  expect((await POST(new Request('https://fixture/api/dive-data',{method:'POST',body:JSON.stringify({id:'fixture-dive',kind:'dive',data,localMutation:true,baseModifiedAt:null})}))).status).toBe(200);
  const payload=await (await backup()).json() as {records:Array<{dataJson:string}>};expect(payload.records[0]!.dataJson.length).toBeLessThan(200000);
  sqlite.exec('DELETE FROM dive_records');expect(await (await restore(new Request('https://fixture/api/dive-backup',{method:'POST',body:JSON.stringify(payload)}))).json()).toMatchObject({restored:1,conflicts:0});
  const {items}=await (await GET(new Request('https://fixture/api/dive-data?kind=dive'))).json() as {items:unknown[]};expect(items[0]).toMatchObject(data);
 });
 it('keeps exactly 100000 formatted characters within the real sync limit without altering text',async()=>{
  const notes='  '+'x'.repeat(99996)+'  ',document=planTextFromPlain(notes);
  const original={...plan,notes,textFormatting:{notes:document}},prepared=fitPlanTextForSync(original);
  expect(prepared.formattingReduced).toBe(true);expect(prepared.record.notes).toBe(notes);
  expect(prepared.record).not.toHaveProperty('textFormatting');expect(original.textFormatting.notes).toBe(document);
  expect((await POST(request(prepared.record))).status).toBe(200);
  const stored=sqlite.prepare('SELECT data_json AS dataJson FROM dive_records').get();expect(String(stored?.dataJson).length).toBeLessThanOrEqual(200000);
 });
 it('budgets all formatted fields together with packed weather and retains small formatting',async()=>{
  const value='🌊'.repeat(20000),document=planTextFromPlain(value);
  const original={...plan,notes:value,aim:value,goals:[value],textFormatting:{notes:document,aim:document,goals:document}};
  const prepared=fitPlanTextForSync(original);
  expect(prepared.formattingReduced).toBe(true);expect(prepared.record.conditions).toBe(original.conditions);
  expect(prepared.record.notes).toBe(value);expect(prepared.record.goals).toEqual([value]);
  expect((await POST(request(prepared.record))).status).toBe(200);
  const small={...plan,textFormatting:{notes:planTextFromPlain(plan.notes)}};
  expect(fitPlanTextForSync(small)).toEqual({record:small,formattingReduced:false});
 });
 it('can omit presentation at the exact 200000-character boundary without adding a replacement marker',async()=>{
  const base={entityId:'fixture-plan',name:'Boundary QA',notes:'tiny',padding:''};
  base.padding='x'.repeat(200000-JSON.stringify(base).length);
  const prepared=fitPlanTextForSync({...base,textFormatting:{notes:planTextFromPlain(base.notes)}});
  expect(prepared.formattingReduced).toBe(true);expect(JSON.stringify(prepared.record).length).toBe(200000);
  expect((await POST(request(prepared.record))).status).toBe(200);
 });
 it.each(['trip','dive-trip'])('checks actual %s contact writes and both operator deletion paths',async kind=>{
  sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,NULL)').run('centre','fixture-owner','operator',JSON.stringify({name:'Fixture Centre',phone:'+44 12345'}),100,100);
  sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,NULL)').run('private-centre','different-owner','operator','{}',100,100);
  const write=(id:string,ids:string[])=>POST(new Request('https://fixture/api/dive-data',{method:'POST',body:JSON.stringify({id,kind,data:{name:'Fixture Plan',diveCentreIds:ids},localMutation:true,baseModifiedAt:null})}));
  expect((await write('bad',['private-centre'])).status).toBe(409);expect((await write('valid',['centre'])).status).toBe(200);
  const {DELETE}=await import('../app/api/dive-data/route');expect((await DELETE(new Request('https://fixture/api/dive-data?id=centre',{method:'DELETE'}))).status).toBe(409);
  expect((await POST(new Request('https://fixture/api/dive-data',{method:'POST',body:JSON.stringify({id:'centre',kind:'operator',data:null,localMutation:true,baseModifiedAt:new Date(100).toISOString()})}))).status).toBe(409);
  expect(sqlite.prepare('SELECT deleted_at AS deleted FROM dive_records WHERE id=?').get('centre')?.deleted).toBeNull();
 });
 it('saves the complete oversized forecast and returns every original field through the owner API',async()=>{
  expect(JSON.stringify(plan).length).toBeGreaterThan(200000);expect((await POST(request(plan))).status).toBe(200);
  const stored=sqlite.prepare('SELECT id,data_json AS dataJson FROM dive_records').get();expect(stored?.id).toBe('fixture-plan');expect(String(stored?.dataJson).length).toBeLessThan(200000);
  const response=await GET(new Request('https://fixture/api/dive-data?kind=trip'));const {items}=await response.json() as PlanResponse;expect(items).toHaveLength(1);expect(items[0]).toMatchObject(plan);expect(items[0]!.conditions.conditionsV1.readings).toHaveLength(3000);
 });
 it('exports and restores the compact ordinary record with its canonical ID and lossless evidence',async()=>{
  await POST(request(plan));const payload=await (await backup()).json() as {records:Array<{dataJson:string}>};expect(payload.records).toHaveLength(1);expect(payload.records[0]!.dataJson.length).toBeLessThan(200000);
  sqlite.exec('DELETE FROM dive_records');const response=await restore(new Request('https://fixture/api/dive-backup',{method:'POST',body:JSON.stringify(payload)}));expect(await response.json()).toMatchObject({restored:1,conflicts:0});
  const {items}=await (await GET(new Request('https://fixture/api/dive-data?kind=trip'))).json() as PlanResponse;expect(items[0]).toMatchObject(plan);
 });
 it('does not raise the generic upload limit or accept malformed packed backups',async()=>{
  expect((await POST(request({name:'Huge notes',notes:'x'.repeat(210000)}))).status).toBe(413);expect(sqlite.prepare('SELECT count(*) AS n FROM dive_records').get()?.n).toBe(0);
  const dataJson=JSON.stringify({name:'Bad packed data',conditions:{conditionsV1Packed:{version:1,encoding:'gzip-base64',jsonBytes:100,body:'invalid'}}});
  const response=await restore(new Request('https://fixture/api/dive-backup',{method:'POST',body:JSON.stringify({format:'zeustek-dive-cloud-data',version:1,records:[{id:'bad',kind:'trip',dataJson}]})}));expect(response.status).toBe(400);expect(sqlite.prepare('SELECT count(*) AS n FROM dive_records').get()?.n).toBe(0);
 });
 it('preserves owner isolation even for a perfectly valid compressed Plan',async()=>{
  sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,NULL)').run('fixture-plan','different-owner','trip',JSON.stringify({name:'Private existing plan'}),100,100);
  expect((await POST(request(plan))).status).toBe(409);expect(sqlite.prepare('SELECT user_id AS owner,data_json AS data FROM dive_records').get()).toEqual({owner:'different-owner',data:JSON.stringify({name:'Private existing plan'})});
 });
});
