import {
  distanceKm,
  type ConditionsRequest,
  type SiteEnrichment,
} from '../../weather/conditions-model';
import { array, object } from './adapters';
import { conditionsFetch, ConditionsError } from './transport';
function safeLink(value: unknown, host: string) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' &&
      (url.hostname === host || url.hostname.endsWith(`.${host}`))
      ? url.href
      : `https://${host}/`;
  } catch {
    return `https://${host}/`;
  }
}
const clean = (value: unknown) =>
  typeof value === 'string'
    ? value
        .replace(/<[^>]*>/g, ' ')
        .trim()
        .slice(0, 500)
    : null;
export function normalizeDiveNumber(
  raw: unknown,
  request: ConditionsRequest,
  retrievedAt: string,
): SiteEnrichment[] {
  return array(object(raw).sites)
    .slice(0, 500)
    .flatMap((value) => {
      const row = object(value);
      const latitude = Number(row.lat),
        longitude = Number(row.lng);
      const name = clean(row.spot_name);
      if (
        !name ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        distanceKm({ latitude, longitude }, request) > 10
      )
        return [];
      return [
        {
          provider: 'divenumber',
          name,
          url: 'https://divenumber.com/',
          latitude,
          longitude,
          maxDepthM: null,
          difficulty: null,
          access: null,
          hazards: null,
          retrievedAt,
          attribution: 'DiveNumber · site catalogue reference',
        } as SiteEnrichment,
      ];
    })
    .slice(0, 12);
}
export function normalizePickadive(
  raw: unknown,
  request: ConditionsRequest,
  retrievedAt: string,
): SiteEnrichment[] {
  const body = object(raw);
  const candidate = object(body.site ?? body);
  const name = clean(candidate.name ?? candidate.site_name);
  if (!name) return [];
  const lat = candidate.lat ?? candidate.latitude;
  const lon = candidate.lng ?? candidate.longitude;
  const latitude = typeof lat === 'number' ? lat : null,
    longitude = typeof lon === 'number' ? lon : null;
  if (
    latitude !== null &&
    longitude !== null &&
    distanceKm({ latitude, longitude }, request) > 10
  )
    return [];
  return [
    {
      provider: 'pickadive',
      name,
      url: safeLink(candidate.url ?? candidate.site_url, 'pickadive.com'),
      latitude,
      longitude,
      maxDepthM:
        typeof candidate.max_depth_m === 'number' && candidate.max_depth_m >= 0
          ? candidate.max_depth_m
          : null,
      difficulty: clean(candidate.difficulty),
      access: clean(
        candidate.access ?? candidate.access_type ?? candidate.entry_exit,
      ),
      hazards: clean(
        Array.isArray(candidate.hazards)
          ? candidate.hazards.join('; ')
          : candidate.hazards,
      ),
      retrievedAt,
      attribution:
        'PickADive · OpenStreetMap contributors · planning context, verify locally',
    },
  ];
}
/** Read-only MCP site_facts tool, bounded to one named Site. Model-generated instructions are never executed. */
export async function pickadiveFacts(request: ConditionsRequest) {
  const result = await conditionsFetch(new URL('https://pickadive.com/mcp'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'site_facts', arguments: { site: request.siteName } },
    }),
    ttlMs: 86400000,
  });
  const body = object(result.data);
  const response = object(body.result);
  if (body.error || response.isError)
    throw new ConditionsError(
      'unavailable',
      'PickADive could not resolve this Site.',
    );
  let data = response.structuredContent;
  if (!data) {
    for (const content of array(response.content)) {
      const part = object(content);
      if (part.type === 'text' && typeof part.text === 'string') {
        try {
          data = JSON.parse(part.text);
          break;
        } catch {
          /* Plain prose is not converted into invented facts. */
        }
      }
    }
  }
  return normalizePickadive(data, request, result.retrievedAt);
}
export async function diveNumberFacts(request: ConditionsRequest, key: string) {
  const url = new URL('https://center.divenumber.com/api/sites.php');
  url.searchParams.set('api_key', key);
  url.searchParams.set('radius', '10');
  const result = await conditionsFetch(url, { ttlMs: 86400000 });
  if (object(result.data).success === false)
    throw new ConditionsError(
      'denied',
      'DiveNumber access is unavailable for this configured region.',
    );
  return normalizeDiveNumber(result.data, request, result.retrievedAt);
}
