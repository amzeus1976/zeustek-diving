import {nasaDailyWeather} from '@/lib/server/nasa-weather';
import { getChatGPTUser } from '../../chatgpt-auth';
import { atmosphericFallback, marineFallback, type ConditionsEnvironment } from '@/lib/server/conditions/service';
import { parseConditionsRequest } from '@/lib/server/conditions/request';
import { selectConditions, type ConditionsSnapshot } from '@/lib/weather/conditions-model';
import { boundedBody } from '@/lib/server/conditions/transport';

const weatherDescriptions: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog', 51: 'Light drizzle', 53: 'Drizzle',
  55: 'Heavy drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
  81: 'Heavy rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm',
  96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
};

function valueAt(values: unknown, index: number) {
  return Array.isArray(values) && index >= 0 ? (values[index] as number | null) : null;
}

type WeatherPayload = {hourly?:Record<string,unknown>;daily?:Record<string,unknown>;[key:string]:unknown};
const upstreamCache=new Map<string,{expires:number;data:WeatherPayload}>();
const upstreamPending=new Map<string,Promise<WeatherPayload>>();
const weatherRetryAt=new Map<string,number>();
class WeatherRateLimit extends Error {
  constructor(readonly retryAfterSeconds:number){super('Open-Meteo is temporarily rate-limited. Existing entries were kept. Please try again after its limit resets.');}
}
function weatherFailure(reason:unknown){
 const limited=reason instanceof WeatherRateLimit;
 return Response.json({error:reason instanceof Error?reason.message:'Weather is temporarily unavailable.',code:limited?'rate_limited':'provider_unavailable',directFallback:true},{status:limited?429:502,headers:{'Cache-Control':'private, no-store',...(limited?{'Retry-After':String(reason.retryAfterSeconds)}:{})}});
}
async function fetchJson(url:URL):Promise<WeatherPayload> {
 const key=url.href;const cached=upstreamCache.get(key);
 if(cached && cached.expires>Date.now())return cached.data;
 const pending=upstreamPending.get(key);if(pending)return pending;
 if(Date.now()<(weatherRetryAt.get(url.hostname)??0))throw new WeatherRateLimit(Math.max(1,Math.ceil(((weatherRetryAt.get(url.hostname)??0)-Date.now())/1000)));
 const work=fetchUpstream(url).then(data=>{if(upstreamCache.size>=200)upstreamCache.delete(upstreamCache.keys().next().value!);upstreamCache.set(key,{expires:Date.now()+20*60*1000,data});return data;}).finally(()=>upstreamPending.delete(key));
 upstreamPending.set(key,work);return work;
}
async function fetchUpstream(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' }, signal: controller.signal, redirect:'error' });
    if (response.ok) return JSON.parse(await boundedBody(response)) as WeatherPayload;
    if (response.status === 429) {const raw=response.headers.get('retry-after');const numeric=Number(raw);const dateDelay=raw?Math.ceil((Date.parse(raw)-Date.now())/1000):NaN;const seconds=Math.max(60,raw&&Number.isFinite(numeric)?numeric:Number.isFinite(dateDelay)?dateDelay:60);weatherRetryAt.set(url.hostname,Date.now()+seconds*1000);throw new WeatherRateLimit(seconds);}
    throw new Error(`The weather service returned ${response.status}.`);
  } finally { clearTimeout(timeout); }
}

const weatherCache = new Map<string, { expires: number; value: Record<string, unknown> }>();

