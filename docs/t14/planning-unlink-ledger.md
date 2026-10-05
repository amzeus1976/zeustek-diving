# Planning connections and deletion — owner request 5 October 2026

Preserve the completed Home/copy candidate 4381e907365f2572087d0ccb3bc5e7e1598bcc93. Its native app1.0.86 archive passed packaging/privacy, but has not been saved or published. Production remains recovered, verified Sites153/app1.0.81. The new owner request extends this candidate before publication; rerun affected release gates and freeze a new exact commit.

The current canonical architecture uses `trip` for Calendar bookings/Dive Plans, `dive-trip` for expeditions, and `gas-plan` for Gas Plans. Links can exist at either or both ends: Trip plan IDs / Plan tripId; Plan gasPlanLinks / Gas Plan divePlanId; Calendar explicit Trip/Plan/Gas references and Trip origin/calendar/itinerary references; logged Dive originatingPlanId and skill evidence planId. Existing multi-link/historical records must remain valid. The diagram establishes the desired workflow, not permission to collapse historical associations or duplicate records.

| Requirement | Implementation / verification | State |
|---|---|---|
| U01 | Read-only list of exact linked records with canonical workspace links, from Calendar, Trips, Dive Plans and Gas Plans | LOCAL implementation/tests PASS; compiled acceptance pending |
| U02 | Explicit reviewed per-connection Unlink; clear both known references atomically on device; preserve records, text, dates, evidence, unknown fields and revision history | LOCAL implementation/tests PASS; compiled acceptance pending |
| U03 | Reject stale/account-changed review; missing endpoints can be explicitly detached; offline changes retain normal conflict review | LOCAL implementation/tests PASS; compiled acceptance pending |
| U04 | Deletion guards include Gas Plans and outgoing planning links; cloud deletion remains blocked until dependencies actually sync | LOCAL implementation/tests PASS; compiled acceptance pending |
| U05 | Calendar → Trip / Dive Plan → Gas Plan links carry the exact canonical context; create a reviewed Plan for a selected Trip | LOCAL implementation/tests PASS; compiled acceptance pending |
| U06 | Meaningful RED tests before implementation; 1573 tests/231 files and typecheck PASS; 10 added files lint0; 7 existing modules20 unchanged accepted153 diagnostics; nine hashes unchanged; build/PWA/privacy/six-width acceptance pending | PARTIAL LOCAL PASS |
| U07 | Fresh owner baseline, verified current153 rollback, one combined candidate publication/read-only acceptance and exact PR94/main reconciliation | Pending |

No bulk owner-data edit, relationship-store migration, protected calculation edit, Gmail operation or Google Calendar mutation. Unlink never deletes records. A failed cloud update remains reviewable; do not bypass dependency guards. Final evidence belongs on a separate documentation branch after exact product freeze.

RED checkpoint874ef8f preserved missing-module failure and five real atomic API guard failures before implementation. New11 unlink tests cover mirrored references, isolation, stale/account conflicts, recoverable backup/history and atomic failure. Four context tests cover exact workflow and reviewed Trip drafts. Server/local shared14-field guards include both incoming and outgoing relationships and Gas Plans; no protected calculation changed.


## Final-review corrections — app1.0.87 candidate

Preserve withdrawn Sites158/e0978 and RED f46fc12 /6ae308f. Review regressions now cover allocated/legacy Gas copy evidence resets, a real bookingKind event opening a reviewed new Plan, atomic Plan/event/Gas saves, abort without network or exposed partial update, conflict/stale source protection, and canonical legacy workspace links. 1592tests/233files PASS;61focused/7files PASS; typecheck PASS; nine protected hashes unchanged. No new store, owner migration or protected byte edit. App1.0.87/cachev34 compiled responsive/native packaging/privacy/fresh owner baseline and publication/exact PR94/main acceptance remain required. Source Calendar text/history remain unchanged apart from an explicit normal Save association.

Compiled87 Trip-editor acceptance also reproduced Calendar bookings offered as linked Dive Plans. RED60d1c36 precedes the bounded root-component read projection: retain all sources for exact event conversion, offer only canonical raw rows without bookingKind as Plan choices/counts. No owner rewrite, frozen-file change or source-event loss. Positive legacy Plan and exact booking conversion regressions added; exact-source gates/package and browser acceptance are refreshed before publication.

