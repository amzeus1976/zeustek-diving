# Overview layout repair — app1.0.58 candidate

## Defect and bounded fix

The owner screenshot showed My Profile and Top Dive Buddy values wrapping one character per line at a 1036-pixel desktop viewport. Browser measurement of Sites129 found each card around 190 pixels wide while its detail row reserved a 144-pixel label track plus a 16-pixel gap, leaving the value track at **0 pixels**. The Next Dive weather note and action were both inline and crowded one line.

The candidate stacks the two cards from 1001 through 1240 pixels, preserving the weather rail and all record values. The weather note and action now occupy separate lines. This is CSS-only product behavior; app version and service-worker cache names advance for reliable delivery. Current GitHub main's non-application documentation and issue templates were merged into the local branch before the candidate was frozen, so the later PR can preserve them.

## Local verification

- Pre-fix live browser check at 1036 pixels: both detail value tracks **0 px**, failed the 90-pixel readability threshold.
- Post-fix local browser check: profile/buddy value tracks 152/152 px at 390; 163/163 at 820; 186/186 at 1024; 198/198 at 1036; 303/303 at 1200; 94/94 at 1240; 174/174 at 1440. Next Dive note ends above its action at every checked width. Page overflow 0 and application console errors 0.
- Full regression: 132 files, 763 tests PASS. Typecheck PASS. Targeted TypeScript lint PASS. Production build and PWA PASS; 429 precache entries, complete icon library excluded. Release/cache tests and all nine protected calculation checks are included in the regression. Bundle privacy scan: 78 client files, six private credentials checked, zero matches.
- Fresh live pre-release owner snapshot: 6,400 cloud records including 66 Dives, one Gas Plan, 11 People and five Operators. Seventeen ordered-content fingerprint chunks over the canonical backup's records array are retained in the active browser comparison state for post-release exact comparison. Five Operators is current owner activity, not a migration target.
- Confirmed Sites129's saved source and successful deployment; its archive-backed version is the rollback target.

## Remaining release steps

Commit the exact candidate, recheck its clean status and current owner baseline, push it to the existing Sites source repository, save one production version with its matching built archive, and deploy once. Verify the live layout/version/PWA, routes, data fingerprints, console/overflow and protected hashes. Do not run Gmail sync or write owner records. On acceptance, reconcile the exact source through GitHub PR/main. If production verification fails, restore verified Sites129 and retain the candidate and evidence.
