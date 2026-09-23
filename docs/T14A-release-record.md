# T14A release record

## Release identity

- Task: T14A Snagging / Brand Icon Foundation / Must-fix Display Pass
- Source baseline: `b1df4e26327ada47346ffbcce315652f0baf0648`
- Candidate app version: `1.0.51`
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

Deployment, Sites version, published-source SHA, production smoke, retention counts, and final GitHub SHA are recorded in the progress log after successful publication and smoke verification.
