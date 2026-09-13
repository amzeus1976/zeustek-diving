import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const captures = sqliteTable('captures', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  content: text('content').notNull(),
  claimType: text('claim_type').notNull().default('observation'),
  storagePolicy: text('storage_policy').notNull().default('cloud'),
  createdAt: integer('created_at').notNull(),
});

export const imports = sqliteTable('imports', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  category: text('category').notNull(),
  fileName: text('file_name').notNull(),
  objectKey: text('object_key').notNull(),
  contentType: text('content_type').notNull(),
  size: integer('size').notNull(),
  status: text('status').notNull().default('uploaded'),
  createdAt: integer('created_at').notNull(),
});

export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(),
  occurredAt: integer('occurred_at').notNull(), timezone: text('timezone').notNull(),
  title: text('title'), rating: integer('rating'), status: text('status').notNull().default('published'),
  createdAt: integer('created_at').notNull(),
});

export const journalRevisions = sqliteTable('journal_revisions', {
  id: text('id').primaryKey(), entryId: text('entry_id').notNull(),
  revisionNumber: integer('revision_number').notNull(), baseRevisionId: text('base_revision_id'),
  clientRevisionId: text('client_revision_id').notNull(), origin: text('origin').notNull(),
  contentFormat: text('content_format').notNull(), content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const diveRecords = sqliteTable('dive_records', {
  id: text('id').primaryKey(), userId: text('user_id').notNull(), kind: text('kind').notNull(),
  dataJson: text('data_json').notNull(), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(), deletedAt: integer('deleted_at'),
});

export const diveHouseholds = sqliteTable('dive_households', {
  id: text('id').primaryKey(), ownerUserId: text('owner_user_id'), createdAt: integer('created_at').notNull(),
});

export const diveHouseholdMembers = sqliteTable('dive_household_members', {
  householdId: text('household_id').notNull(), userId: text('user_id'), email: text('email').notNull(),
  displayName: text('display_name').notNull(), role: text('role').notNull(), joinedAt: integer('joined_at'),
}, (table) => [primaryKey({ columns:[table.householdId,table.email] }), uniqueIndex('idx_dive_household_members_user').on(table.userId)]);

export const diveHouseholdShares = sqliteTable('dive_household_shares', {
  householdId: text('household_id').notNull(), ownerUserId: text('owner_user_id').notNull(), area: text('area').notNull(),
  canView: integer('can_view').notNull().default(0), canEdit: integer('can_edit').notNull().default(0), updatedAt: integer('updated_at').notNull(),
}, (table) => [primaryKey({ columns:[table.householdId,table.ownerUserId,table.area] }), index('idx_dive_household_shares_owner').on(table.ownerUserId,table.area)]);

// Relay tables contain transport/control metadata only. Decrypted user content
// and vault keys must never be written to D1.
export const relayState = sqliteTable('relay_state', {
  key: text('key').primaryKey(), value: text('value').notNull(), updatedAt: integer('updated_at').notNull(),
});

export const relayVaults = sqliteTable('vaults', {
  vaultId: text('vault_id').primaryKey(), relayEpoch: text('relay_epoch').notNull(),
  driveRootFileId: text('drive_root_file_id'), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});

export const relayDevices = sqliteTable('devices', {
  deviceId: text('device_id').primaryKey(), vaultId: text('vault_id').notNull(), userId: text('user_id').notNull(),
  tokenSha256: text('token_sha256').notNull().unique(), isAdminDevice: integer('is_admin_device').notNull().default(0),
  createdAt: integer('created_at').notNull(), lastSeenAt: integer('last_seen_at'), revokedAt: integer('revoked_at'),
});

export const relayObjects = sqliteTable('objects', {
  seq: integer('seq').primaryKey({ autoIncrement: true }), vaultId: text('vault_id').notNull(), objectId: text('object_id').notNull(),
  driveFileId: text('drive_file_id').notNull(), cipherSha256: text('cipher_sha256').notNull(), cipherBytes: integer('cipher_bytes').notNull(), createdAt: integer('created_at').notNull(),
});
