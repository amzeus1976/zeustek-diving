# People / Dive Entity correction — local implementation evidence

Date: 2026-09-24. Branch `t14/master-forward-build`, based on accepted scoped-release source `14a5fe8540bf6e6acc664a3ccf71df4982ae2b04`. The implementation commit is recorded in `HANDOVER.md`. No production or owner-record write was made for this correction.

## Delivered locally

- People owns human Person CRUD, roles, contact, qualifications and photos. The old “People & Operators” route remains an alias; ordinary UI says People. Historical organisation fields remain readable but are absent from normal Person editing.
- Dive Centres owns canonical `operator` records. Types cover centres, resorts, boats, liveaboards, charters, schools, clubs, shops, operators, diving accommodation and Other. Legacy types remain readable; untyped records show Unclassified.
- The owner-scoped generic store now accepts Person–Entity and Entity–Entity relationships. Shared projection shows virtual legacy Person links without migration writes; explicit links carry roles, dates, state and primary choice. Entity links canonicalise inverse directions. Both workspaces show exact-record links without cross-workspace CRUD.
- Local and cloud writes validate endpoints and stable identity; deletion guards protect links and historical references. Backup/restore validates and orders relationships, household views/copy strip private entity links, and similar names prompt review without merging.
- Person avatars use a circular viewport, nondistorting crop, drag/keyboard recenter, zoom controls, reset, replace, cancel and Save Crop; legacy image IDs remain renderable.

## Verification

- Focused tests were written red before implementation. Final local regression: **129 files, 742 tests passed**, including retained T14A, Insights, People/operator, planning, cylinder, CPD/News/Admin and new relationship/avatar/backup/household tests.
- Typecheck passed. Production build/PWA passed; final service worker precache contains 398 entries and excludes the 748 complete icons. Focused lint on new and directly changed relevant modules passed. Broad lint over older dashboard/trip/store modules reports pre-existing warnings and was not the focused gate.
- Four-width local browser checks at 390, 820, 1024 and 1440 px covered People, Dive Centres and relationship editing: no page overflow or application console errors. Exact Person deep link, legacy route alias, circular portrait/landscape crops, drag/keyboard/zoom/reset/cancel were exercised with unsaved local fixtures.
- Six private server-credential fingerprints were absent from 78 client build files and the staged diff. Nine protected calculation files match approved SHA-256 manifest: zero mismatches. The isolated 76-record Dive/Gas fixture and plan fingerprints remained unchanged (`221e9ff72ab5deb482b5ef0029e556c8ee7a3e667e54ff52e0671ca646411a10`, `edeffbe5e65a30ac2eaa54f36562ee50e754ea53f90c9ef00d468cff2f39bebe`).
- Read-only Sites inspection still showed Sites126, successful deployment `appgdep_6ab4624dfb28819193f77caf20388762`, published source `14a5fe8540bf6e6acc664a3ccf71df4982ae2b04`. GitHub main remained `3e78c8baf7aefe914592cce72f990bb3941bff27`; remote T14 branch remained on the accepted source. The documented fallback is Sites124, but any future release must reconfirm current rollback health.

## Remaining release work

This is an application-code checkpoint, **not** a production release. Reconfirm the then-current Sites version/rollback and capture fresh owner-record IDs/content fingerprints. Advance app and service-worker cache identifiers for the release, rerun exact-candidate checks and production-built smoke, review newer production/GitHub changes, and verify owner-data preservation. Only publish under an explicit release decision after all mandatory gates pass; then production-smoke and reconcile the exact accepted source to GitHub. Do not repeat the consumed Gmail live sync.

Existing Stage9 finishing, optional topic/public-profile work and conditional provider access remain separately tracked in the T14 ledger. This correction does not mark them complete.
