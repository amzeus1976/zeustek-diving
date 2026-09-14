export interface SelectedMediaFile { id: string; fileName: string }

export function mediaShowsPreview(id: string, compact: boolean, previewCategory?: string, categoryById?: Record<string, string>) {
  return !compact || Boolean(previewCategory && categoryById?.[id] === previewCategory);
}

/** Independent, stable-ID operations; failures retain their filenames and selection. */
export async function operateSelectedMedia<T extends SelectedMediaFile>(files: T[], operation: (file: T) => Promise<void>) {
  const completedIds: string[] = [];
  const failed: Array<SelectedMediaFile & { error: string }> = [];
  const visited = new Set<string>();
  for (const file of files) {
    if (visited.has(file.id)) continue;
    visited.add(file.id);
    try { await operation(file); completedIds.push(file.id); }
    catch (error) { failed.push({ id: file.id, fileName: file.fileName, error: error instanceof Error ? error.message : 'Operation failed; retry this file.' }); }
  }
  return { completedIds, failed };
}
