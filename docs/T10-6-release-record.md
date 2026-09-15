# T10.6 — Synthetic Data Cleanup & Universal Edit/Delete Controls

## Candidate

- Application: 1.0.28
- Task: T10.6 only
- Canonical project: `appgprj_6a91926878b48191a80d70f1681ef135`
- Pre-release production: app1.0.27 / Sites94
- Immediate rollback saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_fc335c73e6d88191ab1337bdebffe020`
- Owner-directed rollback: app1.0.25 / Sites92 / `appgdep_6aa903fc83248191a927b8f5704052f5`
- Actual usage: NOT_EXPOSED

## Local gate

- Focused T10.6/workflow compatibility: 4 files / 19 tests PASS
- Full regression: 64 files / 334 tests PASS
- TypeScript: PASS
- Production build: PASS
- PWA precache: 68 entries
- New T10.6 source/tests targeted lint: PASS
- 390px, approximately 820px, 1024px and 1440px: PASS with no horizontal overflow
- Browser runtime/console errors and framework error overlay: none

## Implementation

- The Site Configuration scanner now inspects every canonical record kind and common nested user fields for explicit acceptance/test labels.
- Fixture cards identify the matched field/value, record kind, owning page, dependencies and a conservative recommended action.
- Nothing is preselected or removed automatically. Selected removal requires an exact typed phrase and may include only independently safe labelled children.
- Cross-record references are indexed by stable IDs. Protected history is archived/suppressed; known relationship arrays may be unlinked; ambiguous dependencies require manual review.
- All user data is searchable and filterable with compact density, details, owning-page navigation and safe metadata edit/delete/archive/unlink controls.
- All writes use the existing canonical local-first mutation, event, outbox, sync and backup path. No record kind, table, migration, router, backend or parallel store was added.
- Initial Sites95 smoke exposed three false positives caused by ordinary phrases containing “acceptance”. The generic matcher was removed, a regression test added and the entire gate rerun before final acceptance; no record was selected or changed.

## Publication

- Corrected final release: app1.0.28 / Sites96
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_f761ea5b99948191bd0577afe56850f1`
- Deployment: `appgdep_6aa93726debc8191a2d32b41359ab655` (SUCCEEDED)
- Published source: `7aeb35f0496d21769ba44b6aa352225dc5c5c0f8`
- Archive: `sha256:0e21191c940244813c96aa2289876061c82ce0d1eb2565717c65a9cbba831470` (21,688,320 bytes / 179 files)
- Immediate rollback retained: app1.0.27 / Sites94 / `appgdep_6aa92a038e3881918ee96a7f3d9fbb5f`
- Production fixture scan checked 6,177 records across all 37 canonical kinds and identified 10 conservatively matched fixtures with no default selection.
- With fresh owner confirmation, the sole dependency-free directly deletable record—currency-policy `be149e1c-a7bd-4c3e-af8f-1af2cd31d23c`—was deleted through canonical history and sync. A fresh scan confirmed 6,176 records and 9 retained fixtures.
- The remaining nine fixtures were not deleted: they require archive/suppress, unlink, or manual dependency review to protect history and references.
- Production smoke PASS: app version/changelog, Data Tools controls, fixture dependency/action display, T09 Insights, T10 Dive Planning Centre, Equipment, Trips, Dive Skills and populated Logbook. Exactly 66 Dive targets remain.
- Responsive/PWA acceptance PASS: exact build at 390/820/1024/1440px and authenticated production at compact width without horizontal overflow. The first cached PWA shell required the established bounded refresh before showing app1.0.28.
- No real owner record was selected, edited or deleted. Plan→Dive provenance, IDs, outbox/sync, backup history and existing routes remain intact.

## GitHub synchronisation

Pending exact verified production-source sync.

T11 is not started.
