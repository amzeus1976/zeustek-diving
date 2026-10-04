# Calendar, bookings and Trip links — 5 October 2026

Owner-authorised follow-up to accepted app1.0.77 / Sites149. Preserve source9b1c0af and documentation6e4e67d; branch `fix/calendar-booking-trip-links`. GitHub main33efa427 has the exact accepted product tree. Native Sites source opening preserved the existing checkout and branch; no reset, migration or owner-record write.

| Requirement | Implementation / acceptance |
|---|---|
| C01 Compact selected event | Cap long event text with an accessible “… More” / “Less” control. Expanding never rewrites saved text. |
| C02 Multiple Dives | Explicitly link zero, one or many canonical logged Dives to either a booking or a Trip calendar entry; exact record links, search and review/save; unlinking does not delete records. |
| C03 Event → Trip | Create a Trip with event name, dates/times, location, notes, saved Site/People/Plan references; review before saving. Link an existing Trip by importing an identified itinerary entry and filling only blank summary fields. Preserve existing owner values and provenance. |
| C04 Trip → Calendar | Project the existing canonical `dive-trip` record into the calendar immediately after save. No second Trip/event store or automatic duplicate record. Edit the canonical Trip from that entry. |
| C05 Calendar identity | Preserve explicit legacy booking links and exact deep links; derive inverse provenance without migration. A converted event keeps its original calendar identity. Repeated linking/imports do not duplicate its itinerary. |
| C06 Google Calendar | Existing reviewed Google-compatible ICS pipeline must include current bookings and Trips without converted-source duplicates, preserve UID/date/time/status, selections/privacy and first-of-month reminders. Owner clarification on automatic updates vs existing downloads is pending; no real Google writes or new access while it is pending. |
| C07 Data / security | Account-scoped canonical stores, historical/unknown fields and references preserved; no synthetic production data, bulk rewrite, credential operation or Gmail call. All nine approved protected hashes unchanged; extend types outside frozen planning-pages.ts. |
| C08 Release | Focused RED/GREEN then full regression/typecheck/build/PWA/lint/privacy/cache; six-width populated browser checks and console/focus/clipping; fresh owner fingerprints and verified current rollback; exact candidate publication, acceptance and GitHub reconciliation. |

Read-only audit found the Calendar list only reads `trip` bookings; its Convert/link Trip action merely navigates to Trips. Trips persist separately in the existing `dive-trip` kind and are already included in ICS snapshots, but not the Calendar workspace. Selected-event notes render uncapped. No explicit logged-Dive list is currently maintained on an event. `planning-pages.ts` is frozen; its normalization/save spreads additive fields, so no protected byte change is required.

Bounded design: additive `linkedDiveIds` on existing records and Trip `calendarBookingIds`/`originCalendarBookingId` provenance. Current legacy `linkedTripId` remains readable. Conversion saves one canonical Trip with provenance; existing-trip linking imports once into that Trip, avoiding a partial two-record write. Calendar entries are a shared read projection, never persisted synthetic rows. Conversion is an explicit reviewed edit; reading performs no writes. Current Trip summary values are retained when non-empty; source details remain visible in its identified itinerary.

Focused tests are written before application changes. Pending: implementation, affected tests, final release gates, owner snapshot, native rollback/source revalidation, production acceptance and exact GitHub source match. Gmail and existing public profile/API/provider states remain unchanged.
