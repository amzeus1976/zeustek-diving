import {DatabaseSync} from 'node:sqlite';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({db:null as unknown as D1Database}));
vi.mock('cloudflare:workers',()=>({env:{get DB(){return fixture.db;}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner',email:'fixture@example.invalid'})}));
vi.mock('../lib/server/household',()=>({registerHouseholdUser:async()=>undefined,allowedHouseholdUser:()=>true,householdCanEditGear:async()=>false,householdAreaAccess:async()=>false,readHouseholdAreaUserIds:async()=>[],readHouseholdUserIds:async()=>[]}));
import {POST,DELETE} from '../app/api/dive-data/route';
let sqlite:DatabaseSync;
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');const prepare=(sql:string,args:unknown[]=[])=>({bind:(...values:unknown[])=>prepare(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),run:async()=>({meta:sqlite.prepare(sql).run(...args as never[])})});fixture.db={prepare,batch:async(statements:Array<{run:()=>Promise<unknown>}>)=>Promise.all(statements.map(item=>item.run()))} as unknown as D1Database;});
afterEach(()=>sqlite.close());
const add=(id:string,kind:string,data:object,owner='fixture-owner')=>sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,NULL)').run(id,owner,kind,JSON.stringify(data),100,100);
describe('Atomic owner-scoped Plan tombstones',()=>{
 it('blocks direct and offline-sync deletion when the event alone stores linkedDiveIds',async()=>{
  add('event','trip',{name:'Event',linkedDiveIds:['logged-dive']});
  add('logged-dive','dive',{site:'Site'});
  const responses=[await DELETE(new Request('https://fixture/api/dive-data?id=event',{method:'DELETE'})),await POST(new Request('https://fixture/api/dive-data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'trip',id:'event',data:null,localMutation:true,baseModifiedAt:new Date(100).toISOString()})}))];
  for(const response of responses)expect(response.status).toBe(409);
  expect(sqlite.prepare('SELECT deleted_at AS deleted FROM dive_records WHERE id=?').get('event')).toEqual({deleted:null});
  expect(sqlite.prepare('SELECT deleted_at AS deleted FROM dive_records WHERE id=?').get('logged-dive')).toEqual({deleted:null});
 });
 it.each([['dive',{originatingPlanId:'plan'}],['gas-plan',{divePlanId:'plan'}],['trip',{linkedDivePlanId:'plan'}],['dive-trip',{planIds:['plan']}],['dive-trip',{calendarBookingIds:['plan']}],['dive-trip',{originCalendarBookingId:'plan'}],['dive-trip',{itinerary:[{calendarBookingId:'plan'}]}],['skill_evidence',{planId:'plan'}]] as const)('blocks direct and offline-sync deletion for a live %s reference',async(kind,data)=>{add('plan','trip',{name:'Dummy'});add('linked',kind,data);for(const response of [await DELETE(new Request('https://fixture/api/dive-data?id=plan',{method:'DELETE'})),await POST(new Request('https://fixture/api/dive-data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'trip',id:'plan',data:null,localMutation:true,baseModifiedAt:new Date(100).toISOString()})}))])expect(response.status).toBe(409);expect(sqlite.prepare('SELECT deleted_at AS deleted FROM dive_records WHERE id=?').get('plan')).toEqual({deleted:null});});
 it('ignores deleted and foreign-owner links, soft-deletes only the selected owner plan, and forbids another owner plan deletion',async()=>{add('plan','trip',{name:'Dummy'});add('foreign','dive',{originatingPlanId:'plan'},'other');add('old','dive',{originatingPlanId:'plan'});sqlite.prepare('UPDATE dive_records SET deleted_at=1 WHERE id=?').run('old');expect((await DELETE(new Request('https://fixture/api/dive-data?id=plan',{method:'DELETE'}))).status).toBe(200);expect(sqlite.prepare('SELECT deleted_at AS deleted FROM dive_records WHERE id=?').get('foreign')).toEqual({deleted:null});add('other-plan','trip',{},'other');expect((await DELETE(new Request('https://fixture/api/dive-data?id=other-plan',{method:'DELETE'}))).status).toBe(404);});
});
