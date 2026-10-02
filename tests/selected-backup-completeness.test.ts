import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {sharingDatabase} from './selected-sharing-fixture';
const state=vi.hoisted(()=>({db:null as unknown as D1Database}));
vi.mock('cloudflare:workers',()=>({env:{get DB(){return state.db;}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner',email:'owner@fixture.invalid'})}));
import {GET} from '../app/api/dive-backup/route';
let fixture:ReturnType<typeof sharingDatabase>;
beforeEach(()=>{fixture=sharingDatabase();state.db=fixture.db;});
afterEach(()=>fixture.sqlite.close());
describe('complete owner backup for large ordinary-record collections',()=>{
 it('exports all 2506 owned canonical records without secrets, foreign records or writes',async()=>{for(let i=0;i<2505;i++)fixture.add(`site-${String(i).padStart(5,'0')}`,'site',{name:`Site ${i}`,latitude:1,longitude:2});fixture.add('dive-one','dive',{site:'Owned Dive'});fixture.add('foreign','site',{name:'Other owner'},'fixture-partner');fixture.add('secret','gmail-connection-secret',{token:'DUMMY-PRIVATE-TOKEN'});const before=fixture.sqlite.prepare('SELECT COUNT(*) AS count FROM dive_records').get();const response=await GET();expect(response.status).toBe(200);const body=await response.json() as {records:Array<{id:string;kind:string;dataJson:string}>};expect(body.records).toHaveLength(2506);expect(new Set(body.records.map(r=>r.id)).size).toBe(2506);expect(body.records.some(r=>r.id==='site-02504')).toBe(true);expect(body.records.some(r=>r.id==='dive-one')).toBe(true);expect(JSON.stringify(body)).not.toMatch(/DUMMY-PRIVATE-TOKEN|foreign|gmail-connection-secret/);expect(fixture.sqlite.prepare('SELECT COUNT(*) AS count FROM dive_records').get()).toEqual(before);});
 it('keeps the original backup envelope readable for an empty owner store',async()=>{const response=await GET();expect(response.status).toBe(200);expect(await response.json()).toMatchObject({format:'zeustek-dive-cloud-data',version:1,records:[]});});
});
