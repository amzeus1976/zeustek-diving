# T14 scoped release attempt — blocked at Gmail acceptance

The owner authorised one scoped production release through Stage 8, including Stage 5W. This attempt did **not** pass production acceptance. Do not report the scoped release as published and verified, and do not sync this candidate to GitHub main.

## Frozen candidate and local gate

- Application source commit: `18aa824c85cede9c66b9abf178d705552f72e0bc`; tree `a3a63b8a2729dcccf7dd3bcf73472b3e4127faa0`; branch `t14/master-forward-build`.
- App version `1.0.53`. The exact-tip full regression passed: 121 files, 697 tests. Typecheck and production build passed. PWA generated 398 precache entries; the complete 748-icon library was excluded from default precache. Targeted new/security-path lint passed; the pre-existing dashboard/offline monolith diagnostics were 80 versus 100 at the Stage 8 baseline. Four viewport widths (390, 820, 1024, 1440) passed locally without page overflow or application console errors.
- Nine frozen calculation files matched `protected-calculations.json`; no unauthorised `CALCULATION_TOUCHPOINT`. The built client privacy scan examined 78 files against six local server credentials and found zero matches. Local protected owner fixtures remained unchanged.
- Sites archive `work/t14-scoped-release-18aa824.tar.gz` (ignored, local only): SHA-256 `efeecf940ba54c4ab043a57736841a6ac4074d260f5763f8bae350d7de1cc725`, 84,125,035 bytes. It contains the worker, 16 migration entries and 748 complete-library PNGs. The standard Sites Bash packager could not run because this Windows host has no WSL distribution, so its documented preparation and archive layout were reproduced with the same `prepare-site-build.cjs` and native `tar`; the archive was validated before saving.

## Sites attempt and live evidence

- The Sites source repository received exact commit `18aa824`. The archive-backed version **Sites125** was saved as `appgprj_6a91926878b48191a80d70f1681ef135~appgver_4570ea5c98888191a57efe0465e6c0a3` and deployed as `appgdep_6ab4541a4d888191a5511877cd545441`.
- The custom domain served app `1.0.53`. Read-only smoke found the shipped Admin, Settings, Diver Summary Export, Dive Centres, Insights, Dive Planning, Gas Planning and Dive News routes. All five live Diver Summary format actions (PDF, DOCX, TXT, CSV, JSON) were invoked without application errors. The Weather & Conditions card showed Open-Meteo as the working no-key default, MET Norway available, and conditional providers unavailable/disabled. Four live viewport widths had no page-level overflow or application console errors. Local fixture tests inspected generated export content and privacy.
- The new authenticated cloud backup returned **6,362 records across 43 canonical kinds**, explicitly excluding the one legacy `gmail-connection-secret` row. Every one of those 43 kinds matched its pre-release count and sorted ID/content/timestamp SHA-256. Dives: 66, hash `8f08dd00ecb3d4806cd253f81b5aa3e0133ffd0301ddeb89d022d4ea76ca361e`; Gas Plans: one, hash `f5d274c372bc74fda7560750692f9277e987ee3610c032779539f50ca89d53f1`.

## Single Gmail acceptance and recovery

Before the run, `/api/gmail/status` reported configured, connected, expected dedicated mailbox identity, callback `https://dive.amzeus.co.uk/api/gmail/callback`, manual mode, no prior recorded run, and no diagnostic. The **one authorised** UI-triggered sync created durable run `fdeda6a4-5504-49d0-881d-d1795839955b` at `2026-09-23T22:41:59Z`. It finished `failed` with `upstream_failure` and the safe message “The mailbox provider could not complete the request.” Count/imported/updated/unchanged were zero; reconnect was not required. The prior last-success timestamp and count remained `2026-09-07T10:32:47.685Z` and 19. No second sync was attempted. The failure updated connection diagnostic metadata; it did not change cached newsletter records.

Because the mandatory Gmail acceptance check failed, Sites124 was restored using saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_921e3d981e848191b042bac6640ca80e`. Recovery deployment `appgdep_6ab455d58c248191840e6ed604373586` succeeded. The custom domain then served app `1.0.52`; its old authenticated backup returned 6,363 rows/44 kinds, including its legacy encrypted connection row. All 43 canonical non-connection kinds still matched their pre-release content hashes, including 66 Dives and one Gas Plan. The connection row is the only expected changed record from the failed run. The Sites source repository retains the candidate commit for recovery; **production is Sites124**. GitHub main remains `b2e86827c19239776c80b51fc93067c7dc4b18ac`; no GitHub PR, branch push or main sync was made.

## Required continuation

1. Diagnose the recorded `upstream_failure` through read-only provider/runtime evidence and local fixtures. Do not repeat the live mailbox sync: the owner's one-run authorisation has been used. Obtain a new explicit authorisation before any further live sync.
2. If code or server configuration changes, preserve the T14 branch, update tests first, and repeat the complete release, security, calculation, owner-data and browser gates against the new exact candidate. Do not weaken checks or silently enable conditional providers.
3. Before a new deployment, recheck the live Sites124 version/source and owner fingerprints; use Sites124 as rollback unless proven unhealthy. Publish only one corrected complete scoped candidate, perform read-only smoke, and run a separately authorised Gmail acceptance at its designated point.
4. Only after complete production acceptance, reconcile the exact accepted source to GitHub through a PR/main verification. Stage 9 nonblocking finishing and optional topic/public profile remain deferred in the issue ledger.
