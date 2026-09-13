# T03 Escape recovery — 2026-09-13

Owner-authorised ONE local repair of preserved T03. Production remains app1.0.12/Sites79 until release gate; rollback saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_58c0abe1ec5481918904ba583d4ec11b. Prior healthy rollback deployment appgdep_6aa6ecdc4a2c8191b053ad2e061c1cdb. No T04/Astra/architecture/persistence redesign.

Root cause: React nested dialog cancel bubbles into read-only Site's AccessibleDialog. Child editable policy previously prevented its own implicit dismissal but did not contain parent cancellation. Narrow repair ONLY in site-overhead-profile.tsx: local keydown boundary checks target's nearest dialog is this editor, prevents native Escape default and propagation, clicks existing explicit Close button. Existing dirty capture/confirmation and cleanup focus restoration reused. Existing containDismiss option enabled for fallback cancel. Shared AccessibleDialog unchanged.

Owner's latest expected behaviour supersedes earlier blocked-note expectation for clean profile Escape: clean first Escape closes child only; dirty Escape invokes existing discard confirmation instead of silently losing edits.

Focused regression tests: site-overhead-escape.test.ts tests local event contract, topmost guard, first/second Escape ordering and dirty Close protection without adding browser dependencies. Native browser integration verified separately:

1. Existing fixture Site card open via original canonical siteId deep link; saved feature Exterior wreck fixture, depth18–34, history/hazards unchanged.
2. Click Edit wreck profile; both native dialogs open.
3. Escape once → only Site dialog open; active element Edit wreck profile. PASS.
4. Escape second → no dialogs open, existing Site dismissal. PASS.
5. Reopen Site/editor → original saved values retained. PASS.
6. Mouse Close wreck profile editor → Site stays open, focus Edit wreck profile. PASS.

Focused15 tests PASS; new Escape3 also PASS after test-only typing correction. Full pnpm test31 files/155 tests PASS. Typecheck initially flagged only incompatible test fixture cast; fixture made type-correct with same distinct-object semantics, Escape3 retested, pnpm typecheck PASS. No product changes after full155 test run; no unnecessary broad repeat. Final app1.0.14 pnpm build PASS. Existing nonfatal build warnings retained.

Candidate1.0.14 changelog published;1.0.13 explicitly marked rolled-back candidate. Single repair succeeded locally and in production; no Sol High/Astra recommended.

### T03 COMPLETE — 2026-09-13 Europe/London

App1.0.14 / Sites81; canonical deployment appgdep_6aa6ef025a2481918534d9af9bafdfe7 succeeded2026-09-13T18:44:33.191112+00:00. Saved version appgprj_6a91926878b48191a80d70f1681ef135~appgver_d799b0d2bb508191a275f75ec7f9da10. Published build/source commit d4734b9a6ce5952e7d724eaf4330471d5a60a7a7; archive sha256:07c6bf5215695b3d40c75f1ef0f0cb072921f9ffdccca1828e76117520ec657c. Release gate focused15 tests PASS, full31 files/155 tests PASS, typecheck PASS, final1.0.14 build PASS. Test-only fixture typing correction retested3 Escape tests; no product changes after full155 run.

Production smoke PASS: correct14 shell; actual desktop Sites navigation; SS Thistlegorm Site/editor open; first Escape closes child only and restores launch control; second Escape follows existing Site close; profile saved from existing Wreck/32m facts and reopened via canonical Site deep link; mouse/phone pointer Close keeps parent usable. Same-origin /?source=pwa, intended closed phone menu opened before Sites selection, effective391×844 phone Escape/focus/no overflow PASS. Original Site facts/source/map links and existing photos unchanged. Populated Logbook on PWA deep route retains66 Dive cards, unrelated route PASS. No physical iPhone/VoiceOver installation claim.

Production acceptance added only optional profile to existing SS Thistlegorm siteId e78409ca-78ce-45bf-8a50-98e01f17c867: featureType Wreck, depthMaxM32, other fields unrecorded. No fictional route, observation or trained details; original Site/Dive identity not changed. No deletions. Previous candidate13/Sites80 failure is closed by this narrow successful recovery, retained below as history.

Immediate rollback retained: app1.0.12/Sites79 saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_58c0abe1ec5481918904ba583d4ec11b. Original78 also retained. T03 COMPLETE after acceptance; no further repair or unchanged redeploy. Evidence docs/T03-escape-recovery.md and docs/T03-release-record.md. Actual usage NOT_EXPOSED. No Sol High/Astra recommendation. Next T04 Trips & Expeditions, planning envelope45 only, NOT_STARTED. OWNER_BUDGET_CHECK_REQUIRED.
