# Issue #53 — Stage 9 finishing plan and execution ledger

The concrete `IMPLEMENTATION PLAN` was posted to [issue #53](https://github.com/amzeus1976/zeustek-diving/issues/53#issuecomment-5831985152) after a read-only source and live UI audit. This file keeps the checkpoint recoverable locally.

## Baseline

- Starting source: `d581ebfd9e6ca475c8256f7e0dd84952de2727fc` on `t14/master-forward-build`; issue branch `t14/issue-53-stage9`.
- Production: app1.0.58 / Sites130, deployment `appgdep_6ab65bed90e08191a67d888e89f41378`, saved source `d581ebfd9e6ca475c8256f7e0dd84952de2727fc`.
- Current previous release for rollback: app1.0.57 / Sites129, deployment `appgdep_6ab574feec2c8191b6cd9045090bb` (reverify immediately before release).
- Read-only owner snapshot: 6,400 canonical records, including 66 Dives and one Gas Plan; private ordered-content fingerprint evidence is held outside Git. No owner writes are planned.
- GitHub main at audit: `ba86e49c21d84a0af434387c9133de9092720750`; no open PR.

## Confirmed tasks

1. Remove the bulky household card from the sidebar, retain an accessible version/changelog link and cloud-status indicators. Check mobile and desktop navigation.
2. Correct Bibliography editor terminology and suppress its observed false empty state while canonical media loads. Leave `Dive Media` route and record kind for compatibility.
3. Replace the Technical Diving `T05 loadouts` internal-stage copy with a real owner action.
4. Label the mobile menu close button and verify keyboard/focus behavior; preserve the already-correct `inert` closed sidebar.
5. Inventory remaining substantive multi-field dialog editors; migrate in bounded groups to `RecordEditorWorkspace` without changing persistence or treating read-only details as editors.
6. Align the Overview `Open people` action label to the canonical `People` name.

## Gates

Focused verification per edit, full regression, typecheck, production build/PWA, privacy, targeted lint, version/cache and all nine protected calculation hashes. Check navigation, Bibliography, Technical Diving, converted editors, no console errors, no broken assets and no page overflow at 390/820/1024/1440. Compare fresh owner IDs/content before and after production. Release one exact candidate, smoke it read-only, then reconcile accepted source to GitHub. No Gmail sync.

## Progress

- 2026-09-25: read-only audit complete; implementation plan posted; issue branch created clean from accepted Sites130 source. No application edits yet.
- 2026-09-25: first bounded implementation group: sidebar card removed while version link remains; Bibliography loading/error state and terminology corrected; technical empty-state copy corrected; mobile menu close named; Site and Trip complex editors moved to in-route workspaces. `EditorSections` now supports both legacy dialogs and in-route workspaces. Site/Trip create and edit opened locally against isolated fixture data; dirty drafts prompted before exit and were discarded without saving. Bibliography/Overview/Trips/Sites browser routes were checked locally. Focused editor tests 10/10 and Trip/dialog tests 7/7; full regression 132 files / 763 tests PASS; typecheck PASS. No production writes or deployment. Remaining: inventory/migrate other complex editors and run the final release gate, including four viewport widths, privacy, build/PWA, protected hashes and fresh owner comparison.
- 2026-09-25: Dive Log create/edit editor converted to the same in-route workspace. Local fixture browser confirmed eight jump sections, no false dirty state from section navigation, correct `Me` identity, dirty-draft confirmation, and no page-level overflow at 390 and 820. The old Dive dialog assertion now verifies the workspace contract. Full regression remains 132 files / 763 tests PASS; typecheck PASS. No fixture or owner record was saved. `components/shared/record-editor-workspace.tsx` targeted lint passes; the pre-existing `react(no-children-prop)` finding in `tests/accessible-dialog.test.ts` remains unrelated lint debt.
- 2026-09-25: Technical Diving's versioned reference form moved to the route workspace. Required-field gating and HTTP(S) source URL validation remain, while save failures now surface through the workspace without losing the draft. Focused technical tests 13/13, typecheck and targeted component lint PASS. Local 390px fixture check showed no overflow and confirmed dirty Cancel protection; no reference was saved.
- 2026-09-25: Conservation activity and programme capture moved to in-route workspaces. Both rendered locally at 390px without overflow; activity edits prompted before discard and the programme capture stayed disabled until required fields were supplied. Focused conservation/dialog tests 6/6, full regression 132 files / 764 tests and typecheck PASS. The existing conservation component lint findings at unrelated effect/ARIA lines remain pre-existing debt; no new lint finding was introduced. No local fixture or production record was saved.
- 2026-09-25: Skill Catalogue single/bulk/CSV editing moved to route workspaces; existing creation/import persistence remains. Single and bulk local drafts prompted on Cancel; CSV is gated until a valid preview and selected rows exist. At 390px all three rendered without page overflow. Focused Skill/dialog tests 17/17, full regression 132 files / 764 tests and typecheck PASS. Existing Skill component effect/ARIA lint findings remain; editor `autoFocus` was removed to preserve workspace focus behavior. No file was imported and no record was saved.
- 2026-09-25: reusable Loadout and physical Cylinder create/edit forms moved to route workspaces without changing their canonical stores or calculations. Local 390px checks showed correct sections, no overflow and dirty Cancel protection; no fixture was saved. Focused Loadout/Cylinder tests 24/24, typecheck and targeted component lint PASS. The multi-action Cylinder detail and Apply Loadout dialogs remain for separate classification; do not mechanically migrate their inline action forms.
- 2026-09-25: Calendar event create/edit moved to a route workspace with required name/start date and end-date order gating. Focused planning tests 18/18, typecheck and targeted component lint PASS. Local 390px create draft showed no overflow and prompted before discard; no event was saved. The previous checkpoint's full regression was 132 files / 765 tests and production build/PWA completed successfully. These are interim checks, not the final frozen candidate gate.

## Remaining editor inventory and classification

- Substantive record editors still using `AccessibleDialog editable`: import review, skill evidence, and media/photo operations. Apply Loadout and Cylinder detail are multi-action operational dialogs with existing inline saves; classify their actions individually before migration. The Dive detail viewer has interactive evidence review and must be inspected before classifying it; do not remove its navigation protection mechanically.
- Read-only details, lightboxes and destructive confirmations may remain dialogs. The synthetic fixture-review workflow is test infrastructure and is not owner-facing Stage 9 polish.
- Next checkpoint: migrate a bounded editor group, focused tests, browser create/edit/cancel checks, then repeat. Final #53 release gate and production deployment remain pending. Production is unchanged at Sites130; do not reconcile GitHub or close #53 yet.
