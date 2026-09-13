# Zeustek private PWA implementation status

This repository follows `ZEUSTEK_PRIVATE_PWA_BUILD_SPEC_v1.0.docx` in its mandatory development order.

## Implemented in this revision

- Installable black/greyscale/neon-orange PWA identity and safe-area-aware responsive shell.
- Custom Workbox `injectManifest` service worker. Application assets are cached; API traffic is network-only.
- `zeustek-v1` Dexie database with the specification's settings, users, entities, immutable events, event parents, entity heads, outbox, inbox, conflicts, attachment, sync, key, migration and diagnostic stores.
- Atomic local entity mutation: projection, immutable event, parent links, head transition and outbox reference commit in one IndexedDB transaction. No network request occurs inside that transaction.
- UUIDv7 identities, Lamport counter, RFC 8785 canonical JSON and SHA-256 record hashes.
- ZTO1 AES-256-GCM envelope primitives using per-object HKDF-SHA-256 keys, 96-bit random IVs, authenticated headers and deterministic gzip payloads.
- Offline Notes reference module with create, list and recoverable tombstone delete.
- Offline journal saves now use the same immutable local event core. Plaintext journal entries are no longer sent to the legacy D1 journal endpoint.
- Visible online/offline, pending outbox, conflict, local storage, replica and verified-backup status.
- Zero-knowledge relay control schema for vaults, hashed device tokens, single-use enrollments, opaque objects, encrypted Google credential storage and keyring compare-and-set metadata.
- Production security headers and privacy-safe support-bundle export.

## Provisioning required before cloud sync can be enabled

- Google Cloud project and `drive.file` OAuth client.
- Sites runtime secrets for Google OAuth, relay-token encryption, bootstrap and exact production origin.
- Owner vault setup: Argon2id passphrase worker, VMK/keyring creation and confirmed 24-word recovery phrase.
- Device enrollment and encrypted object upload/download routes.
- Dedicated home/LAN Docker agent with PostgreSQL, secondary backup path and weekly restore verification.

The UI deliberately labels cloud sync and backups as unconfigured until these items exist. It does not claim that a backup is healthy without a passing restore verification.
