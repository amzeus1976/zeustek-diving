export interface PhoneSyncProgress {
  label: string;
  percent: number;
}
export interface PhoneWorkerProgress {
  stage: 'install' | 'shell';
  completed: number;
  total: number;
}

/** Completed record groups and cached app files, never an elapsed-time estimate. */
export function phoneSyncProgress(
  stage: 'records' | 'install' | 'shell' | 'complete',
  completed = 0,
  total = 1,
  label = '',
): PhoneSyncProgress {
  const ratio = total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
  const ranges = { records: [0, 45], install: [45, 95], shell: [95, 99], complete: [100, 100] };
  const [start, end] = ranges[stage]!;
  return { label, percent: Math.floor(start! + ratio * (end! - start!)) };
}

/** A completed sync may activate a newer app. Reload it once, after drafts are saved. */
export function phoneReloadRequired(pageVersion: string, workerVersion?: string, reloadedVersion?: string | null) {
  return Boolean(workerVersion && workerVersion !== pageVersion && workerVersion !== reloadedVersion);
}
