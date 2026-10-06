# Dive Plan typing latency — 6 October 2026

Scope: urgent text-entry delay only. Accepted Sites174 / app1.0.102 / cache49, source b68323877ea9608dd4e755a4ca63a0fd8c18b056; GitHub main fd974785d887f72c285ba699a89420e398ca9416. Feature branch fix/dive-plan-typing preserves accepted source. No owner writes, provider checks, Gmail, public-profile or key operations.

## Checkpoints

- Baseline: native site active, owner role, public audience, latest174. Current main fetched and clean before new tests. Native workflow opened and verified existing source; credential kept only in session memory.
- RED: tests/conditions-formatting-performance.test.tsx; genuine 2 failures / 1 pass, typing-red-valid.log. The 840-reading actual ConditionsView creates 8,395 Intl.DateTimeFormat instances, exceeding the two distinct zones. Bounded cache retention fails too; DST/UTC/null compatibility passes. Earlier invalid-fixture test logs are retained but rejected as RED evidence.
- Implementation pending: bounded timezone-only formatter cache, isolate unchanged saved weather view from unrelated editor keystrokes. Preserve account boundaries, current readings and freshness timer.
- Verification pending: focused + full regression, typecheck, production build/PWA, relevant lint, privacy, nine protected hashes; compiled browser typing/Save/reopen on dummy records; six effective widths.
- Release pending: fresh read-only owner backup/fingerprints and recoverable174 artifact, exact source freeze/package, one publication, read-only production acceptance, exact GitHub PR/main reconciliation.
- Approval: urgent repair and publication already authorised. No protected byte changes proposed or needed. No production record Save/Delete.
