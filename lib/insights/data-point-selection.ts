export type DataPointSelectionMode = 'all' | 'one' | 'many';

export interface DataPointSelection {
  mode: DataPointSelectionMode;
  selectedIds: string[];
  excludedIds: string[];
}

export function selectAllDataPoints(ids: string[]): DataPointSelection {
  return { mode: 'all', selectedIds: [...new Set(ids)], excludedIds: [] };
}

export function selectNoDataPoints(ids: string[]): DataPointSelection {
  return { mode: 'many', selectedIds: [], excludedIds: [...new Set(ids)] };
}

export function toggleDataPoint(selection: DataPointSelection, id: string): DataPointSelection {
  const selected = new Set(selection.selectedIds);
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  const all = [...new Set([...selection.selectedIds, ...selection.excludedIds, id])];
  const selectedIds = [...selected];
  return {
    mode: selectedIds.length === all.length ? 'all' : selectedIds.length === 1 ? 'one' : 'many',
    selectedIds,
    excludedIds: all.filter((candidate) => !selected.has(candidate)),
  };
}
