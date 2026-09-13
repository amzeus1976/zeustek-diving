# ZeusTek Diving Skills UI corrective release record

## Release identity

- App version: 1.0.10
- Source commit: `fb84910bf69a38677acb792496049171e8a7c589`
- Sites release: 77
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_51917ba9a27c8191b3f1d1c3d2a23a8c`
- Deployment: `appgdep_6aa6a3c9667c81918e431b69851e9b51`
- Production origin: https://zeustek-dashboard.amzeus.chatgpt.site

## Corrective results

- SNAG-SKILL-002: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE. New evidence stores the stable lowercase level `foundation`, `developing`, `competent`, `advanced` or `mastered`. The editor resolves the selected canonical Skill and shows that Skill's definition for the selected level. Skills without definitions retain the five levels and show a controlled no-definition message.
- SNAG-DIVE-004: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE. Evidence actions are accessible icon-only controls in a compact top-right cluster; the complete evidence remains in the disclosure and the existing destructive confirmation is retained.
- SNAG-SKILL-003: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE. The heading and copy are separated from the ordered wrapping toolbar; tablet/phone layouts reflow without a competing narrow heading column. Skill Groups now use a searchable checkbox multi-select with zero groups selected by default, explicit Select all/Clear all actions, and 75-Skill incremental batches so a large catalogue is not rendered at once.

## Compatibility and data impact

- Canonical Skill IDs, Skill references, CSV schema/import/export and archive cleanup semantics are unchanged.
- Existing numeric competence values remain valid legacy values and are not remapped.
- Existing free-text `assessment` remains readable and editable.
- Updating canonical Skill definition text does not rewrite the stable level stored on Skill Evidence.
- No new table, database, migration or duplicate model was added.

## Verification

- Targeted Skill/UI/CSV: 3 files / 25 tests passed.
- Full regression: 27 files / 138 tests passed.
- TypeScript: passed.
- Production build: passed.
- PWA precache: 69 entries.
- Deployment/version smoke: passed; Sites77 is current, its deployment succeeded at 2026-09-13T13:23:37Z, and its saved source is the commit recorded above.
- Authenticated UI smoke: BLOCKED_ACCESS. The owner's signed-in in-app browser is not controllable from this environment, and Sites policy prohibits navigating the isolated cloud browser to the live Sites origin.

## Rollback and closure

- Immediate pre-steering rollback checkpoint: app 1.0.10 / Sites76.
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_583b3da80d7481919aade742d4f6dc17`.
- Deployment: `appgdep_6aa684b42554819183ff2673b84c7c32`.
- The original pre-corrective checkpoint remains app 1.0.9 / Sites74, saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_7d36308defd881918f2387b20854035e`, deployment `appgdep_6aa677abef848191bdd9b672169408d0`.
- No rollback was required.
- The three snags are not marked CLOSED until owner-authenticated production acceptance is completed.
- Astra invoked: no.
- Actual usage: NOT_EXPOSED.

## Owner-acceptance follow-up — app 1.0.11 / Sites78

- Source commit: `26f1d360916fcf3a6dcca5eb3eff99d99e21567f`.
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_30e54cb3da78819180db7230a61c3620`.
- Deployment: `appgdep_6aa6acd49e5c81918b73c92962a12a44`; succeeded at 2026-09-13T14:02:12Z on the existing production origin.
- SNAG-SKILL-002: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE. The compact level selector now has an always-visible, live Skill-specific definition associated with `aria-describedby`. The adjacent information control exposes the current definition on hover/focus and toggles all five definitions for touch users. Evidence continues to store only the stable lowercase competence level; legacy assessments are preserved.
- SNAG-UI-002: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE. Shared editable dialogs ignore backdrop clicks and Escape. Explicit X/Cancel closes a clean editor immediately; a changed editor displays `Discard unsaved changes?`, with Keep editing preserving mounted values and Discard changes closing without saving. Read-only dialogs retain their existing dismiss behaviour.
- Applied through the shared dialog to Skill, bulk Skill, CSV import, Skill Evidence, Site, Dive, Conservation/programme and photo editors. No CSV schema, canonical Skill ID, competence-level or historical evidence changes were made.
- Targeted Skill/dialog/UI gate: 4 files / 28 tests passed. Full regression: 28 files / 141 tests passed. TypeScript and production build passed; PWA precache contains 69 entries.
- Deployment/version smoke: PASS. Sites confirms release 78 is current, the deployment succeeded, and its saved source matches the commit above.
- Authenticated UI smoke: BLOCKED_ACCESS. The managed browser cannot reach the local preview in this environment, and the owner's signed-in production browser is not controllable. Owner acceptance remains required before either snag is CLOSED.
- Rollback target: app 1.0.10 / Sites77, saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_51917ba9a27c8191b3f1d1c3d2a23a8c`, deployment `appgdep_6aa6a3c9667c81918e431b69851e9b51`.
- No rollback was required. Astra invoked: no. Actual usage: NOT_EXPOSED.
