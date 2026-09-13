# Zeustek Diving change review — 8 September 2026

This is an implementation and verification record, not a claim that every device acceptance criterion has passed. Scope: the 68 issue IDs in the v1.0 change register. Supporting documents and the supplied course-map image informed the work. ZT-OVR-001 remains an optional proposal.

## Verified

- TypeScript validation and production build pass; 58 automated tests across 12 files pass (final rerun recorded with delivery).
- Local read/write tests run without a network request. Empty related lists return immediately rather than holding up a populated page.
- Immutable local mutation history, monotonic Lamport ordering, recoverable deletion, encrypted backup restore, images, duplicate validation and conflict preservation have regression coverage.
- Live local API check: a stale revision returns HTTP 409. Retrying identical content returns the existing revision. A delayed conflict cannot replace a newer local edit.
- Browser: the cloud-refresh error is fixed for the development-only preview identity. Production identity checks remain enforced.
- Browser: map markers open the correct site; Escape closes the dialog and restores marker focus; bucket-list markers use stars. The map has no 600-marker truncation.
- Browser: consolidated Data & Backups tabs, training front/back image inputs, media test entry, and explicit unknown knowledge areas are present.
- Course map stays within the page at desktop and phone widths, with horizontal pathways and separate plan/medical controls.
- Equipment dates: three dates occupied 19.2 px at a 312 px card; four and five occupied 44.8 px without overflow. Five also fit a 297 px tablet card in 44.8 px and a 522 px desktop card in 19.2 px. Five retained as the largest tested count. Dates derive from explicitly selected owned kit, newest first; hired gear is excluded.
- Service worker is emitted into the public client build. Its 60 precache paths all resolve to client assets; none contain the erroneous client/ or server/ prefix.
- Synthetic records used for checks were removed from active local lists. No production records were used or altered during testing.

## Acceptance still requiring follow-up

- Installed iPhone/iPad PWA behavior, native open select menus, full-screen photo controls, and the <=2 second offline cold-start target require real-device acceptance. Responsive desktop browser checks do not establish these results.
- This existing hosted dive module uses the legacy authenticated D1/R2 record APIs. The changes add durable local records, immutable local events and guarded cloud writes. They do not migrate that legacy module to the separate end-to-end encrypted event transport described in the platform build specification. Local IndexedDB projections and legacy cloud records remain in their existing plaintext data model. Full platform-spec compliance cannot be claimed.
- Backup files are encrypted and include records, local event history, queued changes, locally available card/profile images, and archived conflict reviews. Cloud-only gallery attachments are excluded and coverage is shown in the app. Full gallery attachment recovery remains a platform migration task.
- Domain imports have targeted validation; a complete migration of every legacy entity to namespaced JSON Schemas is not part of this patch. This is another remaining platform-baseline gap.
- Question banks must be imported and explicitly reviewed before use. No unreviewed diving questions are enabled by default. Automated fixtures test selection/scoring and are not diving instruction.
- News grouping deliberately uses matching normalized headlines within seven days. All grouped source links and source metadata are preserved. Semantic clustering of differently worded headlines is not implemented.
- Custom Google My Maps requires the owner's sharing settings to permit embedding; the app normalizes valid IDs/links and retains a direct-link fallback.

## Issue traceability

“Implemented” below means a code path exists for the issue's product behavior. It does not override the acceptance limits above. All load-time items use the same local-first store and share its device-performance acceptance requirement.

