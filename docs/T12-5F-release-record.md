# T12.5F release record — Rental / temporary cylinder mode

- Status: COMPLETE, 2026-09-21.
- Canonical project: `appgprj_6a91926878b48191a80d70f1681ef135` at `https://zeustek-dive.amzeus.chatgpt.site/`.
- Baseline: app `1.0.46` / Sites `117` / deployment `appgdep_6ab18c6b2f2c81918f67c5eb06a529c0` / GitHub main `56ec161cd58ac637d14149f3015eae75f09dbe10`.
- Release: app `1.0.47` / Sites `118`.
- Published product source: `5ba71a87fa39565dcafa926ed4e0046424e5c08e`.
- Saved version: `appgprj_6a91926878b48191a80d70f1681ef135~appgver_f81c3e7837888191b39210c5fb1fed94`.
- Deployment: `appgdep_6ab1a4d3493c81919ec59b29ce0fcc5d`, SUCCEEDED.
- Stored archive: `sha256:b4ccc97144e5427609812f069776f2e55023a7f07b35033805b685777b7a02da`, 36,761,600 bytes, 314 files.
- Immediate rollback: app `1.0.46` / Sites `117`, saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_42f4fb6e41448191846fd8d74ff25ce3`, deployment `appgdep_6ab18c6b2f2c81918f67c5eb06a529c0`, source `d5a8322908023d5c529da8d6efbaa3b870ebcaf2`.

## Delivered

- Gas Planning keeps the accepted owned-cylinder path unchanged and adds an explicit `Use rental / temporary cylinder` source mode.
- Rental snapshots retain label, material/type, water volume, working/start/remaining pressure, valve, gas fractions, analysis state/source/date, operator/fill source and notes inside the Gas Plan.
- Rental values feed total/usable gas, reserve, MOD, PPO2, NDL and gas-limited-time calculations without requiring or creating a canonical cylinder.
- Rental service history is advisory rather than blocking. Missing volume, pressure, valve and Nitrox analysis remain visible warnings.
- `Save as cylinder` is an explicit, separately confirmed action. It is never automatic and preserves the Gas Plan as a rental snapshot.
- No decompression schedule, second cylinder store, destructive migration or owner-record rewrite was added.

## Verification

- Focused T12.5F plus release/version checks: 5 files / 31 tests passed.
- Full regression: 88 files / 496 tests passed.
- TypeScript, production build, final PWA precache (201 entries), version/PWA checks, targeted lint and diff check passed.
- Read-only production smoke passed on app `1.0.47`: owned-cylinder selection remained available; rental mode and all required fields/advisories/warnings rendered; explicit `Save as cylinder` confirmation did not create a cylinder; no horizontal overflow or browser-console errors.
- Owner-approved write acceptance created exactly one standalone synthetic Gas Plan named `T12.5F PRODUCTION ACCEPTANCE ONLY — DELETE AFTER TEST — 2026-09-21 22:00 BST`. It was not linked to a Dive or owned cylinder.
- Save/reopen retained rental mode, EAN32, analysis source/timestamp, 11.1 L volume, start/remaining pressure, DIN valve, 79-minute NDL, 22.7-minute gas-limited time, MOD/PPO2 and reserve evidence.
- The synthetic Gas Plan was deleted through the app after a separate action-time confirmation. Gas Planning returned to zero plans; the synthetic label was absent from Cylinders & Gas; no canonical cylinder was created.
- Production Logbook retained exactly 66 Dive cards. No real owner record was created, changed, linked or deleted.
- GitHub exact-product-source synchronization starts from published product commit `5ba71a87fa39565dcafa926ed4e0046424e5c08e`; the final main merge SHA is reported in the owner-facing completion report.
- Actual usage: NOT_EXPOSED. Max/Astra: not invoked or recommended.

T12.6R, T13 and T14 were not started.
