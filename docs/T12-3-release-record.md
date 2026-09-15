# T12.3 release record — Diving Calendar & Bookings + Gas Planning

Date: 2026-09-15  
Status: COMPLETE

## Release

- Application: 1.0.34
- Sites version: 102
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_faa3f76ab7708191aead460a24183dac`
- Deployment: `appgdep_6aa9cb5ce3308191a57e32033ffec198` (SUCCEEDED)
- Published source: `613f8c695d492e8d28f5bc8a6c6fb698c2a71d1c`
- Archive: `sha256:9c28916e4d62da89dc5ea9cfbf0134535cd2c4c08efa00377f8242123ed642b5`, 36,352,000 bytes, 314 files
- Canonical origin: `https://zeustek-dashboard.amzeus.chatgpt.site/`
- Immediate rollback: app1.0.33 / Sites101 / `appgdep_6aa99dd08c7c8191871aafa18daecc39`
- Retained owner-recorded rollback: app1.0.32 / Sites100 / `appgdep_6aa987d09c888191920f07575f0f483a`

## Delivered

- Replaced the two Planning roadmap placeholders with real Diving Calendar & Bookings and Gas Planning pages.
- Added calendar/list/bookings views, event filters, selected-event detail, local-first create/edit/status/archive actions and safe links to existing Trips, Dive Plans, Gas Plans and Planned Training.
- Added lightweight gas planning using stable Dive Plan, cylinder, fill and analysis references, real Logbook RMV provenance or explicit manual override, basic gas-needed/available estimates and incomplete-evidence warnings.
- Added generic-store-backed `gas-plan`; no D1 table, second Dive/Plan/gas store or destructive migration.
- Preserved legacy route aliases, compact +/− controls, bottom navigation, transparent icons and T09–T12.2 behaviour.

## Verification

- Focused T12.3 plus version/cache gate: 7 files / 28 tests PASS.
- Full regression: 74 files / 388 tests PASS.
- TypeScript: PASS.
- Production build: PASS; final PWA precache contains 201 entries.
- Strict targeted lint: PASS for new and directly changed T12.3 files. Existing shared record-identity lint debt is unchanged.
- Responsive local acceptance: 390, 820, 1024 and 1440px PASS; no horizontal overflow.
- Production smoke: both new pages, compact navigation, bottom navigation, legacy Bookings alias, T09/T10/T11/T12/T12.1/T12.2 and Equipment PASS; browser errors none.
- Logbook retention: exactly 66 Dive cards.
- Production data: no owner record created, edited or deleted during smoke.
- Actual usage: NOT_EXPOSED.
- Max/Astra: not used; not recommended.

## GitHub

The verified app1.0.34 product source is synchronised from this release branch. Final GitHub main evidence is recorded after the merge without changing the production product tree.

## Next

T13 — Final Workflow, Navigation, Settings & Page-Compliance Audit — NOT_STARTED.
