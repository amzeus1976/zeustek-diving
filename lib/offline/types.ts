export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Operation =
  | 'create'
  | 'update'
  | 'delete'
  | 'undelete'
  | 'merge'
  | 'migration';

export interface EntityRow {
  entityId: string;
  module: string;
  entityType: string;
  schemaVersion: number;
  record: JsonValue | null;
  recordHash: string;
  deleted: 0 | 1;
  updatedEventId: string;
  updatedAt: string;
}

export interface EventRow {
  protocolVersion: 1;
  eventId: string;
  entityId: string;
  module: string;
  entityType: string;
  schemaVersion: number;
  parents: string[];
  actorUserId: string;
  deviceId: string;
  lamport: number;
  createdAt: string;
  operation: Operation;
  record: JsonValue | null;
  recordHash: string;
}

export interface OutboxRow {
  objectId: string;
  objectKind: 'event' | 'attachment-manifest' | 'attachment-chunk' | 'snapshot' | 'system-checkpoint' | 'purge-marker';
  createdAt: string;
  attemptCount: number;
  nextAttemptAt: number;
  cipherBlob?: Blob;
  cipherSha256?: string;
  state: 'pending' | 'uploading' | 'acknowledged' | 'failed_permanent';
}

export interface NoteRecord {
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  attachments: string[];
  createdAt: string;
  modifiedAt: string;
}

export interface PlatformStatus {
  online: boolean;
  pending: number;
  conflicts: number;
  lastSyncAt: string | null;
  latestReplicaAt: string | null;
  latestVerifiedBackupAt: string | null;
  storageUsage: number | null;
  storageQuota: number | null;
  persistenceGranted: boolean | null;
}
