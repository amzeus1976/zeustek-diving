# T14 resumable handover

Branch: `t14/master-forward-build`.
Latest completed checkpoint: `adb8aed` — T14 Stage 7. Stage 8 is locally complete in the working tree; its checkpoint commit is the next source action.
Implementation checkout: `zeustek-t14-master` in the Zeus Dive project workspace. Reference material remains outside this checkout and synced `sources/` is read-only.

## Authority

The owner authorised **one scoped production release through Stage 8, including Stage 5W**, once all release/security/data gates pass. This explicitly supersedes the old all-Stages-before-production hold. No T15, new providers, plugin installs or unrelated refactoring. Non-blocking Stage 9 finishing and the optional topic/public-profile work are deferred with issue-matrix status; the public/API profile remains off. Do not describe this as the full T14 master build.

Production and rollback remain app1.0.52 / Sites124, deployment `appgdep_6ab3a2f736688191bc630fc86bf3d42e`, published source `5547a2eacdb33e2f58924b4a91efc2b91275177c`. GitHub baseline `b2e86827c19239776c80b51fc93067c7dc4b18ac`. No deployment or GitHub push has occurred during T14 implementation.

## Completed requirements and evidence

Stages 0–5, 6, 5W and 7 have checkpoints. See `progress.md`, `issue-matrix.csv`, `weather-conditions-ledger.csv` and `implementation-plan.md` for requirement-level evidence.

- Stage6 `ffe0f6f`: corrected independent/manifold supply allocation, explicit reserves/scenarios, plan-first supply UX and one full-page editor. 28 focused allocation tests plus10 protection checks; full610 tests; typecheck/build/PWA/lint pass; four widths390/820/1024/1440, console0 and overflow0.
- Stage5W `2d17b47`: normalized weather/marine/depth-specific conditions, explicit retrieval, attribution/cache/failure handling and domain configuration. 40 focused tests; full650; typecheck/build/PWA/lint pass; four widths pass. Met Office403 disabled, Copernicus absent server binding and SwellCloud approval/access remain conditional and disclosed; never simulate activation. No extra provider work is authorised.
- Stage7 `adb8aed`: immutable question maintenance and explicit advisory decisions; Certification/Bibliography/editor styling; guided resumable professional setup; canonical News identity/grouping/removal; manual-only Gmail with encrypted refresh persistence, safe diagnostics and durable bounded sync-run IDs. 23 focused tests;116files/673tests pass; typecheck/build/PWA/targeted lint pass; relevant screens/editors at all four widths, console0/overflow0. Lazy Insights also verified. No Gmail sync invoked. Mandatory live Gmail acceptance remains Stage10.
- Nine frozen files match `protected-calculations.json`. Authorised additive allocation is outside them. Any frozen change requires CALCULATION_TOUCHPOINT stop and explicit approval.
- Local protected75Dives+1GasPlan fingerprint unchanged: `221e9ff72ab5deb482b5ef0029e556c8ee7a3e667e54ff52e0671ca646411a10`. Local Plan hash `edeffbe5e65a30ac2eaa54f36562ee50e754ea53f90c9ef00d468cff2f39bebe`. These are isolated fixtures, not production counts.
- Production baseline66Dives+1GasPlan identity/content evidence is private ignored `work/t14-evidence/owner-baseline.csv`. The live pre-release backup still matches every one of its 44 record kinds and 6,363 records: aggregate SHA-256 `87ef513b7ecdabfb8af91b85140f0622633aea3b47e248b2b23efeed05d67085`. Dive hash `8f08dd00ecb3d4806cd253f81b5aa3e0133ffd0301ddeb89d022d4ea76ca361e`; Gas Plan hash `f5d274c372bc74fda7560750692f9277e987ee3610c032779539f50ca89d53f1`. Do not print owner values or the private backup (it contains an encrypted server connection record). Stage8 excludes that record from future exports.

## Outstanding required work

1. Commit the locally complete Stage 8 checkpoint and record its exact SHA. Stage8 requirements ADMIN-01/02/03 pass locally; ADMIN-04 is owner-deferred optional. See `stage8-admin-export-boundary.md` and the Stage8 `progress.md` entry. The guarded remaining legacy editors and household footer are a named Stage9 follow-up, not part of this scoped release.
2. Complete the final candidate acceptance audit: staged secret scan, frozen hashes, full regression/typecheck/build/PWA/version/cache/targeted lint, four widths, console/overflow, production-built isolated smoke and owner-data fingerprints. Current local evidence is 121 files/697 tests, typecheck/build/PWA pass, 24 Stage8 focused tests, 8 routes at four widths with overflow0/console0, nine frozen hashes unchanged, and local75Dives+1GasPlan unchanged. Re-run anything affected by edits after checkpoint.
3. Freeze commit/artifact, confirm live Sites124 and GitHub main unchanged, and confirm Sites124 rollback readiness and production owner66Dives+1GasPlan identities/content. Do not print or commit private backup values. No live Gmail sync has run; review durable sync status before invocation.
4. Publish **one** scoped release to the existing Sites project, do read-only live smoke and owner-data checks, then the separately authorised **one** bounded Gmail acceptance sync at its designated point. Never repeat solely for a passing result; on failure preserve diagnostics and stop further mailbox operations. Verify expected newsletter/connection metadata separately from canonical protected records.
5. Only after production acceptance, create/attach the GitHub PR, merge/reconcile the exact accepted source, and verify main/source match. If deployment fails, restore healthy app1.0.52/Sites124, verify, retain branch/evidence, and report BLOCKED_DEPLOYMENT. Do not sync rejected source to main.

## Exact continuation and current work

Stage8 is locally complete but not yet committed. **Do not reset the working tree.** Focused real-route backups, local backup secret reviews, diagnostics, settings preservation, PDF/DOCX content, TXT/CSV/JSON and no-write GET tests pass. The initial candidate build exposed a new-account cloud-backup 500, which was fixed and re-smoked at HTTP200. The production-built local smoke created one isolated fixture Dive in Wrangler's local D1; it did not touch the preserved Vite fixture DB or production.

Next exact commands: `git status --short`, stage only intended source/docs/tests, run `node work/check-weather-bundle-privacy.mjs` against staged diff, verify nine hashes from `protected-calculations.json`, `pnpm test`, `pnpm typecheck`, `pnpm build`, targeted lint, then commit Stage8. Reconfirm Sites124 via @Sites and main SHA via @GitHub immediately before release freeze. The scope amendment is at the top of `implementation-plan.md`.

## Local operation and private evidence

`pnpm dev --port 5173` runs against isolated `.wrangler/state` local_seedy fixture data. Never seed production. Latest Stage7 evidence files under ignored `work/t14-evidence/stage7-*`. Use `node work/check-weather-owner-fixtures.mjs` and `node work/check-stage5-plan.mjs` for local protected fingerprints. `node work/check-weather-bundle-privacy.mjs` scans6 private server credentials against client bundles and staged diff; stage before this check. Do not expose `.dev.vars` or the credential reference file. Existing Gmail production configuration must be preserved.

Use CUA only for browser interactions. Healthy local tabs9/11 were used; live user tab1 and private baseline tab2 are not disposable fixtures. Tab8 crashed earlier; avoid it. Browser viewport override was reset. All writes must remain isolated local fixtures until the authorised complete scoped release. Wrangler production-build smoke runs on local port8787 with an isolated local D1 and a fixture auth header; local dev runs on5173.
