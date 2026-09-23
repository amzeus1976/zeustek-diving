'use client';
import {useEffect,useState,useRef,useCallback} from 'react';
import Link from 'next/link';
import {WorkflowLink} from '../shared/workflow-link';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import {CloudSun} from 'lucide-react';
import type {DiveSiteRecord,Stored} from '../../lib/offline/dive-planning';
import {currentDiveAccount} from '../../lib/offline/dive-store';
import {fetchConditions} from '../../lib/weather/conditions-client';
import {readConditionsCache} from '../../lib/weather/conditions-cache';
import {readConditionsSettings} from '../../lib/weather/conditions-settings';
import {overviewForecast,type OverviewForecast} from '../../lib/weather/overview-forecast';
import type {ConditionsRequest} from '../../lib/weather/conditions-model';
type Site=Stored<DiveSiteRecord>;
export function useSiteForecasts(sites:Site[]){
 const [forecasts,setForecasts]=useState<Record<string,OverviewForecast>>({});
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const controller=useRef<AbortController|null>(null);
 const account=currentDiveAccount();
 const signature=JSON.stringify(sites.filter(s=>s.latitude!=null&&s.longitude!=null).slice(0,8).map(s=>({entityId:s.entityId,name:s.name,latitude:s.latitude,longitude:s.longitude,siteType:s.siteType,waterType:s.waterType})));
 const load=useCallback(async(refresh:boolean,signal:AbortSignal)=>{
  const located=JSON.parse(signature) as Site[];
  const settings=await readConditionsSettings();
  const result=await Promise.allSettled(located.map(async site=>{
   const marine=site.waterType==='salt'||['shore','boat','wreck','sea'].includes(site.siteType??'');
   const request:ConditionsRequest={siteId:site.entityId,siteName:site.name,latitude:site.latitude!,longitude:site.longitude!,siteType:marine?'coastal':'inland',marine,date:new Date().toISOString().slice(0,10),time:'12:00',mode:'forecast',provider:settings.defaultProvider,disabledProviders:settings.disabledProviders};
   const snapshot=refresh?await fetchConditions(account,request,signal,false):await readConditionsCache(account,request);
   return snapshot?[site.entityId,overviewForecast(snapshot)] as const:null;
  }));
  if(signal.aborted)return;
  setForecasts(Object.fromEntries(result.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[])));
  setError(result.some(r=>r.status==='rejected')?'Some forecasts are unavailable. Saved conditions remain available in Site details.':'');
 },[signature,account]);
 useEffect(()=>{const current=new AbortController();controller.current?.abort();controller.current=current;void Promise.resolve().then(()=>load(false,current.signal)).catch(()=>{if(!current.signal.aborted)setError('Saved forecasts could not be loaded.');});return()=>current.abort();},[load]);
 async function refresh(){controller.current?.abort();const current=new AbortController();controller.current=current;setBusy(true);try{await load(true,current.signal);}catch{if(!current.signal.aborted)setError('Forecasts could not be refreshed.');}finally{if(!current.signal.aborted)setBusy(false);}}
 return {forecasts,error,busy,refresh};
}
export function SevenDayForecastCard({site,forecast,compact=false}:{site:Pick<Site,'entityId'|'name'|'location'>;forecast?:OverviewForecast|undefined;compact?:boolean}){
 return <section className={`mini-forecast-card ${compact?'compact':''}`}>
 <div className="mini-forecast-head"><div><span className="focus-eyebrow">7-DAY DIVE WEATHER</span><h3><WorkflowLink href={workflowDestinationUrl({route:'Sites',recordId:site.entityId})}>{site.name}</WorkflowLink></h3><small>{site.location}</small></div><CloudSun/></div>
 {forecast?.days.length?<><div className="forecast-days">{forecast.days.slice(0,compact?4:7).map(day=><div key={day.date} title={day.summary??'Forecast'}><b>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short'})}</b><CloudSun size={18}/><span>{day.maximumC==null?'Unknown':`${Math.round(day.maximumC)}°C`}</span><small>{day.windMaximumMps==null?'Wind unknown':`${Math.round(day.windMaximumMps*2.236936)} mph`}</small></div>)}</div><small>{forecast.source} · Retrieved {forecast.retrievedAt.slice(0,16).replace('T',' ')} UTC{forecast.offline?' · Cached / refresh unavailable':forecast.stale?' · Stale cached forecast':''} · <Link href={forecast.url}>{forecast.attribution}</Link></small></>:<p className="focus-copy">Choose Get weather to load the forecast.</p>}
 </section>;
}
