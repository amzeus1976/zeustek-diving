# T14 resumable handover

Branch: `t14/master-forward-build`.
Prior Stage 8 candidate: `18aa824`; rollback documentation checkpoint: `54ffc6c`. The owner-approved Gmail isolation and app1.0.54 release candidate are the current working changes. Check `git rev-parse HEAD` and `git status --short` before resuming; do not reset them.
Implementation checkout: `zeustek-t14-master` in the Zeus Dive project workspace. Reference material remains outside this checkout and synced `sources/` is read-only.

## Authority

The owner authorised **one scoped production release through Stage 8, including Stage 5W**, once all non-Gmail release/security/data gates pass. On 2026-09-24 the owner explicitly approved deferring *successful live Gmail sync* only, while preserving the failed result and disabling all live sync actions. This supersedes the earlier Gmail-success release gate and requires no repeat mailbox operation. See `scoped-release-exception.md`. No T15, new providers, plugin installs or unrelated refactoring. Non-blocking Stage 9 finishing and the optional topic/public-profile work are deferred with issue-matrix status; the public/API profile remains off. Do not describe this as the full T14 master build.

Production is restored to app1.0.52 / Sites124, published source `5547a2eacdb33e2f58924b4a91efc2b91275177c`, via recovery deployment `appgdep_6ab455d58c248191840e6ed604373586`. Its original accepted deployment was `appgdep_6ab3a2f736688191bc630fc86bf3d42e`. GitHub main remains `b2e86827c19239776c80b51fc93067c7dc4b18ac`. Sites125 was briefly deployed, failed the mandatory single Gmail acceptance, and was rolled back. See `scoped-release-attempt.md` before any continuation. No GitHub push or PR occurred.

## Completed requirements and evidence

Stages 0–5, 6, 5W and 7 have checkpoints. See `progress.md`, `issue-matrix.csv`, `weather-conditions-ledger.csv` and `implementation-plan.md` for requirement-level evidence.

- Stage6 `ffe0f6f`: corrected independent/manifold supply allocation, explicit reserves/scenarios, plan-first supply UX and one full-page editor. 28 focused allocation tests plus10 protection checks; full610 tests; typecheck/build/PWA/lint pass; four widths390/820/1024/1440, console0 and overflow0.
- Stage5W `2d17b47`: normalized weather/marine/depth-specific conditions, explicit retrieval, attribution/cache/failure handling and domain configuration. 40 focused tests; full650; typecheck/build/PWA/lint pass; four widths pass. Met Office403 disabled, Copernicus absent server binding and SwellCloud approval/access remain conditional and disclosed; never simulate activation. No extra provider work is authorised.
- Stage7 `adb8aed`: immutable question maintenance and explicit advisory decisions; Certification/Bibliography/editor styling; guided resumable professional setup; canonical News identity/grouping/removal; manual-only Gmail with encrypted refresh persistence, safe diagnostics and durable bounded sync-run IDs. 23 focused tests;116files/673tests pass; typecheck/build/PWA/targeted lint pass; relevant screens/editors at all four widths, console0/overflow0. Lazy Insights also verified. No Gmail sync was invoked at that checkpoint; the later single live acceptance failed as recorded below.
- Nine frozen files match `protected-calculations.json`. Authorised additive allocation is outside them. Any frozen change requires CALCULATION_TOUCHPOINT stop and explicit approval.
- Local protected75Dives+1GasPlan fingerprint unchanged: `221e9ff72ab5deb482b5ef0029e556c8ee7a3e667e54ff52e0671ca646411a10`. Local Plan hash `edeffbe5e65a30ac2eaa54f36562ee50e754ea53f90c9ef00d468cff2f39bebe`. These are isolated fixtures, not production counts.
- Production baseline66Dives+1GasPlan identity/content evidence is private ignored `work/t14-evidence/owner-baseline.csv`. The live pre-release backup still matches every one of its 44 record kinds and 6,363 records: aggregate SHA-256 `87ef513b7ecdabfb8af91b85140f0622633aea3b47e248b2b23efeed05d67085`. Dive hash `8f08dd00ecb3d4806cd253f81b5aa3e0133ffd0301ddeb89d022d4ea76ca361e`; Gas Plan hash `f5d274c372bc74fda7560750692f9277e987ee3610c032779539f50ca89d53f1`. Do not print owner values or the private backup (it contains an encrypted server connection record). Stage8 excludes that record from future exports.