Final159 review: owner-safe Trip Plan assignment must verify reviewed versions and update inverse planIds from current rows within the same transaction, including ordinary Plan saves and moves between Trips. New wrapper rejects stale Plan/Trip/Gas revisions and pending conflicts; failure rolls back event/Plan/Trip histories and outbox. Training-progress and certification are canonical Calendar targets, refreshed/displayed with correct labels/routes and guarded at both ends. Exact linked training record remains distinct from combined Course Map progress. RED450d011 and added positive/move/rollback/conflict/navigation tests precede new88 release. No protected changes or owner mutations.


Final160 review correction: REDec40ab5 reproduces six valid deselection/inverse-only/stale/conflict/rollback regressions. New89 wrapper reviews current selected plus prior-forward and inverse Gas rows, then passes them to the unchanged frozen canonical reconciler in the existing transaction. Both links clear; all gas/Plan evidence is retained. Separate withdrawn160 evidence preserved; new release gates remain.


Final161 review correction: REDdc6f173 reproduces canonical Plan Calendar action mislabelling. Canonical Plan lifecycle is routed to exact Dive Plans; ordinary event lifecycle remains distinct and guarded. Five rendered regressions preserve Plan/event/Trip boundaries and input data. New90/cache37 candidate requires full gates and saved responsive measurements.


Final162 acceptance correction: REDc28fb16 reproduces exact known Calendar link being routed as a Plan. Detail uses all preserved planning sources, keeps the true title and opens Calendar for bookings. Canonical Plan picker remains filtered; no source transformation. Four semantic/rendered tests verify source ownership, exact ID, missing endpoint visibility and unchanged input. New91/cache38 gates remain.


Final163 review correction: REDffd0c42 reproduces retained loadout application snapshots in repeated Dive Plans. New draft clears those application snapshots without changing original equipment/selected loadout/source/history; normal Save applies current loadout slots. New92/cache39 requires full gates and actual compiled changed-loadout copy acceptance before release. No frozen change or owner write.


Final164 review correction: RED3220a90 proves old source-slot IDs remain in repeated Plans. New draft now removes only IDs attributable to source application snapshots (including multiple/array slots), retains independent/unknown legacy selections, resets applications and reapplies current loadout on Save. Original records are immutable. Version93/cache40 requires full gates and compiled full equipment-list/source-preservation acceptance. No frozen or owner write.
# Review / Trip correction stage — 5 October 2026

### G12 — final weather provenance and Calendar Gas routing correction

Sites169/sourcecb92e5b withdrawn after valid complete-head review5419950896 (4188282118/4188282125). Verified153 restored by succeeded appgdep_6ac404ec2f688191b1040896786d2250 at20:13:55UTC; separate evidence/planning-sites169-2026-10-05 commitbe38dcb preserves1676 tests,60+48 observations and6540 identical owner rows. REDc657450 reproduces6 failures/12 retained passes. Provider summary origins are tracked separately from labelled marine readings; owner mode clears only provider atmospheric/surface summary values, retains explicit owner values including0, and preserves labelled marine fields. Calendar Gas uses the exact canonical/linked Plan ID and a normal accessible link; an unlinked event/Trip asks for an explicit Dive Plan first.59 focused tests pass. App98/cache45 still requires exact full/typecheck/native/privacy/lint/nine hashes, compiled mode save/reload and Gas routing, current owner comparison, publication/read-only acceptance, complete-head PR94 review and exact main reconciliation. No frozen or production record change.

Accepted live release restored to Sites153 / app1.0.81 by deployment appgdep_6ac3e4d8d9308191b2142287c8078005. Preserve withdrawn Sites165 / source87975 and separate evidence/planning-sites165-2026-10-05. PR94 remains unmerged.

RED checkpoint: 14 meaningful failures / 21 retained passes across atomic Plan/loadout persistence, actual Cloud status evidence and Trip destination/owner presentation. Ignored review166-red.log retains exact output. Requirements:

