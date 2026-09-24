import {DatabaseSync} from 'node:sqlite';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const mocked=vi.hoisted(()=>({db:null as unknown as D1Database}));
vi.mock('cloudflare:workers',()=>({env:{get DB(){return mocked.db;}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner',email:'fixture@example.com'})}));
import {GET,POST} from '../app/api/dive-backup/route';
import {entityRelationIdentity,personEntityLinkIdentity} from '../lib/operators/entity-relationships';
let sqlite:DatabaseSync;
function database(){const prepare=(sql:string,args:unknown[]=[])=>({bind:(...values:unknown[])=>prepare(sql,values),all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,run:async()=>({meta:sqlite.prepare(sql).run(...args as never[])})});return {prepare} as unknown as D1Database;}
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');mocked.db=database();});afterEach(()=>sqlite.close());
const record=(id:string,kind:string,dataJson:string)=>({id,kind,dataJson,createdAt:123,updatedAt:123});
const insert=(row:ReturnType<typeof record>)=>sqlite.prepare('INSERT INTO dive_records(id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)').run(row.id,'fixture-owner',row.kind,row.dataJson,row.createdAt,row.updatedAt);
describe('T14 backup route connection-secret exclusion',()=>{
 it('returns an empty backup for a new account without creating tables',async()=>{sqlite.exec('DROP TABLE dive_records');const response=await GET();expect(response.status).toBe(200);expect((await response.json() as {records:unknown[]}).records).toEqual([]);expect(sqlite.prepare("SELECT name FROM sqlite_master WHERE name='dive_records'").get()).toBeUndefined();});
 it('exports canonical owner data, never reads or serialises encrypted connection rows',async()=>{insert(record('dive-1','dive','{"site":"Fixture Bay"}'));insert(record('secret','gmail-connection-secret','{"encryptedRefreshToken":"DUMMY_PRIVATE_TOKEN"}'));insert(record('news-1','gmail-news','{"title":"Cached newsletter"}'));const response=await GET();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');const raw=await response.text();expect(raw).toContain('Fixture Bay');expect(raw).toContain('Cached newsletter');expect(raw).not.toMatch(/DUMMY_PRIVATE_TOKEN|gmail-connection-secret|"secret"/);});
 it('restores ordinary legacy data while excluding embedded connection secrets',async()=>{const response=await POST(new Request('https://fixture/api/dive-backup',{method:'POST',body:JSON.stringify({format:'zeustek-dive-cloud-data',version:1,records:[record('normal','dive','{}'),record('secret','gmail-connection-secret','{"secret":"DUMMY"}')]} )}));expect(response.status).toBe(200);expect(await response.json()).toEqual({restored:1,skipped:0,conflicts:0});expect(sqlite.prepare('SELECT id FROM dive_records').all()).toEqual([{id:'normal'}]);});
 it('restores ordinary records and keeps identical records unchanged',async()=>{const payload={format:'zeustek-dive-cloud-data',version:1,records:[record('normal','dive','{"site":"Fixture Bay"}'),record('news','gmail-news','{"title":"Cached newsletter"}')]};const request=()=>new Request('https://fixture/api/dive-backup',{method:'POST',body:JSON.stringify(payload)});expect(await(await POST(request())).json()).toEqual({restored:2,skipped:0,conflicts:0});expect(await(await POST(request())).json()).toEqual({restored:0,skipped:2,conflicts:0});expect(sqlite.prepare('SELECT COUNT(*) AS count FROM dive_records').get()).toEqual({count:2});});
 it('rejects an orphan Person–Entity relationship before restoring anything',async()=>{
   const link={personId:'missing-person',operatorId:'missing-entity',role:'Guide',active:true};
   const payload={format:'zeustek-dive-cloud-data',version:1,records:[record('normal','dive','{}'),record(personEntityLinkIdentity(link),'person-operator-link',JSON.stringify(link))]};
   const response=await POST(new Request('https://fixture/api/dive-backup',{method:'POST',body:JSON.stringify(payload)}));
   expect(response.status).toBe(400);
   expect(sqlite.prepare('SELECT COUNT(*) AS count FROM dive_records').get()).toEqual({count:0});
 });
 it('restores link records after their owner-scoped parents even when the backup lists links first',async()=>{
   const link={personId:'person',operatorId:'centre',role:'Instructor',active:true};
   const payload={format:'zeustek-dive-cloud-data',version:1,records:[record(personEntityLinkIdentity(link),'person-operator-link',JSON.stringify(link)),record('person','person','{"name":"Alex"}'),record('centre','operator','{"name":"Centre"}')]};
   const response=await POST(new Request('https://fixture/api/dive-backup',{method:'POST',body:JSON.stringify(payload)}));
   expect(response.status).toBe(200);
   expect((await response.json() as {restored:number}).restored).toBe(3);
   expect(sqlite.prepare('SELECT kind FROM dive_records ORDER BY rowid').all()).toEqual([{kind:'person'},{kind:'operator'},{kind:'person-operator-link'}]);
 });
 it('rejects duplicate active primaries and noncanonical reciprocal entities before restoring parents',async()=>{
   const first={personId:'person',operatorId:'centre',role:'Instructor',active:true,primary:true};
   const second={personId:'person',operatorId:'boat',role:'Skipper',active:true,primary:true};
   const parents=[record('person','person','{}'),record('centre','operator','{}'),record('boat','operator','{}')];
   const payload=(links:ReturnType<typeof record>[])=>new Request('https://fixture/api/dive-backup',{method:'POST',body:JSON.stringify({format:'zeustek-dive-cloud-data',version:1,records:[...parents,...links]})});
   expect((await POST(payload([record(personEntityLinkIdentity(first),'person-operator-link',JSON.stringify(first)),record(personEntityLinkIdentity(second),'person-operator-link',JSON.stringify(second))]))).status).toBe(400);
   expect(sqlite.prepare('SELECT COUNT(*) AS count FROM dive_records').get()).toEqual({count:0});
   const inverted={fromOperatorId:'boat',toOperatorId:'centre',relationType:'operated-by',active:true};
   expect((await POST(payload([record(entityRelationIdentity(inverted),'operator-operator-link',JSON.stringify(inverted))]))).status).toBe(400);
   expect(sqlite.prepare('SELECT COUNT(*) AS count FROM dive_records').get()).toEqual({count:0});
 });
});
