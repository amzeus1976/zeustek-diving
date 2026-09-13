import Dexie, { type EntityTable, type Table } from 'dexie';
import type { EntityRow, EventRow, JsonValue, OutboxRow } from './types';

export interface SettingRow { key: string; value: JsonValue }
export interface UserRow { userId: string; role: 'owner' | 'admin' | 'member' | 'viewer'; profileEntityId: string }
export interface EventParentRow { eventId: string; parentEventId: string }
export interface EntityHeadRow { entityId: string; eventId: string }
export interface InboxObjectRow { objectId: string; state: 'received' | 'blocked_missing_parent' | 'quarantined'; receivedAt: string; detail?: string }
export interface ConflictRow { entityId: string; headEventIds: string[]; createdAt: string; resolvedAt?: string }
export interface AttachmentRow { attachmentId: string; entityId: string; fileName: string; mimeType: string; byteLength: number; sha256: string; state: string }
export interface AttachmentChunkRow { objectId: string; attachmentId: string; index: number; plainSha256: string; cipherBlob: Blob; state: string }
export interface SyncStateRow { key: string; value: JsonValue }
export interface KeyMaterialRow { key: string; value: JsonValue | CryptoKey | Blob }
export interface MigrationRow { id: string; appliedAt: string }
export interface DiagnosticRow { id: string; code: string; createdAt: string; detail?: JsonValue }
export interface DiveImageRow { id:string; account:string; blob:Blob; name:string; remoteKey?:string; createdAt:string }

export class ZeustekDatabase extends Dexie {
  settings!: EntityTable<SettingRow, 'key'>;
  users!: EntityTable<UserRow, 'userId'>;
  entities!: EntityTable<EntityRow, 'entityId'>;
  events!: EntityTable<EventRow, 'eventId'>;
  eventParents!: Table<EventParentRow, [string, string]>;
  entityHeads!: Table<EntityHeadRow, [string, string]>;
  outbox!: EntityTable<OutboxRow, 'objectId'>;
  inboxObjects!: EntityTable<InboxObjectRow, 'objectId'>;
  conflicts!: EntityTable<ConflictRow, 'entityId'>;
  attachments!: EntityTable<AttachmentRow, 'attachmentId'>;
  attachmentChunks!: EntityTable<AttachmentChunkRow, 'objectId'>;
  syncState!: EntityTable<SyncStateRow, 'key'>;
  keyMaterial!: EntityTable<KeyMaterialRow, 'key'>;
  migrations!: EntityTable<MigrationRow, 'id'>;
  diagnostics!: EntityTable<DiagnosticRow, 'id'>;
  diveImages!: EntityTable<DiveImageRow, 'id'>;

  constructor() {
    super('zeustek-v1');
    this.version(1).stores({
      settings: '&key',
      users: '&userId,role',
      entities: '&entityId,module,entityType,[module+entityType],updatedAt',
      events: '&eventId,entityId,[entityId+lamport],actorUserId,deviceId,createdAt',
      eventParents: '&[eventId+parentEventId],eventId,parentEventId',
      entityHeads: '&[entityId+eventId],entityId,eventId',
      outbox: '&objectId,state,nextAttemptAt,createdAt',
      inboxObjects: '&objectId,state,receivedAt',
      conflicts: '&entityId,createdAt,resolvedAt',
      attachments: '&attachmentId,entityId,state',
      attachmentChunks: '&objectId,attachmentId,[attachmentId+index],state',
      syncState: '&key',
      keyMaterial: '&key',
      migrations: '&id,appliedAt',
      diagnostics: '&id,code,createdAt',
    });
    this.version(2).stores({diveImages:'&id,account,createdAt'});
  }
}

export const zeustekDb = new ZeustekDatabase();
