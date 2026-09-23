export const CYLINDER_COLUMNS = [
  'id', 'serial', 'gas', 'oxygen', 'helium', 'pressure', 'volume', 'oxygenClean',
  'analysis', 'lastFill', 'fillLocation', 'valve', 'nextTest',
] as const;

export type CylinderColumn = (typeof CYLINDER_COLUMNS)[number];

export const CYLINDER_COLUMN_LABELS: Record<CylinderColumn, string> = {
  id: 'ID #', serial: 'Manufacturer serial', gas: 'Gas', oxygen: 'O₂ %', helium: 'He %',
  pressure: 'Fill bar', volume: 'Litres', oxygenClean: 'O₂ cleaned', analysis: 'Analysis',
  lastFill: 'Last fill date', fillLocation: 'Fill location', valve: 'Valve', nextTest: 'Next test',
};

export const DEFAULT_CYLINDER_COLUMNS: CylinderColumn[] = [
  'id', 'gas', 'oxygen', 'pressure', 'volume', 'analysis', 'nextTest',
];

export function normaliseCylinderColumns(input: readonly string[] | null | undefined): CylinderColumn[] {
  const selected = new Set(input ?? DEFAULT_CYLINDER_COLUMNS);
  const ordered = CYLINDER_COLUMNS.filter((column) => selected.has(column));
  return ordered.length ? ordered : [...DEFAULT_CYLINDER_COLUMNS];
}
