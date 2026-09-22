# T13 Design Ethos / UI Consistency / Compliance Design

## Status and authority

This design implements the owner-approved T13 shared-system-first consistency pass.

- Source baseline: GitHub main `1ceeecf5cdb564fb5487e81465c03a9ca94418ec`
- Production baseline: app1.0.49 / Sites120
- Production deployment: `appgdep_6ab25dc72ee48191abd975468eea4d58`
- Production published source: `c41a2cc8096e2d779df457e2b148f50ee0973261`
- Rollback: app1.0.48 / Sites119
- Retention requirement: 66 canonical Dive logs
- Existing Gas Planning visible-plan requirement: zero plans before and after read-only acceptance

T13 changes presentation, interaction consistency, accessibility, density and responsive behavior. It does not introduce a new feature domain, change canonical data, or alter planning calculations.

## Intent

Make every audited page feel like one coherent ZeusTek Diving product family while preserving each page's purpose. The current Experience & Analytics page is the visual benchmark: a dark technical shell, restrained cyan line work, orange/yellow hierarchy, compact rounded cards, purposeful icons, dense but readable spacing and accessible drill-down interactions.

## Architectural approach

T13 uses a shared-system-first approach:

1. Strengthen existing design tokens and global interaction states.
2. Normalize reusable card, dialog, density, warning, readiness, status, form, table and action patterns.
3. Apply targeted route-level fixes only where shared primitives cannot solve the inconsistency.
4. Verify representative routes from each page family rather than redesigning every route independently.

The pass must not add a second shell, router, record store, dialog framework or styling system.

## Shared visual foundation

### Tokens and surfaces

- Preserve the deep black/navy application background.
- Use dark neutral panels; broad blue slabs and generic grey dashboard panels are not acceptable.
- Use cyan for borders, technical/data accents and focus relationships rather than large filled surfaces.
- Use orange/yellow for section hierarchy, primary actions, warnings and selected emphasis.
- Keep white and muted blue-grey text readable at supported contrast levels.
- Standardize card radii, border opacity, shadows, spacing and minimum interactive target sizes.

### Cards and density

- Reuse `CollapsibleWorkCard` and established compact card patterns.
- Keep `+` and `−` as the expansion controls with accessible labels and persisted preferences where already supported.
- Keep alerts and status visible when a card is minimized.
- Use “Show more” / “Show less” only for content truncation, not as a substitute for detail dialogs.
- Make row/card click behavior keyboard accessible when it opens details.
- Do not add generic “Open detail” button clutter where the row or title already provides the action.

### Dialogs and overlays

- Reuse `AccessibleDialog` semantics for focus entry, Escape behavior, discard protection and focus restoration.
- Normalize dialog headers, close buttons, scrolling regions, sticky action areas and destructive-action styling.
- Prevent nested content and form grids from causing horizontal overflow.
- Ensure every overlay has an accessible name and visible keyboard focus.

### Warnings, readiness and status

- Use a shared warning/status vocabulary: informative, ready/current, caution/due, blocked/overdue and destructive.
- Never rely on color alone; warnings retain an icon or text label.
- Keep warning icons hoverable, focusable and touch usable when they disclose supporting text.
- Preserve all existing readiness and calculation semantics; T13 changes only presentation.

### Forms, tables and actions

- Normalize label spacing, help text, validation text, focus rings, disabled states and field grouping.
- Preserve native or existing application semantics for inputs and selectors.
- Keep table headers readable, rows keyboard operable where interactive, and narrow-screen layouts scroll-safe or stacked without page-level horizontal overflow.
- Use consistent primary, secondary, quiet-link and destructive actions.
- Keep save actions reachable at both the logical top and bottom of long edit overlays where the existing workflow calls for it.

## Targeted route audit

### Overview

- Keep the page at-a-glance: Next Dive, My Profile, Top Dive Buddy, Kit Status and Weather Forecast.
- Align cards, empty states, status summaries and actions with the shared visual foundation.
- Do not reintroduce Insights analytics or awards.

### Insights

- Preserve the current benchmark hierarchy and analytics behavior.
- Audit filter and data-point-selection overlays for shared dialog/form behavior.
- Preserve Site Configuration ownership of the 4/8/12/16/20 award count.
- Keep incomplete award rows centered at the established responsive column counts.
- Preserve separate SAC and RMV meaning.

### Gear

- Keep Equipment for individual non-cylinder gear history.
- Keep Loadouts free of gas ownership.
- Keep Cylinders & Gas as the canonical cylinder workspace.
- Preserve stable two-digit `ID #`, editable manufacturer serial, month/year inspection dates, canonical fill/analysis provenance and existing save behavior.
- Normalize table rows, detail overlays, status chips and long-form action placement without changing cylinder data.

### People & Operators

- Preserve owner/profile privacy defaults, role modeling and all existing records.
- Normalize list density, selected state, profile detail layout, row-click behavior and edit actions.

