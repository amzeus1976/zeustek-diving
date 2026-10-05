# Planning connections and deletion — owner request 5 October 2026

Preserve the completed Home/copy candidate 4381e907365f2572087d0ccb3bc5e7e1598bcc93. Its native app1.0.86 archive passed packaging/privacy, but has not been saved or published. Production remains recovered, verified Sites153/app1.0.81. The new owner request extends this candidate before publication; rerun affected release gates and freeze a new exact commit.

The current canonical architecture uses `trip` for Calendar bookings/Dive Plans, `dive-trip` for expeditions, and `gas-plan` for Gas Plans. Links can exist at either or both ends: Trip plan IDs / Plan tripId; Plan gasPlanLinks / Gas Plan divePlanId; Calendar explicit Trip/Plan/Gas references and Trip origin/calendar/itinerary references; logged Dive originatingPlanId and skill evidence planId. Existing multi-link/historical records must remain valid. The diagram establishes the desired workflow, not permission to collapse historical associations or duplicate records.

| Requirement | Implementation / verification | State |
|---|---|---|
| U01 | Read-only list of exact linked records with canonical workspace links, from Calendar, Trips, Dive Plans and Gas Plans | Pending |
| U02 | Explicit reviewed per-connection Unlink; clear both known references atomically on device; preserve records, text, dates, evidence, unknown fields and revision history | Pending |
| U03 | Reject stale/account-changed review; missing endpoints can be explicitly detached; offline changes retain normal conflict review | Pending |
| U04 | Deletion guards include Gas Plans and outgoing planning links; cloud deletion remains blocked until dependencies actually sync | Pending |
| U05 | Calendar → Trip / Dive Plan → Gas Plan links carry the exact canonical context; create a reviewed Plan for a selected Trip | Pending |
| U06 | Meaningful RED tests before implementation; focused/full/typecheck/build/PWA/privacy/lint/six-width acceptance; nine protected hashes unchanged | Pending |
| U07 | Fresh owner baseline, verified current153 rollback, one combined candidate publication/read-only acceptance and exact PR94/main reconciliation | Pending |

No bulk owner-data edit, relationship-store migration, protected calculation edit, Gmail operation or Google Calendar mutation. Unlink never deletes records. A failed cloud update remains reviewable; do not bypass dependency guards. Final evidence belongs on a separate documentation branch after exact product freeze.
