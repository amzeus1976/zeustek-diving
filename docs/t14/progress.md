# T14 execution ledger — plan: docs/t14/implementation-plan.md

## Resume contract

Read this ledger and implementation-plan.md, inspect git log/status, then continue the first incomplete stage. Never discard earlier checkpoint work or publish partial stages. Reference specs/candidates live in ../t14-master-reference. User corrections in the approved plan supersede package rollback/multiplier/optional advice.

## Stage 0 — complete

- Isolated branch t14/master-forward-build at b2e86827c19239776c80b51fc93067c7dc4b18ac.
- GitHub connector main unchanged; Sites connector latest124, successful accepted deployment/source unchanged.
- Sites workflow opened selected checkout successfully, no push/publish. Credential stays in session only.
- Fresh regression: 91 files / 522 tests PASS. Typecheck PASS. Full output: ignored work/t14-evidence/stage0-*.log.
- Freeze: docs/t14/protected-calculations.json records Git-byte and working-byte SHA256 for nine calculation-bearing modules.
- Authenticated read-only backup view confirms6363 active records, including66 Dives,1 GasPlan,4 operators,10 people,1 cylinder; all kinds fingerprinted. No records written.
- Source inspection: cylinder list may repair IDs; generic data GET registers household user; Gmail News refresh may sync on open; backup includes encrypted Gmail connection record. Avoid these side effects during smoke; fix connection-secret export in Stage8.
- Ruling: native worktree tool could not operate from project-mirror root (not a Git repository). Used git worktree from existing GitHub repository into sibling zeustek-t14-master; no existing checkout changed.
- Ruling: pnpm shim invokes11.25.0 despite packageManager10.15.1. Frozen-lock installation succeeded without tracked changes; baseline tests/typecheck pass. Keep lock files unchanged unless a justified dependency is needed.
- Ruling: candidate references were moved OUTSIDE checkout so TypeScript's broad include cannot compile candidate scaffolding. All reference files remain intact; sources/ untouched.

## Pre-flight shared interfaces / rulings

- Stage1 ->2/4/5/6/9: workspace and typed navigation must preserve existing string go callers and Escape/discard/focus semantics.
- Stage2 ->4: optional OperatorRecord extension, existing person operatorId/currentDiveOperatorId; no second store.
- Stage3 ->8/9: additive versioned workbench/scopes settings; domain saves merge latest settings to avoid clobbering awards/maps/news.
- Stage5 ->6: preserve immutable Plan-to-Dive; gas metadata extensions outside protected planning-pages/loadouts files.
- Stage6 ->release: independent assignment cannot be replaced by pooling or altered default math. Freeze includes mixed persistence/calculation modules; add types/adapters elsewhere.
- Stage7 ->10: remove sync-on-open; one authorised production mailbox sync only AFTER complete release, never a partial Stage7 deployment.
- Stage8 ->9: public profile uses explicit redacted projection, never generic record/export spreading; owner opt-in stays off in production acceptance.
- Stage9 ->10: all additional capabilities included after mandatory acceptance, then full combined gate.

## Remaining checkpoints

Stages0–3 checkpointed; Stage4 is next. No production deployment or GitHub source push performed.

Stage 0: complete — baseline522/522, typecheck PASS; new protection10/10 PASS. 748 PNGs extracted/validated in ignored staging, manifest748, curated131 unchanged,112 overlapping basenames. Owner baseline captured2026-09-23T16:17:52.726Z; hashes of sorted [id,dataJson,createdAt,updatedAt] per kind in ignored work/t14-evidence/owner-baseline.csv. Sites124 rollback verified. Next: Stage1 foundations and focused tests.


## Stage 1 — checkpoint

