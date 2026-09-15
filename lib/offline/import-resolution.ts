import type { DiveCylinder, DiveRecord } from './dives';
import type {
  OceanicGasDefinition,
  OceanicSegment,
  OceanicSourceSite,
} from './oceanic-uddf';

export type ImportResolutionAction =
  | 'keep-zeustek'
  | 'use-imported'
  | 'append'
  | 'ignore'
  | 'manual';
export interface ImportFieldCandidate {
  fieldPath: string;
  zeustekValue: unknown;
  importedValue: unknown;
  resolutionClass: 'scalar' | 'text' | 'structured';
  provenance: 'direct' | 'derived' | 'merged';
  transformIds: string[];
  sourceSegmentIds: string[];
}
export interface ImportFieldDecision extends ImportFieldCandidate {
  action: ImportResolutionAction;
  committedValue?: unknown;
}
export interface ImportResolutionRecord {
  importId: string;
  targetDiveId: string;
  targetRevisionEventId: string | null;
  decidedAt: string;
  decisions: ImportFieldDecision[];
  createdAt: string;
  modifiedAt: string;
}

const localDate = (iso: string | null) =>
  iso?.match(/^(\d{4}-\d{2}-\d{2})T/)?.[1] ?? null;
const hhmm = (iso: string | null) => iso?.match(/T(\d{2}:\d{2})/)?.[1] ?? null;

