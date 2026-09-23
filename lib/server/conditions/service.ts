import {
  conditionReading,
  selectConditions,
  type ConditionsProvider,
  type ConditionsSelection,
  type ConditionsRequest,
  type ConditionsSnapshot,
  type ConditionReading,
  type ProviderDiagnostic,
} from '../../weather/conditions-model';
import {
  object,
  normalizeOpenMeteo,
  normalizeMetOffice,
  normalizeXweather,
  normalizeTomorrow,
  normalizeWwo,
  normalizeMetNorway,
  type AdapterContext,
} from './adapters';
import {
  conditionsFetch,
  boundedBody,
  ConditionsError,
  type TransportResult,
} from './transport';
import {
  matchedOperator,
  parseCapernwrayCsv,
  parseOperatorConditions,
} from './operators';
import { diveNumberFacts, pickadiveFacts } from './enrichment';

export interface ConditionsEnvironment {
  DB?: D1Database;
  MET_OFFICE_API_KEY?: string;
  XWEATHER_CLIENT_ID?: string;
  XWEATHER_CLIENT_SECRET?: string;
  TOMORROW_API_KEY?: string;
  WWO_API_KEY?: string;
  DIVENUMBER_API_KEY?: string;
  COPERNICUS_CONDITIONS?: { fetch(request: Request): Promise<Response> };
}
export interface ConditionsProviderStatus {
  id: ConditionsProvider | 'auto';
  label: string;
  configured: boolean;
  enabled: boolean;
  status: ProviderDiagnostic['status'];
  reason: string;
  lastCheckedAt?: string;
}
const checks = new Map<
  string,
  { signature: string; diagnostic: ProviderDiagnostic; expires: number }
