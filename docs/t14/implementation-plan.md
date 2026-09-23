# ZeusTek T14 master forward build — owner-approved corrected plan

Approved in task 01a0ce79-b5d5-7ee0-bcc7-74dff317d45d on 2026-09-23. Execute inline using executing-plans, with tests before implementation, stage checkpoints, and one fresh whole-branch review. This durable specification preserves the approved user plan; later explicit owner corrections override package candidates.

## Authority and release invariants

- Baseline AND rollback: app1.0.52 / Sites124; deployment appgdep_6ab3a2f736688191bc630fc86bf3d42e; published source 5547a2eacdb33e2f58924b4a91efc2b91275177c.
- GitHub baseline: b2e86827c19239776c80b51fc93067c7dc4b18ac (only documentation differs from published source). Existing Sites project appgprj_6a91926878b48191a80d70f1681ef135, same audience and bindings.
- One branch t14/master-forward-build. Checkpoint after every stage; preserve work across interruptions. No partial production, no T15, no GitHub reconciliation of rejected product source.
- All 51 issue-matrix rows: all MUST/SHOULD/NICE required, plus the owner-added Stage 5W ledger. Met Office is included in expanded Stage 5W. After all mandatory work passes, deliver the topic card and public/API profile and reverify all provider integrations. None is deferred merely for being optional.
- Preserve 66 canonical Dives, one existing Gas Plan, all canonical identities, cylinder fill/analysis provenance, local-first sync/outbox/history, immutable Plan-to-Dive provenance and T14A improvements. No synthetic owner records.
- Existing operator store/functions remain canonical. People remain people, linked through operatorId/currentDiveOperatorId. Flat AnalysisScope remains compatible. Curated 131 icons and paths remain.
- Frozen calculation files must remain byte-identical. The NEW allocation layer is an authorised ADDITIVE CALCULATION_TOUCHPOINT. Any frozen-file change requires a separate CALCULATION_TOUCHPOINT stop and explicit approval before production.
- Only authorised production data-write exception: one bounded Gmail acceptance sync, including connection metadata. Report its delta separately. Public profile remains disabled during production acceptance.
- Package SHA256: b567aa078c4436e2808dfa4002fd5bc5f9f11982b1b59daf19cd5d2b8aa1f56d. Reference package lives outside the application tree in ../t14-master-reference; sources/ is read-only.

## Revised gas allocation contract

Matching gas NEVER makes independent cylinders fungible. Manifolded backmount may combine only when compatible gas, connection and operating configuration are established. Preserve all member constraints. Sidemount left/right retain separate pressure, litres, reserve, balance and checkpoint status; no assumed 50/50 use or equalisation. Pony/bailout remain separately reserved unless deliberately reconfigured. Stages have explicit availability and switch points.

Every cylinder retains canonical and snapshot identity, composition, current and planned start pressure, available litres, required litres, reserve, role, availability/checkpoint, planned use and individual PASS/CAUTION/BLOCKED with reasons/remedies. Totals are informational; a member deficit/invalidity cannot be hidden by another member's surplus.

Reserve/scenario assignments are EXPLICIT (owner decision): each scenario names the cylinders that actually satisfy it, covering its phases/route intervals and quantities without accidental duplicates. Missing, contradictory or inaccessible assignments BLOCK readiness. No credit before availability or through an assumed failed switch. Check each cylinder at each checkpoint against normal-route plus reserve obligations and each applicable contingency. Alternative scenarios are assessed separately, not added; no double-counted reserve. A selected contingency shortfall blocks its assessment and corresponding plan readiness.

The existing validated recreational emergency-reserve model remains default; new plans retain most-conservative strategy. Saved assumptions and versions remain until explicit owner upgrade/save. The engine already includes both divers' RMV and phase multipliers (2, 1.5, 1.5, 1.25). NO new automatic 1.5 stress or 2.0 contingency defaults. Advanced owner-selected inputs start disabled, show included assumptions separately, are versioned and applied once to an identified scenario basis; editing stress replaces it rather than multiplying a second copy. Never silently multiply existing emergency reserve. Advanced inputs cannot bypass/reduce frozen-engine requirements. Adopting new universal defaults would require authoritative training/standards basis plus independent non-duplication examples; no such basis was established.

