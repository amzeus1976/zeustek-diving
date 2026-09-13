# T03 — Wreck & Overhead

### T03 COMPLETE — 2026-09-13 Europe/London

App1.0.14 / Sites81; canonical deployment appgdep_6aa6ef025a2481918534d9af9bafdfe7 succeeded2026-09-13T18:44:33.191112+00:00. Saved version appgprj_6a91926878b48191a80d70f1681ef135~appgver_d799b0d2bb508191a275f75ec7f9da10. Published build/source commit d4734b9a6ce5952e7d724eaf4330471d5a60a7a7; archive sha256:07c6bf5215695b3d40c75f1ef0f0cb072921f9ffdccca1828e76117520ec657c. Release gate focused15 tests PASS, full31 files/155 tests PASS, typecheck PASS, final1.0.14 build PASS. Test-only fixture typing correction retested3 Escape tests; no product changes after full155 run.

Production smoke PASS: correct14 shell; actual desktop Sites navigation; SS Thistlegorm Site/editor open; first Escape closes child only and restores launch control; second Escape follows existing Site close; profile saved from existing Wreck/32m facts and reopened via canonical Site deep link; mouse/phone pointer Close keeps parent usable. Same-origin /?source=pwa, intended closed phone menu opened before Sites selection, effective391×844 phone Escape/focus/no overflow PASS. Original Site facts/source/map links and existing photos unchanged. Populated Logbook on PWA deep route retains66 Dive cards, unrelated route PASS. No physical iPhone/VoiceOver installation claim.

Production acceptance added only optional profile to existing SS Thistlegorm siteId e78409ca-78ce-45bf-8a50-98e01f17c867: featureType Wreck, depthMaxM32, other fields unrecorded. No fictional route, observation or trained details; original Site/Dive identity not changed. No deletions. Previous candidate13/Sites80 failure is closed by this narrow successful recovery, retained below as history.

Immediate rollback retained: app1.0.12/Sites79 saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_58c0abe1ec5481918904ba583d4ec11b. Original78 also retained. T03 COMPLETE after acceptance; no further repair or unchanged redeploy. Evidence docs/T03-escape-recovery.md and docs/T03-release-record.md. Actual usage NOT_EXPOSED. No Sol High/Astra recommendation. Next T04 Trips & Expeditions, planning envelope45 only, NOT_STARTED. OWNER_BUDGET_CHECK_REQUIRED.

### T03 failed candidate / safe rollback — 2026-09-13 19:35 Europe/London

No T04 work. App1.0.13/Sites80 saved from exact pushed source76c8a9fdb340b1eb70d8939929b7c9abe98251c1; canonical deployment appgdep_6aa6ec5d18588191902a34fa59c0df93 succeeded18:33:16Z. Candidate archive sha256:b83833b787d4abb92bdc9beebafaab9418dd51701985426b88f59ec65b70e031. Local targeted12 and metadata2 tests PASS; full30 files/152 tests, typecheck and final metadata build PASS.

Production version13, desktop existing SS Thistlegorm details/source/map/media links, clean Cancel/focus restoration, same-origin PWA, actual Open menu→Sites, effective391×844 phone reflow/no overflow and trained disclosure Enter/cyan focus PASS. No production records saved or deleted. Exact failed action: open profile editor inside existing Site, expand trained disclosure, press Escape. Before: AX container2 Edit wreck / overhead profile — SS Thistlegorm, focus45 trained disclosure. After: both dialogs absent; AX heading34 Dive sites, focus55 View SS Thistlegorm. Expected existing editable-dialog policy: Escape must not implicitly discard/close editable profile or parent Site. Candidate nested-cancel propagation, NOT closed-menu, stale shell or auth failure. Profile AccessibleDialog lacks containDismiss although optional T03 media viewer opts in. No repair/redeployment after failure.

Immediately restored saved79 appgprj_6a91926878b48191a80d70f1681ef135~appgver_58c0abe1ec5481918904ba583d4ec11b via deployment appgdep_6aa6ecdc4a2c8191b053ad2e061c1cdb; succeeded18:35:20.820640Z. Fresh authenticated PWA loads version1.0.12; populated Logbook with retained66 dives PASS. Original78 rollback retained; newer owner Sites79 correction not lost.

All T03 source, tests, candidate changelog, saved artifact and audit preserved. BLOCKED_DEPLOYMENT, not COMPLETE. Next owner-authorised action: narrow T03 profile nested-cancel containment plus regression checking protected editable Escape and parent survival; then appropriate gate/new candidate/same-project smoke. Do not startT04. No Astra/review invoked; deployment-failure STOP takes precedence over further repair. Actual usage NOT_EXPOSED. OWNER_BUDGET_CHECK_REQUIRED.

## Resume gate — 2026-09-13

