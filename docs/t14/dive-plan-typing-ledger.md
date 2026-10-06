# Dive Plan typing latency — 6 October 2026

Scope: urgent text-entry delay only. Accepted Sites174 / app1.0.102 / cache49, source b68323877ea9608dd4e755a4ca63a0fd8c18b056; GitHub main fd974785d887f72c285ba699a89420e398ca9416. Feature branch fix/dive-plan-typing preserves accepted source. No owner writes, provider checks, Gmail, public-profile or key operations.

## Checkpoints

- Baseline: native site active, owner role, public audience, latest174. Current main fetched and clean before new tests. Native workflow opened and verified existing source; credential kept only in session memory.
- RED: tests/conditions-formatting-performance.test.tsx; genuine 2 failures / 1 pass, typing-red-valid.log. The 840-reading actual ConditionsView creates 8,395 Intl.DateTimeFormat instances, exceeding the two distinct zones. Bounded cache retention fails too; DST/UTC/null compatibility passes. Earlier invalid-fixture test logs are retained but rejected as RED evidence.
- Implementation pending: bounded timezone-only formatter cache, isolate unchanged saved weather view from unrelated editor keystrokes. Preserve account boundaries, current readings and freshness timer.
- Verification pending: focused + full regression, typecheck, production build/PWA, relevant lint, privacy, nine protected hashes; compiled browser typing/Save/reopen on dummy records; six effective widths.
- Release pending: fresh read-only owner backup/fingerprints and recoverable174 artifact, exact source freeze/package, one publication, read-only production acceptance, exact GitHub PR/main reconciliation.
- Approval: urgent repair and publication already authorised. No protected byte changes proposed or needed. No production record Save/Delete.

## Implementation / gates in progress

RED checkpoint ed69c40. Narrow implementation reuses at most sixteen timezone-only formatters and memoises the saved weather panel with account/snapshot props; account changes remount its private comparison evidence. Minute freshness updates remain inside the panel. Conditions selection, request matching, saved snapshots and calculation bytes remain unchanged.

Focused33/6 PASS; full1709/248 PASS; typecheck PASS; nine approved hashes unchanged. Targeted lint101 retained findings/0 new or changed. Whole-tree lint1125 findings is retained separately as broader historical evidence, not called clean. New Sites build wrapper rejects the repository's two pre-existing lockfile families; preserve both and run the existing exact prebuild/Vinext build instead. No package/dependency changes.

Fresh6Oct baseline6541 canonical rows, fingerprint3b5b3599db0d3ba30b3da686b888dacf564c436f4a720f5eb75aba61ee776b57, zero missing relationship endpoints and encrypted recovery verified. Corrected inspection unpacks conditionsV1Packed: the two operational owner Plans contain1184/2353 readings (669947/1507989 expanded bytes). The earlier direct-only reading count is rejected. Temporary live typing test:3chars2399ms including browser-control overhead; discarded, no Save. Compiled2352-reading dummy baseline stalled before entering the full three-character sequence; command deadline, only initial space present, discarded. Do not turn this into an invented10–15s measurement.

Issue95 tracks this fix. Native174 rollback artifact verified6Oct, sourceb6832387, stored hash6091de307bc623630e1c9f9fd21cfb629d15b59126fc3e2d39624777c89c3726. Build/compiled/browser gates and release pending.

## Accepted release — complete

App1.0.103 / Sites175 / cache50 / source85eae436ddbd10dd8703feb3908350ea64f30284 accepted6Oct after succeeded deploymentappgdep_6ac4aa4fedb88191aca5d1959a9d68af. Read sites175-typing-release-evidence.json. Compiled2352-reading dummy typing, Unicode immediate Save/reopen and actual replacement weather all pass. Six actual compiled editor widths and six actual live widths pass; live three-character sequences250–317ms including browser-control overhead, every character retained. Both live operational Plans tested and every temporary edit discarded. Fresh live console0warnings/errors. Historical auth SDK warning is separately excluded.

All6541 canonical owner rows/IDs/content/timestamps match before/after, fingerprint3b5b3599db0d3ba30b3da686b888dacf564c436f4a720f5eb75aba61ee776b57; all9protected hashes unchanged. Full1709/248, focused33/6, typecheck, build/PWA422, privacy and scoped lint gates pass as recorded. Broad lint remains historical1125 findings, scoped101unchanged/0new; no rule suppression.

Complete-head review6011888273 has0major findings and0unresolved threads. PR96 merged after production acceptance. Main39de587b8f6bf9dd0d5d3f2d14e8196f88bcbb9e and published85eae436 have identical tree42349629fef26f5edc60368a4f7dba33a06b1f55. Verified rollback is174/app102 with stored artifact6091de30. Failed wrapper attempts preserved privately; no failed candidate deployment. Final evidence is on separate evidence/dive-plan-typing-sites175-2026-10-06 branch, leaving published/main source exact.

Issue95 complete; no remaining action for this bounded fix. Gmail/provider integration exceptions remain separate: no token, provider, Google Calendar, API-key or public-profile operation occurred. Do not continue Task5, T15 or unrelated work.
