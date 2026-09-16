# T12.4B synthetic cleanup safety release

- Status: COMPLETE; T13 paused, T14 not started.
- Live: app 1.0.36 / Sites 104, deployment `appgdep_6aaaaea808248191af78f607ee66e502`, saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_000d4857b9a48191b5d57072618a8163`.
- Published source: `6e8b82a82f9e32db000b0b67ccfd05063ce4ddeb`.
- Immediate rollback: healthy app 1.0.34 / Sites 102, saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_faa3f76ab7708191aead460a24183dac`, restored deployment `appgdep_6aaa5707926c8191b2bbc4aa1ee2dc1c`.
- The earlier app 1.0.35 / Sites 103 candidate failed smoke because a real Liverpool wreck history mentioned “fixtures and fittings”; no record was selected or changed and that candidate was not synced to GitHub.
- Correction: explicit synthetic/acceptance/test-data fixture context is high-confidence; bare task markers are review-only; physical fixtures and routine service/medical tests are ignored. High-confidence and possible tabs are distinct.
- Focused verification: 3 test files / 22 tests passed. Full regression: 75 files / 402 tests passed. Typecheck, production build, PWA/version gate and targeted lint passed.
- Production smoke: 6,287 records across 44 kinds; 3 high-confidence records (1 cylinder fill blocked by an inbound gas-analysis reference; 2 historical equipment events offered only owner-confirmed archival), 0 possible. Zero selected, deleted, archived or unlinked. No owner record changed. Liverpool remains in all-user-data search and absent from synthetic lists. Insights, Dive Planning Centre, Dive Knowledge, Dive Computer Imports, Gas Planning, Equipment, Sites, phone/PWA layout and all 66 Logbook Dives passed; no browser errors or horizontal overflow.
- GitHub product-source sync: PR33 merged as `4127f10d7db5b7b1e405f1abeae5d6f9b8a73a42`. Product-tree difference from the published Sites source: zero. This document and tracker update are documentation-only.
- Actual usage: NOT_EXPOSED. Max/Astra: not recommended.
