import {nasaDailyWeather} from '@/lib/server/nasa-weather';
import { getChatGPTUser } from '../../chatgpt-auth';

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
async function fetchJson(url:URL):Promise<WeatherPayload> {
 const key=url.href;const cached=upstreamCache.get(key);
 if(cached && cached.expires>Date.now())return cached.data;
 const pending=upstreamPending.get(key);if(pending)return pending;
 if(Date.now()<(weatherRetryAt.get(url.hostname)??0))throw new Error('Weather is temporarily rate-limited. Your log has not been changed. Please try again later.');
 const work=fetchUpstream(url).then(data=>{if(upstreamCache.size>=200)upstreamCache.delete(upstreamCache.keys().next().value!);upstreamCache.set(key,{expires:Date.now()+20*60*1000,data});return data;}).finally(()=>upstreamPending.delete(key));
 upstreamPending.set(key,work);return work;
}
async function fetchUpstream(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url.toString(), { headers: { accept: 'application/json' }, signal: controller.signal });
    if (response.ok) return (await response.json()) as WeatherPayload;
    if (response.status === 429) { const seconds=Number(response.headers.get('retry-after'));weatherRetryAt.set(url.hostname,Date.now()+Math.max(60,Number.isFinite(seconds)?seconds:60)*1000);throw new Error('Weather is temporarily rate-limited. Your log has not been changed. Please try again later.'); }
    throw new Error(`The weather service returned ${response.status}.`);
  } finally { clearTimeout(timeout); }
}

const weatherCache = new Map<string, { expires: number; value: Record<string, unknown> }>();

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const url = new URL(request.url);
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
      return Response.json({ error: reason instanceof Error ? reason.message : 'Forecast temporarily unavailable.', directFallback: true }, { status: 502 });
    }
  }
  const latitude = Number(url.searchParams.get('latitude'));
  const longitude = Number(url.searchParams.get('longitude'));
  const marine = url.searchParams.get('marine') === 'true';
  const date = url.searchParams.get('date');
  const time = url.searchParams.get('time') || '12:00';
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return Response.json({ error: 'Valid site coordinates are required.' }, { status: 400 });
  }

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
        provider: 'Open-Meteo historical archive', resolution: 'regional seasonal reference',
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
  const cacheKey = [latitude.toFixed(3), longitude.toFixed(3), marine, date ?? 'forecast', time].join(':');
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
      provider:'Open-Meteo',resolution:date?'hourly':'forecast',
      marine: marineData,
      ...(logConditions ? { logConditions } : {}),
      attribution: 'Weather data by Open-Meteo. Model data are guidance only and are not for navigation or dive-safety decisions.',
    };
    weatherCache.set(cacheKey, { expires: Date.now() + (historical ? 7 * 24 * 60 * 60 * 1000 : 20 * 60 * 1000), value: result });
    return Response.json(result);
  } catch (reason) {
    if(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < today) {
      try {const fallback=await nasaDailyWeather(latitude,longitude,date);weatherCache.set(cacheKey,{expires:Date.now()+20*60*1000,value:fallback});return Response.json(fallback);}catch {/* Keep the original failure visible if both providers fail. */}
    }

    return Response.json({
      error: reason instanceof Error ? reason.message : date ? 'No weather history is available for that date.' : 'Weather forecast is temporarily unavailable.',
    }, { status: 502 });
  }
}
