# T12.5 release record — Dive Plan Editor + Gas Planning Foundation

- Status: COMPLETE, 2026-09-17.
- Canonical project: `appgprj_6a91926878b48191a80d70f1681ef135` at `https://zeustek-dashboard.amzeus.chatgpt.site/`.
- Live app/Sites: `1.0.37` / `105`.
- Published source: `e903cf969a00bcfcb3bf25d5535bafc37d454955` (Sites branch, product files byte-identical to the tested GitHub-based candidate `d3a7ab90044500a7c44d17514089c8a830feb268`).
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_5cb1e0f1d1608191b3c6d99e42b15afb`.
- Deployment: `appgdep_6aabb3bb91308191bf9a9b3792813b8d`, SUCCEEDED.
- Archive: `sha256:c1ecca622648535d4ba84795eb7a0a9942e1eef04bd147f06b2d52a61e05c404`, 36,474,880 bytes, 314 files.
- Immediate rollback: app `1.0.36` / Sites `104`, saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_000d4857b9a48191b5d57072618a8163`, prior deployment `appgdep_6aaaaea808248191af78f607ee66e502`.
- Baseline: 66 canonical Logbook Dives; no owner data changed during production smoke.

## Scope and compatibility

The canonical Dive Plan remains runtime kind `trip`; Gas Planning remains additive generic kind `gas-plan`. Existing local-first mutation, event, outbox and cloud sync paths are retained. Plan additions include dive number of day and structured preparation context. The linked Gas workspace records gas/cylinder evidence, manual segments and stops, selected table/algorithm *reference and edition*, and basic deterministic gas-volume/oxygen calculations. The previous recorded pressure group is shown with its dataset and estimated surface interval when available. A linked Trip flight within 24 hours raises an advisory. A visible alert icon exposes the warning list on mouse hover and opens an accessible dialog on click, tap or keyboard. No NDL, residual nitrogen, new pressure group, decompression schedule or flight clearance is calculated.

The owner supplied PADI RDP Air metric and EANx32 imperial images, US Navy table images and SSI planning PDFs for future table-provider evaluation. They were not added to production or GitHub. The different agency tables and editions cannot be mixed, and a validated licensed provider is outside this T12.5 foundation.

## Verification

- Focused T12.5 tests: 6 files / 35 passed; additional focused checks: 2 files / 8 passed.
- Final full regression: 79 files / 427 passed.
- TypeScript: passed. Production build: passed; PWA precache: 201 entries. PWA/version gate: 2 files / 4 passed. Targeted lint and diff check: passed.
- Local responsive acceptance: 390, 820, 1024 and 1440px with no horizontal overflow.
- Authenticated production smoke: app version `1.0.37` visible; Gas Planning and Dive Planning Centre and both editors loaded; PWA same-origin route hydrated after its initial cached shell; 390px Gas Planning and editor did not overflow; an unrelated Overview route worked; browser-console errors: none; populated Logbook showed exactly 66 Dive cards. No test record was written to production.
- GitHub exact-product-source sync: PENDING final merge/HEAD verification.
- Actual usage: NOT_EXPOSED. Max/Astra: not invoked or recommended.

T13 remains paused; T12.6 and T14 were not started.
