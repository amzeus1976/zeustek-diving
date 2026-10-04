import { conditionFreshness, conditionWallTime, type ConditionReading, type ConditionMetric, type ConditionsSnapshot } from './conditions-model';
export interface OverviewForecastDetail {metric:ConditionMetric;label:string;minimum:number;maximum:number;unit:string;resolution:string;atNoon?:boolean}
export interface OverviewMarineForecast {source:string;attribution:string;url:string;retrievedAt:string;details:OverviewForecastDetail[];stale:boolean}
export interface OverviewForecastDay {
  date: string;
  minimumC: number | null;
  maximumC: number | null;
  windMaximumMps: number | null;
  summary: string | null;
  averageC?: number;
  windAverageMps?:number;
  details?:OverviewForecastDetail[];
  marine?:OverviewMarineForecast[];
}
const detailMetrics:Array<[ConditionMetric,string]>=[['feels-like','Feels like'],['wind-gust','Gust'],['wind-direction','Wind from'],['rain','Rain per reported interval'],['air-visibility','Atmospheric visibility']];
const marineMetrics:Array<[ConditionMetric,string]>=[['water-temperature','Surface water'],['wave-height','Wave height'],['wave-period','Wave period'],['wave-direction','Waves from'],['swell-height','Swell height'],['current-speed','Current speed'],['current-direction','Current direction'],['sea-level','Sea level (datum unknown)']];
function forecastDetails(rows:ConditionReading[],metrics:Array<[ConditionMetric,string]>):OverviewForecastDetail[]{
  return metrics.flatMap(([metric,label])=>{
    let values=rows.filter(row=>row.metric===metric&&typeof row.value==='number'&&Number.isFinite(row.value));
    // Underwater depth evidence cannot be relabelled surface water.
    if(metric==='water-temperature')values=values.filter(row=>row.depth.kind==='surface');
    if(!values.length)return [];
    const direction=metric.endsWith('direction');
    if(direction)values=[...values].sort((a,b)=>Math.abs(Number(conditionWallTime(a)?.slice(11,13))-12)-Math.abs(Number(conditionWallTime(b)?.slice(11,13))-12)).slice(0,1);
    // Do not combine different units or resolutions, or sum accumulated rain twice.
    const basis=values[0]!;values=values.filter(row=>row.unit===basis.unit&&row.resolution===basis.resolution&&row.datum===basis.datum);
    const numbers=values.map(row=>Number(row.value));
    return [{metric,label:metric==='sea-level'&&basis.datum?`Sea level (${basis.datum})`:label,minimum:Math.min(...numbers),maximum:Math.max(...numbers),unit:basis.unit,resolution:basis.resolution,...(direction?{atNoon:true}: {})}];
  });
}
function dailyMarine(snapshot:ConditionsSnapshot,date:string):OverviewMarineForecast[]{
  const groups=new Map<string,ConditionReading[]>();
  for(const row of snapshot.readings){
    if(row.classification!=='forecast'||!marineMetrics.some(([metric])=>metric===row.metric)||!conditionWallTime(row)?.startsWith(date))continue;
    const key=JSON.stringify([row.provider,row.label,row.latitude,row.longitude,row.model??'',row.station??'',row.retrievedAt]);
    const group=groups.get(key)??[];group.push(row);groups.set(key,group);
  }
  return [...groups.values()].flatMap(rows=>{
    const basis=rows[0]!,details=forecastDetails(rows,marineMetrics);
    return details.length?[{source:basis.label,attribution:basis.attribution??basis.label,url:basis.url,retrievedAt:basis.retrievedAt,details,stale:conditionFreshness(basis,new Date().toISOString())==='stale'}]:[];
  });
}
export interface OverviewForecast {
  days: OverviewForecastDay[];
  source: string;
  retrievedAt: string;
  offline: boolean;
  stale: boolean;
  attribution: string;
  url: string;
  context?: { kind: 'seasonal'; temperatureC: number | null; summary: string };
}
/** Daily extrema of one atmosphere model, never an average across competing providers. */
export function overviewForecast(
  snapshot: ConditionsSnapshot,
): OverviewForecast {
  const candidates = snapshot.readings.filter(
    (r) => r.classification === 'forecast' && r.metric === 'air-temperature',
  );
  const preferred =
    candidates.find((r) => r.provider === snapshot.request.provider) ??
    candidates.find((r) => r.provider === 'open-meteo') ??
    candidates[0];
  if (!preferred) {
    const typical = snapshot.readings.find(r => r.metric === 'air-temperature' && r.resolution === 'monthly climatology');
    return {
      days: [],
      source: typical?.label ?? 'No atmospheric forecast',stale:!typical,attribution:typical?.attribution ?? '',url:typical?.url ?? '',
      retrievedAt: snapshot.retrievedAt,
      offline: Boolean(snapshot.offline),
      ...(typical ? { context: { kind: 'seasonal' as const, temperatureC: typeof typical.value === 'number' ? typical.value : null, summary: typical.detail ?? 'Typical monthly climate; not a date forecast.' } } : {}),
    };
  }
  const rows = snapshot.readings.filter(
    (r) =>
      r.classification === 'forecast' &&
      r.provider === preferred.provider &&
      r.label === preferred.label &&
      r.latitude === preferred.latitude &&
      r.longitude === preferred.longitude,
  );
  const dates = [
    ...new Set(
      rows
        .map((r) => conditionWallTime(r)?.slice(0, 10))
        .filter((d): d is string => Boolean(d) && d! >= snapshot.request.date),
    ),
  ]
    .sort()
    .slice(0, 7);
  return {
    days: dates.map((date) => {
      const daily = rows.filter((r) => conditionWallTime(r)?.startsWith(date));
      const dailyAverage = daily.some(r=>r.resolution === 'UTC-day forecast average');
      const air = daily
        .filter(
          (r) => r.metric === 'air-temperature' && typeof r.value === 'number',
        )
        .map((r) => Number(r.value));
      const windRows = daily
        .filter((r) => r.metric === 'wind-speed' && typeof r.value === 'number')
      const wind=windRows.map(r=>Number(r.value));
      const windAverage=windRows.length>0&&windRows.every(r=>r.resolution==='UTC-day forecast average');
      const weather = daily
        .filter((r) => r.metric === 'weather')
        .sort(
          (a, b) =>
            Math.abs(Number(conditionWallTime(a)?.slice(11, 13)) - 12) -
            Math.abs(Number(conditionWallTime(b)?.slice(11, 13)) - 12),
        )[0];
      return {
        date,
        minimumC: !dailyAverage && air.length ? Math.min(...air) : null,
        maximumC: !dailyAverage && air.length ? Math.max(...air) : null,
        ...(dailyAverage && air.length ? {averageC:air[0]!} : {}),
        windMaximumMps: !windAverage&&wind.length ? Math.max(...wind) : null,
        ...(windAverage?{windAverageMps:wind[0]!}:{}),
        summary: typeof weather?.value === 'string' ? weather.value : null,
        details:forecastDetails(daily,detailMetrics),
        marine:dailyMarine(snapshot,date),
      };
    }),
    source: preferred.label,
    stale:conditionFreshness(preferred,new Date().toISOString())==='stale',
    attribution:preferred.attribution??preferred.label,
    url:preferred.url,
    retrievedAt: preferred.retrievedAt,
    offline: Boolean(snapshot.offline),
  };
}
