export function parseNasaDaily(body:any,date:string) {
 const key=date.replaceAll('-','');const values=body?.properties?.parameter;
 const read=(name:string)=>{const value=values?.[name]?.[key];return typeof value==='number' && Number.isFinite(value) && value > -900 ? value : null;};
 const airTemperatureC=read('T2M');const wind=read('WS10M');
 if(airTemperatureC==null && wind==null)throw new Error('NASA POWER has no daily observations for this date.');
 return {logConditions:{weatherSummary:'Daily averages — NASA POWER (UTC day; not conditions at dive time)',airTemperatureC,windSpeedKnots:wind==null?null:Math.round(wind*1.94384449*10)/10},provider:'NASA POWER',resolution:'daily',timeStandard:'UTC',attribution:'NASA POWER daily model averages for the UTC date. Not hourly dive conditions; no marine measurements supplied.'};
}
const cache=new Map<string,{expires:number;value:ReturnType<typeof parseNasaDaily>}>();
const pending=new Map<string,Promise<ReturnType<typeof parseNasaDaily>>>();
let retryAt=0;
export async function nasaDailyWeather(latitude:number,longitude:number,date:string) {
 const key=`${latitude.toFixed(3)}:${longitude.toFixed(3)}:${date}`;const prior=cache.get(key);if(prior && prior.expires>Date.now())return prior.value;
 if(pending.has(key))return pending.get(key)!;
 if(Date.now()<retryAt)throw new Error('NASA POWER is temporarily busy.');
 const work=(async()=>{const day=date.replaceAll('-','');const url=new URL('https://power.larc.nasa.gov/api/temporal/daily/point');url.search=new URLSearchParams({latitude:String(latitude),longitude:String(longitude),start:day,end:day,parameters:'T2M,WS10M',community:'RE',format:'JSON','time-standard':'UTC'}).toString();
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});if(response.status===429){retryAt=Date.now()+Math.max(60,Number(response.headers.get('retry-after'))||60)*1000;throw new Error('NASA POWER is temporarily busy.');}if(!response.ok)throw new Error('NASA POWER is unavailable.');
 const value=parseNasaDaily(await response.json(),date);if(cache.size>=200)cache.delete(cache.keys().next().value!);cache.set(key,{expires:Date.now()+86400000,value});return value;})().finally(()=>pending.delete(key));pending.set(key,work);return work;
}
