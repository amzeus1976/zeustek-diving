# ZeusTek Diving Skill Catalogue CSV release record

## Candidate identity

- App version: 1.0.9
- Tested implementation commit: `5af2dfefca878661a903461fb8db96d6dec85173`
- Saved Sites source commit: `431ef130355ea5fa0bfb47b325a574748261dee1`
- Difference after the tested commit: deployment/progress evidence only; product source unchanged.

## Preserved verification

- Targeted Skill/CSV tests: 19/19 passed.
- Full regression: 27 files / 132 tests passed.
- TypeScript: passed.
- Production build: passed.
- PWA precache: 69 entries.

## Production publication

- Previous production: app 1.0.8 / Sites73.
- Saved version: Sites74, `appgprj_6a91926878b48191a80d70f1681ef135~appgver_7d36308defd881918f2387b20854035e`.
- Deployment: `appgdep_6aa677abef848191bdd9b672169408d0`.
- Deployment status: succeeded at 2026-09-13T10:15:23Z.
- Production origin: https://zeustek-dashboard.amzeus.chatgpt.site
- Access mode: public, unchanged.

## Acceptance status

- Deployment/version smoke: PASS. Sites confirms the deployment succeeded and Sites74 is current.
- Authenticated product interaction: BLOCKED_ACCESS. This environment cannot control the owner's signed-in in-app browser, and the isolated cloud browser is not permitted to navigate to a live Sites origin.
- Still requiring owner-authenticated acceptance: visible app version 1.0.9; Skill Catalogue load; Import CSV and Export CSV controls; existing Dive/Skill Evidence route; one unrelated route.
- No candidate defect or smoke failure was observed. No rollback was required.

## Rollback

- Last owner-verified rollback: app 1.0.7 / Sites72.
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_23ba3fc321e08191ad94cbbb2013de47`.
- Deployment: `appgdep_6aa65eea7f7481919b714148bf05ee52`.

## Model and usage

- Astra invoked: no.
- Actual usage: NOT_EXPOSED.
