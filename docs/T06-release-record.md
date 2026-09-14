# T06 — Skills & Currency release evidence

T06 COMPLETE, app1.0.19 / Sites86. Actual usage: NOT_EXPOSED. Planning envelope60 is relative complexity, not spending. T07 is NOT_STARTED; no Sol High/Astra escalation.

## Source and rollback

Preserved clean app1.0.17/T00–T05 source2228b12. Canonical project appgprj_6a91926878b48191a80d70f1681ef135, production https://zeustek-dashboard.amzeus.chatgpt.site/, PWA /?source=pwa. Immediate known-good rollback app1.0.17/Sites84, saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_4246114357dc819197c0abd730712d4e, deployment appgdep_6aa79e3e3634819197db466afdf6951d, published source5176279b4e8bdaaabc34a41cbeee90b43e329aa2. Native saved-version/deployment evidence verified before changes.

## Implementation

Integrated v1.13 T06 candidate additively. New components/skills-currency.tsx and CSS; lib/offline/skills-currency.ts; domain, shell and canonical-persistence tests. Existing dashboard navigation/mount, record identity and cloud diagnostics extended. New generic kind currency-policy only; existing skill/skill_evidence remain canonical. No D1 migration, direct event/outbox writes or second catalogue. All prior trip/dive-trip/site-overhead-profile/equipment-set/cylinder-fill/gas-analysis kinds retained.

Canonical policy aliases resolve exact Skill ID/key, unavailable references require review, duplicate policy conflicts never silently overwrite. Time-zone-aware chronology and explicit clock derive recency; future evidence is excluded. Confidence and existing competence levels retained. Evaluator labels truthfully say recorded, not independent agency verification. Nested editors reuse contained dismissal and unsaved-edit protection. Catalogue/CSV management remains the existing Settings interface.

## Verification before publication

Focused T06: 11 tests PASS across domain, shell and canonical-persistence suites. Full gate: 41 files/202 tests PASS; pnpm typecheck PASS; pnpm build PASS/PWA70 entries. Existing non-blocking build warnings unchanged. Metadata verification/rebuild recorded below after completion.

Local acceptance PASS: existing catalogue fixture create, policy create/save/reopen, canonical Dive-linked synthetic evidence save, competence/confidence/environment history, derived Current status, page reload retention. Empty evidence save disabled until a logged Dive is chosen. Policy Escape preserves protected editor and parent; explicit Cancel restores launcher focus. Keyboard focus outline visible, phone390/tablet820/desktop1280 reflow without horizontal overflow. Fixtures are explicitly labelled local tests, not real practice or certification. No production Dive was created.

## Publication and production acceptance

Metadata+T06 focused13 PASS; final typecheck/build PASS/PWA70 entries. Only version/changelog metadata and documentation followed the full202-test gate; no feature code changed. Remote canonical main2228b12 matches local baseline; native latest Sites84 reconfirmed before publication.

Original app1.0.18/Sites85 saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_d9aba16e6858819198c39c61928ef651, source3827d6c085d645355ca41b289e273e25f3505664, deployment appgdep_6aa83bb5989c81918973f3019a63525b. Version/PWA, policy/evidence retention, responsive navigation, Plans/Trips/Loadouts, T03 nested Escape and all66 Logbook checks passed. Owner acceptance then identified Group used a fixed12-name shortlist rather than Settings' configured groups. Immediate rollback to Sites84 succeeded: appgdep_6aa83cf4f124819194cbc34e444d547f, 2026-09-14T18:29:20.131817+00:00. Fresh production shell confirmed app1.0.17 and66 Logbook entries. No incomplete candidate remains authoritative.

Owner explicitly authorised the narrow repair. Existing Settings group derivation extracted unchanged into canonicalSkillGroups; both Settings and Skills & Currency call it over all canonical Skills. Custom, archived-only and future groups remain available with identical names/sorting. No database migration or record mutation. Regression includes54 synthetic configured groups, whitespace duplicates, archived-only group and future addition; local Settings/custom-group selection filters correctly without overflow. Focused T0613 PASS; repaired full41 files/204 tests PASS; typecheck PASS; metadata+T0615 PASS; final build PASS/PWA70 entries. No feature code followed the repaired full gate.

Corrected release published to the same canonical project: Sites86 saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_e4e6783d1d8c8191acd1f5e6b65ccacb; sourcebc771bfba0642041ad4f893776d50bb533e03329; deployment appgdep_6aa83eb6f0008191b58f1ad0c267bedc SUCCEEDED2026-09-14T18:36:55.612512+00:00, env revision3 preserved. Native archive sha256:eeadd3068fb17986b85a0ca1cb3b3809f4357ceb805bba6f6b76588f1a5069ec,183 files/20899840 bytes. Immediate rollback remains saved Sites84/app1.0.17.

Final production acceptance PASS: v1.0.19; exact ordered Settings/Skills group parity (52 groups in the currently synced account, rather than asserting an unobserved54); formerly missing Wreck Penetration filter shows correct canonical Skills. Synthetic Dive64 evidence retained Foundation/confidence0/Freshwater and disabled90-day/14-day policy. Protected policy Escape does not discard editable data; Cancel restores Currency policy focus. All66 Logbook cards present; existing7 Plans, redsea2027 Trip, Equipment/Loadouts/Gas and canonical SS Thistlegorm deep link/profile/media/dated observation remain usable. T03 first Escape dismisses only child profile/restores launcher, second closes Site normally. Phone390 PWA starts with closed offscreen navigation, actual Open menu exposes onscreen Skills; page/editor no horizontal overflow, new controls44px, keyboard focus solid. Tablet820/desktop1280 no overflow; unrelated Dive News20 Read links loads normally. No physical iOS/VoiceOver claim. Temporary first shells/cloud hydration and closed-menu selectors handled as test state, not passing-code rewrites. Desktop and repository progress updated. No additional feature code followed the full204-test gate; no unchanged redeployment required for documentation.

Next T07 — Technical Diving Workspace, planning65, NOT_STARTED. OWNER_BUDGET_CHECK_REQUIRED.
