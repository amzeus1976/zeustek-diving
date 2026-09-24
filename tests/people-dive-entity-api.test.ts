import {DatabaseSync} from 'node:sqlite';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {personEntityLinkIdentity} from '../lib/operators/entity-relationships';

const fixture=vi.hoisted(()=>({db:null as unknown as D1Database}));
vi.mock('cloudflare:workers',()=>({env:{get DB(){return fixture.db;}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner',email:'fixture@example.invalid'})}));
vi.mock('../lib/server/household',()=>({registerHouseholdUser:async()=>undefined,allowedHouseholdUser:()=>true,householdCanEditGear:async()=>false,householdAreaAccess:async()=>false,readHouseholdAreaUserIds:async()=>[],readHouseholdUserIds:async()=>[]}));
import {POST,DELETE} from '../app/api/dive-data/route';

let sqlite:DatabaseSync;
function database(){const prepare=(sql:string,args:unknown[]=[])=>({bind:(...values:unknown[])=>prepare(sql,values),first:async()=>sqlite.prepare(sql).get(...args as never[])??null,all:async()=>({results:sqlite.prepare(sql).all(...args as never[])}),run:async()=>({meta:sqlite.prepare(sql).run(...args as never[])})});return {prepare,batch:async(statements:Array<{run:()=>Promise<unknown>}> )=>Promise.all(statements.map(item=>item.run()))} as unknown as D1Database;}
const add=(id:string,owner:string,kind:string,data:object)=>sqlite.prepare('INSERT INTO dive_records VALUES (?,?,?,?,?,?,NULL)').run(id,owner,kind,JSON.stringify(data),100,100);
const post=(kind:string,id:string,data:object)=>POST(new Request('https://fixture/api/dive-data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind,id,data,localMutation:true,baseModifiedAt:null})}));
beforeEach(()=>{sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)');fixture.db=database();});
afterEach(()=>sqlite.close());

describe('owner-scoped relationship writes and deletion',()=>{
  it('rejects a link whose Operator belongs to another account',async()=>{
    add('person','fixture-owner','person',{name:'Alex'});add('foreign','other-owner','operator',{name:'Centre'});
    const data={personId:'person',operatorId:'foreign',role:'Guide',active:true};
    const response=await post('person-operator-link',personEntityLinkIdentity(data),data);
    expect(response.status).toBe(409);
    expect(sqlite.prepare("SELECT id FROM dive_records WHERE kind='person-operator-link'").all()).toEqual([]);
  });
  it('blocks deleting a Person or Operator while their explicit link remains',async()=>{
    add('person','fixture-owner','person',{name:'Alex'});add('centre','fixture-owner','operator',{name:'Centre'});
    const data={personId:'person',operatorId:'centre',role:'Guide',active:true};
    const id=personEntityLinkIdentity(data);
    expect((await post('person-operator-link',id,data)).status).toBe(200);
    expect(sqlite.prepare('SELECT id FROM dive_records WHERE id=?').get(id)).toEqual({id});
    for(const parentId of ['person','centre']){
      const response=await DELETE(new Request(`https://fixture/api/dive-data?id=${parentId}`,{method:'DELETE'}));
      expect(response.status).toBe(409);
    }
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM dive_records WHERE deleted_at IS NULL').get()).toEqual({count:3});
  });
  it('rejects a second active primary affiliation for the same Person',async()=>{
    add('person','fixture-owner','person',{name:'Alex'});add('centre-a','fixture-owner','operator',{name:'Centre A'});add('centre-b','fixture-owner','operator',{name:'Centre B'});
    const first={personId:'person',operatorId:'centre-a',role:'Instructor',active:true,primary:true};
    const second={personId:'person',operatorId:'centre-b',role:'Guide',active:true,primary:true};
    expect((await post('person-operator-link',personEntityLinkIdentity(first),first)).status).toBe(200);
    expect((await post('person-operator-link',personEntityLinkIdentity(second),second)).status).toBe(409);
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM dive_records WHERE kind='person-operator-link' AND deleted_at IS NULL").get()).toEqual({count:1});
  });
  it('preserves Person references in plans and certification evidence on direct deletion',async()=>{
    add('person','fixture-owner','person',{name:'Alex'});
    add('plan','fixture-owner','trip',{name:'Next Dive',planTeam:[{personId:'person',role:'buddy'}]});
    expect((await DELETE(new Request('https://fixture/api/dive-data?id=person',{method:'DELETE'}))).status).toBe(409);
    sqlite.prepare('UPDATE dive_records SET deleted_at=1 WHERE id=?').run('plan');
    add('certificate','fixture-owner','certification',{personId:'person',certification:'Rescue'});
    expect((await DELETE(new Request('https://fixture/api/dive-data?id=person',{method:'DELETE'}))).status).toBe(409);
  });
});
