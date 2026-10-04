import {DatabaseSync} from 'node:sqlite';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const fixture=vi.hoisted(()=>({db:null as unknown as D1Database}));
vi.mock('cloudflare:workers',()=>({env:{get DB(){return fixture.db;}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner',email:'fixture@example.invalid'})}));
vi.mock('../lib/server/household',()=>({registerHouseholdUser:async()=>undefined,allowedHouseholdUser:()=>true,householdCanEditGear:async(_env:unknown,_user:unknown,owner:string)=>owner==='fixture-owner',householdAreaAccess:async()=>false,readHouseholdAreaUserIds:async()=>[],readHouseholdUserIds:async()=>['fixture-owner']}));
import {POST} from '../app/api/dive-data/route';
import {syncReviewSummary} from '../lib/offline/sync-review';
let sqlite:DatabaseSync;
const history={entityId:'history',equipmentId:'missing-parent',eventType:'service',title:'Fixture history',serviceBaselineApplied:true,notes:'Saved evidence'};
function database(){const prepare=(sql:string,args:unknown[]=[])=>({bind:(...values:unknown[])=>prepare(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),run:async()=>({meta:sqlite.prepare(sql).run(...args as never[])})});return {prepare,batch:async(statements:Array<{run:()=>Promise<unknown>}>)=>Promise.all(statements.map(item=>item.run()))} as unknown as D1Database;}
const add=(id:string,owner:string,kind:string,data:object,deletedAt:number|null=null)=>sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,?)').run(id,owner,kind,JSON.stringify(data),100,100,deletedAt);
const post=(data:object,base=100)=>POST(new Request('https://fixture/api/dive-data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'history',kind:'equipment-event',data,localMutation:true,baseModifiedAt:new Date(base).toISOString()})}));
const records=()=>sqlite.prepare('SELECT * FROM dive_records ORDER BY id').all();
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');fixture.db=database();});
afterEach(()=>sqlite.close());
describe('Equipment history sync preserves orphaned historical evidence',()=>{
 it('acknowledges identical authorised history without writing or recreating its missing parent',async()=>{
  add('history','fixture-owner','equipment-event',history);const before=records();
  const response=await post({...history,createdAt:new Date(100).toISOString(),modifiedAt:new Date(200).toISOString(),householdOwnerId:'fixture-owner',householdOwnedByMe:true});
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({id:'history',updatedAt:100});expect(records()).toEqual(before);
 });
 it('compares nested saved values independently of key insertion order, preserving real changes',async()=>{
  add('history','fixture-owner','equipment-event',{...history,cost:{amount:12.5,currency:'GBP'}});const before=records();
  expect((await post({...history,cost:{currency:'GBP',amount:12.5}})).status).toBe(200);
  expect((await post({...history,cost:{currency:'GBP',amount:13}})).status).toBe(409);expect(records()).toEqual(before);
 });
 it('reports an unavailable Equipment reference accurately for changed and new history',async()=>{
  add('history','fixture-owner','equipment-event',history);const before=records();
  const response=await post({...history,notes:'Deliberate new note'});expect(response.status).toBe(409);
  expect(await response.json()).toEqual({error:'Equipment for this history is unavailable. Review its Equipment record before syncing.'});expect(records()).toEqual(before);
  sqlite.exec('DELETE FROM dive_records');expect((await post(history)).status).toBe(409);expect(records()).toEqual([]);
 });
 it('does not acknowledge another owner’s history, even if every field matches',async()=>{
  add('history','unrelated-owner','equipment-event',history);const before=records();expect((await post(history)).status).toBe(403);expect(records()).toEqual(before);
 });
 it('retains access checks for real changes with an inaccessible parent',async()=>{
  add('history','fixture-owner','equipment-event',history);add('missing-parent','unrelated-owner','equipment',{});const before=records();
  expect((await post({...history,notes:'Changed'})).status).toBe(403);expect(records()).toEqual(before);
 });
 it('permits an explicit archive-only revision of authorised orphaned history, preserving all source evidence',async()=>{
  add('history','fixture-owner','equipment-event',history);
  const archived={...history,archived:true,suppressedFromUse:true,archivedAt:'2026-10-04T12:00:00Z'};
  expect((await post(archived)).status).toBe(200);
  expect(JSON.parse(String(records()[0]?.data_json))).toMatchObject(archived);expect(records()).toHaveLength(1);
 });
 it('does not combine orphan archival with other edits or bypass its revision check',async()=>{
  add('history','fixture-owner','equipment-event',history);const before=records();
  const archived={...history,archived:true,suppressedFromUse:true,archivedAt:'2026-10-04T12:00:00Z'};
  expect((await post({...archived,notes:'Changed evidence'})).status).toBe(409);
  expect((await post(archived,99)).status).toBe(409);expect(records()).toEqual(before);
 });
 it('never treats a deleted record or mismatching canonical identity as an identical active record',async()=>{
  add('history','fixture-owner','equipment-event',history,120);const before=records();expect((await post(history)).status).toBe(409);expect(records()).toEqual(before);
  sqlite.exec('UPDATE dive_records SET deleted_at=NULL');expect((await post({...history,entityId:'different'})).status).toBe(409);
 });
 it('preserves stale-revision protection and immutable Equipment association for changed history',async()=>{
  add('history','fixture-owner','equipment-event',history);add('missing-parent','fixture-owner','equipment',{});const before=records();
  expect((await post({...history,notes:'Changed'},99)).status).toBe(409);expect((await post({...history,equipmentId:'different'})).status).toBe(400);expect(records()).toEqual(before);
  expect((await post({...history,notes:'Changed'})).status).toBe(200);expect(JSON.parse(String(records()[0]?.data_json)).entityId).toBe('history');
 });
 it('gives a safe, actionable missing-reference diagnostic without exposing arbitrary errors',()=>{
  const summary=syncReviewSummary({kind:'equipment-event',record:{title:'History'},error:'Equipment for this history is unavailable. Review its Equipment record before syncing.'});
  expect(summary.message).toContain('Equipment reference is unavailable');expect(summary.message).toContain('Use cloud version');
  expect(syncReviewSummary({error:'token secret fixture-sensitive'}).message).not.toContain('fixture-sensitive');
 });
});
