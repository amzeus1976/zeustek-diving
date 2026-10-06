import {retainPartialConditions} from './weather/conditions-retention';
import type { PlanConditionSnapshot } from './offline/dive-planning-centre';
import {conditionFreshness,selectConditions} from './weather/conditions-model';

export const PLAN_FORECAST_DAYS = 16;
export type PlanWeatherMode = 'auto' | 'seasonal' | 'manual' | 'unavailable';

export function planWeatherMode(conditions?: PlanConditionSnapshot): PlanWeatherMode {
  if (conditions?.provenance === 'recorded') return 'manual';
  if (conditions?.provenance === 'seasonal') return 'seasonal';
  if (conditions?.provenance === 'forecast') return 'auto';
  return 'unavailable';
}

/** A provider failure never deletes observations or upgrades stale data into a new forecast. */
export function weatherFailureFallback(conditions: PlanConditionSnapshot | undefined, rateLimited: boolean): PlanConditionSnapshot {
  return {
    ...conditions,
    provenance: conditions?.provenance ?? 'unavailable',
    weatherAvailability: rateLimited ? 'rate-limited' : 'unavailable',
    sourceDetail: conditions?.sourceDetail ?? 'Weather unavailable — check conditions manually before diving.',
  };
}

/** Switching to owner-entered conditions preserves prior owner entries, but not an old model forecast. */
export function ownerConditionMode(conditions: PlanConditionSnapshot | undefined, mode: 'manual' | 'seasonal' | 'unavailable'): PlanConditionSnapshot {
  const previousForecast = conditions?.provenance === 'forecast' && conditions.weatherFieldSources === undefined;
  const retained = previousForecast ? {
    ...conditions,
    waterTemperatureC: null,
    waveHeightM: null,
    visibilityM: null,
    swellHeightM: null,
    currentStrength: null,
  } : { ...conditions };
  const weatherValueOrigins={...conditions?.weatherValueOrigins};
  for(const field of ['weather','airTemperatureC','surfaceTemperatureC'] as const){
    if(weatherValueOrigins[field]==='weather'||(conditions?.provenance==='forecast'&&weatherValueOrigins[field]!=='owner')){
      Object.assign(retained,{[field]:null});delete weatherValueOrigins[field];
    }
  }
  return {
    ...retained,
    weatherValueOrigins,
    provenance: mode === 'manual' ? 'recorded' : mode,
    ...(mode === 'unavailable' ? { weatherAvailability: 'unavailable' as const } : retained.weatherAvailability ? { weatherAvailability: retained.weatherAvailability } : {}),
    sourceDetail: mode === 'seasonal'
      ? 'Owner-entered seasonal / typical conditions — not a dive-day forecast.'
      : mode === 'manual'
        ? 'Owner-entered conditions — verify locally before diving.'
        : 'Weather unavailable — check conditions manually before diving.',
  };
}

export type PlanWeatherField = keyof NonNullable<PlanConditionSnapshot['weatherFieldSources']>;
const empty=(value:unknown)=>value===null||value===undefined||(typeof value==='string'&&!value.trim());
/** Merge against the latest draft after the request finishes, not the draft captured at request time.
 * Only fresh, selected, genuinely matching measurements can fill fields. Thresholds are not measurements. */
export function fillEmptyPlanWeatherFields(current:PlanConditionSnapshot|undefined,next:PlanConditionSnapshot):PlanConditionSnapshot {
 const result:PlanConditionSnapshot={...current,...next,weatherFieldSources:{...current?.weatherFieldSources}};
 result.weatherValueOrigins={...current?.weatherValueOrigins};
 for(const field of ['weather','airTemperatureC','surfaceTemperatureC'] as const){
  if(!empty(current?.[field]))result.weatherValueOrigins[field]=current?.weatherValueOrigins?.[field]??(current?.provenance==='forecast'?'weather':'owner');
  else if(!empty(next[field]))result.weatherValueOrigins[field]='weather';
  else delete result.weatherValueOrigins[field];
 }
 for(const field of ['waterTemperatureC','waveHeightM','visibilityM','swellHeightM','currentStrength'] as const)Object.assign(result,{[field]:empty(current?.[field])?null:current![field]});
 for(const field of ['weather','airTemperatureC','waterTemperatureC','surfaceTemperatureC','waveHeightM','visibilityM','swellHeightM','currentStrength','tideSummary','notes'] as const){
  if(!empty(current?.[field]))Object.assign(result,{[field]:current![field]});
 }
 const snapshot=next.conditionsV1;
 if(!snapshot)return result;
 const selected=selectConditions(snapshot.readings,snapshot.request,next.capturedAt??snapshot.retrievedAt)
  .filter(reading=>conditionFreshness(reading,next.capturedAt??snapshot.retrievedAt)==='fresh'&&typeof reading.value==='number'&&Number.isFinite(reading.value));
 const fields=[['waterTemperatureC','water-temperature','°C'],['visibilityM','visibility','m'],['waveHeightM','wave-height','m'],['swellHeightM','swell-height','m'],['currentStrength','current-speed','m/s']] as const;
 for(const [field,metric,unit] of fields){
  if(!empty(current?.[field]))continue;
  const matching=selected.filter(reading=>reading.metric===metric&&reading.unit===unit);
  // Different depth/datum readings require an explicit choice, rather than silently choosing one.
  if(matching.length!==1)continue;
  const reading=matching[0]!;
  Object.assign(result,{[field]:field==='currentStrength'?`${reading.value} m/s`:reading.value});
  result.weatherFieldSources![field]=structuredClone(reading);
 }
 return result;
}
/** An explicit refresh may replace provider-filled measurements. Owner edits and
 * earlier measurements without a usable replacement remain intact. */
