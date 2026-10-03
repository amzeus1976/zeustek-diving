import {afterEach,describe,it,expect,vi} from 'vitest';
import {fetchDiveLogWeather,applyDiveLogWeather,weatherInputKey} from '../lib/weather/dive-log-weather';
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({userId:'fixture-owner'})}));
const request={latitude:51,longitude:0,date:'2026-10-03',time:'12:00',marine:false};
const hourly={hourly:{time:['2026-10-03T12:00'],temperature_2m:[14],weather_code:[2],wind_speed_10m:[8],wind_direction_10m:[180]}};
const urlText=(url:string|URL|Request)=>typeof url==='string'?url:url instanceof URL?url.href:url.url;
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();vi.resetModules();});
describe('bounded Dive Log weather retrieval',()=>{
 it('uses authenticated server weather first with no extra provider request on success',async()=>{
  const fetcher=vi.fn(async()=>Response.json({provider:'NASA POWER',resolution:'daily',logConditions:{airTemperatureC:16},attribution:'Daily averages'}));const result=await fetchDiveLogWeather(request,undefined,fetcher);
  expect(result).toMatchObject({provider:'NASA POWER',resolution:'daily',logConditions:{airTemperatureC:16}});expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('falls back once to the same no-key provider in the browser when server IP is throttled',async()=>{
  const fetcher=vi.fn(async (url:string|URL|Request)=>urlText(url).startsWith('/api/')?Response.json({code:'rate_limited',directFallback:true},{status:429}):Response.json(hourly));const result=await fetchDiveLogWeather(request,undefined,fetcher);
  expect(result).toMatchObject({provider:'Open-Meteo',resolution:'hourly',logConditions:{weatherSummary:'Partly cloudy',airTemperatureC:14,windSpeedKnots:8}});expect(fetcher).toHaveBeenCalledTimes(2);expect(urlText(fetcher.mock.calls[1]![0])).toMatch(/^https:\/\/api.open-meteo.com\/v1\/forecast\?/);
 });
 it('does not bypass sign-in, retry the same browser rate limit, or claim weather exists on total failure',async()=>{
  const unauth=vi.fn(async()=>new Response('',{status:401}));await expect(fetchDiveLogWeather(request,undefined,unauth)).rejects.toThrow(/sign in/i);expect(unauth).toHaveBeenCalledTimes(1);
  const limited=vi.fn(async(url:string|URL|Request)=>urlText(url).startsWith('/api/')?Response.json({code:'rate_limited',directFallback:true},{status:429}):Response.json({reason:'PRIVATE UPSTREAM RESPONSE'},{status:429}));await expect(fetchDiveLogWeather(request,undefined,limited)).rejects.toThrow(/rate.limit/i);expect(limited).toHaveBeenCalledTimes(2);
 });
 it('requests the exact historical date/hour, tolerates missing marine data and never invents visibility',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));const fetcher=vi.fn(async(url:string|URL|Request)=>urlText(url).startsWith('/api/')?Response.json({directFallback:true},{status:502}):urlText(url).includes('marine-api')?new Response('',{status:503}):Response.json({...hourly,hourly:{...hourly.hourly,time:['2026-08-26T09:00']}}));
  const result=await fetchDiveLogWeather({...request,date:'2026-08-26',time:'09:30',marine:true},undefined,fetcher);const apiCall=fetcher.mock.calls.map(x=>urlText(x[0])).find(x=>x.includes('archive-api'))!;expect(new URL(apiCall).searchParams.get('start_date')).toBe('2026-08-26');expect(result.logConditions.airTemperatureC).toBe(14);expect(result.logConditions).not.toHaveProperty('visibilityM');expect(result.logConditions.surfaceTemperatureC).toBeUndefined();
 });
 it('does not use another date, nonfinite readings, malformed dates or coordinates',async()=>{
  const fetcher=vi.fn(async(url:string|URL|Request)=>urlText(url).startsWith('/api/')?Response.json({directFallback:true},{status:502}):Response.json({...hourly,hourly:{...hourly.hourly,time:['2026-10-04T12:00']}}));await expect(fetchDiveLogWeather(request,undefined,fetcher)).rejects.toThrow(/date.*time|time.*date/i);
  const untouched=vi.fn();await expect(fetchDiveLogWeather({...request,date:'2026-02-30'},undefined,untouched)).rejects.toThrow(/date/i);await expect(fetchDiveLogWeather({...request,latitude:Infinity},undefined,untouched)).rejects.toThrow(/coordinates/i);expect(untouched).not.toHaveBeenCalled();
 });
 it('discards a stale site/date response and preserves manually edited or missing field values',()=>{
  const start={weather:'Old',airTemp:'15',windSpeed:'4',surfaceTemp:'12'};const current={...start,airTemp:'17'};const data={weatherSummary:'Overcast',airTemperatureC:14,windSpeedKnots:8};
  expect(applyDiveLogWeather(start,current,data,true)).toEqual({...current,weather:'Overcast',windSpeed:'8'});expect(applyDiveLogWeather(start,current,data,false)).toEqual(current);expect(start.airTemp).toBe('15');expect(weatherInputKey(request)).not.toBe(weatherInputKey({...request,date:'2026-10-04'}));
 });
 it('returns truthful rate-limit status and a bounded fallback flag from the server',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:429,headers:{'retry-after':'120'}})));const {GET}=await import('../app/api/site-weather/route');
  const response=await GET(new Request('https://fixture.invalid/api/site-weather?latitude=51&longitude=0&date=2026-10-03&time=12:00'));expect(response.status).toBe(429);expect(response.headers.get('retry-after')).toBe('120');expect(await response.json()).toMatchObject({code:'rate_limited',directFallback:true});
 });
});
