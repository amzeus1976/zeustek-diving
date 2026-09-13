import tableDataset from './data/dive-table-dataset.json';

export type PressureGroupValidation =
  | 'MATCHED'
  | 'MANUAL_MORE_CONSERVATIVE'
  | 'SYSTEM_MORE_CONSERVATIVE'
  | 'VIOLATION_DANGER'
  | 'INSUFFICIENT_DATA'
  | 'NO_DECOMPRESSION_LIMIT_EXCEEDED';

type DepthRow = (typeof tableDataset.depth_rows)[number];

export interface PressureGroupResult {
  pressureGroup: string;
  roundedDepthM: number | null;
  roundedDepthFt: number | null;
  roundedTimeMin: number | null;
  noDecompressionLimitMin: number | null;
  validation: PressureGroupValidation;
  message: string;
}

export interface SurfaceIntervalResult {
  pressureGroup: string;
  validation: PressureGroupValidation;
  message: string;
}

export interface DivePressureGroupProfile extends PressureGroupResult {
  previousPostDiveGroup: string;
  preDivePressureGroup: string;
  residualNitrogenTimeMin: number;
  adjustedNoDecompressionLimitMin: number | null;
  actualBottomTimeMin: number | null;
  totalBottomTimeMin: number | null;
}

export const PRESSURE_GROUP_DATASET_NAME = tableDataset.table_name;
export const PRESSURE_GROUP_SOURCE_NOTE = tableDataset.source_note;
const FEET_PER_METRE = 3.28084;

function validGroup(value: string | undefined | null) {
  const group = (value ?? '').trim().toUpperCase();
  return /^[A-Z]$/.test(group) ? group : '';
}

function findDepthRow(depthM: number): DepthRow | undefined {
  const depthFt = depthM * FEET_PER_METRE;
  return tableDataset.depth_rows.find((candidate) => candidate.depth_feet >= depthFt);
}

function resultMessage(
  row: DepthRow,
  roundedTime: number,
  preGroup: string,
  rnt: number,
  firstDive: boolean,
) {
  if (firstDive)
    return `First dive of the day starts at group A with no residual nitrogen time. Rounded conservatively to ${row.depth_feet}ft and the ${roundedTime}-minute threshold.`;
  const repetitive = preGroup ? ` Pre-dive group ${preGroup} adds ${rnt} minutes RNT.` : '';
  return `Rounded conservatively to ${row.depth_feet}ft and the ${roundedTime}-minute threshold.${repetitive}`;
}

export function calculateSurfaceIntervalPressureGroup(
  previousPostDiveGroup: string,
  surfaceIntervalMin: number | null,
): SurfaceIntervalResult {
  const previous = validGroup(previousPostDiveGroup);
  if (!previous || surfaceIntervalMin == null || !Number.isFinite(surfaceIntervalMin) || surfaceIntervalMin < 0) {
    return {
      pressureGroup: '',
      validation: 'INSUFFICIENT_DATA',
      message: 'Enter the previous post-dive group and surface interval.',
    };
  }

  const boundaries = tableDataset.surface_interval_max_minutes[
    previous as keyof typeof tableDataset.surface_interval_max_minutes
  ];
  const boundaryIndex = boundaries.findIndex((maximum) => surfaceIntervalMin <= maximum);
  if (boundaryIndex < 0) {
    return {
      pressureGroup: '',
      validation: 'MATCHED',
      message: `After ${surfaceIntervalMin} minutes the interval is beyond this table's residual-nitrogen window; treat the next entry as a new dive for this table only.`,
    };
  }

  const previousIndex = previous.charCodeAt(0) - 65;
  const nextIndex = previousIndex - boundaryIndex;
  const pressureGroup = String.fromCharCode(65 + nextIndex);
  return {
    pressureGroup,
    validation: 'MATCHED',
    message: `Previous group ${previous} becomes ${pressureGroup} after ${surfaceIntervalMin} minutes.`,
  };
}

