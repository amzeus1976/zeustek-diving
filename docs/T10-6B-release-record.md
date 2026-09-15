# T10.6B release record — Workflow and user-data controls refinement

## Candidate

- Application: 1.0.29
- Baseline / rollback: app1.0.28 / Sites96 / deployment `appgdep_6aa93726debc8191a2d32b41359ab655`
- Canonical Sites project: `appgprj_6a91926878b48191a80d70f1681ef135`
- Task scope: T10.6B only; T11 remains not started.

## Implementation

- Workflow context is a compact, closed-by-default disclosure rather than a large permanent strip.
- Shared card density controls and the remaining Training/Wishlist controls use visible +/− symbols with accessible Expand/Collapse names.
- Generic Open detail button clutter is removed; supported card headings and complete user-data rows are accessible primary detail controls.
- Fixture review shows kind, label, matched field/value, dependency status, safe action and the reason an action is allowed or blocked.
- Universal record actions remain dependency-aware and inside the detail flow: Edit, Delete, Archive/suppress, Unlink or manual review.
- Destructive actions remain unselected by default and require exact typed owner confirmation.

## Local acceptance

- Focused: 5 files / 24 tests PASS.
- Full regression: 65 files / 339 tests PASS.
- TypeScript: PASS.
- Production build: PASS.
- PWA: PASS, 68 precache entries.
- Strict targeted lint: PASS for all new/shared T10.6B files; no new finding from the two bounded dashboard changes.
- Responsive browser checks: 390, 820, 1024 and 1440px PASS with no horizontal overflow.
- Keyboard/focus: disclosure, card detail, Escape and focus return PASS.
- Data safety: no owner record was changed or deleted during local verification.

## Production and source evidence

Publication, smoke-test and GitHub evidence are recorded after the candidate passes the same-project production gate.
