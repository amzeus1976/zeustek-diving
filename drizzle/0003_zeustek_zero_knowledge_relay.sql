CREATE TABLE IF NOT EXISTS relay_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  vault_id TEXT PRIMARY KEY,
  relay_epoch TEXT NOT NULL,
  drive_root_file_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_sha256 TEXT NOT NULL UNIQUE,
  is_admin_device INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_devices_vault_active ON devices(vault_id, revoked_at);

CREATE TABLE IF NOT EXISTS enrollments (
  enrollment_id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  secret_sha256 TEXT NOT NULL,
  created_by_device_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_enrollments_expiry ON enrollments(expires_at, used_at);

CREATE TABLE IF NOT EXISTS objects (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  vault_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  cipher_sha256 TEXT NOT NULL,
  cipher_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(vault_id, object_id)
);

CREATE INDEX IF NOT EXISTS idx_objects_vault_seq ON objects(vault_id, seq);

CREATE TABLE IF NOT EXISTS oauth_credentials (
  provider TEXT PRIMARY KEY,
  encrypted_refresh_token TEXT NOT NULL,
  iv_b64u TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS keyring_pointer (
  vault_id TEXT PRIMARY KEY,
  keyring_version INTEGER NOT NULL,
  drive_file_id TEXT NOT NULL,
  object_name TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_control (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  device_id TEXT,
  status_code INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

PRAGMA optimize;