export function segmentCanonicalCandidates(
  segment: OceanicSegment,
  site: OceanicSourceSite | undefined,
  gas: OceanicGasDefinition | undefined,
): Array<Omit<ImportFieldCandidate, 'zeustekValue'>> {
  const cylinders: DiveCylinder[] = [];
  if (
    gas ||
    segment.tankPressureBeginBar != null ||
    segment.tankPressureEndBar != null
  ) {
    cylinders.push({
      id: `oceanic-${segment.sourceDiveId}-tank`,
      name: 'Oceanic+ source tank',
      gasType: gas?.heliumFraction
        ? 'Trimix'
        : (gas?.oxygenFraction ?? 0.21) > 0.22
          ? 'Nitrox'
          : 'Air',
      oxygenPercent:
        gas?.oxygenFraction == null ? null : gas.oxygenFraction * 100,
      heliumPercent: gas?.heliumFraction == null ? 0 : gas.heliumFraction * 100,
      configuration: 'Single Tank',
      material: '',
      size: '',
      startPressureBar: segment.tankPressureBeginBar,
      endPressureBar: segment.tankPressureEndBar,
      switchDepthM: null,
      switchRuntimeMin: null,
    });
  }
  const rows: Array<Omit<ImportFieldCandidate, 'zeustekValue'>> = [];
  const add = (
    fieldPath: string,
    importedValue: unknown,
    resolutionClass: 'scalar' | 'text' | 'structured',
    provenance: 'direct' | 'derived' | 'merged' = 'direct',
    transformIds: string[] = [],
  ) => {
    if (
      importedValue !== null &&
      importedValue !== undefined &&
      importedValue !== ''
    )
      rows.push({
        fieldPath,
        importedValue,
        resolutionClass,
        provenance,
        transformIds,
        sourceSegmentIds: [segment.sourceDiveId],
      });
  };
  const date = localDate(segment.normalisedTimestamp);
  if (date) {
    add('date', date, 'scalar', 'direct', segment.timestampTransforms);
    add(
      'timeIn',
      hhmm(segment.normalisedTimestamp),
      'scalar',
      'direct',
      segment.timestampTransforms,
    );
  }
  add('latitude', site?.latitude, 'scalar');
  add('longitude', site?.longitude, 'scalar');
  add('maxDepthM', segment.greatestDepthM, 'scalar');
  add('minimumTemperatureC', segment.minimumTemperatureC, 'scalar', 'direct', [
    'kelvin-to-celsius',
  ]);
  add('ballastKg', segment.ballastKg, 'scalar');
  if (cylinders.length)
    add('cylinders', cylinders, 'structured', 'derived', ['pascal-to-bar']);
  return rows;
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function fieldCandidatesForDive(
  dive: DiveRecord,
  segments: OceanicSegment[],
  sites: Map<string, OceanicSourceSite>,
  gases: Map<string, OceanicGasDefinition>,
): ImportFieldCandidate[] {
  const grouped = new Map<
    string,
    Array<Omit<ImportFieldCandidate, 'zeustekValue'>>
  >();
  const ordered = [...segments].sort((a, b) =>
    String(a.normalisedTimestamp ?? '').localeCompare(
      String(b.normalisedTimestamp ?? ''),
    ),
  );
  for (const segment of ordered) {
    for (const candidate of segmentCanonicalCandidates(
      segment,
      segment.sourceSiteId ? sites.get(segment.sourceSiteId) : undefined,
      segment.gasId ? gases.get(segment.gasId) : undefined,
    )) {
      grouped.set(candidate.fieldPath, [
        ...(grouped.get(candidate.fieldPath) ?? []),
        candidate,
      ]);
    }
  }
  const result: ImportFieldCandidate[] = [];
  for (const [fieldPath, rows] of grouped) {
    let importedValue: unknown = rows[0]!.importedValue;
    let provenance: ImportFieldCandidate['provenance'] = rows[0]!.provenance;
    if (fieldPath === 'maxDepthM') {
      importedValue = Math.max(...rows.map((row) => Number(row.importedValue)));
      provenance = rows.length > 1 ? 'derived' : provenance;
    } else if (fieldPath === 'minimumTemperatureC') {
      importedValue = Math.min(...rows.map((row) => Number(row.importedValue)));
      provenance = rows.length > 1 ? 'derived' : provenance;
    } else if (fieldPath === 'cylinders') {
      importedValue = rows.flatMap(
        (row) => row.importedValue as DiveCylinder[],
      );
      provenance = rows.length > 1 ? 'merged' : provenance;
    } else if (
      ['latitude', 'longitude', 'ballastKg'].includes(fieldPath) &&
      rows.some((row) => !sameValue(row.importedValue, importedValue))
    ) {
      continue;
    }
    result.push({
      fieldPath,
      zeustekValue: (dive as unknown as Record<string, unknown>)[fieldPath],
      importedValue,
      resolutionClass: rows[0]!.resolutionClass,
      provenance,
      transformIds: [...new Set(rows.flatMap((row) => row.transformIds))],
      sourceSegmentIds: [
        ...new Set(rows.flatMap((row) => row.sourceSegmentIds)),
      ],
    });
  }
  return result;
}

export function applyImportDecisions(
  dive: DiveRecord,
  decisions: ImportFieldDecision[],
): DiveRecord {
  const next = structuredClone(dive);
  for (const decision of decisions) {
    if (decision.action === 'keep-zeustek' || decision.action === 'ignore')
      continue;
    const imported =
      decision.action === 'manual'
        ? decision.committedValue
        : decision.importedValue;
    const record = next as unknown as Record<string, unknown>;
    if (
      decision.action === 'append' &&
      typeof record[decision.fieldPath] === 'string' &&
      typeof imported === 'string'
    )
      record[decision.fieldPath] = [record[decision.fieldPath], imported]
        .filter(Boolean)
        .join('\n\n');
    else if (
      decision.action === 'append' &&
      Array.isArray(record[decision.fieldPath]) &&
      Array.isArray(imported)
    )
      record[decision.fieldPath] = [
        ...(record[decision.fieldPath] as unknown[]),
        ...imported,
      ];
    else record[decision.fieldPath] = imported;
  }
  return next;
}

export function decisionsComplete(
  candidates: ImportFieldCandidate[],
  decisions: ImportFieldDecision[],
) {
  const chosen = new Set(decisions.map((decision) => decision.fieldPath));
  return candidates.every((candidate) => chosen.has(candidate.fieldPath));
}

export function rebaseImportDecisions(
  decisions: ImportFieldDecision[],
  candidates: ImportFieldCandidate[],
) {
  return candidates.flatMap((candidate) => {
    const prior = decisions.find(
      (decision) => decision.fieldPath === candidate.fieldPath,
    );
    if (
      !prior ||
      !sameValue(prior.zeustekValue, candidate.zeustekValue) ||
      !sameValue(prior.importedValue, candidate.importedValue)
    ) {
      return [];
    }
    return [
      {
        ...candidate,
        action: prior.action,
        ...(prior.action === 'manual'
          ? { committedValue: prior.committedValue }
          : {}),
      } satisfies ImportFieldDecision,
    ];
  });
}
