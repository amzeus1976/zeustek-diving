# T10.5 — Workflow, Navigation & Page-Density Foundation

## Candidate

- Application: 1.0.27
- Task: T10.5 only
- Canonical project: `appgprj_6a91926878b48191a80d70f1681ef135`
- Pre-release production: app1.0.26 / Sites93
- Rollback saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_74c8d16276848191a20d9a06deff04eb`
- Owner-directed failure rollback: app1.0.25 / Sites92 / `appgdep_6aa903fc83248191a927b8f5704052f5`
- Actual usage: NOT_EXPOSED

## Local gate

- Focused workflow plus T09/T10 compatibility: 13 files / 58 tests PASS
- Full regression: 62 files / 323 tests PASS
- TypeScript: PASS
- Production build: PASS
- PWA precache: 68 entries
- New T10.5 workflow source/test targeted lint: PASS
- 390px, approximately 820px, 1024px and 1440px: PASS with no horizontal overflow

## Implementation

- Navigation is grouped into Overview, Gear, Dive Data, Planning, Diving CPD and Admin.
- Legacy `?section=` links resolve through aliases without migrating internal route or record identities.
- Display labels clarify Certifications, Planned Training, Dive Skills, Dive Bibliography, Site Configuration and Dive Planning Centre.
- Reusable card density supports minimise/restore, show more/show less and open detail with accessible controls and visible status/alerts.
- Site Configuration is a compact, directly linked directory of minimised sections.
- Trips, Dive Planning Centre and Logbook expose the intended workflow hand-offs; future T11/T12 destinations are honest placeholders only.
- Synthetic fixture review finds only explicitly labelled acceptance/test records, requires owner confirmation and uses the canonical delete/history/sync path.
- T09 analytics and T10 Plan-to-Dive immutable revision/provenance remain unchanged.

## Publication

- Live application: 1.0.27
- Sites version: 94
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_fc335c73e6d88191ab1337bdebffe020`
- Deployment: `appgdep_6aa92a038e3881918ee96a7f3d9fbb5f` — SUCCEEDED
- Published source: `d74c1f0728c361f054b5394ca3b5170fb099b976`
- Archive: `sha256:bde3d110c56e8907436c793c9e63c6112340e1db495df4b4a558c61db1573290`
- Canonical origin/audience: unchanged
- Rollback required: no

## Production acceptance

- Grouped desktop navigation and all renamed destinations: PASS
- Legacy `Course Map` alias → Planned Training: PASS
- Overview minimise/restore with status retained: PASS
- Compact, directly linked Site Configuration: PASS
- 390px PWA menu, grouped Planning disclosure and no horizontal overflow: PASS
- Dive Knowledge T11 placeholder without records/migration: PASS
- T09 Insights KPI drill-down, denominator/source evidence, Escape and focus return: PASS
- T10 existing Plan reopen and stable Site, Person and Equipment Set references: PASS
- Start Dive prefilled the existing Dive editor; cancelled without saving: PASS
- Synthetic fixture surfaced, explicit confirmation unchecked and deletion disabled: PASS
- Unrelated Logbook route: PASS
- Production Dive Logbook targets retained: 66
- Browser console errors: none
- Owner records changed/deleted: none

## GitHub synchronisation

PASS through verified release PR17: https://github.com/amzeus1976/zeustek-diving/pull/17

- Release commit: `ca67b2e4aefac83fda7d72ee3af61e24bdfcf544`
- Merged main commit: `464796086b7a79322204ff65fc1bec5a30a8ad85`
- Documentation evidence PR18: https://github.com/amzeus1976/zeustek-diving/pull/18
- Final verified GitHub main after evidence merge: `52ec9345414b02868626b1155e5d4da059eb3e8d`
- Read-only verification: app1.0.27, all six workflow navigation groups, legacy aliases and this T10.5 release evidence are present on main
- Excluded: secrets, credentials, private attachments, test media and the local untracked deployment archive

T11 is not started.