T03 product files: app/dashboard-client.tsx, app/focus.css, app/api/media/route.ts; components/site-overhead-profile.tsx, components/media-gallery.tsx, components/accessible-dialog.tsx; lib/offline/site-overhead.ts, lib/record-identity.ts, lib/schemas/dive.site_overhead_profile.schema.json; tests/site-overhead.test.ts, tests/site-overhead-shell.test.ts; package.json, lib/app-changelog.ts. Record kind site-overhead-profile, natural key canonical siteId, optional child JSON schema; no D1 table migration, duplicate catalogue or direct event/outbox mutations. Exact newer Sites79 Skill CSV files/tests/audit also preserved; no new snag work.

Release changelog status: app1.0.13 entry remains a preserved FAILED CANDIDATE, not current known-good production. This release record logs its rollback; live changelog restored to app1.0.12/Sites79. Publication/source/audit state must not be confused with live deployment.

T00–T02 and previous snags are owner-accepted COMPLETE. T03 only, planning envelope40 relative complexity; actual usage NOT_EXPOSED. £30 ceiling controlled externally; no billing changes or Astra.

Existing old Windows checkout is1.0.3 with audit-only dirty files, preserved untouched. Current canonical GitHub main fetched and opened as linked worktree zeustek-t03-v17 of the SAME repository/project, not a replacement product. Baseline main4f8a98ca00ed6b60505774548a6a834fcf93d302, package1.0.11, imported source26f1d360916fcf3a6dcca5eb3eff99d99e21567f/Sites78. No newer work overwritten. Import's28 files/141 tests/typecheck/build already accepted; not rerun as baseline.

Canonical Sites project appgprj_6a91926878b48191a80d70f1681ef135 active/owner; current78 saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_30e54cb3da78819180db7230a61c3620 and deployment appgdep_6aa6acd49e5c81918b73c92962a12a44 succeeded2026-09-13T14:02:32.994956+00:00. This immutable saved78 is T03 rollback target. Same production https://zeustek-dashboard.amzeus.chatgpt.site/ and PWA /?source=pwa. No audience/runtime binding change.

Source map: SitesV2 RecordDetail at dashboard-client.tsx3099; canonical Site deep link siteId; Planner detail site block2323; map overlay2755. Ordinary Site facts unchanged; optional site-overhead-profile natural keysiteId, generic JSON/event/outbox APIs and existing private media. No D1 migration. Real Desktop API resolves C:/Users/amzeu/OneDrive/Desktop; both tracker summaries corrected once, historical closed-snag evidence preserved. T04–T13 unopened.

Dependency helper rejected pre-existing dual lockfiles; canonical pnpm frozen-lockfile install used without dependency/lock changes. Current build remains pnpm/Vinext.

## Preserved implementation / local verification

Optional site-overhead-profile with Site natural key, canonical JSON/event/outbox APIs; no D1 migration or duplicate Site. Six persistence tests PASS at checkpoint; shell three PASS after focused review. Site deep-link save/reopen and original Site history/hazards retention PASS. Dated observation separate; private text/SVG upload/reopen and original1000×500 contain viewer PASS. Protected dirty Close/Keep editing, keyboard disclosure/cyan focus,390/820/1280 reflow and44px controls PASS. T03-only optional shared native media viewer moves/restores focus; bounded cancellation-containment repair keeps underlying Site open on Escape. Planner typed Site picker/save/reopened read-only summary and existing map route PASS. Physical assistive-device testing not claimed.

## Newer owner source retained before publication

Full release-candidate gate PASS: pnpm test30 files/152 tests; pnpm typecheck PASS; pnpm build PASS. Focused T03/profile/dialog tests12 PASS, changelog metadata tests2 PASS. Final app1.0.13 metadata production build PASS; PWA precache69 entries. Existing non-failing Vite alias/inlineDynamicImports/chunk-size warnings retained, no unrelated build redesign. Sites/GitHub source histories joined without changing tested tree; exact newer Skill CSV source/evidence and existing GitHub docs retained. T03 checkpoint commit c75170f; no incomplete production publish.

Concurrent Sites79/app1.0.12 source840478ae71eb256597ec396eeedbacfd38e4c9e3, audit721c0f879c8e17a5d63288b075f9f2311582acaa fetched. Exact Skill CSV fix/tests/changelog/version/evidence retained without reopening its scope; GitHub documentation preserved. Fresh separate authenticated production tab shows1.0.12/healthy Overview. Audience public unchanged. Immediate pre-T03 rollback saved79: appgprj_6a91926878b48191a80d70f1681ef135~appgver_58c0abe1ec5481918904ba583d4ec11b; deployment appgdep_6aa6e9b161a08191a2eeeb67732c924c succeeded2026-09-13T18:22:48.490761+00:00. Original78 retained above; never roll the newer owner correction backwards without evidence requiring it.
