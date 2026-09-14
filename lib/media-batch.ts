export interface PendingMediaFile { id: string; file: File }
export interface UploadedMediaFile { id: string; fileName: string; contentType: string; sizeBytes: number; createdAt: string }
export interface MediaBatchResult { uploaded: UploadedMediaFile[]; failed: Array<PendingMediaFile & { error: string }> }

/** Stable per-selection IDs, never filenames; sequential order and independent failures. */
export function appendMediaSelection(current: PendingMediaFile[], files: File[]) {
  return [...current, ...files.map(file => ({ id: crypto.randomUUID(), file }))];
}
export async function uploadMediaBatch(files: PendingMediaFile[], ownerKind: string, ownerId: string,
  request: typeof fetch = fetch, progress?: (completed: number, total: number) => void): Promise<MediaBatchResult> {
  const result: MediaBatchResult = { uploaded: [], failed: [] };
  for (const [index, pending] of files.entries()) {
    try {
      if (pending.file.size > 75 * 1024 * 1024) throw new Error('File must be under 75 MB.');
      const form = new FormData();
      form.append('file', pending.file); form.append('ownerKind', ownerKind); form.append('ownerId', ownerId);
      form.append('uploadId', pending.id);
      const response = await request('/api/media', { method: 'POST', body: form });
      if (!response.ok) throw new Error(response.status === 415 ? 'Unsupported file type.' : response.status === 401 ? 'Sign in to upload.' : 'Upload failed; reconnect and retry this file.');
      const asset = await response.json() as { id: string };
      if (!asset.id) throw new Error('Upload response is missing its attachment ID.');
      result.uploaded.push({ id: asset.id, fileName: pending.file.name, contentType: pending.file.type, sizeBytes: pending.file.size, createdAt: new Date().toISOString() });
    } catch (error) { result.failed.push({ ...pending, error: error instanceof Error ? error.message : 'Upload failed.' }); }
    progress?.(index + 1, files.length);
  }
  return result;
}
