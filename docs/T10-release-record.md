# T10 — Dive Planning Centre release record

## Candidate

- Application: 1.0.26
- Task: T10 — Dive Planning Centre only
- Canonical project: `appgprj_6a91926878b48191a80d70f1681ef135`
- Pre-release production: app1.0.25 / Sites92
- Rollback saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_01602ff97f208191a5db926e012df87c`
- Rollback deployment: `appgdep_6aa903fc83248191a927b8f5704052f5`
- Actual usage: NOT_EXPOSED

## Local gate

- Focused T10/shared-dialog regression: 5 files / 15 tests PASS
- Full regression: 58 files / 305 tests PASS
- TypeScript: PASS
- Production build: PASS
- PWA precache: 70 entries
- New T10 component/domain/tests targeted lint: PASS
- Desktop and 390px / 820px / 1024px responsive checks: PASS, no horizontal page/dialog overflow
- Keyboard Escape, editable discard guard and focus return: PASS
- Recreational Plan create/save/reopen and local-first pending-sync evidence: PASS
- Progressive technical fields and canonical cylinder/fill/analysis controls: PASS
- Stable loadout slot snapshot and canonical Trip selector/back-reference: PASS

## Architecture

T10 additively extends the existing runtime `trip` Plan records. It does not add a record kind, table, migration, secondary Plan catalogue or another Dive editor. Start Dive continues through `createDiveDraftFromPlan`, retaining `originatingPlanId`, the exact immutable `originatingPlanRevision`, and existing Plan comparison/reopen behaviour. Trips remain `dive-trip`; Sites, People, Equipment Sets, Skills, cylinders, fills and analyses remain canonical stable-ID references.

## Publication

- Live application: 1.0.26
- Sites version: 93
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_74c8d16276848191a20d9a06deff04eb`
- Deployment: `appgdep_6aa912f2d2b4819199e1029b0a75867f` — SUCCEEDED
- Published source: `2133d7e26ecdabb6cf4d37a46ba7108bef0d7e40`
- Canonical origin/audience: unchanged
- Rollback required: no

## Production acceptance

- Production Plan create/save/reopen/edit/cloud-sync: PASS
- Canonical Site, Person role and reusable-loadout references: PASS
- Advisory readiness 11/11 and Ready lifecycle persistence: PASS
- Start Dive opens the existing Dive editor with Plan date, Site and equipment; cancelled without saving a synthetic Dive: PASS
- Technical-plan deep link and recorded cylinder/fill/analysis/deco controls: PASS
- Readiness dialog Escape and focus return: PASS
- Phone/PWA 390px menu/reflow/no horizontal overflow: PASS
- T03–T09 retained-route smoke: PASS
- Browser console errors: none
- Production Dive Logbook targets retained: 66
- Remaining fixture: one clearly labelled synthetic production Plan, `T10 PRODUCTION ACCEPTANCE ONLY`

Exact verified-source GitHub synchronisation remains pending. T11 has not started.
