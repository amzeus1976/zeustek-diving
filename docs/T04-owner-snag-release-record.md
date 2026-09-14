# T04 Trips owner-snag corrective release

## Baseline and integration

- Owner-accepted rollback checkpoint: app 1.0.15 / Sites82.
- Saved rollback version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_5b831d4952108191b8397c59675095d9`.
- Rollback deployment: `appgdep_6aa6f54f5bfc819186816052ee6ea995`.
- Published baseline source: `a6852fcdb4edd16e0427beb7843cc17d9af208a7`.
- Canonical Sites main at inspection: `50b12c2c9f2d3bf9317623516dce954894421945`; its parent was the published baseline source.
- Precode PR #5 head inspected: `726a7fba4d2553a42dbccab2694049d5d6efbc8d`.
- Integration method: manually integrated the bounded four-file PR change using `apply_patch`. It was not merged, rebased or cherry-picked because the GitHub and canonical Sites histories diverged. The three existing implementation files were byte-identical to the PR base before integration.

## Corrective implementation

- `SNAG-TRIP-001`: choice cards use a checkbox plus `minmax(0, 1fr)`, normal word wrapping, and a single-column list at tablet widths. No dialog-wide `overflow-wrap:anywhere` was introduced.
- `SNAG-TRIP-002`: Organiser offers `Me (this account)` and stores the stable existing account ID in optional `organiserUserId`. Account, Person and unrecorded modes clear the competing reference. No Person is created.
- `SNAG-TRIP-003`: optional `guestParticipants` stores Trip-local non-divers with name, role and notes. Blank rows are filtered. Guests render separately and never enter People/buddy/instructor data.
- `SNAG-TRIP-004`: the existing itinerary enum retains travel, accommodation, dive, transfer and other, and adds meal, activity, training, meeting and rest with human-readable labels.
- Backward compatibility: legacy `dive-trip` records may omit the new optional fields; editable projection supplies an empty guest collection without migration. Legacy `trip` Dive Plans are untouched. Readiness remains derived and is not persisted.
- Save path: all changes continue through the existing canonical `saveRecord('dive-trip', ...)` local-first event/outbox service. No new backend, table or store was introduced.

## Files changed

Product and tests in exact published source `33f09eb762149bc0e7b662a7de38b27506a44341`:

- `components/trips-expeditions.module.css`
- `components/trips-expeditions.tsx`
- `lib/offline/trips-expeditions.ts`
- `tests/trips-owner-snags.test.ts`
- `tests/trips-expeditions-persistence.test.ts`
- `package.json`
- `lib/app-changelog.ts`

Release evidence was added afterward in this document and `ZEUSTEK_Diving_Upgrade_Progress.md`; those documentation-only changes were not redeployed.

## Verification

- Focused owner-snag, existing T04 shell/domain and offline persistence: 4 files / 22 tests PASS.
- Full regression: 35 files / 177 tests PASS.
- TypeScript: PASS.
- Production build: PASS.
- PWA precache: 70 entries, 13770.93 KiB.
- `git diff --check`: PASS.
- Static responsive coverage protects 390px, approximately 820px and 1024px layouts through constrained grids, normal wrapping and the 1100px single-column breakpoint.
- Interactive visual preview: BLOCKED_ACCESS. The supervised preview reported running, but the permitted managed-browser URL returned `net::ERR_BLOCKED_BY_CLIENT`. No code change or speculative alternate deployment was made for this environment failure.

## Publication

- App version: 1.0.16.
- Sites release: 83.
- Published source: `33f09eb762149bc0e7b662a7de38b27506a44341`.
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_385737197a4881918533e6f676a890e0`.
- Deployment: `appgdep_6aa7310f7b408191a75bf6202f97e6dc`.
- Deployment result: SUCCEEDED at `2026-09-13T23:26:23.735549+00:00`.
- Archive: sha256 `6907e594c51ee32b29237f963723447c79ea594406725785697b1d8cd6ea8237`, 183 files, 20,695,040 bytes.
- Production: https://zeustek-dashboard.amzeus.chatgpt.site/
- Native saved-version/deployment checks: PASS.
- Authenticated product smoke: BLOCKED_ACCESS; the owner-signed-in browser was not controllable from this agent environment. This is not an implementation failure. No production records were created or changed during acceptance.

## Status

- `SNAG-TRIP-001`: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE.
- `SNAG-TRIP-002`: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE.
- `SNAG-TRIP-003`: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE.
- `SNAG-TRIP-004`: IMPLEMENTED_PENDING_OWNER_ACCEPTANCE.
- Owner-authenticated acceptance is still required before closing any snag.
- Rollback checkpoint remains app 1.0.15 / Sites82 using the saved version and deployment above.
- Astra usage: NONE.
- Actual usage: NOT_EXPOSED.
