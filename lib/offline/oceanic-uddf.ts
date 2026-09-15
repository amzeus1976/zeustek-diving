import { canonicalBytes, sha256Hex } from './canonical';
import type { JsonValue } from './types';

export const OCEANIC_UDDF_ADAPTER = 'oceanic-plus-uddf-3.2.1' as const;
export const UDDF_321_NAMESPACE = 'http://www.streit.cc/uddf/3.2/';
export const OCEANIC_OFFSET_TRANSFORM = 'oceanic-offset-repair-v1';

export interface OceanicSourceSite {
  id: string;
  name: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
}
export interface OceanicGasDefinition {
  id: string;
  name: string;
  oxygenFraction: number | null;
  nitrogenFraction: number | null;
  heliumFraction: number | null;
}
export interface OceanicWaypoint {
  elapsedSec: number | null;
  depthM: number | null;
  temperatureC: number | null;
}
export interface OceanicSegment {
  sourceDiveId: string;
  sourceSiteId: string | null;
  rawTimestamp: string | null;
  normalisedTimestamp: string | null;
  timestampTransforms: string[];
  greatestDepthM: number | null;
  sourceDurationSec: number | null;
  finalSampleElapsedSec: number | null;
  minimumTemperatureC: number | null;
  ballastKg: number | null;
  gasId: string | null;
  diveMode: string | null;
  tankPressureBeginBar: number | null;
  tankPressureEndBar: number | null;
  waypoints: OceanicWaypoint[];
}
export interface OceanicDocument {
  adapterKey: typeof OCEANIC_UDDF_ADAPTER;
  version: string;
  namespace: string;
  oceanicDetected: boolean;
  generatorHomepage: string | null;
  generatorVersion: string | null;
  sites: OceanicSourceSite[];
  gases: OceanicGasDefinition[];
  segments: OceanicSegment[];
  waypointCount: number;
  warnings: string[];
}

