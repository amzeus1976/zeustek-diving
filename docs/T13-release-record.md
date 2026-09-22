# T13 — Design Ethos / UI Consistency / Compliance Pass

Date: 2026-09-22

## Release state

- Candidate: app1.0.50
- Source baseline: GitHub main `1ceeecf5cdb564fb5487e81465c03a9ca94418ec`
- Live pre-deployment authority: app1.0.49 / Sites120
- Live pre-deployment deployment: `appgdep_6ab25dc72ee48191abd975468eea4d58`
- Live pre-deployment published source: `c41a2cc8096e2d779df457e2b148f50ee0973261`
- Rollback: app1.0.48 / Sites119
- Candidate Sites version: pending publication
- Candidate deployment: pending publication
- Candidate published source: pending publication
- Final GitHub SHA: pending verified production

## Scope delivered

- Added shared ZeusTek design tokens and reusable surface, card-density, dialog, focus, warning, status, table, form and action contracts.
- Applied bounded presentation convergence to Overview, Insights, Equipment/Cylinders, People, Admin, Dive Planning Centre, Gas Planning and Technical Diving.
- Moved the loose Technical Diving advisory and canonical Skill-group selector into an accessible compact note after the hero.
- Kept minimised-card warnings/status available to assistive technology and retained `+` / `−` density controls.
- Raised Site Configuration action and non-checkbox form targets to the shared 44 px minimum.

## Protection boundaries

- Canonical records, identities, local-first sync, history and outbox behavior: unchanged.
- Navigation structure and existing aliases: unchanged.
- Gas Planner NDL, MOD, PPO₂, gas-time, reserve and route/checkpoint calculation logic: unchanged.
- Protected calculation files: no diff.
- Schema/database directories: no diff.
- `CALCULATION_TOUCHPOINT: NONE`.
- Owner records changed: no.
- T14/T15: not started.

## Verification

- Focused T13 shared-pattern test: 6/6 passed.
- Planning/technical focused gate: 7 files / 51 tests passed.
- Full regression: 90 files / 514 tests passed.
- Typecheck: passed.
- Production build/PWA: passed; final precache 201 entries.
- Targeted lint for changed TypeScript/TSX tests and components: passed.
- Responsive browser acceptance: desktop, 1024 px, 820 px and 390 px passed with no page-level horizontal overflow on ten representative route families.
- Browser console errors: none. Existing transient Recharts dimension warnings appeared only during rapid automated route/viewport cycling.

## Production acceptance

Pending same-project publication and read-only production smoke. Required final checks: candidate version, representative route families, old aliases, 66 Dive logs, zero Gas Plans, no owner-data writes, no horizontal overflow and no browser-console errors.
