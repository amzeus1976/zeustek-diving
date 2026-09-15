# T12.2 release record — Transparent Icon Asset Split & Implementation Pass

## Complete release — 2026-09-15

- Starting authority: app 1.0.32 / Sites100 / deployment `appgdep_6aa987d09c888191920f07575f0f483a` / source `f25a804afffeeb58d3b07a245eee9c7d2c0c0bdb` / GitHub main `f5e4b08878f852a88de029637676468c7aaaf86b`.
- Released app: 1.0.33.
- Assets: 131 individual transparent PNG files; source sheets remain outside the runtime bundle. Semantic filename mismatches in the supplied automatic crops were corrected by reassigning the supplied pixels, not by regenerating artwork.
- Integration: one typed registry/resolver and one reusable responsive icon component applied across high-value Dive, Site, Equipment, Plan, Trip, certification, course, skills, technical, professional, conservation, knowledge, analytics and import surfaces.
- Accessibility: existing visible labels and control names remain authoritative; decorative images use empty alternatives and do not duplicate screen-reader speech; focus, keyboard and touch behaviour are unchanged.
- Data safety: no canonical record, record kind, schema, migration, D1 table, R2 object or persistence path changed.
- Focused tests: 1 file / 4 tests PASS.
- Full regression: 73 files / 382 tests PASS.
- TypeScript: PASS.
- Production build: PASS with 201 PWA precache entries.
- Targeted strict lint: PASS for the new icon registry, component and tests; broader pre-existing lint findings remain outside this asset-only task.
- Local responsive acceptance: 390, 820, 1024 and 1440px PASS with no horizontal overflow; phone Planned Training rendered 69 mapped course icons and retained all actions.
- Same-project publication: Sites101 / saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_5a65b52de11c8191bccd3b02cf6f5484` / deployment `appgdep_6aa99dd08c7c8191871aafa18daecc39` SUCCEEDED / published source `b9f44b2173b45b2a04c5305b1abccb05b48960c1` / archive `sha256:1c7bc758780432cad46a6c1610e7c1c4f0de82460b8e11909eba320b0b9c57a0` (36,270,080 bytes / 314 files).
- Production smoke: app1.0.33 activated after the expected one-time stale PWA shell reload; Overview, Logbook, Equipment, Sites, Dive Planning Centre, Dive Skills, Certifications, Planned Training, Dive Knowledge and Dive Computer Imports passed at phone width without horizontal overflow. Desktop Planned Training passed visual and interaction checks. Representative deployed icon assets returned HTTP 200 `image/png`. Production-origin browser errors: none.
- Retention: exactly 66 production Dive log cards remain.
- Immediate rollback: app1.0.32 / Sites100 / saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_82721151d8a48191b6af846195e0cfc5` / deployment `appgdep_6aa987d09c888191920f07575f0f483a`; app1.0.31 / Sites99 is also retained. No rollback was required.
- GitHub sync: pending the final exact-production-source PR/merge recorded after production acceptance.
- Actual usage: NOT_EXPOSED. Max/Ultra/Astra were not invoked or recommended.
- T13: NOT_STARTED.
