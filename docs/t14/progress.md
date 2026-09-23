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

Stages0–6 checkpointed; expanded Stage5W is next. No production deployment or GitHub source push performed.

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


## Stage 4 — complete

- Gear, Sites, Trips and Bucket presentation aligned; curated domain icons and real buddy initials added. Other loadout choices use category coverage while retaining selected legacy entries. Read-only loadout details from Stage3 retained.
- Imports master/detail keeps a scrollable profile list beside the selected graph, stacked on small screens. Eight isolated profiles verified; selected graph changes correctly.
- Certification projection associates evidence with the holder, never the instructor. Explicit qualification ranks and depth evidence remain distinct from display priority and achieved depth; owner-entered and legacy overrides preserved. Refresh is displayed without automatic owner saves.
- Historical buddy linking requires explicit selection/review and performs one atomic, owner-scoped, revision-checked database update. Browser acceptance deliberately linked three disposable local Dives; production records were not accessed or changed. Post-save workspace is clean.
- Calendar hides absent associations and opens exact Trip/Dive/Gas records. Gas deep links no longer depend on having a Dive Plan. Local Trip detail verified.
- New focused12 tests; full regression98files/574tests; typecheck; production build/PWA; new/shared modified-module lint PASS. Existing Trip monolith lint debt is recorded for the Stage9 finishing gate, not claimed clean here.
- Gear/Sites/Imports/Calendar/Trip/Bucket/buddy workspace checks at390/820/1024/1440 show no page overflow. Fresh browser application console errors0. All frozen calculation hashes pass.
- No production deployment or GitHub push. Next: Stage5 Dive Planning Centre.


## Stage 5 — complete

- Compact Save/edit, Mark ready, Log dive and Link logged dive actions sit directly below Upcoming Dive Plan. Linking selects/reviews one real log, preserves its observations and refuses replacement of existing provenance.
- Resolved source conflict deliberately: legacy draft creation formerly saved the Plan to obtain a revision and Start dive changed lifecycle before a log existed. Draft creation is now read-only; an owner-scoped, hash-checked immutable revision snapshot persists only when its Dive is saved. Existing event-based provenance remains supported. Enriched fields use the same revision, avoiding a mixed snapshot.
- Full-page editor has larger named objectives fields, bounded36px help targets and team-only oxygen selections; departing members are removed from the draft selection. Planning cylinder reads use a pure adapter instead of the frozen ID-repair helper.
- Explicit provider interface defaults to Open-Meteo; request identities include Site/date/time/provider/mode/coordinates/marine. Superseded requests cannot update the draft. Snapshots retain provider/time/coordinates, visible attribution and changed-input warning; existing historical/seasonal/NASA fallback remains. Met Office registration is present but disabled until Stage9 server validation.
- Focused8 tests + retained provenance/lifecycle/weather tests; regression99files/582tests; typecheck; production build/PWA; targeted modified-module lint PASS. Frozen hashes pass.
- Local browser: cancellation retains exact Plan fingerprint edeffbe5e65a30ac2eaa54f36562ee50e754ea53f90c9ef00d468cff2f39bebe; one disposable existing Dive explicitly linked, original observed facts retained. Team filtering/removal, help, forecast retrieval and exact linked-log destination pass. Workbench/editor overflow0 at390/820/1024/1440; console errors0. Stale-response race verified with focused deterministic tests.
- No production/GitHub writes. Next: Stage6 corrected gas allocation and supply UX.



## Owner addition — Stage 5W pending

- Inserted the supplied Weather, Marine & Dive Conditions scope immediately after the Stage 5 weather-provider section. Original Stage 5 checkpoint c55b4f0 and its passing evidence are preserved; expanded Stage 5 now awaits 5W acceptance.
- Includes normalized provider registry/conditions, first-class depth-aware water temperature, operator adapters, source/freshness provenance, visibility, metric-aware Auto/manual selection, local cache/history, Weather & Conditions configuration and focused regression coverage.
- Met Office now belongs to 5W; no duplicate adapter in Stage 9B. Other provider integrations depend on verified access. SwellCloud remains approval-dependent; do not claim enabled without access.
- Provider/access reference contains secrets: no secret values are persisted in repository materials. Existing server-only credential and no-partial-release rules apply.
- Stage 6 allocation work remains uncommitted and preserved. Finish its checkpoint, then execute 5W before Stage 7. The original 51-row issue matrix is retained; supplemental weather requirements have their own ledger.

