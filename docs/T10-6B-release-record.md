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

- Same-project release: app 1.0.29 / Sites97.
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_583de89943f081919dbc2e699bbb230f`.
- Deployment: `appgdep_6aa941e6d96c819199f74f50ea064801` — SUCCEEDED.
- Published source: `76d80e4fab13ea43ff173373bf00cc804a039294`.
- Archive: `sha256:0acc6331f90a4be5d1f920210da5a63572ef4a0402143ba5488920b5bc16903d`, 21,698,560 bytes / 179 files.
- Rollback: app 1.0.28 / Sites96 / `appgdep_6aa93726debc8191a2d32b41359ab655`.
- Production smoke: PASS for compact workflow, visible `+`/`−` controls, primary card/row detail interaction, all 37 record kinds, nine retained fixtures, dependency-aware safe actions, zero default selection, 390px/PWA no-overflow, T09 Insights, T10 Dive Planning Centre and 66 retained Dives.
- Production data safety: no owner record changed or deleted during T10.6B acceptance.
- GitHub source sync: PR21 (`https://github.com/amzeus1976/zeustek-diving/pull/21`), release commit `121d1320127f3f3111b4978332c10e88b0a941cc`, release merge `b7e49dbedc28bf46dca9b10a3f8b8744f8f864f7`; documentation PR22 (`https://github.com/amzeus1976/zeustek-diving/pull/22`) merged and final main verified as `c7e6d60a273c6c226fee5f4968b17d7a4f456b4e`.
- Excluded from GitHub: secrets, credentials, private attachments, test media and `.artifacts/` deployment archives.
- Actual usage: NOT_EXPOSED. Max/Astra: not recommended. T11: not started.
