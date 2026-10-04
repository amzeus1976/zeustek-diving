# Sites146 rejected attempt and verified recovery — 4 October2026

## State and authority

The complete combined candidate74436f6b17b2df96b69395fad945ca67ba13ad8f (app1.0.74 / cachev21) was deployed to Sites146, deploymentappgdep_6ac2861f3fd48191b400908f8e35c9e9, and passed the previously recorded local/live checks. Final PR91 automatic review then found two confirmed gaps. Its provisional acceptance is REJECTED; do not merge74436f6 into accepted GitHub main or present its passing1388 tests as evidence for corrected code.

Production was restored to the actual verified accepted **app1.0.73 / Sites145**, source67c9706171ece312699c2c352fd94d5163137ee5. Native recovery succeeded at **2026-10-04T17:43:21.488740+00:00**, deployment **appgdep_6ac290249c1c8191a41d26c0a437c7d2**, same saved version and environmentrevision6/all17bindings. Live Overview shows version1.0.73. No data restoration, canonical rewrite, secret change or Gmail operation occurred.

## Confirmed defects and bounded correction

- R01: newly persisted private Person `favourite` survives householdPersonProjection and household copy. Remove it before exposure/copy; original owner Person remains unchanged. Add true/false preference omission, nonmutation and normal human-data retention tests.
- R02: saveDiveSkillBatch preserves partial success in persistence, but DiveSkillBatchEditor reports successful IDs to its parent only when the entire batch succeeds. Closing failed drafts refreshes evidence but not the parent's debrief IDs. Deliver successful IDs to the parent immediately without closing failed drafts; keep independent retries and dirty Cancel. Add actual partial persistence plus callback/Cancel/final retry tests.

No frozen calculation, dependency or schema change is required. No new feature or provider. Preserve every completed requirement and all prior evidence.

## Exact next steps

Write focused regression tests before bounded fixes; capture expected failures. Correct R01/R02 and derive a fresh app/cache version. Run focused suites, full regression/typecheck/build/PWA/lint/privacy, all9 hashes and six-width real compiled browser gates, including partial-save/cancel. Freeze a clean reproducible candidate, preserve encrypted fresh owner snapshot and source bundle, then publish the complete corrected scope. Production acceptance stays read-only; no Gmail or synthetic owner record. Retain Sites145 recovery. Only after final acceptance push corrected source to PR91, complete review/merge and verify main's exact full tree.

The old work/overview-weather-buddy/production-acceptance.json is superseded by this rejection. Preserve it as historical evidence, not current acceptance. The preparatory write-release-docs.py draft was never executed and must be revised to actual corrected identities before use. Separate documentation branch t14/sites146-release-evidence remains at74436f6; it was not pushed or merged. Current product work branch t14/overview-weather-buddy resumes that exact local architecture. GitHub main remains4df0df63cea1e45c4b6159276def8c51127c987b; PR91 is draft with rejection/rollback evidence.

