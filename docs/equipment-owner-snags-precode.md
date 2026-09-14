# Equipment owner-snags precode

## Status

**PRECODE ONLY — do not merge or deploy directly.**

Prepared against current synced `main` at app **1.0.19 / Sites86**. The normal ZeusTek release agent must inspect the branch, run the integration script, review the resulting application diff, execute targeted and full gates, publish through the existing Sites project, and obtain owner acceptance.

## Owner-observed snags

### SNAG-EQUIP-001 — Overview Kit Status

Overview currently previews arbitrary Equipment and can show `No service date set`. The owner wants Kit Status to be a scheduled-servicing panel only.

Prepared projection:

- excludes retired equipment;
- requires `serviceRequired === true` explicitly;
- requires an actual recorded/calculated service due date;
- does not infer serviceability from category;
- sorts overdue, due-soon, then current items; within state, earliest date first;
- limits the compact Overview list to eight items;
- provides a controlled empty state rather than showing unrelated equipment.

## SNAG-EQUIP-002 — Equipment editor layout

The owner screenshot shows servicing and retired checkboxes detached from their labels at desktop width, with excessive dead space.

The integration script adds EquipmentForm-scoped layout classes and headings so:

- checkbox + label remain one clickable row;
- Scheduled servicing is visually grouped;
- Equipment status is visually grouped;
- the changes do not alter global `record-check` behaviour in unrelated editors;
- tablet/phone widths remain stacked without horizontal overflow.

Existing scheduling calculations and stored fields remain unchanged.

## SNAG-EQUIP-003 — Issue / fault / maintenance history

Prepared a new additive canonical record kind: `equipment-event`.

The record keeps:

- canonical `equipmentId` reference;
- type: issue, fault, damage, inspection, maintenance, service, repair, resolved/note/other;
- title and description;
- occurrence date;
- open / monitoring / resolved state;
- resolution date and notes;
- optional provider, cost and currency.

It uses the existing `saveRecord('equipment-event', ...)` local-first mutation/event/outbox path. No table, backend, sync mechanism, or duplicate Equipment model is introduced. The generic `/api/dive-data` allowlist is already sourced from `DIVE_RECORD_KINDS`, so adding the kind enables normal record sync without a new endpoint.

The detail component is prepared to show the latest five events first and a `More… view full log` control with filters for All, Open, Fault/Issue, Service/Maintenance and Resolved.

Open items have an explicit resolve workflow. Resolution updates the same canonical event record while ZeusTek immutable event history retains prior revisions.

A Service event can optionally and explicitly update `lastServiceAt` and the calculated `nextServiceAt`. Logging an arbitrary note, fault or repair does not silently alter service scheduling.

## Prepared source

New / changed branch files:

- `lib/offline/equipment-events.ts`
- `components/equipment-maintenance-log.tsx`
- `components/equipment-maintenance-log.module.css`
- `lib/record-identity.ts`
- `lib/offline/equipment-usage.ts`
- `scripts/apply-equipment-owner-snags-precode.mjs`
- `tests/equipment-owner-snags.test.ts`

The large `app/dashboard-client.tsx` and `app/focus.css` are intentionally not replaced wholesale by connector writes. Instead, the checked-in script applies narrow, anchor-checked integration changes to the current source. This mirrors the compatibility-first precode pattern: current application source wins if an anchor has moved, and the script fails rather than guessing.

## Required release-agent sequence

1. Start from current production-aligned source; do not reset newer work to an older checkpoint.
2. Review this branch and its model/UI helpers.
3. Run `node scripts/apply-equipment-owner-snags-precode.mjs` in the working tree.
4. Inspect the resulting `app/dashboard-client.tsx` and `app/focus.css` diff before testing.
5. Run focused Equipment tests including `tests/equipment-owner-snags.test.ts` and existing `tests/equipment-usage.test.ts`.
6. Run full regression, TypeScript and production build.
7. Test Overview Kit Status with service-required and non-service-required gear.
8. Test Equipment editor at desktop, iPad/tablet and phone widths.
9. Test report → reopen → resolve → full log for an Equipment issue offline/local-first.
10. Verify explicit Service baseline update and verify a normal note does not alter service dates.
11. Publish only through the same canonical ZeusTek Sites project after all gates pass.
12. Keep the current accepted production release as rollback until owner acceptance.

## Acceptance highlights

- a wetsuit with `serviceRequired=false` never appears in Overview Kit Status;
- a regulator with scheduled servicing and a due date does appear;
- `No service date set` is absent from Overview Kit Status;
- service and retired checkboxes remain adjacent to their labels;
- latest five Equipment events appear on details;
- full history is reachable through More;
- faults can be resolved without losing the original event history;
- unrelated events do not move the service baseline;
- explicit Service-baseline update does;
- existing Equipment IDs, loadouts, Dive references and T05/T06 behaviour remain intact.

## Validation note

This branch was prepared through the GitHub connector. No claim is made that local Vitest, TypeScript or production build gates have run in this chat. Those remain mandatory before merge/publication.