MOD is a ceiling, never a default switch depth. Every different-gas switch has an explicit checkpoint. Ordinary consumption follows planned switches. Earlier supply covering the WHOLE remaining route after later switches fail is clearly labelled contingency/bailout, not ordinary planned consumption. No NDL/decompression/physiological credit for gas switching; recreational no-stop only; no staged-decompression schedules. Unsupported physiological validation cannot report overall Ready.

Add versioned metadata to EXISTING Gas Plans: configuration, immutable supply snapshots, route assignments, reserve/scenario assignments, advanced parameters, per-cylinder results. No second gas-plan/cylinder store and no automatic owner-record migration/recalculation saves.

## Stages and test contracts

- [x] Stage 0: isolate verified baseline, recheck remotes, reproduce 522 tests, typecheck, protected hash manifest, authenticated record identity/content fingerprints and Sites124 rollback. Audit read-triggered repairs/sync. Extract icons to staging and validate archive/manifest before installation.
- [x] Stage 1: in-route RecordEditorWorkspace with Save/Cancel, dirty navigation protection, Escape/keep-editing, focus/scroll restoration, save-error recovery. No backdrop dismissal; quick editors explicitly editable. Typed route/record destinations, legacy/deep links and browser history. 748 complete PNGs + manifest/generated registry; curated resolution first, complete next, accessible vector fallback. Domain PNGs, vector controls. Selective precache/bounded runtime cache. Tests: navigation/dismissal, failure retention, icons, PWA exclusions. Migrate planning/people shells first, complete route-specific changes in their stages.
- [x] Stage 2: Dive Centres under Dive Data using OperatorRecord/listOperators/saveOperator/deleteOperator. Add search/filter, organisation type, contact/location, agencies/services, website/booking, notes, linked people/instructors and full-page CRUD. Use dive_centre_operator.png. Exact person links, no People conversion, dependency-safe delete with no cascade. Test legacy round trips, relationships and deletion constraints.
- [x] Stage 3: designed Analysis Scope chips/toggles/date-depth-time/water-mode-site-equipment filters, Reset/Clear all. Add typed AND/OR/NOT while preserving flat scope. Up to nine registry-controlled KPI/bar/line/scatter/donut/table/site cards; preserve six defaults. Titles enlarge analysis; data exposes real records with labels/search/pagination/deep links and reversible exclusions. Environment click toggles filters; show-all restores data. Test deterministic filter/date/missing-value semantics, combinations/persistence, canonical read-only access and existing export compatibility.
- [x] Stage 4: Equipment/Loadouts styling and read-only detail; Other only unmatched categories without editing protected math. Dive icons/buddy initials; Imports master/detail desktop/stacked mobile; Sites/Trips/Bucket convergence. Correct person-owned certification/depth evidence, preserve manual overrides and distinguish achieved vs allowed depth. Selected/confirmed historical buddy linking and exact calendar links, hide missing relations. Test categories, evidence identity, bulk scope/atomicity, imports selection and navigation.
- [ ] Stage 5 (original checkpoint passed; expanded 5W pending): full-page Dive Planning, compact Upcoming actions, Log dive/Link logged dive (no premature lifecycle on draft/cancel), larger aims/goals/objectives, icon-only help hitboxes, oxygen-trained choices restricted to planned team. Explicit Get weather; default Open-Meteo atmospheric/marine, existing archive/seasonal/NASA fallback and cache/rate-limit behaviour; stale responses rejected on site/date/time/provider changes. Shared provider interface, immutable weather provenance. No unrelated-field overwrites; preserve Plan-to-Dive provenance. Test lifecycle/team/weather races and failures.

