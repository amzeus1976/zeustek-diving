import {DatabaseSync} from 'node:sqlite';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({db:null as unknown as D1Database}));
vi.mock('cloudflare:workers',()=>({env:{get DB(){return fixture.db;}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner',email:'fixture@example.invalid'})}));
vi.mock('../lib/server/household',()=>({registerHouseholdUser:async()=>undefined,allowedHouseholdUser:()=>true,householdCanEditGear:async()=>false,householdAreaAccess:async()=>false,readHouseholdAreaUserIds:async()=>[],readHouseholdUserIds:async()=>['fixture-owner']}));
import {POST,GET} from '../app/api/dive-data/route';
import {GET as backup,POST as restore} from '../app/api/dive-backup/route';
let sqlite:DatabaseSync;
function database(){const prepare=(sql:string,args:unknown[]=[])=>({bind:(...values:unknown[])=>prepare(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),run:async()=>({meta:sqlite.prepare(sql).run(...args as never[])})});return {prepare,batch:async(statements:Array<{run:()=>Promise<unknown>}>)=>Promise.all(statements.map(item=>item.run()))} as unknown as D1Database;}
const conditions={version:1,request:{date:'2026-10-11',time:'12:00'},readings:Array.from({length:3000},(_,i)=>({id:`reading-${i}`,value:i,provenance:'Fixture atmospheric forecast — no real observation. '.repeat(8)})),diagnostics:[]};
const plan={entityId:'fixture-plan',name:'Fixture Plan',startDate:'2026-10-11',notes:'Owner-entered notes 海 🌊',conditions:{weather:'Fixture weather',conditionsV1:conditions}};
type PlanResponse={items:Array<typeof plan&{id:string}>};
const request=(data:unknown)=>new Request('https://fixture/api/dive-data',{method:'POST',body:JSON.stringify({id:'fixture-plan',kind:'trip',data,localMutation:true,baseModifiedAt:null})});
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');fixture.db=database();});afterEach(()=>sqlite.close());
describe('Actual Plan API and backup boundaries for packed conditions',()=>{
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