## Stage 6 — complete

- One full-page Gas Plan editor replaces the duplicate legacy form. Requirements-only, own-empty/fill-required, own-full, hire and temporary/manual workflows preserve canonical identities, immutable snapshots, analysis/fill provenance and legacy assumptions.
- Authorised ADDITIVE CALCULATION_TOUCHPOINT: versioned allocation outside all nine frozen files. Independent cylinders retain pressure, consumption, reserves, availability, checkpoint and scenario results; compatible explicitly connected manifolds alone combine accessible supply. Aggregate surplus never hides an individual failure. Explicit switches, reserve coverage and scenario assignments are required; alternative scenarios are assessed separately. Advanced owner inputs are disabled by default and apply once to their identified basis.
- Existing most-conservative reserve and all legacy engine outputs retained. Independent numerical fixture confirms 860.625 L emergency reserve versus 800 L thirds. Allocation, evidence freshness and physiological validation remain separate; unsupported different-gas physiological validation cannot yield Ready.
- Requested-pressure tolerance replaces the global full-cylinder threshold in T14 selection. Actual analysis/current pressure and inspection evidence are reviewed without repairs or saves; dated snapshots cannot silently become current. Specific remedies, route cylinder dropdowns, depth continuity, field help and contextual NDL/MOD/PPO2 delivered. Linked Dive Plan readiness honours allocation blockers.
- New focused28 tests plus protected10 PASS; full regression105files/610tests PASS; typecheck PASS; production build/PWA PASS; all modified Gas/Dive Plan files targeted lint PASS; git diff check PASS. Retained static tests now inspect the relocated canonical editor, preserving their behavioural assertions.
- Local browser editor and saved summary: overflow0 at390/820/1024/1440; application console errors0. A disposable fixture first passed, then an independently deficient cylinder blocked Ready despite aggregate surplus. Draft save retained individual reasons; route end/start continuity and cancel/discard preservation verified. One local Gas Plan, no cylinder/fill/analysis records created; canonical local Dive count remains75. Fixture hash265a34afa97c3b1d04a28e16ba9a4fcbc3013effdb58f1fadc7ed092f532bc2f.
- Production owner records were not accessed or changed. No production release or GitHub push. All protected calculation hashes unchanged. Next: Stage5W expanded weather, then Stage7.

## Stage 5W — complete (conditional provider activation preserved)