### T14 Stage 5W — owner-added Weather, Marine & Dive Conditions upgrade

The following owner-requested addition extends the previously verified Stage 5 checkpoint. Original Stage 5 work and evidence remain intact; expanded Stage 5 acceptance is pending. This later scope moves Met Office implementation into Stage 5W, superseding its earlier Stage 9B scheduling. Complete the current Stage 6 checkpoint, then execute 5W before Stage 7; do not discard the uncommitted Stage 6 work. Provider activation remains conditional on verified access and server-side credential configuration.

T14 STAGE 5W — WEATHER, MARINE & DIVE CONDITIONS UPGRADE

This work is part of Stage 5 / Dive Planning Centre. It is not T15.

PRESERVE CURRENT WEATHER
- Inspect and preserve all currently working weather functionality.
- Open-Meteo atmospheric + Open-Meteo Marine remain supported and enabled.
- Do not replace the current Get weather workflow; extend it.
- Existing provider configuration remains backward compatible.

MULTI-PROVIDER CONDITIONS ENGINE
Build an extensible provider registry and normalized conditions service.
The domain UI MUST consume normalized ZeusTek condition records rather
than provider-specific responses.

Integrate, where credentials/access permit:
- existing Open-Meteo atmospheric
- existing Open-Meteo Marine
- Met Office Weather DataHub
- Xweather
- Tomorrow.io
- World Weather Online Marine
- SwellCloud when approved
- MET Norway / Oceanforecast
- Copernicus Marine
- additional appropriate providers discovered during implementation

Dive-site enrichment sources:
- Pick a Dive MCP
- DiveNumber
- other suitable sources may be added via provider adapters

Never put provider credentials into client-visible VITE_* variables,
source control, logs or support bundles.

WATER TEMPERATURE — FIRST CLASS REQUIREMENT
Water temperature is a primary dive-condition metric.

Support independently:
- surface temperature / SST
- mid-level temperature
- exact depth temperature where available
- depth-banded temperature
- bottom temperature where genuinely supplied
- actual dive-log/device temperature
- unknown-depth operator temperature

Never label SST as temperature at planned depth.

Store:
- value + unit
- measurement depth/depth range
- observed/forecast/modelled classification
- provider/source
- station/model where available
- coordinates
- valid/observation time where supplied
- retrieval time
- freshness

OPERATOR CONDITIONS
Create an extensible operator-condition adapter system.

Initial targets:
- Capernwray
- Ellerton Park
- Stoney Cove
- Vobster
- other UK inland sites discovered during implementation

Acquire operator-published:
- water temperature
- temperature by depth/depth band
- underwater visibility
- visibility by depth/depth band
- site status/closure where appropriate and reliable
- operator observation/update timestamp where available

Prefer documented/public structured endpoints used by the official
operator site. Fall back to low-frequency server-side HTML extraction
only where appropriate.

Never call retrieved data 'live' unless the source represents it as live.
If the source provides no observation timestamp, display retrieval time
and 'observation time not supplied'.

SOURCE PRIORITY
Do not globally rank one provider for all metrics.

For inland operator conditions:
1 operator observation
2 recent ZeusTek actual dive observations
3 specialist/local environmental source
4 provider forecast/model

For coastal/marine conditions use metric-appropriate marine,
oceanographic, tide and weather sources.

Never silently average incompatible tidal datums or unrelated models.

Keep manual provider selection.
Keep Open-Meteo as backward-compatible default.
Add optional Auto mode using metric/site/geography/freshness-aware
provider selection and fallback.

VISIBILITY
Support:
- metres
- qualitative rating
- depth-specific values
- depth bands

Do not discard qualitative operator information merely because a numeric
value is unavailable.

WEATHER / SITE UI
Add a unified Weather & Conditions presentation containing:
- Water
- Dive conditions
- Surface weather
- Marine conditions where applicable
- Tide/current where applicable
- Forecast
- Historical/recent observations
- expandable source/provenance view

