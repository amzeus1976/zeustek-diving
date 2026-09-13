# SNAG-SKILL-004 release record

## Release identity

- Status: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE
- App version: 1.0.12
- Source commit: `840478ae71eb256597ec396eeedbacfd38e4c9e3`
- Sites release: 79
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_58c0abe1ec5481918904ba583d4ec11b`
- Deployment: `appgdep_6aa6e9b161a08191a2eeeb67732c924c`
- Production origin: https://zeustek-dashboard.amzeus.chatgpt.site/

## Corrective result

- The normal CSV import preview now renders the matched canonical Skill name and group.
- The canonical Skill ID remains in preview state for exact identity and mutation targeting but is no longer rendered as an ordinary matched-Skill label.
- No technical-details disclosure was added because hiding the implementation ID was the smaller, clearer presentation change.
- Unknown-ID / REVIEW_REQUIRED diagnostics remain explicit and unchanged.
- The CSV schema, exported `skill_id`, exact-ID matching, deterministic UPDATE, ARCHIVE/RESTORE, duplicate protection and all canonical Skill IDs are unchanged.
- The directly affected Skill Catalogue/CSV preview code contains no other implementation-only ID rendered as an ordinary label.

## Verification

- Targeted Skill/CSV/UI regression: 4 files / 30 tests passed.
- Full regression: 28 files / 143 tests passed.
- TypeScript: passed.
- Production build: passed.
- PWA precache: 69 entries.
- Deployment/version smoke: passed. Sites confirms release 79 is current, the deployment succeeded at 2026-09-13T18:21:50Z, and the saved source matches the commit above.
- Authenticated product smoke: BLOCKED_ACCESS. The owner's signed-in in-app browser is not controllable from this environment, so CSV preview interaction and unrelated-route acceptance require owner confirmation.

## Rollback and closure

- Rollback checkpoint: owner-accepted app 1.0.11 / Sites78.
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_30e54cb3da78819180db7230a61c3620`.
- Deployment: `appgdep_6aa6acd49e5c81918b73c92962a12a44`.
- No rollback was required.
- SNAG-SKILL-004 remains pending owner acceptance and is not marked CLOSED.
- Astra invoked: no.
- Actual usage: NOT_EXPOSED.
