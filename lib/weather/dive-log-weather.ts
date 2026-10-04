import {weatherDescription} from '../server/conditions/adapters';
import type {ConditionsProvider,ConditionsSelection} from './conditions-model';
export interface DiveLogWeatherRequest {latitude:number;longitude:number;date:string;time:string;marine:boolean;provider?:ConditionsSelection;disabledProviders?:ConditionsProvider[];timeZone?:string}
export interface DiveLogConditions {weatherSummary?:string|undefined;airTemperatureC?:number|null|undefined;windSpeedKnots?:number|null|undefined;windDirectionDegrees?:number|null|undefined;waveHeightM?:number|null|undefined;surfaceTemperatureC?:number|null|undefined;currentDirectionDegrees?:number|null|undefined}
export interface DiveLogWeatherResult {provider:string;resolution:string;attribution:string;logConditions:DiveLogConditions;directFallback?:boolean}
const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const finite=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
function validRequest(request:DiveLogWeatherRequest){
 if(!Number.isFinite(request.latitude)||Math.abs(request.latitude)>90||!Number.isFinite(request.longitude)||Math.abs(request.longitude)>180)throw new Error('Valid site coordinates are required.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(request.date)||!Number.isFinite(Date.parse(request.date+'T12:00:00Z'))||new Date(request.date+'T12:00:00Z').toISOString().slice(0,10)!==request.date)throw new Error('Select a valid dive date.');
 if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(request.time))throw new Error('Select a valid dive time.');
}
export const weatherInputKey=(request:DiveLogWeatherRequest)=>JSON.stringify([request.latitude,request.longitude,request.date,request.time,request.marine]);
async function responseBody(response:Response){
 if(Number(response.headers.get('content-length'))>1500000)throw new Error('The weather response exceeded the supported size.');
 if(!response.body)return {};
 const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw new Error('The weather response exceeded the supported size.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{return obj(JSON.parse(new TextDecoder().decode(bytes)));}catch{throw new Error('The weather response could not be read. Existing entries were kept.');}
}
function safeConditions(value:unknown):DiveLogConditions{
 const source=obj(value);const result:DiveLogConditions={};
 if(typeof source.weatherSummary==='string')result.weatherSummary=source.weatherSummary.slice(0,500);
 for(const key of ['airTemperatureC','windSpeedKnots','windDirectionDegrees','waveHeightM','surfaceTemperatureC','currentDirectionDegrees'] as const){const number=finite(source[key]);if(number!==undefined)result[key]=number;}
 return result;
}
const hasConditions=(conditions:DiveLogConditions)=>Boolean(conditions.weatherSummary)||Object.values(conditions).some(value=>typeof value==='number');
/** Bulk historical backfill must never turn typical climate context into recorded dive-day temperatures. */
export function historicalWeatherBackfillConditions(value:unknown):DiveLogConditions|null {
 const body=obj(value);
 if(body.weatherContext==='seasonal'||typeof body.resolution==='string'&&/seasonal|climatology/i.test(body.resolution))return null;
 const conditions=safeConditions(body.logConditions);
 return hasConditions(conditions)?conditions:null;
}
const rateMessage='Open-Meteo is temporarily rate-limited. Existing entries were kept. Please try again after its limit resets.';
/** A single official, no-key browser fallback avoids a shared server-IP quota; no credentials, proxies or automatic retry. */
export async function fetchDiveLogWeather(request:DiveLogWeatherRequest,signal?:AbortSignal,fetcher:typeof fetch=fetch):Promise<DiveLogWeatherResult>{
 validRequest(request);const timeout=AbortSignal.timeout(45000);const combined=signal?AbortSignal.any([signal,timeout]):timeout;
 const params=new URLSearchParams({latitude:String(request.latitude),longitude:String(request.longitude),date:request.date,time:request.time,marine:String(request.marine)});
 if(request.provider)params.set('provider',request.provider);
 if(request.disabledProviders?.length)params.set('disabled',request.disabledProviders.join(','));
 if(request.timeZone)params.set('timeZone',request.timeZone);
 const response=await fetcher(`/api/site-weather?${params}`,{cache:'no-store',signal:combined});
 if(response.status===401||response.status===403)throw new Error('Sign in again to retrieve weather. Existing entries were kept.');
 const result=await responseBody(response);const conditions=safeConditions(result.logConditions);
 if(response.ok&&hasConditions(conditions))return {provider:typeof result.provider==='string'?result.provider.slice(0,100):'Open-Meteo',resolution:typeof result.resolution==='string'?result.resolution.slice(0,100):'hourly',attribution:typeof result.attribution==='string'?result.attribution.slice(0,1500):'',logConditions:conditions};
 // Only a server-declared provider failure permits direct retrieval, never a permission or input failure.
 if(result.directFallback!==true||![429,502,503,504].includes(response.status))throw new Error(result.code==='rate_limited'?rateMessage:'Weather is unavailable for that date and time. Existing entries were kept.');
 const historical=request.date<new Date(Date.now()-5*86400000).toISOString().slice(0,10);
 const atmospheric=new URL(historical?'https://archive-api.open-meteo.com/v1/archive':'https://api.open-meteo.com/v1/forecast');
 atmospheric.search=new URLSearchParams({latitude:String(request.latitude),longitude:String(request.longitude),start_date:request.date,end_date:request.date,hourly:'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m',timezone:'auto',wind_speed_unit:'kn'}).toString();
 const primary=await fetcher(atmospheric.href,{cache:'no-store',credentials:'omit',signal:combined,referrerPolicy:'no-referrer'});
 if(!primary.ok)throw new Error(primary.status===429?rateMessage:'Open-Meteo could not provide weather for this date and time. Existing entries were kept.');
 const data=await responseBody(primary);const hourly=obj(data.hourly);const target=`${request.date}T${request.time.slice(0,2)}:00`;const index=Array.isArray(hourly.time)?hourly.time.indexOf(target):-1;
 const read=(name:string)=>index>=0&&Array.isArray(hourly[name])?finite((hourly[name] as unknown[])[index]):undefined;
 const direct:DiveLogConditions={weatherSummary:weatherDescription(read('weather_code')),airTemperatureC:read('temperature_2m'),windSpeedKnots:read('wind_speed_10m'),windDirectionDegrees:read('wind_direction_10m')};
 if(index<0||!hasConditions(direct))throw new Error('No weather data are available for this exact date and time. Existing entries were kept.');
 let marineAvailable=false;
 if(request.marine){
  const url=new URL('https://marine-api.open-meteo.com/v1/marine');url.search=new URLSearchParams({latitude:String(request.latitude),longitude:String(request.longitude),start_date:request.date,end_date:request.date,hourly:'wave_height,sea_surface_temperature,ocean_current_direction',timezone:'auto',cell_selection:'sea'}).toString();
  try{const marineResponse=await fetcher(url.href,{cache:'no-store',credentials:'omit',signal:combined,referrerPolicy:'no-referrer'});if(marineResponse.ok){const marine=obj((await responseBody(marineResponse)).hourly);const mi=Array.isArray(marine.time)?marine.time.indexOf(target):-1;for(const [key,field] of [['waveHeightM','wave_height'],['surfaceTemperatureC','sea_surface_temperature'],['currentDirectionDegrees','ocean_current_direction']] as const){const value=mi>=0&&Array.isArray(marine[field])?finite((marine[field] as unknown[])[mi]):undefined;if(value!==undefined){direct[key]=value;marineAvailable=true;}}}}catch(error){if(combined.aborted)throw error;/* Atmospheric readings remain usable when marine coverage is missing. */}
 }
 return {provider:'Open-Meteo',resolution:'hourly',logConditions:direct,directFallback:true,attribution:`Open-Meteo ${historical?'historical model':'forecast'} data, retrieved directly by this browser for ${target}. ${request.marine&&!marineAvailable?'Marine data unavailable; saved water and wave observations were kept. ':''}Model data are guidance only, not dive-safety or navigation advice.`};
}
const fieldMap={weather:'weatherSummary',airTemp:'airTemperatureC',windSpeed:'windSpeedKnots',windDirection:'windDirectionDegrees',waveHeight:'waveHeightM',surfaceTemp:'surfaceTemperatureC',currentDirection:'currentDirectionDegrees'} as const;
/** Apply to a draft only; missing values and edits made during the request are retained. */
export function applyDiveLogWeather<T extends Partial<Record<keyof typeof fieldMap,string>>>(before:T,current:T,conditions:DiveLogConditions,sameRequest:boolean):T{
 const next={...current};if(!sameRequest)return next;
 for(const [field,metric] of Object.entries(fieldMap) as Array<[keyof typeof fieldMap,(typeof fieldMap)[keyof typeof fieldMap]]>){const value=conditions[metric];if(current[field]!==before[field]||value==null||value==='')continue;(next as Record<string,unknown>)[field]=String(value);}
 return next;
}