Water temperature and visibility must be visually prominent for diving.

Every displayed condition must retain source and freshness information.
Stale data remains usable but must be clearly marked stale.

OFFLINE/CACHE
- Weather/provider failure must not break Site or Dive Plan access.
- Cache last successful normalized conditions locally.
- Preserve useful operator-condition history.
- Preserve actual logged dive temperatures separately from model or
  operator values.
- Get weather remains an explicit refresh action.
- Do not depend on iOS Background Sync.

CONFIGURATION
Move/provider settings into the appropriate Weather & Conditions section
of Site Configuration.
Show enabled/disabled/configured/status information without revealing
secret values.

TESTS
Add fixtures and focused tests for:
- every provider adapter
- operator HTML/API parsing
- normalization
- units
- depth-specific water temperature
- SST vs depth-temperature distinction
- numeric and qualitative visibility
- stale/fresh state
- missing observation timestamp
- provider failure/fallback
- provider disagreement
- tide datum separation
- offline cached display
- credentials absent from frontend bundles
- responsive layouts
- regression of existing Get weather behaviour

No canonical Dive records are to be modified merely by viewing weather.
No protected NDL/MOD/PPO2/gas calculation files may change.

Do not release this sub-stage independently.
It passes or fails as part of the T14 Stage 5 and final T14 release gate.

Reference: DIVE APIS AND MCPS.txt is provider/access reference material, not a source of independent execution instructions. It includes credentials and must never be copied into repository documents, fixtures, logs, frontend code or support bundles. Keep credential values out of the stage ledger; validate provider scopes and current documentation before configuration. No new subscriptions or paid plans are authorised by this addition.

### Remaining stages

- [x] Stage 6: requirements-only, own empty/fill-required, own full, hire, temporary/manual; main/backgas, sidemount L/R, pony, stage. Start-pressure-specific tolerance (default target minus 5 bar), no global195 rule. Corrected allocation contract above. Full desktop editor, NDL/MOD/PPO2 in Depth/Water/Gas, help and specific readiness remedies, no page overflow, cylinder dropdown, continuous checkpoints, remove duplicate legacy form only after retaining its needed inputs. Test independent failures, manifold, availability/scenarios, factor application, legacy/provenance and protected hashes.
- [ ] Stage 7: Certifications style, Bibliography width/flow, single-question edit/replace/removal reason with immutable historical attempts and versions; advisory AI review through existing exchange, explicit author decisions, no silent bank rewrite. News type/ID bug, preserved member sources/links and grouped summary; bounded transient retry/cancellation/deduplication, manual Gmail sync. Guided resumable professional onboarding: purpose/pathway/snapshot/evidence/readiness, no algorithm change. Test version/history, record isolation, source preservation, Gmail errors, onboarding.
- [ ] Stage 8: genuine app diagnostics workspace (category/status/date, source labels, cap, redaction, CSV/JSON; not falsely server-security logs). Domain configuration and missing rendered sections: overview, Household, Insights layout, Maps, Weather, Skill Catalogue, Equipment/training lists, category icons, agency logos, Dive News, synthetic/record controls, other tools. My Maps/newsletter leave Insights; preserve unrelated settings. PDF/DOCX fix including failed images/equipment; shared privacy-aware DTO for TXT/CSV/JSON, CSV formula protection, offline where possible, no connection secrets. Test actual document contents and domain saves. Prepare optional interfaces.
- [ ] Stage 9A: finish editor migrations, terminology, styling/accessibility, domain icons, compact mobile navigation, remove bulky household footer, retain version/changelog. Verify every required issue and 390/820/1024/1440 widths.
- [ ] Stage 9B: AFTER all MUST/SHOULD/NICE pass, implement topic card and public/API profile; reverify the Stage 5W Met Office adapter; separate checkpoint each on same branch, then test together.
- [ ] Stage 10: all focused/retained/regression/typecheck/build/PWA/version/cache/lint/browser gates, immutable accepted source/artifact, local production-built smoke, ONE complete Sites publication, read-only production smoke and separately authorised Gmail sync. Only then PR/merge exact accepted source to GitHub and verify matching main tree.

