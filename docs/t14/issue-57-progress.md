# Issue #57 — whole-Dive open-circuit RMV

Owner-approved additive design: [issue comment](https://github.com/amzeus1976/zeustek-diving/issues/57#issuecomment-5837591734). The owner approved explicit cylinder inclusion with no changes to the nine frozen calculation files. The current single-cylinder `lib/gas-rates.ts` path remains byte-identical.

## Contract

- A cylinder must be explicitly marked **used** or **excluded**. Missing legacy participation is unreviewed and blocks the estimate. An excluded bailout contributes no litres.
- Only known open-circuit configurations are supported. CCR or unknown configurations block the whole-Dive estimate, even when a row is marked excluded; mixed-mode breathing cannot be represented by this method.
- At least two included cylinders need distinct IDs, positive internal litres and valid measured start/end bar. The Dive needs a positive recorded elapsed runtime and finite nonnegative average depth.
- Version `whole-dive-oc-rmv/1`: `Σ[(start−end) × internal litres] / [elapsed minutes × (1 + average depth m / 10)]`, with seawater 10 m/atm approximation. No rounding is stored. The 12 L 200→100 plus 7 L 180→80 example uses 1,900 L and yields 15.833333… L/min at 20 m over 40 min.
- This is a whole-Dive estimate, not per-cylinder/segment SAC, reserve, decompression or physiological validation. Switch depth/time alone never creates a segment rate.
- Preview is read-only. Applying a missing Dive-level value is explicit; manual/legacy values are retained. The saved estimate has a versioned input snapshot and must be reapplied if source inputs change. No bulk migration or recalculation on read.

## Local implementation checkpoint

Branch `t14/issue-57-multi-cylinder-rmv` starts from accepted app1.0.69/Sites140 GitHub main `c063306f5396077aabe15d2fa6a0b72b5db96707`. The new helper is `lib/whole-dive-oc-rmv.ts`; `DiveCylinder` and `DiveRecord` gain additive metadata in `lib/offline/dives.ts`. The Dive editor and Logbook Tools distinguish the old single-tank per-cylinder calculation from the new explicitly reviewed whole-Dive action. `lib/dive-elapsed-runtime.ts` preserves a recorded actual elapsed runtime when it differs from the bottom-time-plus-stops suggestion. No production owner record has been changed.

Focused tests were red first, then green. Exact app-source candidate gate on 2026-09-25: **144 files / 888 tests PASS**, typecheck PASS, production build/PWA PASS (427 precache entries; complete 748-icon library excluded), version/cache tests PASS within regression, targeted new-file lint PASS, six-credential client privacy scan zero matches, and the nine frozen-file hashes PASS (10 protected-boundary tests, including unchanged reserve numerics). The prior approved cylinder-ID touchpoint in `lib/offline/loadouts-gas.ts` remains at its approved hash; this issue changes none of the nine files. `git diff --check` passes. The broad legacy dashboard file has pre-existing lint debt; the changed hunk was checked separately for new findings.

Local browser exercised an unsaved two-cylinder draft, explicit use selections, manual-value protection and estimate application: 1,900 L at 12 m average over the stored actual 44 minutes yielded 19.628099173553718 L/min, with versioned provenance. The current single-cylinder path remained unchanged. At 390/820/1024/1440, the local Dive editor retained the recorded 44-minute runtime rather than replacing it with the 39-minute suggestion; there was no horizontal page overflow, completed broken image or application console error. The authenticated, production-built local shell redirects to sign-in, so the exact production artifact still requires authenticated live smoke after publication. No production owner record has been written.

## Release sequence

1. Finish code review and run focused tests, full regression, typecheck, production build/PWA, version/cache test, targeted lint, six-credential client privacy scan and all nine frozen hashes against the exact clean app1.0.70 candidate.
2. Smoke the production-built candidate locally at 390/820/1024/1440, including manual value protection, actual runtime, calculated provenance, console and page overflow. Do not save a production fixture.
3. Capture fresh live deployment/version and owner record IDs/content fingerprints. Verify Sites140 archive-backed rollback and Gmail disabled state; do not sync Gmail.
4. Publish one Sites version from the exact candidate, verify version/source/PWA/read-only routes and unchanged owner fingerprints. On a release blocker restore accepted Sites140 and report `BLOCKED_DEPLOYMENT`.
5. Only after live acceptance push/merge the exact candidate through a GitHub PR, verify main tree equals published source, comment on and close #57. Preserve this file as the durable handover.