>();
const definitions: Array<{
  id: ConditionsProvider;
  label: string;
  keys: Array<keyof ConditionsEnvironment>;
}> = [
  { id: 'open-meteo', label: 'Open-Meteo atmospheric + marine', keys: [] },
  {
    id: 'met-office',
    label: 'Met Office DataHub Global Spot',
    keys: ['MET_OFFICE_API_KEY'],
  },
  {
    id: 'xweather',
    label: 'Vaisala Xweather',
    keys: ['XWEATHER_CLIENT_ID', 'XWEATHER_CLIENT_SECRET'],
  },
  { id: 'tomorrow', label: 'Tomorrow.io', keys: ['TOMORROW_API_KEY'] },
  { id: 'wwo', label: 'World Weather Online Marine', keys: ['WWO_API_KEY'] },
  { id: 'met-norway', label: 'MET Norway Oceanforecast', keys: [] },
  {
    id: 'copernicus',
    label: 'Copernicus Marine depth data',
    keys: ['COPERNICUS_CONDITIONS'],
  },
  { id: 'swellcloud', label: 'SwellCloud', keys: [] },
];
function signature(id: string, env: ConditionsEnvironment) {
  return JSON.stringify(
    definitions
      .find((row) => row.id === id)
      ?.keys.map((key) =>
        typeof env[key] === 'string' ? env[key] : Boolean(env[key]),
      ) ?? [],
  );
}
async function signatureHash(id:string,env:ConditionsEnvironment){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature(id,env)));
 return [...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
/** Read-only status hydration. The explicit access check owns creating/updating this runtime table. */
export async function hydrateProviderChecks(env:ConditionsEnvironment){
 if(!env.DB)return;
 try{
  const result=await env.DB.prepare('SELECT provider,signature_hash,diagnostic_json,expires FROM weather_provider_checks WHERE expires > ?').bind(Date.now()).all<{provider:string;signature_hash:string;diagnostic_json:string;expires:number}>();
  for(const row of result.results){
   if(!definitions.some(d=>d.id===row.provider)||row.signature_hash!==await signatureHash(row.provider,env))continue;
   const entry=JSON.parse(row.diagnostic_json) as ProviderDiagnostic;
   if(entry.provider!==row.provider||!['ok','denied','unavailable','unsupported','rate-limited'].includes(entry.status))continue;
   checks.set(row.provider,{signature:signature(row.provider,env),diagnostic:entry,expires:row.expires});
  }
 }catch{/* Missing runtime table or offline DB leaves unverified providers disabled. */}
}
async function persistProviderCheck(id:ConditionsProvider,env:ConditionsEnvironment,entry:ProviderDiagnostic){
 if(!env.DB)return;
 const hash=await signatureHash(id,env);
 await env.DB.prepare('CREATE TABLE IF NOT EXISTS weather_provider_checks (provider TEXT PRIMARY KEY,signature_hash TEXT NOT NULL,diagnostic_json TEXT NOT NULL,expires INTEGER NOT NULL)').run();
 await env.DB.prepare('INSERT INTO weather_provider_checks(provider,signature_hash,diagnostic_json,expires) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET signature_hash=excluded.signature_hash,diagnostic_json=excluded.diagnostic_json,expires=excluded.expires').bind(id,hash,JSON.stringify(entry),Date.now()+86400000).run();
}
export function providerStatuses(
  env: ConditionsEnvironment,
): ConditionsProviderStatus[] {
  return [
    {
      id: 'auto',
      label: 'Auto · choose by metric and available sources',
      configured: true,
      enabled: true,
      status: 'ok',
      reason:
        'Operator observations and actual Dives stay distinct from forecasts.',
    },
    ...definitions.map((row) => {
      const configured =
        row.id !== 'swellcloud' && row.keys.every((key) => Boolean(env[key]));
      const check = checks.get(row.id);
      const valid =
        check &&
        check.signature === signature(row.id, env) &&
        check.expires > Date.now()
          ? check
          : null;
      const enabled =
        configured && (!row.keys.length || valid?.diagnostic.status === 'ok');
      return {
        id: row.id,
        label: row.label,
        configured,
        enabled,
        status:
          row.id === 'swellcloud'
            ? ('disabled' as const)
            : !configured
              ? ('unconfigured' as const)
              : (valid?.diagnostic.status ??
                (row.keys.length ? ('unverified' as const) : ('ok' as const))),
        reason:
          row.id === 'swellcloud'
            ? 'Awaiting provider approval and a documented access contract.'
            : !configured
              ? 'Server-side configuration is required.'
              : (valid?.diagnostic.message ??
                (row.keys.length
                  ? 'Choose Check access to validate the configured product.'
                  : 'No API key required.')),
        ...(valid ? { lastCheckedAt: valid.diagnostic.retrievedAt } : {}),
      };
    }),
  ];
}
function diagnostic(
  provider: string,
  error: unknown,
  now: string,
): ProviderDiagnostic {
  return {
    provider,
    status: error instanceof ConditionsError ? error.code : 'unavailable',
    message:
      error instanceof ConditionsError
        ? error.message
        : 'Provider could not be reached. Saved conditions are retained.',
    retrievedAt: now,
  };
}
function makeUrl(base: string, params: Record<string, string>) {
  const url = new URL(base);
  url.search = new URLSearchParams(params).toString();
  return url;
}
function context(
  request: ConditionsRequest,
  result: TransportResult,
): AdapterContext {
  return {
    latitude: request.latitude,
    longitude: request.longitude,
    retrievedAt: result.retrievedAt,
    historical: request.mode === 'historical',
    ...(request.timeZone ? { timeZone: request.timeZone } : {}),
  };
}
function withTimeZone(
  readings: ConditionReading[],
  request: ConditionsRequest,
) {
  const timeZone = request.timeZone;
  return timeZone
    ? readings.map((row) =>
        row.timeZone === 'UTC' ? { ...row, timeZone } : row,
      )
    : readings;
}
/** Convert the requested wall time to an instant only after a source supplied the site's time zone. */
export function requestedInstant(request: ConditionsRequest) {
  const wall = Date.parse(`${request.date}T${request.time}:00Z`);
  if (!Number.isFinite(wall))
    throw new ConditionsError(
      'unsupported',
      'The requested date and time are invalid.',
    );
  if (!request.timeZone) return new Date(wall).toISOString();
  let result = wall;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: request.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .format(new Date(result))
      .replace(' ', 'T');
    result += wall - Date.parse(`${parts}Z`);
  }
  return new Date(result).toISOString();
}
async function fetchNamedProvider(
  id: ConditionsProvider,
  request: ConditionsRequest,
  env: ConditionsEnvironment,
): Promise<{ readings: ConditionReading[]; costAccesses?: number; diagnostics: ProviderDiagnostic[] }> {
  const configuration = providerStatuses(env).find((row) => row.id === id);
  if (!configuration?.configured)
    throw new ConditionsError(
      'unconfigured',
      configuration?.reason ?? 'This provider is not configured.',
    );
  let result: TransportResult;
  let readings: ConditionReading[] = [];
  let extraCost: number | undefined;
  const diagnostics: ProviderDiagnostic[] = [];
  if (id === 'met-office') {
    result = await conditionsFetch(
      makeUrl(
        'https://data.hub.api.metoffice.gov.uk/sitespecific/v0/point/hourly',
        {
          latitude: String(request.latitude),
          longitude: String(request.longitude),
          includeLocationName: 'true',
        },
      ),
      { headers: { apikey: env.MET_OFFICE_API_KEY! } },
    );
    readings = normalizeMetOffice(result.data, context(request, result));
  } else if (id === 'xweather') {
    const date = requestedInstant(request);
    const params = {
      client_id: env.XWEATHER_CLIENT_ID!,
      client_secret: env.XWEATHER_CLIENT_SECRET!,
      filter: '1hr',
      from: date,
      to: date,
      plimit: '1',
    };
    result = await conditionsFetch(
      makeUrl(
        `https://data.api.xweather.com/forecasts/${request.latitude},${request.longitude}`,
        params,
      ),
    );
    if (object(result.data).success === false)
      throw new ConditionsError(
        'denied',
        'Xweather did not authorise or return the requested forecast.',
      );
    readings = normalizeXweather(result.data, context(request, result));
    if (request.marine) {
      try {
      const marine = await conditionsFetch(
        makeUrl(
          `https://data.api.xweather.com/maritime/${request.latitude},${request.longitude}`,
          {
            client_id: env.XWEATHER_CLIENT_ID!,
            client_secret: env.XWEATHER_CLIENT_SECRET!,
            for: date,
            plimit: '1',
          },
        ),
      );
      readings.push(
        ...normalizeXweather(marine.data, context(request, marine), true),
      );
      extraCost = marine.costAccesses;
      if (!normalizeXweather(marine.data, context(request, marine), true).length) throw new ConditionsError('unsupported', 'Xweather marine returned no supported readings.');
      } catch (error) { diagnostics.push(diagnostic('xweather-marine', error, new Date().toISOString())); }
    }
  } else if (id === 'tomorrow') {
    result = await conditionsFetch(
      makeUrl('https://api.tomorrow.io/v4/weather/forecast', {
        location: `${request.latitude},${request.longitude}`,
        apikey: env.TOMORROW_API_KEY!,
        units: 'metric',
        timesteps: '1h',
      }),
    );
    readings = normalizeTomorrow(result.data, context(request, result));
  } else if (id === 'wwo') {
    if (!request.marine)
      throw new ConditionsError(
        'unsupported',
        'World Weather Online Marine is available for coastal Sites.',
      );
    result = await conditionsFetch(
      makeUrl(
        `https://api.worldweatheronline.com/premium/v1/${request.mode === 'historical' ? 'past-marine' : 'marine'}.ashx`,
        {
          key: env.WWO_API_KEY!,
          q: `${request.latitude},${request.longitude}`,
          format: 'json',
          date: request.date,
          tide: 'yes',
          tp: '3',
        },
      ),
    );
    if (object(object(result.data).data).error)
      throw new ConditionsError(
        'denied',
        'World Weather Online Marine access or date range is unavailable.',
      );
    readings = normalizeWwo(result.data, context(request, result));
  } else if (id === 'met-norway') {
    if (
      !request.marine ||
      request.latitude < 55 ||
      request.latitude > 82 ||
      request.longitude < -20 ||
      request.longitude > 45
    )
      throw new ConditionsError(
        'unsupported',
        'MET Norway Oceanforecast covers Nordic waters; no value is inferred outside coverage.',
      );
    result = await conditionsFetch(
      makeUrl('https://api.met.no/weatherapi/oceanforecast/2.0/complete', {
        lat: request.latitude.toFixed(4),
        lon: request.longitude.toFixed(4),
      }),
      {
        headers: {
          'User-Agent': 'ZeusTekConditions/1.0 https://dive.amzeus.co.uk/',
        },
      },
    );
    readings = normalizeMetNorway(result.data, context(request, result));
  } else if (id === 'copernicus') {
    if (!request.marine || !env.COPERNICUS_CONDITIONS)
      throw new ConditionsError(
        'unconfigured',
        'Configure a server-side Copernicus subset service binding.',
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let subsetData: unknown;
    try {
    const response = await env.COPERNICUS_CONDITIONS.fetch(
      new Request('https://copernicus-conditions.internal/subset', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          latitude: request.latitude,
          longitude: request.longitude,
          date: request.date,
          depthM: request.plannedDepthM ?? null,
        }),
      }),
    );
    if (!response.ok)
      throw new ConditionsError(
        'unavailable',
        'Copernicus subset service is unavailable.',
      );
    const data = await boundedBody(response);
    if (data.length > 500000)
      throw new ConditionsError(
        'unavailable',
        'Copernicus subset exceeded the supported size.',
      );
    subsetData = JSON.parse(data);
    } finally { clearTimeout(timeout); }
    result = {
      data: subsetData,
      retrievedAt: new Date().toISOString(),
      cached: false,
    };
    const { normalizeCopernicus } = await import('./adapters');
    readings = normalizeCopernicus(result.data, context(request, result));
  } else
    throw new ConditionsError('disabled', 'This provider is not available.');
  readings = withTimeZone(readings, request);
  if (
    !readings.length ||
    !selectConditions(readings, request, new Date().toISOString()).length
  )
    throw new ConditionsError(
      'unsupported',
      'No supported readings cover the requested place and time.',
    );
  const cost =
    result.costAccesses === undefined && extraCost === undefined
      ? undefined
      : (result.costAccesses ?? 0) + (extraCost ?? 0);
  return { readings, diagnostics, ...(cost === undefined ? {} : { costAccesses: cost }) };
}
function recordCheck(
  id: ConditionsProvider,
  env: ConditionsEnvironment,
  entry: ProviderDiagnostic,
) {
  checks.set(id, {
    signature: signature(id, env),
    diagnostic: entry,
    expires: Date.now() + 24 * 3600000,
  });
}
export async function checkProvider(
  id: ConditionsProvider,
  env: ConditionsEnvironment,
  request: ConditionsRequest,
  now = new Date().toISOString(),
): Promise<ProviderDiagnostic> {
  let entry: ProviderDiagnostic;
  try {
    const result = await fetchNamedProvider(
      id,
      { ...request, provider: id as ConditionsSelection },
      env,
    );
    entry = {
      provider: id,
      status: 'ok',
      message: result.diagnostics.length ? 'Atmospheric access verified; marine access is unavailable. Open-Meteo marine remains the fallback.' : 'Access verified for the requested product, place and time.',
      retrievedAt: now,
      ...(result.costAccesses === undefined
        ? {}
        : { costAccesses: result.costAccesses }),
    };
  } catch (error) {
    entry = diagnostic(id, error, now);
  }
  recordCheck(id, env, entry);
  await persistProviderCheck(id,env,entry).catch(()=>{entry.message+=' Access status could not be retained across server restarts; check again if unavailable.';});
  return entry;
}
interface ServiceOptions {
  now?: string;
  legacy?: () => Promise<unknown>;
  enrichment?: boolean;
}
export async function conditionsService(
  request: ConditionsRequest,
  env: ConditionsEnvironment,
  options: ServiceOptions = {},
): Promise<ConditionsSnapshot> {
  const now = options.now ?? new Date().toISOString();
  await hydrateProviderChecks(env);
  const snapshot: ConditionsSnapshot = {
    version: 1,
    request: { ...request },
    retrievedAt: now,
    readings: [],
    diagnostics: [],
  };
  const disabled = new Set(request.disabledProviders ?? []);
  const addError = (provider: string, error: unknown) =>
    snapshot.diagnostics.push(diagnostic(provider, error, now));
  let resolved = { ...request };
  if (request.mode !== 'forecast' && options.legacy) {
    try {
      const legacy = object(await options.legacy());
      if (legacy.error)
        throw new ConditionsError(
          'unavailable',
          'Historical / seasonal data are temporarily unavailable.',
        );
      if (legacy.weather)
        snapshot.readings.push(
          ...normalizeOpenMeteo(legacy.weather, {
            ...context(request, {
              data: null,
              retrievedAt: now,
              cached: false,
            }),
            historical: true,
          }),
        );
      if (legacy.marine)
        snapshot.readings.push(
          ...normalizeOpenMeteo(
            legacy.marine,
            {
              ...context(request, {
                data: null,
                retrievedAt: now,
                cached: false,
              }),
              historical: true,
            },
            true,
          ),
        );
      if (!snapshot.readings.length) {
        const values = object(legacy.logConditions);
        const isNasa = legacy.provider === 'NASA POWER';
        const source = {
          provider: isNasa ? ('nasa' as const) : ('open-meteo' as const),
          label:
            typeof legacy.provider === 'string'
              ? legacy.provider
              : 'Historical archive',
          kind: 'model' as const,
          classification: 'modelled' as const,
          url: isNasa
            ? 'https://power.larc.nasa.gov/'
            : 'https://open-meteo.com/',
          attribution:
            typeof legacy.attribution === 'string' ? legacy.attribution : '',
          latitude: request.latitude,
          longitude: request.longitude,
          retrievedAt: now,
          validAt: request.mode === 'historical' ? request.date : null,
          timeZone: 'date-only',
          resolution:
            typeof legacy.resolution === 'string'
              ? legacy.resolution
              : request.mode,
        };
        for (const [metric, key, unit] of [
          ['air-temperature', 'airTemperatureC', '°C'],
          ['weather', 'weatherSummary', 'text'],
        ] as const) {
          const reading = conditionReading(metric, values[key], unit, source);
          if (reading) snapshot.readings.push(reading);
        }
      }
      snapshot.diagnostics.push({
        provider: 'open-meteo',
        status: snapshot.readings.length ? 'ok' : 'empty',
        message: 'Existing historical / seasonal sources retained.',
        retrievedAt: now,
      });
    } catch (error) {
      addError('open-meteo', error);
    }
  } else {
    try {
      const result = await conditionsFetch(
        makeUrl('https://api.open-meteo.com/v1/forecast', {
          latitude: String(request.latitude),
          longitude: String(request.longitude),
          hourly:
            'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,visibility',
          timezone: 'auto',
          forecast_days: '7',
          wind_speed_unit: 'ms',
        }),
      );
      const timeZone = object(result.data).timezone;
      if (typeof timeZone === 'string') {
        resolved = { ...request, timeZone };
        snapshot.request = resolved;
      }
      snapshot.readings.push(
        ...normalizeOpenMeteo(result.data, context(resolved, result)),
      );
      snapshot.diagnostics.push({
        provider: 'open-meteo',
        status: 'ok',
        message: 'Atmospheric forecast received.',
        retrievedAt: result.retrievedAt,
      });
    } catch (error) {
      addError('open-meteo', error);
    }
    if (request.marine) {
      try {
        const result = await conditionsFetch(
          makeUrl('https://marine-api.open-meteo.com/v1/marine', {
            latitude: String(request.latitude),
            longitude: String(request.longitude),
            hourly:
              'wave_height,wave_direction,wave_period,swell_wave_height,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,sea_level_height_msl',
            timezone: 'auto',
            forecast_days: '7',
            cell_selection: 'sea',
          }),
        );
        snapshot.readings.push(
          ...normalizeOpenMeteo(result.data, context(resolved, result), true),
        );
        snapshot.diagnostics.push({
          provider: 'open-meteo-marine',
          status: 'ok',
          message:
            'Marine model received; SST and mean sea level remain explicitly labelled.',
          retrievedAt: result.retrievedAt,
        });
      } catch (error) {
        addError('open-meteo-marine', error);
      }
    }
  }
  const operator = matchedOperator(request);
  if (operator && !disabled.has('operator')) {
    try {
      const result = await conditionsFetch(new URL(operator.dataUrl), {
        format: 'text',
        ttlMs: 6 * 3600000,
      });
      const readings =
        operator.format === 'csv'
          ? parseCapernwrayCsv(String(result.data), result.retrievedAt)
          : parseOperatorConditions(
              operator.id,
              String(result.data),
              result.retrievedAt,
            );
      snapshot.readings.push(...readings);
      snapshot.diagnostics.push({
        provider: operator.label,
        status: readings.length ? 'ok' : 'empty',
        message: readings.length
          ? 'Operator report received. Observation time is shown only when supplied.'
          : 'No supported current conditions were found; the operator page remains available.',
        retrievedAt: result.retrievedAt,
      });
    } catch (error) {
      addError(operator.label, error);
    }
  }
  const extra =
    request.provider === 'auto'
      ? providerStatuses(env)
          .filter(
            (row) =>
              row.enabled &&
              !['auto', 'open-meteo'].includes(row.id) &&
              !disabled.has(row.id as ConditionsProvider) &&
              !(
                row.id === 'met-norway' &&
                (!request.marine ||
                  request.latitude < 55 ||
                  request.longitude < 0)
              ),
          )
          .map((row) => row.id as ConditionsProvider)
      : !['open-meteo', 'operator', 'zeustek', 'nasa'].includes(
            request.provider,
          )
        ? [request.provider as ConditionsProvider]
        : [];
  await Promise.all(
    extra.slice(0, 6).map(async (id) => {
      if (disabled.has(id)) {
        addError(
          id,
          new ConditionsError(
            'disabled',
            'Provider is disabled in Weather & Conditions settings.',
          ),
        );
        return;
      }
      try {
        const result = await fetchNamedProvider(id, resolved, env);
        snapshot.readings.push(...result.readings);
        snapshot.diagnostics.push(...result.diagnostics);
        const entry: ProviderDiagnostic = {
          provider: id,
          status: 'ok',
          message: 'Requested conditions received.',
          retrievedAt: now,
          ...(result.costAccesses === undefined
            ? {}
            : { costAccesses: result.costAccesses }),
        };
        snapshot.diagnostics.push(entry);
        recordCheck(id, env, entry);
      } catch (error) {
        const entry = diagnostic(id, error, now);
        snapshot.diagnostics.push(entry);
        recordCheck(id, env, entry);
      }
    }),
  );
  if (options.enrichment) {
    snapshot.enrichment = [];
    await Promise.all([
      pickadiveFacts(request)
        .then((rows) => snapshot.enrichment!.push(...rows))
        .catch((error) => addError('pickadive', error)),
      env.DIVENUMBER_API_KEY
        ? diveNumberFacts(request, env.DIVENUMBER_API_KEY)
            .then((rows) => snapshot.enrichment!.push(...rows))
            .catch((error) => addError('divenumber', error))
        : Promise.resolve(),
    ]);
  }
  snapshot.readings = [
    ...new Map(snapshot.readings.map((row) => [row.id, row])).values(),
  ].slice(0, 6000);
  return snapshot;
}