/** Existing no-key primary path. The conditions service calls this internal function, never its fallback wrapper. */
export async function getPrimarySiteWeather(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const url = new URL(request.url);
  const provider = url.searchParams.get('provider') ?? 'open-meteo';
  if (provider !== 'open-meteo') return Response.json({ error: 'The selected provider is not configured. Select Open-Meteo.' }, { status: 409 });
  const points = (url.searchParams.get('points') ?? '').split('|').filter(Boolean).flatMap((value) => {
    const [latitude = NaN, longitude = NaN] = value.split(',').map(Number);
    return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
      ? [{ latitude, longitude }]
      : [];
  }).slice(0, 8);
  if (points.length) {
    const cacheKey = `batch:${points.map((point) => `${point.latitude.toFixed(3)},${point.longitude.toFixed(3)}`).join('|')}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return Response.json(cached.value);
    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
    forecastUrl.search = new URLSearchParams({
      latitude: points.map((point) => point.latitude).join(','),
      longitude: points.map((point) => point.longitude).join(','),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max',
      timezone: 'auto', forecast_days: '7', wind_speed_unit: 'mph',
    }).toString();
    try {
      const result = await fetchJson(forecastUrl);
      const forecasts = Array.isArray(result) ? result : [result];
      const value = {
        locations: points.map((point, index) => ({ ...point, weather: forecasts[index] ?? null })),
        attribution: 'Weather data by Open-Meteo. Forecasts are guidance only and are not dive-safety or navigation advice.',
      };
      weatherCache.set(cacheKey, { expires: Date.now() + 20 * 60 * 1000, value });
      return Response.json(value);
    } catch (reason) {
      return weatherFailure(reason);
    }
  }
  const latitude = Number(url.searchParams.get('latitude'));
  const longitude = Number(url.searchParams.get('longitude'));
  const marine = url.searchParams.get('marine') === 'true';
  const date = url.searchParams.get('date');
  const time = url.searchParams.get('time') || '12:00';
  if (!url.searchParams.has('latitude') || !url.searchParams.has('longitude') || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return Response.json({ error: 'Valid site coordinates are required.' }, { status: 400 });
  }

  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10) !== date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    return Response.json({error:'A valid weather date and time are required.'},{status:400});
  const today = new Date().toISOString().slice(0, 10);
  if (url.searchParams.get('planning') === 'seasonal') {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= today)
      return Response.json({ error: 'A future planned date is required for seasonal context.' }, { status: 400 });
    const cacheKey = `seasonal:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${date.slice(5)}:${today.slice(0,4)}`;
    const cached = weatherCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return Response.json(cached.value);
    try {
      const month = Number(date.slice(5, 7)) - 1;
      const day = Number(date.slice(8, 10));
      const years = [1, 2, 3].map(offset => Number(today.slice(0, 4)) - offset);
      const samples = await Promise.all(years.map(async year => {
        const centre = Date.UTC(year, month, day);
        const format = (offset: number) => new Date(centre + offset * 86400000).toISOString().slice(0, 10);
        const archiveUrl = new URL('https://archive-api.open-meteo.com/v1/archive');
        archiveUrl.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), start_date: format(-7), end_date: format(7), daily: 'temperature_2m_mean,precipitation_sum', timezone: 'auto' }).toString();
        return fetchJson(archiveUrl);
      }));
      const temperatures = samples.flatMap(sample => Array.isArray(sample.daily?.temperature_2m_mean) ? sample.daily.temperature_2m_mean : []).filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value));
      const rain = samples.flatMap(sample => Array.isArray(sample.daily?.precipitation_sum) ? sample.daily.precipitation_sum : []).filter((value: unknown): value is number => typeof value === 'number' && Number.isFinite(value));
      if (!temperatures.length) throw new Error('No comparable regional seasonal records were returned.');
      const average = Math.round(temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length * 10) / 10;
      const wetDays = rain.filter(value => value >= 0.5).length;
      const value = {
        provider: 'Open-Meteo historical archive', providerId:'open-meteo', sourceCoordinates:{latitude,longitude}, sourceTime:'comparable seasonal days', resolution: 'regional seasonal reference',
        logConditions: { weatherSummary: `Regional seasonal reference: average air ${average} °C across ${temperatures.length} comparable days${rain.length ? `; rain on ${wetDays} of ${rain.length} days` : ''}. Not a dive-day forecast.`, airTemperatureC: average },
        attribution: `Open-Meteo historical model observations from comparable weeks in ${years.join(', ')}. Regional context only; no water, wave, current or visibility estimate. Not dive-safety advice.`,
      };
      weatherCache.set(cacheKey, { expires: Date.now() + 24 * 60 * 60 * 1000, value });
      return Response.json(value);
    } catch (reason) {
      return Response.json({ error: reason instanceof Error ? reason.message : 'Regional seasonal context is unavailable.' }, { status: 502 });
    }
  }
  const historical = Boolean(date && date < new Date(Date.now()-5*86400000).toISOString().slice(0,10));
  const cacheKey = [latitude.toFixed(3), longitude.toFixed(3), marine, date ?? 'forecast', time, url.searchParams.get('disabled') ?? ''].join(':');
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return Response.json(cached.value);
  const weatherUrl = new URL(historical ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast');
  weatherUrl.search = new URLSearchParams(date ? {
    latitude: String(latitude), longitude: String(longitude), start_date: date, end_date: date,
    hourly: 'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m', timezone: 'auto', wind_speed_unit: 'kn',
  } : {
    latitude: String(latitude), longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max',
    timezone: 'auto', forecast_days: '7', wind_speed_unit: 'mph',
  }).toString();

  const marineUrl = new URL('https://marine-api.open-meteo.com/v1/marine');
  marineUrl.search = new URLSearchParams(date ? {
    latitude: String(latitude), longitude: String(longitude), start_date: date, end_date: date,
    hourly: 'wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction', timezone: 'auto', cell_selection: 'sea',
  } : {
    latitude: String(latitude), longitude: String(longitude),
    current: 'wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction',
    daily: 'wave_height_max,wave_period_max', timezone: 'auto', forecast_days: '7', cell_selection: 'sea',
  }).toString();

  try {
    const [weather, marineData] = await Promise.all([
      fetchJson(weatherUrl),
      marine ? fetchJson(marineUrl).catch(() => null) : Promise.resolve(null),
    ]);
    let logConditions: Record<string, unknown> | undefined;
    if (date) {
      const hour = String(Math.min(23, Math.max(0, Number(time.slice(0, 2)) || 0))).padStart(2, '0');
      const target = `${date}T${hour}:00`;
      const weatherIndex = Array.isArray(weather.hourly?.time) ? weather.hourly.time.indexOf(target) : -1;
      const marineIndex = Array.isArray(marineData?.hourly?.time) ? marineData.hourly.time.indexOf(target) : -1;
      const weatherCode = valueAt(weather.hourly?.weather_code, weatherIndex);
      if(weatherIndex < 0 || (weatherCode==null && valueAt(weather.hourly?.temperature_2m,weatherIndex)==null && valueAt(weather.hourly?.wind_speed_10m,weatherIndex)==null))throw new Error('The primary provider has no history for this date.');
      logConditions = {
        weatherSummary: weatherCode == null ? '' : weatherDescriptions[weatherCode] || `Weather code ${weatherCode}`,
        airTemperatureC: valueAt(weather.hourly?.temperature_2m, weatherIndex),
        windSpeedKnots: valueAt(weather.hourly?.wind_speed_10m, weatherIndex),
        windDirectionDegrees: valueAt(weather.hourly?.wind_direction_10m, weatherIndex),
        waveHeightM: valueAt(marineData?.hourly?.wave_height, marineIndex),
        surfaceTemperatureC: valueAt(marineData?.hourly?.sea_surface_temperature, marineIndex),
        currentDirectionDegrees: valueAt(marineData?.hourly?.ocean_current_direction, marineIndex),
      };
    }
    const result = {
      weather,
      provider:'Open-Meteo',providerId:'open-meteo',sourceCoordinates:{latitude:Number(weather.latitude??latitude),longitude:Number(weather.longitude??longitude)},sourceTime:date?`${date}T${String(Math.min(23,Math.max(0,Number(time.slice(0,2))||0))).padStart(2,'0')}:00`:null,resolution:date?'hourly':'forecast',
      marine: marineData,
      ...(logConditions ? { logConditions } : {}),
      attribution: 'Weather data by Open-Meteo. Model data are guidance only and are not for navigation or dive-safety decisions.',
    };
    weatherCache.set(cacheKey, { expires: Date.now() + (historical ? 7 * 24 * 60 * 60 * 1000 : 20 * 60 * 1000), value: result });
    return Response.json(result);
  } catch (reason) {
    if(date && date < today && !(url.searchParams.get('disabled') ?? '').split(',').includes('nasa')) {
      try {const fallback=await nasaDailyWeather(latitude,longitude,date);weatherCache.set(cacheKey,{expires:Date.now()+20*60*1000,value:fallback});return Response.json(fallback);}catch {/* Keep the original failure visible if both providers fail. */}
    }

    return weatherFailure(reason);
  }
}

/** Authenticated compatibility entry point. Shared fallbacks cannot call this wrapper recursively. */
export async function GET(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({error:'Authentication required'},{status:401});
  const url = new URL(request.url);
  if (url.searchParams.get('points')) {
    const primary = await getPrimarySiteWeather(request);
    primary.headers.set('Cache-Control','private, no-store');
    return primary;
  }
  let input;
  try { input = parseConditionsRequest(url); }
  catch (error) { return Response.json({error:error instanceof Error ? error.message : 'Invalid weather request.'},{status:400}); }
  const today = new Date().toISOString().slice(0,10);
  input.mode = url.searchParams.get('planning') === 'seasonal' ? 'seasonal' : input.date < today ? 'historical' : 'forecast';
  const primaryUrl = new URL(url);
  primaryUrl.searchParams.set('provider','open-meteo');
  const primary = await getPrimarySiteWeather(new Request(primaryUrl,request));
  primary.headers.set('Cache-Control','private, no-store');
  if (!primary.ok && primary.status < 429 && primary.status !== 409) return primary;
  if (primary.ok && ['open-meteo','auto'].includes(input.provider)) {
    if(!input.marine || input.mode==='seasonal')return primary;
    const body=await primary.clone().json() as Record<string,unknown>;
    const values=body.logConditions as Record<string,unknown>|undefined;
    if(typeof values?.waveHeightM==='number')return primary;
    const primaryZone=(body.weather as Record<string,unknown>|undefined)?.timezone;
    if(typeof primaryZone==='string')input.timeZone=primaryZone;
    const runtime=await import('cloudflare:workers').then(module=>module.env as unknown as ConditionsEnvironment).catch(()=>({}));
    const marine=await marineFallback(input,runtime);
    const selected=selectConditions(marine.readings,input,new Date().toISOString());
    if(!selected.length)return primary;
    const numeric=(metric:string)=>{const value=selected.find(r=>r.metric===metric)?.value;return typeof value==='number'?value:undefined;};
    const additions={waveHeightM:numeric('wave-height'),surfaceTemperatureC:selected.find(r=>r.metric==='water-temperature'&&r.depth.kind==='surface')?.value,currentDirectionDegrees:numeric('current-direction')};
    return Response.json({...body,logConditions:{...values,...Object.fromEntries(Object.entries(additions).filter(([key,value])=>value!==undefined&&values?.[key]==null))},
      marineConditionsV1:{version:1,request:input,retrievedAt:new Date().toISOString(),readings:marine.readings,diagnostics:marine.diagnostics},
      attribution:(typeof body.attribution==='string'?body.attribution:'')+' · '+[...new Set(selected.map(r=>r.attribution).filter(Boolean))].join(' · ')+' · Marine model readings; SST is surface only.'},
      {headers:{'Cache-Control':'private, no-store'}});
  }
  const environment = await import('cloudflare:workers').then(module=>module.env as unknown as ConditionsEnvironment).catch(()=>({}));
  const fallback = await atmosphericFallback(input,environment);
  if (input.marine && !selectConditions(fallback.readings,input,new Date().toISOString()).some(r=>r.metric==='wave-height')) {
    const attempted=fallback.diagnostics.filter(d=>['xweather-marine','wwo','met-norway-ocean'].includes(d.provider)).map(d=>d.provider.replace(/-marine$|-ocean$/,'') as import('@/lib/weather/conditions-model').ConditionsProvider);
    const marine=await marineFallback(input,environment,new Date().toISOString(),attempted);
    fallback.readings.push(...marine.readings);fallback.diagnostics.push(...marine.diagnostics);
  }
  const selected = selectConditions(fallback.readings,input,new Date().toISOString());
  const air = selected.find(r=>r.metric==='air-temperature'), weather = selected.find(r=>r.metric==='weather');
  if (!air && !weather) return primary;
  const source = air ?? weather!;
  const numeric = (metric:string) => {
    const value=selected.find(r=>r.metric===metric)?.value;
    return typeof value==='number' ? value : undefined;
  };
  const wind = numeric('wind-speed');
  const conditionsV1:ConditionsSnapshot = {version:1,request:input,retrievedAt:new Date().toISOString(),readings:fallback.readings,diagnostics:fallback.diagnostics};
  return Response.json({
    provider:source.label,providerId:source.provider,weatherContext:source.resolution==='monthly climatology'?'seasonal':'forecast',
    sourceCoordinates:{latitude:source.latitude,longitude:source.longitude},sourceTime:source.validAt,resolution:source.resolution,conditionsV1,
    attribution:[...new Set(selected.map(r=>r.attribution).filter(Boolean))].join(' · ')+' · '+(source.detail ?? ''),
    logConditions:{weatherSummary:weather?.value ?? 'Atmospheric model conditions',airTemperatureC:air?.value,
      ...(wind === undefined ? {} : {windSpeedKnots:wind/0.514444}),
      windDirectionDegrees:numeric('wind-direction'),waveHeightM:numeric('wave-height'),
      surfaceTemperatureC:selected.find(r=>r.metric==='water-temperature' && r.depth.kind==='surface')?.value,
      currentDirectionDegrees:numeric('current-direction')},
  },{headers:{'Cache-Control':'private, no-store'}});
}