export function calculateDivePressureGroupProfile(input: {
  depthM: number | null;
  bottomTimeMin: number | null;
  previousPostDiveGroup?: string;
  surfaceIntervalMin?: number | null;
  manualPreDiveGroup?: string;
}): DivePressureGroupProfile {
  const { depthM, bottomTimeMin } = input;
  const empty: DivePressureGroupProfile = {
    pressureGroup: '',
    roundedDepthM: null,
    roundedDepthFt: null,
    roundedTimeMin: null,
    noDecompressionLimitMin: null,
    previousPostDiveGroup: validGroup(input.previousPostDiveGroup),
    preDivePressureGroup: '',
    residualNitrogenTimeMin: 0,
    adjustedNoDecompressionLimitMin: null,
    actualBottomTimeMin: bottomTimeMin,
    totalBottomTimeMin: null,
    validation: 'INSUFFICIENT_DATA',
    message: 'Enter maximum depth and bottom time first.',
  };
  if (
    depthM == null ||
    bottomTimeMin == null ||
    !Number.isFinite(depthM) ||
    !Number.isFinite(bottomTimeMin) ||
    depthM <= 0 ||
    bottomTimeMin <= 0
  ) {
    return empty;
  }

  const row = findDepthRow(depthM);
  if (!row) {
    return {
      ...empty,
      message: 'This attached reference table does not cover dives deeper than 140ft (42.7m).',
    };
  }

  const noDecompressionLimitMin = row.rnt_by_group.at(-1);
  if (noDecompressionLimitMin == null) {
    return { ...empty, message: 'The selected reference-table row is incomplete.' };
  }
  let preDivePressureGroup = validGroup(input.manualPreDiveGroup);
  const previousPostDiveGroup = validGroup(input.previousPostDiveGroup);
  const firstDive = !preDivePressureGroup && !previousPostDiveGroup;
  if (!preDivePressureGroup && previousPostDiveGroup) {
    const interval = calculateSurfaceIntervalPressureGroup(
      previousPostDiveGroup,
      input.surfaceIntervalMin ?? null,
    );
    if (interval.validation === 'INSUFFICIENT_DATA') {
      return {
        ...empty,
        roundedDepthFt: row.depth_feet,
        roundedDepthM: Number((row.depth_feet / FEET_PER_METRE).toFixed(1)),
        noDecompressionLimitMin,
        message: interval.message,
      };
    }
    preDivePressureGroup = interval.pressureGroup;
  }
  if (firstDive) preDivePressureGroup = 'A';

  let residualNitrogenTimeMin = 0;
  if (preDivePressureGroup && !firstDive) {
    if ('repetitive_supported' in row && row.repetitive_supported === false) {
      return {
        ...empty,
        roundedDepthFt: row.depth_feet,
        roundedDepthM: Number((row.depth_feet / FEET_PER_METRE).toFixed(1)),
        noDecompressionLimitMin,
        preDivePressureGroup,
        message: 'The attached table does not provide repetitive-dive values at 140ft.',
      };
    }
    const groupIndex = preDivePressureGroup.charCodeAt(0) - 65;
    const rnt = row.rnt_by_group[groupIndex];
    if (rnt == null) {
      return {
        ...empty,
        roundedDepthFt: row.depth_feet,
        roundedDepthM: Number((row.depth_feet / FEET_PER_METRE).toFixed(1)),
        noDecompressionLimitMin,
        preDivePressureGroup,
        message: `Pre-dive group ${preDivePressureGroup} is not supported at ${row.depth_feet}ft by the attached table.`,
      };
    }
    residualNitrogenTimeMin = rnt;
  }

  const adjustedNoDecompressionLimitMin = noDecompressionLimitMin - residualNitrogenTimeMin;
  const totalBottomTimeMin = bottomTimeMin + residualNitrogenTimeMin;
  if (bottomTimeMin > adjustedNoDecompressionLimitMin) {
    return {
      ...empty,
      roundedDepthFt: row.depth_feet,
      roundedDepthM: Number((row.depth_feet / FEET_PER_METRE).toFixed(1)),
      noDecompressionLimitMin,
      previousPostDiveGroup,
      preDivePressureGroup,
      residualNitrogenTimeMin,
      adjustedNoDecompressionLimitMin,
      actualBottomTimeMin: bottomTimeMin,
      totalBottomTimeMin,
      validation: 'NO_DECOMPRESSION_LIMIT_EXCEEDED',
      message: `The profile exceeds the attached table's adjusted no-decompression limit of ${adjustedNoDecompressionLimitMin} minutes at ${row.depth_feet}ft.`,
    };
  }

  const thresholdIndex = row.rnt_by_group.findIndex((threshold) => threshold >= totalBottomTimeMin);
  if (thresholdIndex < 0) {
    return {
      ...empty,
      roundedDepthFt: row.depth_feet,
      roundedDepthM: Number((row.depth_feet / FEET_PER_METRE).toFixed(1)),
      noDecompressionLimitMin,
      previousPostDiveGroup,
      preDivePressureGroup,
      residualNitrogenTimeMin,
      adjustedNoDecompressionLimitMin,
      actualBottomTimeMin: bottomTimeMin,
      totalBottomTimeMin,
      validation: 'NO_DECOMPRESSION_LIMIT_EXCEEDED',
      message: 'The supplied table has no pressure group for this profile.',
    };
  }

  const pressureGroup = String.fromCharCode(65 + thresholdIndex);
  const roundedTimeMin = row.rnt_by_group[thresholdIndex]!;
  return {
    pressureGroup,
    roundedDepthFt: row.depth_feet,
    roundedDepthM: Number((row.depth_feet / FEET_PER_METRE).toFixed(1)),
    roundedTimeMin,
    noDecompressionLimitMin,
    previousPostDiveGroup,
    preDivePressureGroup,
    residualNitrogenTimeMin,
    adjustedNoDecompressionLimitMin,
    actualBottomTimeMin: bottomTimeMin,
    totalBottomTimeMin,
    validation: 'MATCHED',
    message: resultMessage(
      row,
      roundedTimeMin,
      preDivePressureGroup,
      residualNitrogenTimeMin,
      firstDive,
    ),
  };
}

export function calculatePostDivePressureGroup(
  depthM: number | null,
  bottomTimeMin: number | null,
): DivePressureGroupProfile {
  return calculateDivePressureGroupProfile({ depthM, bottomTimeMin });
}

export function verifyManualPressureGroup(
  manualGroup: string,
  calculatedGroup: string,
): { validation: PressureGroupValidation; message: string } {
  const manual = validGroup(manualGroup);
  const calculated = validGroup(calculatedGroup);
  if (!manual || !calculated) {
    return {
      validation: 'INSUFFICIENT_DATA',
      message: 'Enter one pressure-group letter and calculate the table value first.',
    };
  }
  if (manual === calculated) {
    return { validation: 'MATCHED', message: `Manual group ${manual} matches the table.` };
  }
  if (manual.charCodeAt(0) > calculated.charCodeAt(0)) {
    return {
      validation: 'MANUAL_MORE_CONSERVATIVE',
      message: `Manual group ${manual} is more conservative than calculated group ${calculated}.`,
    };
  }
  return {
    validation: 'VIOLATION_DANGER',
    message: `Manual group ${manual} understates the supplied table result ${calculated}. Check the entry before relying on it.`,
  };
}