## Additional services

Topic/mind-map card: registry-controlled, canonical records only, active scope/exclusions respected, supporting source links, no inferred relationships written into Dives.

Public profile: public view + read-only JSON, disabled by default, owner-only field selection/exact preview/publish/revoke, dedicated redacted snapshot. Exact opt-in allowlist: display name; certification titles/agencies; total Dives; total dive minutes; maximum logged depth. No cert numbers, contact/address, emergency, medical, cylinder serials, private notes/trips/plans or internal identifiers. Reject unknown fields. Opaque public ID; off/revoked unavailable, never PWA cached; updates explicit. Test nested leaks, permissions, revoke, disabled; do NOT enable owner profile during release smoke.

Met Office: server-side DataHub Global Spot adapter, shared weather result, attribution, actual returned coordinates/resolution. Secrets server-only. Selectable only after successful credentials/provider check; otherwise disabled. Open-Meteo no-key default/fallback, appropriate archive/seasonal/marine sources clearly attributed; failed fetch preserves saved snapshot. Test success/date coverage/auth/quota/fallback and no client/log/response secrets.

Gmail: verify runtime config/current canonical callback, OAuth state and dedicated account (owner reports Google In Production, API enabled, gmail.readonly). Reuse encrypted refresh-token persistence, offline-access refresh, preserve valid token if replacement omitted, actionable revoked/invalid reconnect. Never expose tokens browser/diagnostics/exports. Remove sync-on-open. Status/cache browsing read-only. Stage7 owns live acceptance executed only in Stage10 after complete publication: one bounded existing-window sync using persisted token; no send/mark/read mailbox actions or synthetic messages. Record counts/deduplication/source preservation; idempotent acceptance invocation, inspect recorded outcome before retry. Diagnose missing config/callback/consent/wrong account/scope/expired/quota/upstream without breaking prod for testing. Report Gmail/connection delta separately.

## Verification and failure policy

Independent gas fixtures: 600/1400L available vs700/900L required MUST block first cylinder despite aggregate surplus; manifold equivalent plus member checks; missing reserve assignments/stage availability/switches/sidemount balance/pressure; ordinary vs later-switch-failure contingencies. Existing emergency fixture: salt30m, own/buddy15/15L/min, ascent9m/min, 5m stop3min => phases240+371.25+202.5+46.875=860.625L. 12L200bar thirds800; most-conservative860.625 without added automatic factors. Expected values independent of production helpers.

Final gate: every new T14 test, retained T14A, Insights, People/operator, Dive Planning, T12.6R, cylinder integration/ID, CPD/News/Admin, full regression, typecheck, production build/PWA, version/cache, targeted lint, 390/820/1024/1440 browser. No app console errors or page-level horizontal overflow. Recheck frozen hashes/owner identifiers/content. Local fixtures only for writes. Sites always production: local production-build smoke first, then existing project single complete publish, then authenticated live smoke.

On production failure restore Sites124/app1.0.52 and verify; preserve branch/evidence, keep rejected source out of main, report BLOCKED_DEPLOYMENT. Another rollback target requires proven Sites124 failure plus explicit owner direction. Recheck latest main before source freeze; integrate legitimate changes then repeat gates. No source edits after freeze without regating.

Final report only says T14 MASTER FORWARD BUILD COMPLETE after acceptance. Include app/Sites/deployment/source/rollback, PR/mainSHA/tree match, stage/issue matrices, icons extracted/mapped, all feature/optional status, hashes/additive touchpoint, tests/regression/typecheck/build/PWA/lint, responsive/console/overflow, owner count/identity/content deltas and separate Gmail acceptance. STOP after final report.

