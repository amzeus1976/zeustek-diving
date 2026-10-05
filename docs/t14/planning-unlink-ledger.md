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