- Full-page shared workspace integrated in People / Dive Planning / Gas Planning. Explicit Save/Cancel, dirty route and Back protection, contained Escape, failed-validation retention and restored launcher focus verified in local browser. Remaining complex editors migrate in their scheduled stages.
- Typed destinations preserve canonical record IDs, legacy aliases and Data Centre tabs; same-route record navigation remounts the correct target.
- 748 complete PNG assets + manifest/generated registry installed; original131 retained. 22 semantic aliases resolve to17 distinct precached complete icons; runtime cache96/30days. Built service worker confirms17 complete PNG entries, not748.
- Focused33/33 (including protected10), full regression94files/542tests PASS, typecheck PASS, production build/PWA PASS. New/shared-module targeted lint PASS. Broad lint also surfaced existing monolithic-file debt; modified-line review/new modules clean, track cleanup in corresponding stages and final targeted gate.
- Local Dive Plan and Gas Plan workspaces have zero page overflow at390/820/1024/1440. Browser Escape / keep / Back / failed validation / focus tests PASS. Development hot reload after changing hook structure required reload; fresh-session console check recorded separately.
- Existing T10 static shell test updated from modal-local Escape assertion to shared workspace Escape contract; all earlier behavior assertions retained.
- A disposable local Person fixture was saved in isolated local preview only; production records untouched. Local built-in seed records show sync-review notices; no attempt to sync or repair owner data.
- Next: Stage2 canonical Dive Centres workspace and dependency-safe deletion.

Fresh browser session: Gas Plan workspace mounted and cancelled; application console errors0.

## Stage 2 — complete

- Dive Centres route uses canonical operator records/functions. Optional type/contact/location/agencies/services/image fields preserve legacy records. Search/filter, details, full-page create/edit, People links and safe website/booking links delivered.
- People can select current and associated centre through existing IDs. Linked record actions open exact Person detail; legacy organisation role metadata remains unchanged.
- Local deletion guards all canonical operator deletes. Cloud tombstone paths use an atomic NOT EXISTS constraint covering both Person references; actual SQLite test verifies stale-client blocking. No cascade.
- Focused8 new tests +20 retained/protection pass; regression95files/550tests PASS; typecheck/build/PWA PASS; new/shared module lint PASS.
- Local fixture browser verification: create/edit, both Save controls, exact Person link and disabled linked-centre deletion PASS. List/detail and editor have no page overflow at390/820/1024/1440; fresh browser console errors0.
- Browser finding corrected: shared sticky editor header now tracks the real topbar height, keeping Save/Cancel reachable after scrolling. No frozen calculations changed.
- Production/GitHub remain untouched. Next: Stage3 Insights scope/expression/workbench.

## Stage 3 — complete

- Designed Analysis Scope workspace provides chips, compact activity/water/mode controls, date/depth/duration bounds, searchable one/many/all references and explicit reset. Typed bounded AND/OR/NOT expressions are additive; invalid expressions fail closed, including negation of missing evidence.
- Registry-controlled workbench retains six default cards and saves up to nine. KPI/bar/line/scatter/donut/table/Site views, enlarged analysis, reversible source exclusions, exact Dive/Site/loadout navigation and environment toggles are integrated. SAC and RMV retain distinct units. Settings merge preserves awards and unrelated domains.
- Brought forward read-only loadout detail from Stage4 to make Insights source links functional. Legacy and unavailable equipment references remain visible; projection never writes. Stage4 still owns editor/categorisation/presentation work.
- Focused22/22 including protected hashes; full regression97files/562tests; typecheck; production build/PWA; new/modified Insights module lint all PASS.
- Local browser used75 disposable Dives,3 Sites,2 loadouts: all three source pages, exclude/reinclude, exact Dive and loadout links, environment toggle, nine-card persistence, Site view, enlarged scatter and invalid range blocking pass. Nested NOT/AND/OR returns expected38 Dives; Show all returns75. Scope/workbench overflow0 at390/820/1024/1440; application console errors0.
- Canonical local fixture count/content hash unchanged:75 / b8d528c1c1534ff85eb6b0ffccfeded3cfa3cace1bf296c6f9289f4718bd9efc. No production access/write or GitHub push during this stage. Frozen calculations unchanged.
- Topic card remains scheduled after all MUST/SHOULD/NICE pass in Stage9; it is included, not deferred.
- Next: Stage4 Gear / Dive Data / People / Trip-Event.

