import {describe,it,expect,vi,afterEach} from 'vitest';
import {calculateGasRates,fillMissingGasRates} from '../lib/gas-rates';
import {parseNasaDaily} from '../lib/server/nasa-weather';
vi.mock('../app/chatgpt-auth',()=>({getChatGPTUser:async()=>({id:'test'})}));
const cylinder={configuration:'Single Tank',internalVolumeLiters:12,startPressureBar:200,endPressureBar:80} as any;
const profile={cylinders:[cylinder],averageDepthM:20,totalElapsedMin:40};
afterEach(()=>vi.unstubAllGlobals());
describe('gas calculations',()=>{
 it('keeps pressure SAC separate from volume RMV',()=>{expect(calculateGasRates(profile)).toEqual({sacPressureBarMin:1,rmvRate:12});});
 it('preserves existing recorded rates',()=>{expect(fillMissingGasRates({...profile,cylinders:[{...cylinder,sacPressureBarMin:2,rmvRate:24}]}).changed).toBe(false);});
 it('skips missing inputs, reversed pressures and CCR',()=>{expect(calculateGasRates({...profile,averageDepthM:null})).toHaveProperty('error');expect(calculateGasRates({...profile,cylinders:[{...cylinder,endPressureBar:210}]})).toHaveProperty('error');expect(calculateGasRates({...profile,cylinders:[{...cylinder,configuration:'CCR Oxygen'}]})).toHaveProperty('error');});
});
describe('historical weather fallback',()=>{
 it('converts wind units and marks daily data without inventing marine conditions',()=>{const data=parseNasaDaily({properties:{parameter:{T2M:{20250801:16.61},WS10M:{20250801:4.56}}}},'2025-08-01');expect(data.logConditions.windSpeedKnots).toBe(8.9);expect(data.resolution).toBe('daily');expect(data.logConditions).not.toHaveProperty('surfaceTemperatureC');});
 it('rejects the provider missing-data sentinel',()=>{expect(()=>parseNasaDaily({properties:{parameter:{T2M:{20250801:-999}}}},'2025-08-01')).toThrow();});
 it('uses independent NASA data when the primary is unavailable',async()=>{
 const fetcher=vi.fn(async(url:any)=>String(url).includes('power.larc.nasa.gov')?Response.json({properties:{parameter:{T2M:{20250801:17},WS10M:{20250801:2}}}}):new Response('',{status:503}));vi.stubGlobal('fetch',fetcher);
 const {GET}=await import('../app/api/site-weather/route');const response=await GET(new Request('https://example.test/api/site-weather?latitude=51&longitude=0&date=2025-08-01&time=12:00'));
 expect(response.status).toBe(200);expect((await response.json() as {provider:string}).provider).toBe('NASA POWER');expect(fetcher).toHaveBeenCalledTimes(2);
 });
});
