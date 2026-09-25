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