## Current release continuation

1. Stage8 application checkpoint `ca58c72` and prior candidate `18aa824` are committed. ADMIN-01/02/03 pass; ADMIN-04 is owner-deferred optional. The guarded remaining legacy editors and household footer are named Stage9 follow-up work.
2. The previous candidate passed 121 files/697 tests, typecheck/build/PWA, targeted lint, privacy, nine protected hashes, local production-built smoke, live routes/exports and all 43 canonical owner-record fingerprints. Its failed Gmail result stays `FAILED — upstream_failure`; the owner's explicit exception applies only to successful Gmail sync. The failed deployment and rollback are in `scoped-release-attempt.md`.
3. The new bounded release lock disables live Gmail sync at the authenticated POST boundary and UI, with status `disabled`; no automatic/scheduled sync path exists. Its focused tests passed. The app version is now 1.0.54 and navigation/static caches are advanced. Complete the new exact-candidate full regression, typecheck, build/PWA, privacy, protected-hash, local/browser, owner-data and release checks. Do **not** repeat live Gmail sync.
4. Reconfirm live Sites124 and current owner fingerprints, publish the new exact source once, verify all non-Gmail production gates and the disabled sync state, then reconcile the accepted source to GitHub by PR/main tree match. On a genuine other failure, restore Sites124 and retain evidence.

## Exact continuation and current work

Stage8 is locally complete and committed at `ca58c72`. Focused real-route backups, local backup secret reviews, diagnostics, settings preservation, PDF/DOCX content, TXT/CSV/JSON and no-write GET tests pass. The initial candidate build exposed a new-account cloud-backup 500, which was fixed and re-smoked at HTTP200. The production-built local smoke created one isolated fixture Dive in Wrangler's ephemeral local D1; it did not touch the preserved Vite fixture DB or production. The final build also returned HTTP200 for shell, data, backup and service worker after that smoke server was restarted.

Next exact steps: preserve the new app1.0.54 isolation changes and this ledger, finish the full gate and commit them as one release candidate. Verify the live Sites124 rollback baseline and current owner hashes before deployment. Package and publish the new candidate through Sites, then perform read-only live smoke including the disabled Gmail control/API status, export-secret exclusion and owner-data preservation. Do not invoke `/api/gmail/sync` in production. After acceptance, create/attach the GitHub PR and verify main matches the published source. The scope amendment remains at the top of `implementation-plan.md`.

## Local operation and private evidence

`pnpm dev --port 5173` runs against isolated `.wrangler/state` local_seedy fixture data. Never seed production. Latest Stage7 evidence files under ignored `work/t14-evidence/stage7-*`. Use `node work/check-weather-owner-fixtures.mjs` and `node work/check-stage5-plan.mjs` for local protected fingerprints. `node work/check-weather-bundle-privacy.mjs` scans6 private server credentials against client bundles and staged diff; stage before this check. Do not expose `.dev.vars` or the credential reference file. Existing Gmail production configuration must be preserved.

Use CUA only for browser interactions. Healthy local tabs9/11 were used; live user tab1 and private baseline tab2 are not disposable fixtures. Tab8 crashed earlier; avoid it. Browser viewport override was reset. All writes must remain isolated local fixtures until the authorised complete scoped release. Wrangler production-build smoke runs on local port8787 with an isolated local D1 and a fixture auth header; local dev runs on5173.
