# T14 resumable handover

Branch: `t14/master-forward-build`.
Latest completed checkpoint: `adb8aed` — T14 Stage 7: CPD, News and guided professional development.
Implementation checkout: `zeustek-t14-master` in the Zeus Dive project workspace. Reference material remains outside this checkout and synced `sources/` is read-only.

## Authority

Continue the approved T14 scope only. No T15, new providers or additional enhancements. No partial production releases. The latest owner instruction prioritises mandatory scope and allows deferral only of already-OPTIONAL work. Topic/public-profile/Met Office remain documented agreed capabilities; report any optional deferral explicitly, never silently omit it.

Production and rollback remain app1.0.52 / Sites124, deployment `appgdep_6ab3a2f736688191bc630fc86bf3d42e`, published source `5547a2eacdb33e2f58924b4a91efc2b91275177c`. GitHub baseline `b2e86827c19239776c80b51fc93067c7dc4b18ac`. No deployment or GitHub push has occurred during T14 implementation.

## Completed requirements and evidence

Stages 0–5, 6, 5W and 7 have checkpoints. See `progress.md`, `issue-matrix.csv`, `weather-conditions-ledger.csv` and `implementation-plan.md` for requirement-level evidence.

- Stage6 `ffe0f6f`: corrected independent/manifold supply allocation, explicit reserves/scenarios, plan-first supply UX and one full-page editor. 28 focused allocation tests plus10 protection checks; full610 tests; typecheck/build/PWA/lint pass; four widths390/820/1024/1440, console0 and overflow0.
- Stage5W `2d17b47`: normalized weather/marine/depth-specific conditions, explicit retrieval, attribution/cache/failure handling and domain configuration. 40 focused tests; full650; typecheck/build/PWA/lint pass; four widths pass. Met Office403 disabled, Copernicus absent server binding and SwellCloud approval/access remain conditional and disclosed; never simulate activation. No extra provider work is authorised.
- Stage7 `adb8aed`: immutable question maintenance and explicit advisory decisions; Certification/Bibliography/editor styling; guided resumable professional setup; canonical News identity/grouping/removal; manual-only Gmail with encrypted refresh persistence, safe diagnostics and durable bounded sync-run IDs. 23 focused tests;116files/673tests pass; typecheck/build/PWA/targeted lint pass; relevant screens/editors at all four widths, console0/overflow0. Lazy Insights also verified. No Gmail sync invoked. Mandatory live Gmail acceptance remains Stage10.
- Nine frozen files match `protected-calculations.json`. Authorised additive allocation is outside them. Any frozen change requires CALCULATION_TOUCHPOINT stop and explicit approval.
- Local protected75Dives+1GasPlan fingerprint unchanged: `221e9ff72ab5deb482b5ef0029e556c8ee7a3e667e54ff52e0671ca646411a10`. Local Plan hash `edeffbe5e65a30ac2eaa54f36562ee50e754ea53f90c9ef00d468cff2f39bebe`. These are isolated fixtures, not production counts.
- Production baseline66Dives+1GasPlan identity/content evidence is private ignored `work/t14-evidence/owner-baseline.csv`. Do not print owner data or the baseline backup (it contains an encrypted server connection record). Stage8 must exclude that record from future exports.

## Outstanding required work

1. Stage8: redacted application diagnostics; domain configuration and visible independent equipment/list/logo sections; relocate map/news settings; repair PDF/DOCX with equipment and fail-soft images; TXT/CSV/JSON common privacy model; backup secret boundary. Review/read-only paths without changing frozen helpers.
2. Stage9A: remaining complex editors, terminology/accessibility/visual consistency, closed mobile menu inert, bulky household footer removal; all MUST/SHOULD/NICE matrix rows and four viewport checks.
3. Stage9B: agreed additional topic card and disabled-by-default redacted public/API profile, after mandatory rows pass. Met Office adapter already exists in5W; verify rather than duplicate. Only designated OPTIONAL work may be deferred with an explicit reason.
4. Stage10: all retained/new/full regression, typecheck, production build/PWA/version/cache/targeted lint, protected hashes/security/privacy, all four widths and console/overflow; local production-built fixture smoke; freeze source/artifact; publish complete build once; read-only live owner66/1 identities/content verification plus ONE authorised bounded Gmail acceptance; only then GitHub PR/attach/merge and exact source tree verification. If production fails restore Sites124, verify, retain branch and do not put rejected source on main.

## Exact continuation and current work

Stage8 is underway, uncommitted. Focused export tests were written red, then9 pass for strict projection, formula-safe CSV, actual PDF bytes/DOCX XML, image failure retention, pagination and backup allowlist. New diagnostics/configuration tests were written red and await implementation. This is not a Stage8 PASS checkpoint.

Continue from current working tree; do not reset or discard it. Finish focused diagnostics/configuration models and UI, wire shared export UI/renderers, test the real backup route and domain saves, then run focused/full/typecheck/build/lint/browser/record-hash gates before the Stage8 commit. Update this handover after each checkpoint.

## Local operation and private evidence

`pnpm dev --port 5173` runs against isolated `.wrangler/state` local_seedy fixture data. Never seed production. Latest Stage7 evidence files under ignored `work/t14-evidence/stage7-*`. Use `node work/check-weather-owner-fixtures.mjs` and `node work/check-stage5-plan.mjs` for local protected fingerprints. `node work/check-weather-bundle-privacy.mjs` scans6 private server credentials against client bundles and staged diff; stage before this check. Do not expose `.dev.vars` or the credential reference file. Existing Gmail production configuration must be preserved.

Use CUA only for browser interactions. Healthy local tab8 was last on Insights; live user tab1 and private baseline tab2 are not disposable fixtures. Older QA tabs6/7 are stale; avoid them. Restore viewport override when ending verification. All writes must remain isolated local fixtures until the complete release.
