# T12 release record — Dive Computer Data & Profile Import

- Status: COMPLETE
- Date: 2026-09-15
- App: 1.0.31
- Sites version: 99
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_6d599c30a2f081919eb08b56d042c3ed`
- Deployment: `appgdep_6aa9702cf4888191b782b29722302941`
- Published source: `f4299807fbd12f17570d1a464fdd12f9d41f4b49`
- Release archive: `sha256:b38312377089b704b197bfee417d99d3a54f6013701b8acca60b29b6200f02bb` (22,179,840 bytes / 183 files)
- Immediate rollback: app1.0.30 / Sites98 / `appgdep_6aa950fc27c8819186a87182f0c44d7c`
- GitHub release PR: [#25](https://github.com/amzeus1976/zeustek-diving/pull/25)
- GitHub release commit: `9adc5a64db05102f5979b9b101de15dff0d81df3`
- GitHub product merge: `c44a5a5b92a0cc16b8a41dad368ce906f7134705`
- Actual usage: NOT_EXPOSED

## Verification

- Focused T12 parser/import/matcher/shell/offline-store: 5 files / 26 tests PASS.
- Focused workflow compatibility correction: 3 files / 12 tests PASS.
- Full regression: 71 files / 370 tests PASS.
- TypeScript: PASS.
- Production build: PASS; PWA precache 70 entries.
- PWA/version gate: 2 files / 4 tests PASS.
- Strict targeted lint: PASS across all new T12 source and tests. Broader changed-file lint continues to report only the project's recorded legacy findings in shared files.
- Local interaction: staged import, explicit assignment/field decisions, profile evidence, protected Escape/focus behaviour and 390/820/1024/1440px reflow PASS.
- Full-history reference: exactly 63 Sites / 27 gases / 63 Dives / 7,718 waypoints and 63 timestamp repairs PASS; private source excluded from release and GitHub.
- Production: standalone T12 route, two-segment synthetic local parse, assignment, eight field decisions, accessible profile evidence and guarded atomic preview PASS without a canonical commit.
- Phone/PWA: compact menu starts closed, opens/closes normally, T12 remains reachable, and 375px client/scroll width shows no horizontal overflow.
- Retained routes: T09 Insights, T10 Dive Planning Centre, T11 Dive Knowledge and Site Configuration PASS; browser console errors none.
- Logbook retention: exactly 66 Dive cards remain.
- Git-object comparison: all 26 GitHub T12 product/test blobs match the production-smoked published source; zero mismatches.

## Data and compatibility

T12 adds `computer-import`, `computer-profile` and `import-resolution` through the existing generic local-first entity/event/outbox and sync path. It preserves canonical Dive IDs and owner field provenance, stores source/profile evidence privately with SHA-256 validation, and extends offline backup/restore. No second Dive store, dedicated D1 table, destructive migration or copied analytics entity was added.

T13 remains NOT_STARTED. Max and Astra are not recommended.