export function refreshPlanWeatherFields(current:PlanConditionSnapshot|undefined,next:PlanConditionSnapshot):PlanConditionSnapshot {
 const editable={...current};
 const refreshable:Array<'weather'|'airTemperatureC'|'surfaceTemperatureC'|PlanWeatherField>=[];
 for(const field of ['weather','airTemperatureC','surfaceTemperatureC'] as const){
  if(current?.weatherValueOrigins?.[field]==='weather')refreshable.push(field);
 }
 for(const field of ['waterTemperatureC','visibilityM','waveHeightM','swellHeightM','currentStrength'] as const){
  if(current?.weatherFieldSources?.[field])refreshable.push(field);
 }
 for(const field of refreshable)Object.assign(editable,{[field]:null});
 const result=fillEmptyPlanWeatherFields(editable,next);
 for(const field of refreshable){
  if(!empty(result[field]))continue;
  Object.assign(result,{[field]:current?.[field]});
  if(field==='weather'||field==='airTemperatureC'||field==='surfaceTemperatureC'){
   result.weatherValueOrigins={...result.weatherValueOrigins,[field]:'weather'};
  }else if(current?.weatherFieldSources?.[field]){
   result.weatherFieldSources={...result.weatherFieldSources,[field]:current.weatherFieldSources[field]};
  }
 }
 return result;
}
/** Focusing does not clear data. Only an actual field edit changes its provenance. */
export function editPlanWeatherField(current:PlanConditionSnapshot|undefined,field:PlanWeatherField,value:number|string|null,capturedAt:string):PlanConditionSnapshot {
 const weatherFieldSources={...current?.weatherFieldSources};delete weatherFieldSources[field];
 return {...current,[field]:value,weatherFieldSources,capturedAt,provenance:current?.provenance??'recorded'};
}

/** Open-Meteo supports up to sixteen days. Shorter-provider coverage falls back to labelled typical context. */
export function planningWeatherRegime(plannedDate: string, today: string): 'forecast' | 'seasonal' | 'past' | 'invalid' {
  const planned = Date.parse(`${plannedDate}T00:00:00Z`);
  const start = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(planned) || !Number.isFinite(start)) return 'invalid';
  const days = Math.round((planned - start) / 86400000);
  if (days < 0) return 'past';
  return days < PLAN_FORECAST_DAYS ? 'forecast' : 'seasonal';
}

export interface PlannedWeatherResponse {
  weatherContext?: 'forecast' | 'seasonal';
  conditionsV1?:import('./weather/conditions-model').ConditionsSnapshot;
  providerId?: import('./weather/provider-contract').WeatherProviderId;
  sourceCoordinates?: {latitude:number;longitude:number};
  sourceTime?: string;
  error?: string;
  provider?: string;
  resolution?: string;
  attribution?: string;
  logConditions?: {
    weatherSummary?: string;
    airTemperatureC?: number | null;
    waveHeightM?: number | null;
    surfaceTemperatureC?: number | null;
    currentDirectionDegrees?: number | null;
  };
}

/** Unknown marine fields stay unknown; historical seasonal context is never presented as a dive-day forecast. */
export function plannedWeatherSnapshot(response: PlannedWeatherResponse, regime: 'forecast' | 'seasonal', siteId: string, date: string, capturedAt: string, previous?: PlanConditionSnapshot): PlanConditionSnapshot {
  const value = response.logConditions;
  if (!value || (!value.weatherSummary && value.airTemperatureC == null)) throw new Error('No usable weather data were returned. Existing conditions were kept.');
  const actualRegime = response.weatherContext ?? regime;
  return {
    provenance: actualRegime,
    weatherAvailability: 'available',
    capturedAt,
    sourceSiteId: siteId,
    sourceDate: date,
    sourceDetail: `${response.provider ?? 'Open-Meteo'} · ${response.resolution ?? regime} · ${response.attribution ?? ''}`,
    weather: value.weatherSummary || null,
    weatherValueOrigins:{...(value.weatherSummary?{weather:'weather' as const}:{}),...(value.airTemperatureC!=null?{airTemperatureC:'weather' as const}:{}),...(actualRegime==='forecast'&&value.surfaceTemperatureC!=null?{surfaceTemperatureC:'weather' as const}:{})},
    airTemperatureC: value.airTemperatureC ?? null,
    waterTemperatureC: null,
    surfaceTemperatureC: actualRegime === 'forecast' ? value.surfaceTemperatureC ?? null : null,
    ...(response.conditionsV1?{conditionsV1:retainPartialConditions(response.conditionsV1,previous?.conditionsV1)}:{}),
    waveHeightM: actualRegime === 'forecast' ? value.waveHeightM ?? null : null,
    currentStrength: null,
    visibilityM: null,
    swellHeightM: null,
  };
}
