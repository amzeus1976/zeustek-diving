import {
  conditionReading,
  distanceKm,
  type ConditionProvenance,
  type ConditionReading,
  type ConditionsRequest,
} from '../../weather/conditions-model';
export const OPERATOR_SOURCES = [
  {
    id: 'capernwray',
    label: 'Capernwray',
    match: /capernwray/i,
    latitude: 54.138,
    longitude: -2.738,
    url: 'https://www.dive-site.co.uk/',
    dataUrl:
      'https://docs.google.com/spreadsheets/d/e/2PACX-1vTDPPa0A3rV_5hlbfxi88wbKjy_KzfX-2rM4LBFTMyrGFGwxEGU0hB-vA1BZuBVSFrASjJs6WHl3ghs/pub?gid=0&single=true&output=csv',
    format: 'csv',
  },
  {
    id: 'ellerton',
    label: 'Ellerton Park',
    match: /ellerton/i,
    latitude: 54.362,
    longitude: -1.616,
    url: 'https://www.ellertonpark.com/',
    dataUrl: 'https://www.ellertonpark.com/',
    format: 'html',
  },
  {
    id: 'stoney',
    label: 'Stoney Cove',
    match: /stoney\s*cove/i,
    latitude: 52.543,
    longitude: -1.274,
    url: 'https://www.stoneycove.com/',
    dataUrl: 'https://www.stoneycove.com/',
    format: 'html',
  },
  {
    id: 'vobster',
    label: 'Vobster Quay',
    match: /vobster/i,
    latitude: 51.245,
    longitude: -2.432,
    url: 'https://www.vobster.com/',
    dataUrl: 'https://www.vobster.com/',
    format: 'html',
  },
] as const;
export type OperatorSourceId = (typeof OPERATOR_SOURCES)[number]['id'];
export function matchedOperator(request: ConditionsRequest) {
  return OPERATOR_SOURCES.find(
    (site) =>
      (request.operatorId === site.id || site.match.test(request.siteName)) &&
      distanceKm(site, request) < 10,
  );
}
function textOnly(html: string) {
  return html
    .slice(0, 700000)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&deg;|&#176;|º/g, '°')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
function sourceFor(
  id: OperatorSourceId,
  retrievedAt: string,
): ConditionProvenance {
  const site = OPERATOR_SOURCES.find((row) => row.id === id)!;
  return {
    provider: 'operator',
    label: site.label,
    station: site.id,
    kind: 'operator',
    classification: 'observed',
    url: site.url,
    attribution: `${site.label} operator-published conditions`,
    resolution: 'operator site report; measurement method not supplied',
    latitude: site.latitude,
    longitude: site.longitude,
    retrievedAt,
    observedAt: null,
  };
}
function dated(day: string, month: string, year: string) {
  const value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
}
/** Only parse the actual conditions block, never promotional copy, opening hours or historical articles. */
export function parseOperatorConditions(
  id: OperatorSourceId,
  html: string,
  retrievedAt: string,
): ConditionReading[] {
  const text = textOnly(html);
  const source = sourceFor(id, retrievedAt);
  const result: ConditionReading[] = [];
  if (id === 'capernwray') return []; // official structured CSV below; loading placeholders are not evidence
  const marker =
    id === 'stoney'
      ? /THE CURRENT SURFACE TEMPERATURE/i
      : id === 'vobster'
        ? /SURFACE WATER TEMP/i
        : /Water Temperature/i;
  const start = text.search(marker);
  if (start < 0) return [];
  const block = text.slice(Math.max(0, start - 45), start + 350);
  if (id === 'vobster') {
    const d = block.match(/UPDATED\s*:\s*(\d{1,2})-(\d{1,2})-(\d{4})/i);
    if (d) source.observedAt = dated(d[1]!, d[2]!, d[3]!);
  }
  if (id === 'stoney') {
    const d = block.match(
      /(\d{1,2})(?:st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
    );
    if (d) {
      const month =
        [
          'january',
          'february',
          'march',
          'april',
          'may',
          'june',
          'july',
          'august',
          'september',
          'october',
          'november',
          'december',
        ].indexOf(d[2]!.toLowerCase()) + 1;
      source.observedAt = dated(d[1]!, String(month), d[3]!);
    }
  }
  if (source.observedAt) source.timeZone = 'date-only';
  const temperature = block.match(
    /(?:WATER TEMP(?:ERATURE)?|SURFACE TEMPERATURE)(?:\s*IS)?\s*:?\s*(-?\d+(?:\.\d+)?)\s*(?:°|degrees\s*)C/i,
  );
  if (temperature) {
    const row = conditionReading('water-temperature', temperature[1], '°C', {
      ...source,
      depth: { kind: id === 'ellerton' ? 'unknown' : 'surface' },
    });
    if (row) result.push(row);
  }
  if (id === 'stoney') {
    const visibility =
      block.match(/Visibility is\s+(.+?)(?:Please|\.|$)/i)?.[1] ?? '';
    for (const part of visibility.split('/')) {
      const match = part
        .trim()
        .match(/^([A-Za-z -]+)\s*@\s*(Below\s*)?(\d+(?:\.\d+)?)\s*m/i);
      if (match) {
        const depth = match[2]
          ? {
              kind: 'band' as const,
              minimumM: Number(match[3]),
              maximumM: null,
            }
          : { kind: 'exact' as const, metres: Number(match[3]) };
        const row = conditionReading('visibility', match[1]!.trim(), 'text', {
          ...source,
          depth,
        });
        if (row) result.push(row);
      }
    }
  }
  const numeric = block.match(
    /Visibility\s*(?:distance)?\s*(?:is|:)?\s*(\d+(?:\.\d+)?)\s*m(?:etres)?/i,
  );
  if (numeric) {
    const row = conditionReading('visibility', numeric[1], 'm', source);
    if (row) result.push(row);
  }
  // Explicit status labels can be retained as dated operator notices; prose about old closures is not current status.
  const status = block.match(
    /SITE STATUS\s*:\s*(OPEN|CLOSED)(?:\s*[-–:]\s*([^.!]{0,120}))?/i,
  );
  if (status && source.observedAt) {
    const row = conditionReading(
      'site-status',
      `${status[1]}${status[2] ? ` · ${status[2]}` : ''}`,
      'text',
      source,
    );
    if (row) result.push(row);
  }
  return result;
}
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < Math.min(input.length, 100000); i++) {
    const c = input[i]!;
    if (c === '"') {
      if (quoted && input[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if (c === '\n' && !quoted) {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += c;
  }
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
}
export function parseCapernwrayCsv(
  csv: string,
  retrievedAt: string,
): ConditionReading[] {
  const [headers, ...rows] = parseCsv(csv);
  if (
    !headers?.includes('surfaceWaterTemp') ||
    !headers.includes('midLevelWaterTemp')
  )
    return [];
  const row = rows.find((values) =>
    values[headers.indexOf('surfaceWaterTemp')]?.trim(),
  );
  if (!row) return [];
  const values = Object.fromEntries(
    headers.map((key, index) => [key, row[index]]),
  );
  const source = sourceFor('capernwray', retrievedAt);
  return [
    conditionReading('water-temperature', values.surfaceWaterTemp, '°C', {
      ...source,
      depth: { kind: 'surface' },
    }),
    conditionReading('water-temperature', values.midLevelWaterTemp, '°C', {
      ...source,
      depth: { kind: 'mid-level' },
    }),
    conditionReading('visibility', values.visibilityDistance, 'm', source),
    conditionReading('visibility', values.waterVisibilty, 'text', {
      ...source,
      detail:
        'Operator qualitative visibility; preserve alongside the numeric distance.',
    }),
  ]
    .filter((r): r is ConditionReading => r !== null)
    .map((r, index) => ({ ...r, id: `${r.id}:${index}` }));
}
