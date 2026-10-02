import {DatabaseSync} from 'node:sqlite';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({db:null as unknown as D1Database}));
vi.mock('cloudflare:workers',()=>({env:{get DB(){return fixture.db;}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner',email:'fixture@example.invalid'})}));
vi.mock('../lib/server/household',()=>({registerHouseholdUser:async()=>undefined,allowedHouseholdUser:()=>true,householdCanEditGear:async()=>true,householdAreaAccess:async()=>false,readHouseholdAreaUserIds:async()=>[],readHouseholdUserIds:async()=>['fixture-owner','fixture-partner']}));
import {POST} from '../app/api/dive-data/route';
let sqlite:DatabaseSync;
function database(){const prepare=(sql:string,args:unknown[]=[])=>({bind:(...values:unknown[])=>prepare(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),run:async()=>({meta:sqlite.prepare(sql).run(...args as never[])})});return {prepare,batch:async(statements:Array<{run:()=>Promise<unknown>}>)=>Promise.all(statements.map(item=>item.run()))} as unknown as D1Database;}
const add=(id:string,owner:string,kind:string,data:object)=>sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,NULL)').run(id,owner,kind,JSON.stringify(data),100,100);
const post=(id:string,kind:string,data:object,baseModifiedAt:string|null=null)=>POST(new Request('https://fixture/api/dive-data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,kind,data,localMutation:true,baseModifiedAt})}));
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');fixture.db=database();});afterEach(()=>sqlite.close());
describe('atomic cylinder-label protection',()=>{
 it('rejects concurrent same-number new cylinders with one winner and preserves both identities',async()=>{
  const results=await Promise.all([post('a','cylinder',{name:'A',cylinderNumber:'02'}),post('b','cylinder',{name:'B',cylinderNumber:'02'})]);expect(results.map(row=>row.status).sort()).toEqual([200,409]);expect(sqlite.prepare("SELECT COUNT(*) AS n FROM dive_records WHERE kind='cylinder'").get()).toEqual({n:1});
 });
 it('rejects a duplicate shared legacy equipment number while ignoring another owner’s private cylinders',async()=>{
  add('legacy','fixture-partner','equipment',{name:'Shared tank',category:'Cylinder',cylinderNumber:'2'});expect((await post('new','cylinder',{name:'New',cylinderNumber:'02'})).status).toBe(409);
  add('private','unrelated','cylinder',{name:'Private',cylinderNumber:'04'});expect((await post('safe','cylinder',{name:'Safe',cylinderNumber:'04'})).status).toBe(200);
 });
 it('blocks a reviewed label collision atomically while preserving references and stale revisions',async()=>{
  add('a','fixture-owner','cylinder',{name:'A',cylinderNumber:'03'});add('b','fixture-owner','cylinder',{name:'B',cylinderNumber:'02'});add('fill','fixture-owner','cylinder-fill',{cylinderEquipmentId:'a'});const before=sqlite.prepare('SELECT * FROM dive_records ORDER BY id').all();
  expect((await post('a','cylinder',{name:'A',cylinderNumber:'02'},new Date(100).toISOString())).status).toBe(409);expect(sqlite.prepare('SELECT * FROM dive_records ORDER BY id').all()).toEqual(before);
  expect((await post('a','cylinder',{name:'A',cylinderNumber:'04'},new Date(99).toISOString())).status).toBe(409);
 });
 it('allows deliberate ordinary edits to pre-existing duplicates without silently repairing either label',async()=>{
  add('a','fixture-owner','cylinder',{name:'A',cylinderNumber:'03'});add('b','fixture-owner','cylinder',{name:'B',cylinderNumber:'03'});expect((await post('a','cylinder',{name:'Edited A',cylinderNumber:'03'},new Date(100).toISOString())).status).toBe(200);expect(sqlite.prepare("SELECT json_extract(data_json,'$.cylinderNumber') AS number FROM dive_records ORDER BY id").all()).toEqual([{number:'03'},{number:'03'}]);
 });
});