- PR4187081798: include reviewed current loadout application inside the existing Plan/event/Trip owner transaction; failure/account switch must roll back all rows, history and queue and permit retry. Call existing frozen helper; never change frozen bytes.
- PR4187081812: empty device queue is not proof of cloud success. Track actual per-account requests, failures and recovery; stale-account completion must not verify another account.
- Owner Trip request: searchable canonical Site destination; draft road arrival/postcode fill; explicit harbour overrides retained; no offshore-coordinate assumption, no source mutation. Present the unique canonical owner as Me / Self without changing Person roles or Trip reference IDs.
- Owner Trip itinerary request: clear label spacing, visibly bounded full-width text controls, readable notes, six-width clipping/keyboard checks.

Remaining: implementations, meaningful focused/full tests, typecheck/lint/privacy/nine hashes, exact native candidate build, compiled failure/retry and Trip checks, fresh owner baseline, one combined publication, read-only production smoke, complete-head PR review and exact main reconciliation. No intermediate implementation release; no owner record changes during smoke.

## Extended final candidate95 — 5 October 2026

Owner approved Dive Centre selector in both Plan and Trip. W01 empty-only weather merge checks latest draft after pending request; selected fresh readings preserve units, depth/source and distinguish atmospheric visibility. W02 grouped two-column fields; thresholds/permits/cost/notes never filled. W03 field Weather label removed only on actual manual edit, others retained. E01 canonical private operator IDs, multiple contacts, no Person duplication; phone and exact record links available in editors/details. E02 owner/endpoint same-statement cloud validation and deletion constraints, local guard, backup/reference integrity; explicit Remove changes draft only. E03 private contact metadata remains outside API/public-profile allowlists. RED08c853e12 failures; focused54/10 PASS. Save/reload, race/current-draft retention, full gates and combined publication/exact PR94 review/main reconciliation remain. No production record save, Gmail sync, Google mutation, credential issuance or protected calculation edit.

### W04 — owner-corrected workbench width

Top row: Site & Conditions, Equipment Readiness, Team & Roles (including canonical Centre contacts). Lower four cards each span the full three-column width, independently collapsible. RED workbench regression preserves the exact selected-source Duplicate action and owner data. Pre-layout a65e076 archive/tests remain recoverable; final source gates, six widths, copy/Save/reload, current owner comparison, Sites publication and exact PR94 reconciliation still required.

### G13 — fresh Trip road arrival and reliable responsive evidence

Final review4188518214 reproduced stale automatic arrival after destination changes to free text, an offshore Site or empty text. RED171:3 expected failures/9 passes; six added cases also preserve manual overrides. Clear only an unchanged prior automatic address when no new road address exists. Sites170 withdrawn and verified153 restored at20:41:49UTC (deployment appgdep_6ac40b769fb0819199b555721e084c13); source/evidence preserved on evidence/planning-sites170-2026-10-05@173e511. Previous reused-tab42/54 observations are rejected as six-width evidence: effective widths1440/1280 did not change. Fresh-tab control verified actual320; subsequent release measurements must assert effective=requested. App99/cache46 requires all release gates, owner comparison, exact review and publication/main reconciliation. No frozen calculation changes.

### G10 — exact Trip-backed source availability

Valid final review4187837867 withdrew167; verified153 restored. RED28c16f0 proves unavailable source was replaced by unrelated Plan. New URL-derived exact guard retains missing/failed identity, offers explicit retry and shows preparation rather than unrelated Plan while valid context opens. Retry consumes URL only after the exact Trip exists. Prior owner/evidence/candidate preserved. App1.0.96/cache43 requires complete fresh gates and source-retry acceptance before publication/main reconciliation.

Compiled96 source acceptance additionally exposed the normal30-second cloud-read throttle. RED55625c0 requires explicit Retry to force only the canonical dive-trip read before reload. Four root retry tests now pass; no source fallback or automatic record save. Preserve pre-force58006c4 native artifact separately; final fresh gates/build/source replace it before any publication.

### G11 — consistent forced exact-source refresh

Review4188075736 withdrew168;153 restored. REDc12afa5 six failures precede matching forced awaited trip reads for event/Plan retry and trip+dive-trip reads for Trip conversion retry. Initial failed exact-source loads retain explicit retry/error identity.24 focused tests pass; app97/cache44 requires all fresh candidate release gates. Original work/owner/evidence retained.
