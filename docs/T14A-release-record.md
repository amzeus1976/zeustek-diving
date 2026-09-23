# T14A release record

## Release identity

- Task: T14A Snagging / Brand Icon Foundation / Must-fix Display Pass
- Source baseline: `b1df4e26327ada47346ffbcce315652f0baf0648`
- Candidate app version: `1.0.52`
- Rollback: app1.0.50 / Sites121 / `appgdep_6ab2a6ca7d288191a3283eb5899f8ac0`
- Canonical Sites project: `appgprj_6a91926878b48191a80d70f1681ef135`
- Production URL: `https://zeustek-dive.amzeus.chatgpt.site/`

## Scope delivered

- Insights award inclusion and cap/layout behaviour corrected, including the zero-selection empty state.
- Shared overlay discard confirmation and Escape/focus restoration corrected.
- ZeusTek brand foundation added with 131 mapped PNG domain icons and accessible fallbacks.
- Overview density, Equipment media centring, Gear Wishlist presentation, and Cylinders table density/column controls improved.
- Broken Gear Wishlist price-search UI and its Site Configuration control removed without changing wishlist records.
- ZeusTek cyan focus treatment replaces the non-brand yellow focus border.

## Verification

- Focused T14A/T13/TWEAKS checks: pass.
- Focused release set: 60 tests passed across 11 test files.
- Full regression: 522 tests passed across 91 test files.
- Typecheck: pass.
- Production build and PWA service worker: pass.
- Targeted lint: pass.
- Responsive checks: pass at 390, 820, 1024 and desktop widths.
- Protected Gas Planner calculation files changed: no.
- `CALCULATION_TOUCHPOINT`: no.
- Owner records changed during local acceptance: no.

## Production evidence

- Release: app `1.0.52` / Sites `124` / deployment `appgdep_6ab3a2f736688191bc630fc86bf3d42e`.
- Saved Sites version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_921e3d981e848191b042bac6640ca80e`.
- Exact published product source: `5547a2eacdb33e2f58924b4a91efc2b91275177c`.
- Sites123 was superseded after live acceptance found that the contained Equipment image was still left-aligned on desktop. Sites124 centres the image in the accessible viewer without changing media data.
- Production smoke passed for Overview, Insights, Site Configuration, Equipment, Gear Wishlist, Cylinders & Gas, Logbook, and the shared discard-confirmation flow.
- Insights respected the configured inclusion list and rendered the zero-selection prompt without auto-filling awards.
- The long-editor discard prompt remained centred at a scrolled position; Escape returned to the editor with focus restored; final discard left no test record.
- Responsive production checks passed at 390, 820, 1024, and 1440 px without page-level horizontal overflow.
- Browser console errors observed during final smoke: none.
- Logbook retained exactly 66 Dives. No owner record was created, edited, or deleted by T14A acceptance.
- Production contained one pre-existing owner Gas Plan at smoke time, despite the supplied baseline stating zero. T14A did not create, edit, or delete that record; Gas Plan delta from this pass is zero.
- GitHub release-source commit: `5547a2eacdb33e2f58924b4a91efc2b91275177c`; final main merge SHA is recorded in the owner-facing report after PR merge.