const decodeXml = (bytes: Uint8Array) =>
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const xmlText = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
const numberOrNull = (value: string | null) => {
  if (value == null || !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const tagPattern = (tag: string, flags = 'i') =>
  new RegExp(
    `<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`,
    flags,
  );
const tagText = (xml: string, tag: string) => {
  const match = xml.match(tagPattern(tag));
  return match ? xmlText(match[1] ?? '') : null;
};
const tagNumber = (xml: string, tag: string) => numberOrNull(tagText(xml, tag));
function blocks(xml: string, tag: string) {
  const regex = new RegExp(
    `<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}\\b([^>]*)>([\\s\\S]*?)<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`,
    'gi',
  );
  return [...xml.matchAll(regex)].map((match) => ({
    attributes: match[1] ?? '',
    body: match[2] ?? '',
    full: match[0],
  }));
}
const attr = (attributes: string, name: string) => {
  const match = attributes.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']+)["']`, 'i'),
  );
  return match?.[1] ?? null;
};
const firstRef = (xml: string, tag = 'link') => {
  const match = xml.match(
    new RegExp(
      `<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}\\b[^>]*\\bref\\s*=\\s*["']([^"']+)["'][^>]*\\/?>(?:<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>)?`,
      'i',
    ),
  );
  return match?.[1] ?? null;
};
const celsius = (kelvin: number | null) =>
  kelvin == null ? null : Math.round((kelvin - 273.15) * 100) / 100;
const bar = (pascal: number | null) =>
  pascal == null ? null : Math.round(pascal / 1000) / 100; // /100000 bar, then *100 rounding => /1000

export function repairOceanicTimestamp(
  raw: string | null,
  oceanicDetected: boolean,
) {
  if (!raw || !oceanicDetected)
    return { value: raw, transforms: [] as string[] };
  if (raw.endsWith('+00:01'))
    return {
      value: `${raw.slice(0, -6)}+01:00`,
      transforms: [OCEANIC_OFFSET_TRANSFORM],
    };
  if (raw.endsWith('+00:03'))
    return {
      value: `${raw.slice(0, -6)}+03:00`,
      transforms: [OCEANIC_OFFSET_TRANSFORM],
    };
  return { value: raw, transforms: [] as string[] };
}
export function assertSafeUddf(xml: string) {
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml))
    throw new Error('Unsafe XML DTD/entity declarations are not accepted.');
  if (xml.length > 30_000_000)
    throw new Error('UDDF file is over the 30 MB local parse limit.');
}
function assertWellFormedXml(xml: string) {
  const stack: string[] = [];
  const withoutOpaque = xml
    .replace(/<!--(?:[\s\S]*?)-->/g, '')
    .replace(/<!\[CDATA\[(?:[\s\S]*?)\]\]>/g, '')
    .replace(/<\?(?:[\s\S]*?)\?>/g, '');
  for (const match of withoutOpaque.matchAll(/<([^<>]+)>/g)) {
    const token = (match[1] ?? '').trim();
    if (!token || token.startsWith('!')) continue;
    if (token.startsWith('/')) {
      const name = token.slice(1).trim().split(/\s/, 1)[0];
      if (!name || stack.pop() !== name)
        throw new Error('Malformed XML: element nesting is invalid.');
    } else if (!token.endsWith('/')) {
      const name = token.split(/\s/, 1)[0];
      if (!name) throw new Error('Malformed XML: element name is missing.');
      stack.push(name);
    }
  }
  if (stack.length)
    throw new Error('Malformed XML: one or more elements are not closed.');
}

export function parseOceanicUddf(input: Uint8Array | string): OceanicDocument {
  const xml = typeof input === 'string' ? input : decodeXml(input);
  assertSafeUddf(xml);
  assertWellFormedXml(xml);
  const root = xml.match(/<(?:(?:[A-Za-z_][\w.-]*):)?uddf\b([^>]*)>/i);
  if (!root) throw new Error('UDDF root element not found.');
  const rootAttrs = root[1] ?? '';
  const version = attr(rootAttrs, 'version') ?? '';
  const namespace = rootAttrs.match(/xmlns\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  if (version !== '3.2.1')
    throw new Error(`Unsupported UDDF version: ${version || 'unknown'}.`);
  if (namespace !== UDDF_321_NAMESPACE)
    throw new Error(`Unsupported UDDF namespace: ${namespace || 'missing'}.`);
  const generator = blocks(xml, 'generator')[0]?.body ?? '';
  const homepage = tagText(generator, 'homepage');
  const oceanicDetected = Boolean(
    homepage && /oceanicworldwide\.com\/.*oceanic-plus/i.test(homepage),
  );
  if (!oceanicDetected)
    throw new Error(
      'This first adapter only accepts positively identified Oceanic+ UDDF exports.',
    );
  const sites = blocks(xml, 'site')
    .map((block) => ({
      id: attr(block.attributes, 'id') ?? '',
      name: tagText(block.body, 'name') ?? '',
      location: tagText(block.body, 'location') ?? '',
      latitude: tagNumber(block.body, 'latitude'),
      longitude: tagNumber(block.body, 'longitude'),
    }))
    .filter((site) => Boolean(site.id));
  const gases = blocks(xml, 'mix')
    .map((block) => ({
      id: attr(block.attributes, 'id') ?? '',
      name: tagText(block.body, 'name') ?? '',
      oxygenFraction: tagNumber(block.body, 'o2'),
      nitrogenFraction: tagNumber(block.body, 'n2'),
      heliumFraction: tagNumber(block.body, 'he'),
    }))
    .filter((gas) => Boolean(gas.id));
  const segments = blocks(xml, 'dive')
    .map((block) => {
      const before = blocks(block.body, 'informationbeforedive')[0]?.body ?? '';
      const after = blocks(block.body, 'informationafterdive')[0]?.body ?? '';
      const samples = blocks(block.body, 'samples')[0]?.body ?? '';
      const tank = blocks(block.body, 'tankdata')[0]?.body ?? '';
      const rawTimestamp = tagText(before, 'datetime');
      const repaired = repairOceanicTimestamp(rawTimestamp, oceanicDetected);
      const waypoints = blocks(samples, 'waypoint').map((point) => ({
        elapsedSec: tagNumber(point.body, 'divetime'),
        depthM: tagNumber(point.body, 'depth'),
        temperatureC: celsius(tagNumber(point.body, 'temperature')),
      }));
      const modeMatch = samples.match(
        /<(?:(?:[A-Za-z_][\w.-]*):)?divemode\b[^>]*\btype\s*=\s*["']([^"']+)["'][^>]*\/?/i,
      );
      return {
        sourceDiveId: attr(block.attributes, 'id') ?? '',
        sourceSiteId: firstRef(before),
        rawTimestamp,
        normalisedTimestamp: repaired.value,
        timestampTransforms: repaired.transforms,
        greatestDepthM: tagNumber(after, 'greatestdepth'),
        sourceDurationSec: tagNumber(after, 'diveduration'),
        finalSampleElapsedSec:
          waypoints
            .map((p) => p.elapsedSec)
            .filter((v): v is number => v != null)
            .sort((a, b) => b - a)[0] ?? null,
        minimumTemperatureC: celsius(tagNumber(after, 'lowesttemperature')),
        ballastKg: tagNumber(after, 'leadquantity'),
        gasId: firstRef(tank) ?? firstRef(samples, 'switchmix'),
        diveMode: modeMatch?.[1] ?? null,
        tankPressureBeginBar: bar(tagNumber(tank, 'tankpressurebegin')),
        tankPressureEndBar: bar(tagNumber(tank, 'tankpressureend')),
        waypoints,
      } satisfies OceanicSegment;
    })
    .filter((segment) => Boolean(segment.sourceDiveId));
  const waypointCount = segments.reduce(
    (sum, segment) => sum + segment.waypoints.length,
    0,
  );
  const warnings: string[] = [];
  if (segments.some((s) => s.timestampTransforms.length))
    warnings.push(
      'Oceanic+ exporter timezone offsets were normalised with oceanic-offset-repair-v1; raw values are retained.',
    );
  return {
    adapterKey: OCEANIC_UDDF_ADAPTER,
    version,
    namespace,
    oceanicDetected,
    generatorHomepage: homepage,
    generatorVersion: tagText(generator, 'version'),
    sites,
    gases,
    segments,
    waypointCount,
    warnings,
  };
}

export async function oceanicFileFingerprint(bytes: Uint8Array) {
  return sha256Hex(bytes);
}
export async function oceanicSegmentFingerprint(segment: OceanicSegment) {
  return sha256Hex(canonicalBytes(segment as unknown as JsonValue));
}
export function profilePreview(segment: OceanicSegment, maxPoints = 180) {
  if (segment.waypoints.length <= maxPoints) return segment.waypoints;
  const step = (segment.waypoints.length - 1) / (maxPoints - 1);
  return Array.from(
    { length: maxPoints },
    (_, i) => segment.waypoints[Math.round(i * step)]!,
  );
}
