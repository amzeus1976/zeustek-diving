# Cylinder inspection schedule and ID #02 hotfix — 2026-09-25

## Source and owner-data baseline

- Isolated branch: `hotfix/cylinder-inspection-schedule`, created from accepted live source `d581ebfd9e6ca475c8256f7e0dd84952de2727fc` (app1.0.58 / Sites130). Unpublished Stage 9 work remains separately preserved at `aa92636` on `t14/issue-53-stage9`; saved Sites134 is not live.
- Verified recovery target: Sites130 saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_a844a76e54c88191af4c261d8a1b2eae`, successful deployment `appgdep_6ab6776076908191ab16bdbc7a33de5e`. Verify again immediately before publication.
- Fresh read-only owner snapshot before release: 6,401 active backup rows, 66 Dives, one Gas Plan. Cylinder IDs are #01 (legacy Equipment), #03 and #04 (canonical Cylinders). No active record has #02. The owner added #04 during this investigation; never reset it. Per-record fingerprints are retained privately in the active release session for comparison; no owner data is written for this fix.
- Owner decision: keep #03 and #04; assign unused #02 to the next new cylinder. There is no #02 owner record to delete.

## Root cause and bounded change

- `deriveCylinderInspectionSchedule` correctly refuses to invent hydro evidence from a visual inspection. The editor previously used its verified `hydroDueAt` directly, so visual-only October 2024 showed a blank hydro field despite the next scheduled test being hydro + visual in April 2027.
- A separate display-only next-test projection now shows hydro within 30 months after a visual, never later than an earlier recorded hydro deadline. It does not save an invented previous hydro date or make an unevidenced cylinder Ready for gas planning. The editor labels this **Next hydro (schedule)** and explains the evidence distinction.
- Cylinder ID creation used highest + 1. It now chooses the first free two-digit ID while reserving all existing active and retired IDs. Existing IDs are not renumbered. Missing or duplicate legacy IDs are repaired using unoccupied slots only, in stable record order; no bulk owner-data migration is part of the release.
- The ID allocator resides in `lib/offline/loadouts-gas.ts`, one of the nine protected files. **CALCULATION_TOUCHPOINT:** original SHA-256 `0e4e7054e7c858e351ad5a9b6a4130d08e108e114a57001294c9d9a41fb94104`; owner-approved ID-only SHA-256 `baf89475637c4fe92bb0d2cbab97c52d673c037258b24254c65d64ea6d17948a`. The owner explicitly approved this bounded touchpoint in the current task. The eight other protected files and all gas/NDL/MOD/PPO2/time/reserve calculation functions remain byte-identical.
- UK HSE guidance calls for periodic inspection of steel/aluminium diving cylinders at least every 2.5 years, subject to stricter applicable guidance. This software schedule is not a substitute for recorded test evidence or an inspector's assessment: https://www.hse.gov.uk/diving/faqs.htm

## Candidate gate

- Candidate version: app1.0.63. Versions 1.0.59–1.0.62 were used in saved but unaccepted intermediate Sites versions; app1.0.63 avoids reusing their application label. Navigation/static PWA caches advance to v9/v8.
- Focused persistence and gas-planner tests: 24/24 PASS, including visual-only preview, no invented hydro evidence, known earlier deadline and unused ID #02.
- Full regression: 132 files, 765 tests PASS, including the updated approved protected-file hash assertion.
- Typecheck PASS; production build/PWA PASS; targeted lint PASS; bundle privacy scan checks 78 client files against six local private values with zero matches.
- PWA: 429 precache entries; 17 selected complete-library icons, not the full 748. Version/cache check PASS.
- Isolated local browser: visual-only October 2024 previews **Next hydro Apr 2027** and visual due Apr 2027 without saving a record. Page-level overflow 0 at 390/820/1024/1440; application console errors 0. Discarded the unsaved fixture.

## Remaining release steps

1. Freeze and commit exact candidate; check clean tree, protected hashes and privacy once more.
2. Refresh the current production version, recovery target and owner per-record baseline. Build/push exact candidate to the Sites source repository, save one version and deploy that saved version only.
3. Read-only live smoke: app/Sites/source, cylinder editor preview, ID #02 gap retained until next owner-created tank, PWA/cache, responsive/console, owner IDs/content and protected hashes. Do not create a synthetic production tank or run Gmail sync.
4. On failure, restore verified Sites130 and report `BLOCKED_DEPLOYMENT`. On success, reconcile exact accepted source to GitHub by PR/main tree match, then resume the preserved Stage 9 branch on top of the accepted hotfix.
