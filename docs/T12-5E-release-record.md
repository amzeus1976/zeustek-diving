# T12.5E release record — Cylinder → Gas Planner integration

- Status: COMPLETE, 2026-09-21.
- Canonical project: `appgprj_6a91926878b48191a80d70f1681ef135` at `https://zeustek-dive.amzeus.chatgpt.site/`.
- Live app/Sites: `1.0.46` / `117`.
- Published source: `d5a8322908023d5c529da8d6efbaa3b870ebcaf2`.
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_42f4fb6e41448191846fd8d74ff25ce3`.
- Deployment: `appgdep_6ab18c6b2f2c81918f67c5eb06a529c0`, SUCCEEDED.
- Archive: `sha256:a0b01da9efccb59eeb655b4e97bc3241a24a0051781abfc0d811677909f17976`, 36,730,880 bytes, 314 files.
- Immediate rollback: app `1.0.44` / Sites `115`, saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_f68f2e121610819192c7bdb8d20b9668`, deployment `appgdep_6aaea5a7d8448191a9c68e240414b63a`, source `daea36d63a63f8ce2108bddcb20e4d1a5303468a`.
- Pre-release production baseline: app `1.0.45` / Sites `116`, deployment `appgdep_6ab176c4b62881918e67626b06327126`, source `bd8af0feb24beab551c75a3fa56bc642a286b8d7`.

## Delivered integration

- Gas Planning reads the canonical `cylinder` plus compatible legacy cylinder inventory directly. Stable entity IDs remain the saved references; selector text includes display ID, volume, current gas, current pressure, analysis state and inspection state.
- Current pressure may come from the selected fill/pressure event, latest cylinder pressure, an explicit Plan snapshot or an owner-entered override. The source is always shown and canonical cylinder state is never silently overwritten.
- Usage and manual pressure-adjustment events remain auditable. They preserve the root fill and do not stale a composition analysis solely because pressure changed.
- Analyses follow `originFillId`; explicit owner-stale evidence is excluded, while a new composition-changing fill starts a new chain and makes prior analysis unavailable to that current fill.
- The details overlay reports manufacturer serial, water volume, valve, hydro/visual/O₂-clean evidence, current and root fill IDs, analysis ID/operator/source, pressure source and the readable fill → analysis → usage lineage.
- Hydro, visual, unknown/mismatched valve, missing volume and context-sensitive oxygen-clean warnings are included in Gas Planning readiness. Oxygen-clean evidence is not required merely for an ordinary air dive.
- No record kind, D1 table, destructive migration, second cylinder inventory, decompression plan or owner-record mutation was added.

## Verification

- Focused T12.5E and adjacent Gas tests: 6 files / 43 passed.
- Full regression: 87 files / 488 passed.
- TypeScript: passed. Production build: passed. PWA final precache: 201 entries. Version/PWA checks: 2 files / 4 passed. Targeted lint and diff check: passed.
- Local responsive acceptance: 390, 820, 1024 and 1440 px; no page or dialog horizontal overflow. Warning dialog Escape and focus restoration passed. Browser-console errors: none.
- Read-only production smoke: version `1.0.46` visible; Gas Planning opened; both existing canonical cylinders appeared with stable IDs, 12 L volume, Air/230 bar, analysis/test state; cylinder provenance showed current/root fill and linked analysis; 390 px page and nested dialogs did not overflow; Logbook retained exactly 66 Dive cards; browser-console errors: none.
- No live Gas Plan, cylinder, fill, analysis, pressure-use or Dive record was created or edited. Production write acceptance remains intentionally not performed because the owner did not approve a T12.5E live write test; deterministic local tests cover usage-only and composition-changing lineage.
- GitHub exact-product-source synchronization uses published product commit `d5a8322908023d5c529da8d6efbaa3b870ebcaf2`; the resulting main merge SHA is reported in the owner-facing final release report because a commit cannot contain its own merge result.
- Actual usage: NOT_EXPOSED. Max/Astra: not invoked or recommended.

T12.6R, T13 and T14 were not started.