- Owner weather addition implemented without discarding Stage5/6 checkpoints. Versioned normalized conditions power Overview, Sites and Plans; legacy archive/seasonal/NASA compatibility remains. Explicit refresh, cache retention and request-race protection apply; no implicit provider sync on opening these views.
- Surface/SST, mid-level, exact depth, depth bands, bottom and unknown-depth readings remain distinct. Actual canonical Dive/device projections are pure local reads. Operator observations, atmosphere, marine, tide/current, forecast, history and inspectable provenance share one responsive view. Tide datums and competing models are never averaged.
- Official Capernwray structured CSV and bounded Ellerton/Stoney/Vobster parsers preserve qualitative/numeric visibility and unknown observation times. PickADive/DiveNumber enrichment is explicit, read-only and allowlisted.
- Open-Meteo default/fallback; Xweather/Tomorrow/WWO/MET Norway adapters verified with available access. Met Office Global Spot credential returned403 and remains disabled with actionable diagnostics. Copernicus exact-depth adapter requires an absent server subset binding; SwellCloud remains approval-dependent. These access conditions are disclosed in weather-conditions-design.md, not simulated successes.
- Provider credentials remain ignored server-only bindings. Six actual supplied credentials scanned against77 client assets and tracked diff: zero matches. Explicit checks persist only hashed credential identity and redacted24-hour status outside canonical owner records. Local Nordic check persisted successfully. Xweather validation used two accesses in the direct probe and two in browser acceptance; no subscription/purchase.
- PWA gate caught the dashboard crossing2MiB. Split Insights, Imports, Knowledge, Professional Development and Gas Planning into lazy workspaces; preserved the existing PWA limit and selective icon policy. Retained shell assertions updated for dynamic imports, with their route/component checks preserved. Shared guarded links retain configuration destinations.
- New focused40 tests; full regression112files/650tests PASS; typecheck PASS; production build/PWA PASS; new/shared/Plan modified modules targeted lint PASS; diff check PASS. Existing unrelated dashboard monolith lint debt remains assigned to Stage9. Nine frozen calculation hashes PASS.
- Browser: Capernwray surface21/mid19 with unknown observation times; coastal SST/waves/current/MSL; Plan planned18m temperature explicitly unknown and owner temperature blank. New Plan inherits configured default; existing Plan choice preserved. Cancel/discard creates no Plan. Site/config/Plan checks at390/820/1024/1440: no horizontal overflow; fresh application console errors0. Offline/partial failure and stale-response cases verified deterministically.
- Local75Dives+1GasPlan fingerprint unchanged:221e9ff72ab5deb482b5ef0029e556c8ee7a3e667e54ff52e0671ca646411a10. Existing Plan fingerprint remainsedeffbe5e65a30ac2eaa54f36562ee50e754ea53f90c9ef00d468cff2f39bebe. Only isolated local Site fixtures, weather preferences/cache and provider-check metadata were added/changed. Production owner records, GitHub and live deployment unchanged.
- Next: Stage7 CPD/News/Professional Development. One authorised Gmail live acceptance remains reserved for Stage10 after the complete release.

- Navigation retest: the initial automation targeted an off-screen mobile-menu button (x=-330). Opening the menu correctly loads the lazy workspace. Stage9 will make closed mobile navigation inert to keyboard/assistive navigation.


## Stage 7 — locally complete; live Gmail acceptance reserved for Stage 10

- Single-question maintenance creates immutable versions with reasons, explicit approval, preserved attempt history and atomic conflict checks. Advisory AI exchanges bind to the exact question content; every finding needs an author decision. Only the latest reviewed bank feeds future attempts.
- Guided Professional Development setup resumes per pathway and preserves unknown readiness. The requirement builder supports cited owner-entered rules without inventing agency thresholds. Certifications, Bibliography, question review and professional editors use the shared workspace; Bibliography cards flow naturally.
- News uses canonical record DTOs, preserves grouped source provenance and hides removed stories without altering Gmail records. Accessible confirmations replace native dialogs. Opening News reads cached stories/status only; feed refresh and mailbox sync are separate explicit actions.
- Gmail validates the dedicated account, callback and read-only scope, preserves or rotates encrypted refresh credentials, consumes OAuth state once and records bounded sync runs durably. Duplicate/concurrent/uncertain requests cannot silently repeat acceptance. Safe diagnostics distinguish configuration, consent, account, access, quota and upstream failures.
- New focused23 tests PASS; full regression116files/673tests PASS; typecheck, production build/PWA, targeted modified-module lint and frozen hashes PASS. Local browser: Bibliography, News, Certifications/editor, question maintenance and Professional Development/editor overflow0 at390/820/1024/1440; application console errors0. Lazy Insights workspace also loads successfully.
- Local UI verified question v1 retained after v2 edit, two active questions rather than duplicated versions; certification dirty-cancel preserves data/focus; professional step and mentor note resume; unknown readiness remains unknown. Newsletter story removal preserves the separate story and source mailbox record.
- Local75Dives+1GasPlan fingerprint unchanged:221e9ff72ab5deb482b5ef0029e556c8ee7a3e667e54ff52e0671ca646411a10. No mailbox sync invoked. Production/GitHub unchanged. The sole live Gmail acceptance runs in Stage10 after the complete release.
- Next: Stage8 Admin, domain configuration and privacy-aware exports.
