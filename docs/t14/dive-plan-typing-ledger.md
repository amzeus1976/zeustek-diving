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
