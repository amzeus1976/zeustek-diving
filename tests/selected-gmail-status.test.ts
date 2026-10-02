import {describe,it,expect,vi} from 'vitest';
const fixture=vi.hoisted(()=>({failure:'diagnostic',authenticated:true}));
vi.mock('cloudflare:workers',()=>({env:{DB:{}}}));
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>fixture.authenticated?{userId:'fixture-owner'}:null}));
vi.mock('../lib/server/gmail-news',async()=>{const real=await vi.importActual<typeof import('../lib/server/gmail-news')>('../lib/server/gmail-news');return {...real,gmailConnectionStatus:async()=>{if(fixture.failure==='diagnostic')throw new real.GmailError('upstream_failure',{version:1,phase:'persistence',kind:'storage'});throw new Error('PRIVATE_CONNECTION_INFORMATION');}};});
import {GET} from '../app/api/gmail/status/route';
describe('Gmail status error privacy',()=>{
 it('returns a bounded stage error with no-store rather than an unhandled status failure',async()=>{fixture.failure='diagnostic';fixture.authenticated=true;const response=await GET(new Request('https://dive.amzeus.co.uk/api/gmail/status'));expect(response.status).toBe(502);expect(response.headers.get('cache-control')).toContain('no-store');expect(await response.json()).toMatchObject({diagnostic:{code:'upstream_failure',evidence:{phase:'persistence',kind:'storage'}}});});
 it('never returns a raw unexpected exception',async()=>{fixture.failure='unknown';fixture.authenticated=true;const response=await GET(new Request('https://dive.amzeus.co.uk/api/gmail/status'));expect(response.status).toBe(502);expect(await response.text()).not.toContain('PRIVATE');});
 it('requires authentication before status access',async()=>{fixture.authenticated=false;const response=await GET(new Request('https://dive.amzeus.co.uk/api/gmail/status'));expect(response.status).toBe(401);});
});
