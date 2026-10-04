'use client';
import {useEffect,useState,useRef,useCallback} from 'react';
import {WorkflowLink} from '../shared/workflow-link';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import {CloudSun} from 'lucide-react';
import type {DiveSiteRecord,Stored} from '../../lib/offline/dive-planning';
import {currentDiveAccount} from '../../lib/offline/dive-store';
import {fetchConditions} from '../../lib/weather/conditions-client';
import {readConditionsCache} from '../../lib/weather/conditions-cache';
import {readConditionsSettings} from '../../lib/weather/conditions-settings';
import {overviewForecast,type OverviewForecast,type OverviewForecastDetail,type OverviewMarineForecast} from '../../lib/weather/overview-forecast';
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
const rounded=(value:number)=>Number(value.toFixed(1)).toString();
function ForecastDetail({detail}:{detail:OverviewForecastDetail}){
 const unit=detail.unit==='m/s'&&detail.metric==='wind-gust'?'mph':detail.unit;
 const convert=(value:number)=>unit==='mph'?value*2.236936:value;
 const minimum=rounded(convert(detail.minimum)),maximum=rounded(convert(detail.maximum));
 return <div><dt>{detail.label}{detail.atNoon&&<small>near noon</small>}</dt><dd title={detail.resolution}>{minimum===maximum?maximum:`${minimum}–${maximum}`} {unit}</dd></div>;
}
function ForecastAttribution({source,offline=false}:{source:Pick<OverviewForecast,'source'|'attribution'|'url'|'retrievedAt'|'stale'>;offline?:boolean}){
 const attribution=source.attribution||source.source;
 const text=/^powered by\b/i.test(attribution)?attribution:`Powered by ${attribution}`;
 return <p className="forecast-attribution">{source.url?<a href={source.url} target="_blank" rel="noopener noreferrer">{text}</a>:text} · Retrieved {source.retrievedAt.slice(0,16).replace('T',' ')} UTC{offline?' · Cached / refresh unavailable':source.stale?' · Stale cached forecast':''}</p>;
}
export function SevenDayForecastCard({site,forecast}:{site:Pick<Site,'entityId'|'name'|'location'>;forecast?:OverviewForecast|undefined;compact?:boolean}){
 const marineSources=new Map<string,OverviewMarineForecast>();
 for(const day of forecast?.days??[])for(const sea of day.marine??[])marineSources.set(JSON.stringify([sea.source,sea.url,sea.retrievedAt]),sea);
 const attributions=new Map<string,Pick<OverviewForecast,'source'|'attribution'|'url'|'retrievedAt'|'stale'>>();
 for(const source of [...(forecast?[forecast]:[]),...marineSources.values()])attributions.set(JSON.stringify([source.attribution||source.source,source.url,source.retrievedAt.slice(0,16)]),source);
 return <section className="mini-forecast-card" aria-label={`${site.name} seven-day conditions`}>
  <div className="mini-forecast-head"><div><span className="focus-eyebrow">7-DAY DIVE WEATHER</span><h3><WorkflowLink href={workflowDestinationUrl({route:'Sites',recordId:site.entityId})}>{site.name}</WorkflowLink></h3><small>{site.location}</small></div><CloudSun aria-hidden="true"/></div>
  {forecast?.days.length?<>
   {forecast.days.length<7&&<output className="forecast-coverage">{forecast.days.length} of 7 days available from this source.</output>}
   <div className="forecast-days">{forecast.days.slice(0,7).map(day=>{
    const date=new Date(`${day.date}T12:00:00`);
    const low=day.minimumC==null?null:rounded(day.minimumC),high=day.maximumC==null?null:rounded(day.maximumC);
    const temperature=day.averageC!==undefined?`${rounded(day.averageC)} °C`:low!==null&&high!==null?`${low===high?high:`${low}–${high}`} °C`:high!==null?`${high} °C`:low!==null?`${low} °C`:'Unknown';
    return <article className="forecast-day" key={day.date}>
     <header><b>{date.toLocaleDateString(undefined,{weekday:'short'})}</b><time dateTime={day.date}>{date.toLocaleDateString(undefined,{day:'numeric',month:'short'})}</time></header>
     <p className="forecast-summary">{day.summary??'Weather description unavailable'}</p>
     <span className="forecast-temperature">{temperature}</span>
     <small>{day.averageC!==undefined?'UTC-day average':'Air temperature range'}</small>
     <dl><div><dt>Wind</dt><dd>{day.windAverageMps!==undefined?`${rounded(day.windAverageMps*2.236936)} mph UTC-day average`:day.windMaximumMps==null?'Wind unknown':`Up to ${rounded(day.windMaximumMps*2.236936)} mph`}</dd></div>{(day.details??[]).map(detail=><ForecastDetail key={detail.metric} detail={detail}/>)}</dl>
     {(day.marine??[]).map((sea,index)=><section className="forecast-marine" key={`${sea.source}-${index}`} aria-label={`Sea conditions for ${day.date}`}><h4>Sea forecast{marineSources.size>1&&<small>{sea.source}</small>}</h4><dl>{sea.details.map(detail=><ForecastDetail key={detail.metric} detail={detail}/>)}</dl></section>)}
    </article>;
   })}</div>
   <p className="forecast-range-note">Ranges cover the returned forecast time steps. Direction is the value nearest noon; rainfall is per reported interval. Sea models describe the surface, not conditions at diving depth.</p>
   {[...attributions.values()].map(source=><ForecastAttribution key={`${source.attribution}-${source.url}-${source.retrievedAt}`} source={source} offline={forecast.offline}/>)}
  </>:forecast?.context?<><p className="focus-copy"><strong>{forecast.context.temperatureC==null?'Air temperature unavailable':`${forecast.context.temperatureC} °C typical air temperature`}</strong></p><p className="focus-copy">{forecast.context.summary}</p><ForecastAttribution source={forecast} offline={forecast.offline}/></>:<p className="focus-copy">{forecast?'No atmospheric forecast is currently available. Open the Site for other conditions and saved observations.':'Choose Get weather to load the forecast.'}</p>}
 </section>;
}
