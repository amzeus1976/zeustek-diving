CREATE TABLE IF NOT EXISTS padi_sync_settings (
  user_id TEXT PRIMARY KEY,
  affiliate_id TEXT NOT NULL,
  last_synced_at INTEGER,
  last_count INTEGER NOT NULL DEFAULT 0
);
