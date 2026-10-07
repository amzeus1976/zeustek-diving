# Phone PWA design QA — 1.0.110

## Authority and scope

The supplied 592 × 1280 iPhone Dive day image is the visual authority. Its complete screen was compared beside an actual 390 × 844 browser render at the same display size. The comparison is retained in ignored `work/phone-pwa/phone-comparison.png`, with the implementation in `phone-final-390.png` and both underlying browser captures. No UI elements were painted into the capture. The real ZeusTek wordmark and emblem retain their original proportions.

This release adds an opt-in `/phone` interface. Desktop components, global styles and all nine protected calculation files remain unchanged. Automatic phone selection remains disabled pending physical iPhone acceptance.

## Visual review

| Area | Result | Evidence |
|---|---|---|
| Hierarchy and branding | Pass | Black background, supplied wordmark/emblem, orange save/sync state, cyan timeline and persistent five-tab navigation match the supplied structure. Actual connection state controls the status badge. |
| Timeline and actions | Pass | Boat departure, Dive 01 and Dive 02 precede Equipment checks, Centre contacts, Add buddy and the orange Log dive action. Times and row contents come from saved records. |
| Density | Pass | Log dive ends at y=724 and navigation starts at y=772 in the 390 × 844 frame; the save/sync note also fits. A preceding comparison revealed overlap and the phone spacing was reduced before acceptance. |
| Readability and forms | Pass | Inputs use 16 px text, explicit labels, visible borders and collapsible sections. The small Person form exposes 71 inputs/selects/textareas without horizontal overflow. |
| Complete planning viewers | Pass | Expandable views include full stored Trip, booking, itinerary, Dive Plan, Gas Plan, conditions, safety, emergency and contact information. Advanced plans retain full viewing even when editing requires the desktop interface. |

The live-site check additionally found an unsupported status message from an older worker and eager rendering of large saved weather payloads. The patch keeps unavailable initial status quiet, loads closed detail cards only when opened, and pages long saved lists without omitting items.

The combined full-screen comparison made the wordmark, timeline spacing, primary action and navigation legible together. No separate crops were needed for the verdict. The production icons use the existing local ZeusTek artwork rather than attempting to recreate the illustrative mockup icons.

## Responsive checks

| Frame | Content / scroll width | Result |
|---|---|---|
| 320 × 844 | 304 / 304 | Pass |
| 390 × 844 | 375 / 375 | Pass |
| 430 × 932 | 430 / 430 | Pass |
| 820 × 900 | 820 / 820 | Pass |
| 1024 × 900 | 1024 / 1024 | Pass |
| 1440 × 900 | 1440 / 1440 | Pass |
| 844 × 390 landscape | 828 / 828 | Pass |
| Desktop 3440 × 1440 | 3424 / 3424 | Pass; original Dive Planning Centre, no phone navigation |
| Desktop 1080 × 1920 | 1065 / 1065 | Pass; original Dive Planning Centre, no phone navigation |

All five navigation controls remain present. Minimum measured button height is 43.998 px (44 px within browser rounding). Browser-native date inputs respond to keyboard changes, and editor dates/time stay consistent for single-day plans. Native disclosure controls support keyboard operation. CSS accounts for safe areas and the on-screen keyboard; physical Safari behavior remains to be tested.

## Interaction and offline evidence

- A compiled production build reopened with transport unavailable, hydrated the anonymous offline shell and displayed saved booking codes and itinerary details.
- Full safety notes and a 12,100-character expanded Gas Plan view remained readable offline.
- A Person and a duplicated Dive Plan saved locally, retained their new identities, and uploaded only on explicit Sync now.
- Gas inputs survived closing/reopening, calculated offline through the unchanged desktop engine, saved locally and reopened with results, warnings and assumptions.
- Updating the same Dive/Gas Plans retained their identities. Reviewed stale-draft merges, account boundaries, failed sync retention and upload dependency order have automated coverage.
- Incomplete Gas Plan inputs remain in their durable draft when a calculation is unavailable; the interface preference reflects the stored choice.
- Final regression: 253 files / 1,775 tests passed. Typecheck and changed-file lint passed. Nine protected hashes matched. Artifact privacy scan found zero credential matches and all 31 navigation icons matched their originals.

## Verdict

**Passed for the opt-in browser/PWA release.** No unresolved critical or high-priority visual defects remain in the checked layouts. Physical iPhone installation, airplane-mode cold start, keyboard/safe areas and reconnect sync are pending acceptance; automatic phone selection stays off. Attached PDFs and external websites still require their own download, and the interface states that explicitly.

---

# Earlier TWEAKS design QA (historical)

## Comparison authority

- Source mockups: `_tweaks_bundle_v1/mockups/01_overview_at_a_glance.png`, `02_insights_award_selector.png`, `03_insights_filters_and_detail_overlay.png`, `04_cylinders_and_gas_table.png`, and `05_workflow_navigation_split.png`.
- Implementation checked in the local production candidate at `http://127.0.0.1:5173/` using the same in-app browser session.
- The Insights award-selector mockup and implementation were reviewed together in one visual comparison input.

## Visual fidelity

| Area | Result | Evidence |
|---|---|---|
| Overview hierarchy | Pass | The long analytics/award presentation is absent. Next Dive leads, with My Profile and Top Dive Buddy beside the existing Kit Status and weather content. |
| Insights style | Pass | Existing dark photographic hero, cyan card outlines, orange headings and dense dashboard rhythm are preserved. |
| Award selector | Pass | Compact 4/8/12/16/20 controls appear immediately above the configurable award grid; the selected count uses the orange active treatment. |
| Insights cards | Pass | SAC and RMV are separate cards/trends. Qualifying-dive Progress and Readiness/Currency are absent. |
| Filter overlay | Pass | The overlay retains the ZeusTek dark modal treatment, has contained scrolling, and exposes date, inclusion, depth/time, water, dive-mode, searchable one/many/all location and equipment-set controls. |
| Gear split | Pass | Equipment, Loadouts and Cylinders & Gas are distinct destinations. Cylinders & Gas uses the supplied compact table/detail concept and canonical ZeusTek styling. |
| Navigation | Pass | Trip / Event Planning and Dive Preparation remain separate; Technical Diving remains under Diving CPD. |

## Responsive acceptance

| Viewport | Result | Notes |
|---|---|---|
| 390 × 844 | Pass | Compact header and five-item bottom navigation; configured awards render four per row with no in-page amount selector and no document horizontal overflow (`375 <= 390`). |
| 820 × 900 | Pass | Two-column analytics layout and compact bottom navigation; no document horizontal overflow (`805 <= 820`). |
| 1024 × 900 | Pass | Desktop sidebar returns and analytics grid remains contained; no document horizontal overflow (`1009 <= 1024`). |
| 1440 × 900 | Pass | Desktop hierarchy and density align with the source mockups and existing Experience & Analytics visual authority. |

## Interaction and accessibility

- Full award cells remain keyboard/touch buttons.
- Award quantity is configured only in Site Configuration; the Insights page centres incomplete rows and uses eight-wide desktop or four-wide compact layouts.
- Filter dialog Escape closes only the dialog and restores focus to Analysis filters.
- Cylinder rows are focusable and open by click, Enter or Space.
- The mobile navigation drawer opens and closes without leaving page overflow.
- Data-point selection provides all/none/individual controls plus Apply to dashboard.
- Visible text labels remain alongside icons.

## Final verdict

passed