### Dive Planning Centre

- Preserve text entry, Site facts, team/skill search-and-add, Plan-to-Dive provenance and save/reopen behavior.
- Normalize the editor overlay, section hierarchy, form grids, help controls, readiness/warning presentation and sticky or repeated save actions.
- Do not change planning data or weather logic.

### Gas Planning

- Make display-only consistency fixes to cards, inputs, tables, overlays, warnings and responsive layout.
- Preserve all NDL, MOD, PPO2, EAD, gas-time, reserve, route/checkpoint, owned-cylinder, rental-cylinder, provenance and readiness calculations exactly.
- Do not edit `lib/offline/buhlmann-ndl.ts`, `lib/offline/recreational-gas-planner.ts`, `lib/offline/recreational-gas-reserve.ts` or related calculation logic.
- Any unavoidable non-logic contact must be reported as `CALCULATION_TOUCHPOINT` with its display-only, typing-only or test-only reason.

### Technical Diving

- Keep Technical Diving under Diving CPD.
- Normalize hero, readiness, requirement, evidence and action presentation without changing technical requirement data or calculations.

### Admin, configuration and backups

- Preserve Site Logs, Site Configuration, Data & Backups and Diver Summary Export routes and functions.
- Improve density, section hierarchy, warning presentation, action consistency and long-page navigation.
- Preserve synthetic-fixture safety, backup/restore semantics, sync/history/outbox and all record operations.

## Accessibility

- All interactive elements need visible `:focus-visible` treatment.
- Icon-only controls need accessible names and tooltips where context is not otherwise visible.
- Interactive rows need keyboard activation and correct roles or native interactive elements.
- Dialogs must keep the current focus containment, Escape and focus-restoration behavior.
- Field errors and supporting help text must be associated with their fields where errors are present.
- Status and warning meaning must remain understandable without color.
- Touch targets must remain usable at phone/PWA width.

## Responsive behavior

The audited routes must be usable at:

- 390 px phone/PWA
- approximately 820 px tablet
- 1024 px compact desktop/tablet landscape
- desktop

At each width, verify no page-level horizontal overflow, no overlapping text or controls, usable dialogs, compact cards, readable tables, stable headers and an uncluttered mobile navigation. The bottom navigation remains compact; the full route map remains available through the menu.

## Data and calculation safety

T13 must preserve:

- all canonical record IDs and record kinds;
- all 66 Dive logs;
- the current zero visible Gas Plan state;
- owned and rental cylinder behavior;
- cylinder fill/root-fill and analysis/origin-fill provenance;
- all Gas Planner calculation outputs and readiness logic;
- Plan-to-Dive immutable provenance;
- local-first history, sync and outbox semantics;
- navigation group structure and legacy aliases;
- the exclusion of rejected Sites109 source.

No destructive migration, automatic cleanup, synthetic production record or owner-record mutation is part of T13.

## Test strategy

### Focused T13 tests

Add behavior-focused tests covering:

- shared focus-visible and minimum-target states;
- shared card minimization, alert visibility and `+` / `−` semantics;
- shared dialog labelling, close/discard behavior and action layout hooks;
- shared warning/readiness/status patterns with text labels;
- interactive row keyboard semantics;
- consistent forms, tables and action classes;
- retained route groups, aliases and terminology;
- absence of broad workflow-bar and generic detail-button regressions;
- representative Overview, Insights, Gear, People, Dive Planning, Gas Planning, Technical Diving and Admin shells;
- no imports from or changes to Gas Planner calculation modules.

Tests are written and observed failing before the corresponding production change.

### Release gate

Run:

- focused T13 tests;
- existing T12.6R tests when Gas Planning presentation is touched;
- existing cylinder integration and ID tests when Gear presentation is touched;
- full regression;
- typecheck;
- production build;
- PWA/version gate;
- targeted lint for changed files;
- responsive browser checks at 390, 820, 1024 and desktop.

## Production acceptance and release

After all local gates pass:

1. Update version, changelog, progress and T13 release evidence.
2. Publish only to the canonical ZeusTek Sites project.
3. Smoke the production routes named in the T13 task, prioritizing changed shared patterns.
4. Verify no console errors or horizontal overflow.
5. Verify all 66 Dive logs remain and Gas Planning still shows zero visible plans.
6. Synchronize the exact verified production source to GitHub only after production acceptance.
7. Verify GitHub HEAD matches the accepted production source.

If production fails, restore app1.0.49 / Sites120, verify rollback health, preserve the T13 branch locally, do not sync broken source and report `BLOCKED_DEPLOYMENT`.

## Non-goals

- No T14 or T15 work.
- No new feature domain.
- No route-by-route redesign.
- No data migration or record cleanup.
- No Gas Planner calculation or decompression-engine change.
- No new router, app shell, record store or D1 table.
- No synthetic production write acceptance unless the owner separately requests it.
