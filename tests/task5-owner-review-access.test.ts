import {beforeEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({access:{user:{userId:'owner'},slot:'landing'} as unknown,dbReads:0}));
vi.mock('../lib/server/sharing-access',()=>({sharingOwner:async()=>state.access,sharingJson:(value:unknown,status=200)=>Response.json(value,{status,headers:{'cache-control':'private, no-store'}})}));
import {GET} from '../app/api/data-review/status/route';
beforeEach(()=>{state.access={user:{userId:'owner'},slot:'landing'};state.dbReads=0;});
it('returns only owner permission with no source data, account identifier or cache allowance',async()=>{const response=await GET();expect(response.status).toBe(200);expect(await response.json()).toEqual({allowed:true});expect(response.headers.get('cache-control')).toBe('private, no-store');});
it('preserves server authentication and owner restrictions before any local scan is enabled',async()=>{for(const status of [401,403]){state.access={error:Response.json({error:'Unavailable'},{status})};expect((await GET()).status).toBe(status);}});
