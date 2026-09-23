import type { ProviderDiagnostic } from '../../weather/conditions-model';
export class ConditionsError extends Error {
  constructor(
    readonly code: ProviderDiagnostic['status'],
    message: string,
  ) {
    super(message);
    this.name = 'ConditionsError';
  }
}
export interface TransportResult {
  data: unknown;
  retrievedAt: string;
  costAccesses?: number;
  cached: boolean;
}
const cache = new Map<string, { expires: number; result: TransportResult }>();
const pending = new Map<string, Promise<TransportResult>>();
const retryAfter = new Map<string, number>();
export function clearConditionsTransport() {
  cache.clear();
  pending.clear();
  retryAfter.clear();
}
const hosts = new Set([
  'api.open-meteo.com',
  'marine-api.open-meteo.com',
  'archive-api.open-meteo.com',
  'data.hub.api.metoffice.gov.uk',
  'data.api.xweather.com',
  'api.tomorrow.io',
  'api.worldweatheronline.com',
  'api.met.no',
  'www.dive-site.co.uk',
  'www.ellertonpark.com',
  'www.stoneycove.com',
  'www.vobster.com',
  'docs.google.com',
  'pickadive.com',
  'center.divenumber.com',
]);
function allowed(url: URL) {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    (hosts.has(url.hostname) ||
      /^doc-[a-z0-9-]+-sheets\.googleusercontent\.com$/.test(url.hostname))
  );
}
export async function boundedBody(response: Response) {
  if (Number(response.headers.get('content-length')) > 1500000)
    throw new ConditionsError(
      'unavailable',
      'Provider response exceeded the supported size.',
    );
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1500000) {
      await reader.cancel();
      throw new ConditionsError(
        'unavailable',
        'Provider response exceeded the supported size.',
      );
    }
    chunks.push(value);
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(data);
}
/** Fixed-host server transport. Provider errors and request URLs never cross the public boundary. */
export async function conditionsFetch(
  url: URL,
  options: {
    headers?: Record<string, string>;
    format?: 'json' | 'text';
    ttlMs?: number;
    method?: 'GET' | 'POST';
    body?: string;
  } = {},
): Promise<TransportResult> {
  if (!allowed(url))
    throw new ConditionsError(
      'unsupported',
      'Provider endpoint is not approved.',
    );
  const key = JSON.stringify([
    url.href,
    options.headers,
    options.method,
    options.body,
    options.format,
  ]);
  const found = cache.get(key);
  if (found && found.expires > Date.now())
    return {
      ...found.result,
      cached: true,
      ...(found.result.costAccesses === undefined ? {} : { costAccesses: 0 }),
    };
  const inflight = pending.get(key);
  if (inflight) return inflight;
  if ((retryAfter.get(url.hostname) ?? 0) > Date.now())
    throw new ConditionsError(
      'rate-limited',
      'Provider request limit reached. Wait before trying again.',
    );
  const work = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      let current = url;
      let response: Response | null = null;
      for (let redirects = 0; redirects < 4; redirects++) {
        response = await fetch(current, {
          method: options.method ?? 'GET',
          ...(options.body ? { body: options.body } : {}),
          headers: {
            accept:
              options.format === 'text'
                ? 'text/plain,text/html'
                : 'application/json',
            ...options.headers,
          },
          signal: controller.signal,
          redirect: 'manual',
        });
        if (response.status < 300 || response.status >= 400) break;
        const location = response.headers.get('location');
        if (
          !location ||
          (options.headers &&
            Object.keys(options.headers).some((key) =>
              /api|auth|token|secret/i.test(key),
            )) ||
          current.searchParams.has('apikey') ||
          current.searchParams.has('client_secret') ||
          current.searchParams.has('api_key') ||
          current.searchParams.has('key')
        )
          throw new ConditionsError(
            'unavailable',
            'Provider returned an unsupported redirect.',
          );
        const next = new URL(location, current);
        if (!allowed(next))
          throw new ConditionsError(
            'unavailable',
            'Provider redirected outside the approved service.',
          );
        current = next;
      }
      if (!response?.ok) {
        const status = response?.status;
        if (status === 429) {
          const seconds = Number(response?.headers.get('retry-after'));
          retryAfter.set(
            url.hostname,
            Date.now() +
              Math.min(
                3600,
                Math.max(60, Number.isFinite(seconds) ? seconds : 60),
              ) *
                1000,
          );
          throw new ConditionsError(
            'rate-limited',
            'Provider request limit reached. Retry later or use Open-Meteo.',
          );
        }
        if (status === 401 || status === 403)
          throw new ConditionsError(
            'denied',
            'Provider access was denied. Check the server credential and subscription scope.',
          );
        if (status === 400 || status === 404 || status === 422)
          throw new ConditionsError(
            'unsupported',
            'This provider does not support the requested place, date or product.',
          );
        throw new ConditionsError(
          'unavailable',
          'Provider is temporarily unavailable. Saved conditions are retained.',
        );
      }
      const text = await boundedBody(response);
      let data: unknown = text;
      if (options.format !== 'text') {
        try {
          data = JSON.parse(text);
        } catch {
          throw new ConditionsError(
            'unavailable',
            'Provider returned an unsupported response.',
          );
        }
      }
      const cost = response.headers.get('X-Cost-Tokens');
      const result: TransportResult = {
        data,
        retrievedAt: new Date().toISOString(),
        cached: false,
        ...(cost !== null && Number.isFinite(Number(cost))
          ? { costAccesses: Number(cost) }
          : {}),
      };
      if (cache.size >= 160) cache.delete(cache.keys().next().value!);
      cache.set(key, {
        expires: Date.now() + (options.ttlMs ?? 1200000),
        result,
      });
      return result;
    } catch (error) {
      if (error instanceof ConditionsError) throw error;
      throw new ConditionsError(
        'unavailable',
        'Provider could not be reached. Saved conditions are retained.',
      );
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => pending.delete(key));
  pending.set(key, work);
  return work;
}