| ID | Priority | Change | Review status |
|---|---|---|---|
| ZT-PERF-001 | P0 | Local-first page population and load-time remediation | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-UX-001 | P0 | Clear progress and state for delete/import/export operations | Implemented; device acceptance pending |
| ZT-UX-002 | P0 | Readable dropdown/select controls across the site | Implemented; device acceptance pending |
| ZT-NAV-001 | P1 | Consolidate Imports, Sync and Backups into one destination | Implemented; device acceptance pending |
| ZT-NAV-002 | P1 | Consolidate Admin and Settings into one destination | Implemented; device acceptance pending |
| ZT-NAV-003 | P1 | Consolidate Dive Plans and Dive Bucket List | Implemented; device acceptance pending |
| ZT-OVR-001 | P3 | Use unused Overview space for relevant Dive News | Deferred optional proposal |
| ZT-LOG-001 | P1 | Show dive-record completeness indicators for weather, gear and gas | Implemented; device acceptance pending |
| ZT-LOG-002 | P1 | Populate structured site address fields from the Sites database | Implemented; device acceptance pending |
| ZT-LOG-003 | P2 | Clarify Hydration 1–5 scale | Implemented; device acceptance pending |
| ZT-LOG-004 | P1 | Automatically calculate Total Elapsed Runtime (min) | Implemented; device acceptance pending |
| ZT-LOG-005 | P1 | Support mixed owned and hired gear per dive | Implemented; device acceptance pending |
| ZT-EQP-001 | P0 | Equipment page load time | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-EQP-002 | P2 | Compact Equipment cards and reduce wasted space | Implemented; device acceptance pending |
| ZT-EQP-003 | P1 | Show recent dates last used on Equipment cards | Five dates retained after responsive comparison |
| ZT-WISH-001 | P0 | Gear Wish List load time | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-WISH-002 | P2 | Reduce wasted space in Gear Wish List | Implemented; device acceptance pending |
| ZT-WISH-003 | P0 | Prevent group/subgroup overlap | Implemented; device acceptance pending |
| ZT-SITE-001 | P0 | Sites page load time | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-SITE-002 | P2 | Reduce wasted space in Sites view | Implemented; device acceptance pending |
| ZT-MAP-001 | P0 | Restore “All markers” map function | Implemented; device acceptance pending |
| ZT-MAP-002 | P0 | Repair Google Maps/custom-map configuration | Implemented; device acceptance pending |
| ZT-MAP-003 | P1 | Make the page a single global zoomable map | Implemented; device acceptance pending |
| ZT-MAP-004 | P1 | Open site-detail overlay from a map marker | Implemented; device acceptance pending |
| ZT-MAP-005 | P1 | Remove right-side site cards after marker overlay is complete | Implemented; device acceptance pending |
| ZT-MAP-006 | P2 | Optional bucket-list marker layer/toggle | Implemented; device acceptance pending |
| ZT-PLAN-001 | P0 | Dive Plans load time | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-PLAN-002 | P1 | Enrich plan overlay with linked site and expandable information | Implemented; device acceptance pending |
| ZT-PLAN-003 | P1 | Integrate bucket-list dives into Dive Plans | Implemented; device acceptance pending |
| ZT-PLAN-004 | P1 | Remove separate Dive Bucket List page | Implemented; device acceptance pending |
| ZT-PEOPLE-001 | P0 | People page load time | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-PEOPLE-002 | P2 | Compact People cards and reduce wasted space | Implemented; device acceptance pending |
| ZT-PEOPLE-003 | P2 | Profile picture support | Implemented; device acceptance pending |
| ZT-OPS-001 | P1 | Operators database | Implemented; device acceptance pending |
| ZT-PEOPLE-004 | P1 | Optional operator assignment for PADI Pros | Implemented; device acceptance pending |
| ZT-PEOPLE-005 | P2 | Filter People by dive operator/store | Implemented; device acceptance pending |
| ZT-ALBUM-001 | P0 | Albums page load time | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-ALBUM-002 | P2 | Reduce wasted space in Albums | Implemented; device acceptance pending |
| ZT-ALBUM-003 | P1 | Repair screen-saver/full-screen slideshow control layout | Implemented; device acceptance pending |
| ZT-TRAIN-001 | P0 | Training page load time | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-TRAIN-002 | P1 | Substantially reduce Training-page wasted space | Implemented; device acceptance pending |
| ZT-TRAIN-003 | P1 | Allow certification/training images to be removed | Implemented; device acceptance pending |
| ZT-TRAIN-004 | P1 | Remove generic “Certificate image or PDF” field from normal UI | Implemented; device acceptance pending |
| ZT-TRAIN-005 | P1 | Certification card front/back images with upload or URL, crop and zoom | Implemented; device acceptance pending |
| ZT-COURSE-001 | P1 | Replace very tall course map with wide, space-efficient map layout | Implemented; device acceptance pending |
| ZT-NEWS-001 | P0 | Dive News load time | Local-first implemented and tested; installed cold-start acceptance pending |
| ZT-NEWS-002 | P0 | Detect and prevent duplicate news entries | Implemented; device acceptance pending |
| ZT-NEWS-003 | P1 | Merge stories about the same topic into one card with all sources | Conservative headline grouping; all source provenance retained |
| ZT-NEWS-004 | P1 | Save action moves item to Dive Media as consumed media | Implemented; device acceptance pending |
| ZT-MEDIA-001 | P0 | Prevent duplicate Dive Media records during import | Implemented; device acceptance pending |
| ZT-MEDIA-002 | P2 | Clickable author filter | Implemented; device acceptance pending |
| ZT-MEDIA-003 | P1 | Compact main cards; open full detail view on click | Implemented; device acceptance pending |
| ZT-MEDIA-004 | P1 | Reading priority and progress state | Implemented; device acceptance pending |
| ZT-MEDIA-005 | P1 | Knowledge growth and interest scores out of 10 | Implemented; device acceptance pending |
| ZT-MEDIA-006 | P2 | Topic grouping and click-to-filter | Implemented; device acceptance pending |
| ZT-MEDIA-007 | P3 | Add “Take a test” entry point from Dive Media | Workflow implemented; reviewed question bank required |
| ZT-TEST-001 | P3 | Persist multiple test attempts over time | Workflow implemented; reviewed question bank required |
| ZT-TEST-002 | P3 | Base test selection on training, consumed media and Ordered Development Plan | Workflow implemented; reviewed question bank required |
| ZT-TEST-003 | P3 | Support multiple question interaction styles | Workflow implemented; reviewed question bank required |
| ZT-TEST-004 | P3 | Randomised first diagnostic test across relevant areas | Workflow implemented; reviewed question bank required |
| ZT-TEST-005 | P3 | Suggested and user-focused follow-up tests | Workflow implemented; reviewed question bank required |
| ZT-TEST-006 | P3 | Suggest Dive Media reading to improve weak areas | Workflow implemented; reviewed question bank required |
| ZT-TEST-007 | P3 | Knowledge map of strengths and weaknesses across scuba diving | Workflow implemented; reviewed question bank required |
| ZT-TEST-008 | P3 | JSON question-set export/import workflow for AI-assisted question generation | Workflow implemented; reviewed question bank required |
| ZT-SET-001 | P0 | Fix Settings formatting and overlapping text | Implemented; device acceptance pending |
| ZT-SET-002 | P1 | Clarify Google map address/ID setting | Implemented; device acceptance pending |
| ZT-IMP-001 | P0 | Duplicate detection across manual entry and imported data | Implemented; backup coverage and schema limits noted above |
| ZT-IMP-002 | P1 | Processing/progress bar for import/backup work | Implemented; backup coverage and schema limits noted above |

