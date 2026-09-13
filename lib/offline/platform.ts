import { zeustekDb } from './db';
import type { PlatformStatus } from './types';

export async function provisionLocalPlatform(): Promise<void> {
  await zeustekDb.open();
  const persistenceGranted = await navigator.storage?.persist?.();
  if (typeof persistenceGranted === 'boolean') {
    await zeustekDb.diagnostics.put({ id: 'storage-persistence', code: 'STORAGE_PERSISTENCE', createdAt: new Date().toISOString(), detail: { granted: persistenceGranted } });
  }
}

export async function getPlatformStatus(): Promise<PlatformStatus> {
  await zeustekDb.open();
  const [pending, conflicts, lastSync, replica, backup, persistence, estimate] = await Promise.all([
    zeustekDb.outbox.where('state').anyOf('pending', 'uploading').count(),
    zeustekDb.conflicts.filter((row) => !row.resolvedAt).count(),
    zeustekDb.syncState.get('lastSuccessfulSyncAt'),
    zeustekDb.syncState.get('latestReplicaAt'),
    zeustekDb.syncState.get('latestVerifiedBackupAt'),
    zeustekDb.diagnostics.get('storage-persistence'),
    navigator.storage?.estimate?.(),
  ]);
  const storedPersistence = persistence?.detail && typeof persistence.detail === 'object' && 'granted' in persistence.detail
    ? (persistence.detail as { granted: boolean }).granted
    : null;
  return {
    online: navigator.onLine,
    pending,
    conflicts,
    lastSyncAt: typeof lastSync?.value === 'string' ? lastSync.value : null,
    latestReplicaAt: typeof replica?.value === 'string' ? replica.value : null,
    latestVerifiedBackupAt: typeof backup?.value === 'string' ? backup.value : null,
    storageUsage: estimate?.usage ?? null,
    storageQuota: estimate?.quota ?? null,
    persistenceGranted: storedPersistence,
  };
}

export async function createSupportBundle(): Promise<Blob> {
  const status = await getPlatformStatus();
  const diagnostics = await zeustekDb.diagnostics.toArray();
  const safe = {
    generatedAt: new Date().toISOString(),
    appVersion: '1.0.0',
    protocolVersion: 1,
    localDbSchemaVersion: 1,
    status,
    diagnostics: diagnostics.map(({ code, createdAt }) => ({ code, createdAt })),
  };
  return new Blob([JSON.stringify(safe, null, 2)], { type: 'application/json' });
}
