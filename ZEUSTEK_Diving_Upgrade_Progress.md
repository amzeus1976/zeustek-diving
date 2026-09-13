# ZeusTek Diving Upgrade Progress

> Work agent: resolve the Windows Desktop path with `[Environment]::GetFolderPath('Desktop')` and maintain this file as `ZEUSTEK_Diving_Upgrade_Progress.md`. Update atomically after every subtask. If local Desktop access is unavailable, maintain the same file at repository root, set `Desktop sync: PENDING`, and copy it to Desktop as soon as local access becomes available. Never claim it is on the Desktop unless the write succeeded.

**Project status:** IN_PROGRESS — scheduled same-task T02 continuation; production known-good
**Current app version:** production 1.0.2 / Sites67 (accepted)
**Current task:** T02 Conservation & AWARE IN_PROGRESS — T03 not authorized
**Primary task planning envelopes:** 820 credits / planning estimate £24.24
**Normal contingency:** 82 credits / planning estimate £2.43
**Astra rescue reserve:** 60 credits / planning estimate £1.78
**Project planning envelope:** 962 credits / planning estimate £28.48
**Owner cash ceiling:** £30
**Cumulative observed credits:** NOT_EXPOSED
**Cumulative observed planning £:** NOT_EXPOSED
**Budget trend:** NOT_EXPOSED — no inferred allowance percentages or billing guarantees; bounded workflow only
**Authoritative account usage checked by owner:** NOT_RECORDED
**Current known-good production version/deployment:** Sites67 / appgdep_6aa5936c62dc819196ad17dae023e745 — succeeded 2026-09-12T18:01:33.221982Z; production smoke PASS
**Current release candidate:** 1.0.3 — T02 local gate PASS; publication pending; preceding source 46c84930ba676f1778ef93770b3b98e4604f2835
**Last rollback reference:** T02 known-good Sites67 / saved version appgprj_6a91926878b48191a80d70f1681ef135~appgver_09881d6e2a84819182a7601053363090
**Desktop sync:** VERIFIED — C:/Users/amzeu/OneDrive/Desktop (resolved by Windows Desktop API in host context)

| ID | Task | Status | Planning credits | Planning £ | Observed credits | Observed £ | Published version | Commit/deploy |
|---|---|---|---:|---:|---:|---:|---|---|
| T00 | Bootstrap: Version, Changelog, Progress & Regression Baseline | COMPLETE | 15 | £0.44 | NOT_EXPOSED | NOT_EXPOSED | 1.0.1 / Sites66 | 2f0e58a3c0f28cfb6d36e1368d8593dc07b8a3cc / appgdep_6aa585eb5bc88191926d2a8dd43c4408 |
| T01 | Dive Log Multi-View — Overview / Debrief / Story | COMPLETE | 30 | £0.89 | NOT_EXPOSED | NOT_EXPOSED | 1.0.2 / Sites67 | 46c84930ba676f1778ef93770b3b98e4604f2835 / appgdep_6aa5936c62dc819196ad17dae023e745 |
| T02 | Conservation & AWARE | IN_PROGRESS | 35 | £1.03 | NOT_EXPOSED | NOT_EXPOSED | NOT_PUBLISHED | Known-good Sites67 / 46c84930ba676f1778ef93770b3b98e4604f2835 |
| T03 | Wreck & Overhead | NOT_STARTED | 40 | £1.18 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T04 | Trips & Expeditions | NOT_STARTED | 45 | £1.33 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T05 | Reusable Loadouts + Gas/Cylinder Foundation | NOT_STARTED | 55 | £1.63 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T06 | Skills & Currency | NOT_STARTED | 60 | £1.77 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T07 | Technical Diving Workspace | NOT_STARTED | 65 | £1.92 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T08 | Professional Development / PADI Pro | NOT_STARTED | 70 | £2.07 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T09 | Experience & Analytics | NOT_STARTED | 75 | £2.22 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T10 | Dive Planning Centre | NOT_STARTED | 85 | £2.51 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T11 | Question Bank Review, Diagnostics & AI Study Workflow | NOT_STARTED | 95 | £2.81 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T12 | Dive Computer Data & Profile Import | NOT_STARTED | 110 | £3.25 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |
| T13 | Final Navigation / Settings UX Tidy | NOT_STARTED | 40 | £1.18 | NOT_EXPOSED | NOT_EXPOSED | NOT_EXPOSED |  |


## T01 release completion and unattended scheduling check — 2026-09-12 19:05 Europe/London

T01 COMPLETE after full gate and successful canonical publication/production smoke. Release evidence: docs/T01-release-record.md. Production healthy app1.0.2 / Sites67; no rollback. No T02 work performed.

Overnight scheduling: BLOCKED_ACCESS, separate from completed T01. No Run A/B/C automation was created and no scheduled-run ID exists.

Requested one-time Europe/London times: A 2026-09-12 22:36; B 2026-09-13 03:37; C 2026-09-13 08:38. These are requested times, NOT confirmed schedules.

Exact access evidence: the available Codex automation API documents standalone cron executionEnvironment=local, not scheduled ChatGPT Work cloud execution. list_projects returned only projectKind=chatgpt entries with hostId=null; no registered local project resolves to the existing zeustek-expansion-v15 working copy. The ChatGPT project labelled Zeus Dive is not proof of unattended access to Windows source, Desktop tracker or the canonical Sites deployment. No source files/credentials were copied into another project and no substitute local/cloud job was created.

Next action: owner must provide a scheduler-backed execution project that genuinely retains this exact working copy, Sites publish/rollback connector and production smoke access, or explicitly choose a supported local Codex continuation arrangement. Then create and verify the requested one-time schedules using the product scheduling mechanism; do not invent a schedule or bypass missing access. Past requested times require owner direction rather than silently rescheduling.

Next implementation task remains T02 — Conservation & AWARE; planning envelope35, relative complexity only. Paid immediate authorization was T01 only. Overnight scope T02–T13 is conditional on genuine scheduling access; read persisted map/current task only, complete one task's entire gate before considering the next, bounded initial + at most two materially different repairs, ChatGPT review before any owner-approved Astra, stop at blocked task without bypassing it. Run C must add MORNING_STATUS if actually executed. Actual usage: NOT_EXPOSED; cannot enforce or guarantee included-only allowance. No ChatGPT review/Astra escalation is recommended for this access limitation.

## Full subtask job list

> This is the owner-visible job list. Every subtask starts `NOT_STARTED`; update the row atomically when work begins/completes/blocks. Planned credits sum to the parent task Planning Credit Envelope. Observed credits must be `NOT_EXPOSED` if the product does not expose them; never invent actual usage.

| Task | Subtask | Status | Planned credits | Observed credits | Notes |
|---|---|---|---:|---:|---|
| T00 | Access/publish preflight | COMPLETE | 1 | NOT_EXPOSED |  |
| T00 | Version source + footer | COMPLETE | 3 | NOT_EXPOSED |  |
| T00 | Changelog route/data | COMPLETE | 3 | NOT_EXPOSED |  |
| T00 | Progress file + repository map | COMPLETE | 3 | NOT_EXPOSED |  |
| T00 | Regression baseline + deploy verification | COMPLETE | 3 | NOT_EXPOSED |  |
| T00 | Publish/smoke/changelog record | COMPLETE | 2 | NOT_EXPOSED | Corrected cached-shell smoke procedure; production PASS |
| T01 | Locate existing Dive detail and baseline tests | COMPLETE | 3 | NOT_EXPOSED | Logbook RecordDetail popup; dives.ts; local-dive-store.test.ts |
| T01 | Additive Dive/debrief/story field/migration mapping | COMPLETE | 5 | NOT_EXPOSED | Optional JSON sections;7 focused persistence/compatibility tests pass; no SQL delta/backfill |
| T01 | Shared header + pill selector shell | COMPLETE | 5 | NOT_EXPOSED | Same popup/ID; labelled semantic tabs,44px targets; local switch/keyboard and2 shell tests pass |
| T01 | Overview recomposition without duplication | COMPLETE | 4 | NOT_EXPOSED | All old factual rows retained; shared summaries and original Plan comparison; existing source status preserved; no old computer-profile visualization existed to remove |
| T01 | Debrief view + shared evidence links | COMPLETE | 4 | NOT_EXPOSED | Shared skill_evidence adapter/selection/inline evidence; no copied Skill/session or T06 workspace; empty and unavailable references retained |
| T01 | Story view + attachment references | COMPLETE | 3 | NOT_EXPOSED | Canonical attachment IDs and account-scoped non-authoritative metadata cache; offline-origin edit/reopen/feature retention verified; no copied binaries |
| T01 | Responsive/offline/a11y verification + publish | COMPLETE | 6 | NOT_EXPOSED | Focused14 PASS; full24 files/108 tests PASS; typecheck/build PASS; offline-origin retention and narrow reflow/AX/keyboard PASS; Sites67 production affected + unrelated-route smoke PASS. Physical VoiceOver/Dynamic Type not claimed. |
| T02 | Locate current Development/Activity integration point | COMPLETE | 3 | NOT_EXPOSED | Existing section navigation/dashboard-client.tsx, generic dive-store core mutations and account-scoped cloud records; canonical Dive/Site/Person popups reused |
| T02 | Schema/repository + additive migration | COMPLETE | 6 | NOT_EXPOSED | Additive canonical JSON kinds/schema; no SQL/table changes/backfill. Owner permits existing private cloud media rather than new encryption. |
| T02 | Dashboard + activity list/detail/form | COMPLETE | 10 | NOT_EXPOSED | Existing navigation/core CRUD; seven activity types, filters, details, reference version capture and summaries. |
| T02 | Dive/Site/Person/attachment references | COMPLETE | 5 | NOT_EXPOSED | Canonical IDs/deep links, private media uploads, optional PDF/text files and retry-link recovery. Local upload/reopen verified. |
| T02 | Derived progress + responsive/offline states | COMPLETE | 4 | NOT_EXPOSED | Version-bound targets, survey/removal separation, offline-origin save/reopen and attachment retention;390/820/1280 reflow,44px targets,keyboard dialogs. Physical assistive-device testing not claimed. |
| T02 | Tests/regression/publish | IN_PROGRESS | 7 | NOT_EXPOSED | Targeted12 PASS; full26 files/118 PASS; typecheck/build PASS; candidate1.0.3 publication/smoke pending. |
| T03 | Locate Site detail/current site model | NOT_STARTED | 3 | NOT_EXPOSED |  |
| T03 | Optional overhead-profile schema/repository | NOT_STARTED | 6 | NOT_EXPOSED |  |
| T03 | Site-detail integration + dedicated presentation | NOT_STARTED | 11 | NOT_EXPOSED |  |
| T03 | Hazards/routes/media/dated observations | NOT_STARTED | 7 | NOT_EXPOSED |  |
| T03 | Progressive disclosure + responsive/a11y | NOT_STARTED | 5 | NOT_EXPOSED |  |
| T03 | Tests/regression/publish | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T04 | Locate Dive navigation/Plan/Site integrations | NOT_STARTED | 3 | NOT_EXPOSED |  |
| T04 | Trip schema/repository + migration | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T04 | Trip list/detail/editor hierarchy | NOT_STARTED | 12 | NOT_EXPOSED |  |
| T04 | Plan/Site/Person/equipment/document links | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T04 | Packing/logistics/readiness + responsive/offline | NOT_STARTED | 6 | NOT_EXPOSED |  |
| T04 | Tests/regression/publish | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T05 | Locate Equipment/Equipment Set/Cylinder flows | NOT_STARTED | 4 | NOT_EXPOSED |  |
| T05 | Loadout + cylinder fill/analysis schema/migration | NOT_STARTED | 12 | NOT_EXPOSED |  |
| T05 | Reusable loadout list/detail/editor | NOT_STARTED | 11 | NOT_EXPOSED |  |
| T05 | Cylinder fill/analysis history UI | NOT_STARTED | 9 | NOT_EXPOSED |  |
| T05 | Apply-to-plan/dive references + overrides | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T05 | Responsive/offline/history compatibility | NOT_STARTED | 4 | NOT_EXPOSED |  |
| T05 | Tests/regression/publish | NOT_STARTED | 7 | NOT_EXPOSED |  |
| T06 | Locate Training/Skills/certification flows | NOT_STARTED | 4 | NOT_EXPOSED |  |
| T06 | Skill evidence + currency-policy schema/migration | NOT_STARTED | 12 | NOT_EXPOSED |  |
| T06 | Skills dashboard/detail/evidence timeline UI | NOT_STARTED | 13 | NOT_EXPOSED |  |
| T06 | Deterministic currency projection/policy logic | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T06 | Dive/Debrief/training evidence linking | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T06 | Responsive/offline/a11y | NOT_STARTED | 5 | NOT_EXPOSED |  |
| T06 | Tests/regression/publish | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T07 | Locate shared Plan/Skill/Equipment/Gas sources | NOT_STARTED | 4 | NOT_EXPOSED |  |
| T07 | Versioned pathway/reference mapping | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T07 | Technical workspace/readiness UI | NOT_STARTED | 15 | NOT_EXPOSED |  |
| T07 | Evidence/drill/configuration deep links | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T07 | Tec-plan progressive disclosure integration | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T07 | Gas/deco evidence boundaries + responsive | NOT_STARTED | 6 | NOT_EXPOSED |  |
| T07 | Tests/regression/publish | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T08 | Locate Training/Development/evidence sources | NOT_STARTED | 4 | NOT_EXPOSED |  |
| T08 | Pathway/evidence/reference schema/migration | NOT_STARTED | 12 | NOT_EXPOSED |  |
| T08 | Professional readiness workspace UI | NOT_STARTED | 16 | NOT_EXPOSED |  |
| T08 | Requirement/evidence matrix + drill-down | NOT_STARTED | 13 | NOT_EXPOSED |  |
| T08 | Existing Dive/Skill/Person/Site evidence links | NOT_STARTED | 9 | NOT_EXPOSED |  |
| T08 | Versioned standards + responsive/offline | NOT_STARTED | 6 | NOT_EXPOSED |  |
| T08 | Tests/regression/publish | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T09 | Locate canonical Dive/Site/Equipment evidence sources | NOT_STARTED | 4 | NOT_EXPOSED |  |
| T09 | Define metric denominators/unknown/provenance rules | NOT_STARTED | 12 | NOT_EXPOSED |  |
| T09 | Derived projection/query implementation | NOT_STARTED | 15 | NOT_EXPOSED |  |
| T09 | Analytics cards/charts/tables UI | NOT_STARTED | 17 | NOT_EXPOSED |  |
| T09 | Source-record drill-down + accessible equivalents | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T09 | Responsive/performance/empty states | NOT_STARTED | 6 | NOT_EXPOSED |  |
| T09 | Tests/regression/publish | NOT_STARTED | 11 | NOT_EXPOSED |  |
| T10 | Locate existing Plans list/detail/editor/lifecycle | NOT_STARTED | 5 | NOT_EXPOSED |  |
| T10 | Plan schema/migration/backfill compatibility | NOT_STARTED | 15 | NOT_EXPOSED |  |
| T10 | Planner detail/editor hierarchy | NOT_STARTED | 20 | NOT_EXPOSED |  |
| T10 | Readiness/HF/checklist/team/equipment/gas interactions | NOT_STARTED | 13 | NOT_EXPOSED |  |
| T10 | Plan→Dive promotion + plan-vs-actual integrity | NOT_STARTED | 12 | NOT_EXPOSED |  |
| T10 | Responsive/offline/progressive disclosure | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T10 | Tests/regression/publish | NOT_STARTED | 12 | NOT_EXPOSED |  |
| T11 | Locate canonical question/bank/attempt/topic services | NOT_STARTED | 6 | NOT_EXPOSED |  |
| T11 | Suppression/review metadata + historical integrity | NOT_STARTED | 12 | NOT_EXPOSED |  |
| T11 | ⚠ review/suppress UI + reason workflow | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T11 | Required sort + topic/subtopic diagnostic drill-down | NOT_STARTED | 18 | NOT_EXPOSED |  |
| T11 | Incremental AI export + previous-advice continuity | NOT_STARTED | 16 | NOT_EXPOSED |  |
| T11 | Study-pack ZIP validation/import/export | NOT_STARTED | 15 | NOT_EXPOSED |  |
| T11 | Tests/regression/publish | NOT_STARTED | 18 | NOT_EXPOSED |  |
| T12 | Locate Dive import/profile/attachment infrastructure | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T12 | Import/profile schema + adapter contract | NOT_STARTED | 15 | NOT_EXPOSED |  |
| T12 | Source hash/store + adapter detection/idempotency | NOT_STARTED | 15 | NOT_EXPOSED |  |
| T12 | Neutral parser/worker/profile pipeline | NOT_STARTED | 18 | NOT_EXPOSED |  |
| T12 | Dive matching + recorded/imported reconciliation | NOT_STARTED | 18 | NOT_EXPOSED |  |
| T12 | Import wizard/profile chart/recent imports UI | NOT_STARTED | 14 | NOT_EXPOSED |  |
| T12 | Offline/performance/source preservation | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T12 | Tests/regression/publish | NOT_STARTED | 14 | NOT_EXPOSED |  |
| T13 | Audit final routes/settings functions | NOT_STARTED | 4 | NOT_EXPOSED |  |
| T13 | Final IA/grouping plan preserving deep links | NOT_STARTED | 5 | NOT_EXPOSED |  |
| T13 | Settings disclosure/dropdown + direct links | NOT_STARTED | 10 | NOT_EXPOSED |  |
| T13 | Dive navigation grouping/tidy | NOT_STARTED | 8 | NOT_EXPOSED |  |
| T13 | Responsive/a11y/active-route behaviour | NOT_STARTED | 5 | NOT_EXPOSED |  |
| T13 | Tests/regression/publish | NOT_STARTED | 8 | NOT_EXPOSED |  |

Allowed status values: `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE`, `BLOCKED`, `BLOCKED_ACCESS`, `BLOCKED_ASTRA`, `BLOCKED_BUDGET`, `BLOCKED_DEPLOYMENT`, `BLOCKED_REVIEW`.


## Current task checklist

- [x] Previous task COMPLETE / known-good production confirmed
- [x] Pre-task budget gate completed (or usage marked NOT_EXPOSED)
- [x] Known-good commit/deployment + rollback mechanism recorded
- [x] Status changed to IN_PROGRESS before code changes
- [x] Baseline route/page recorded
- [x] Existing behaviour/screenshots/tests identified
- [x] Data/schema impact recorded
- [x] Implementation complete
- [x] Targeted tests pass
- [x] Full regression/build pass
- [x] Responsive website verified
- [x] Installed-PWA/offline behaviour verified where applicable
- [x] Candidate version/changelog prepared before publish
- [x] Production published only after release-candidate gate passed
- [x] Production smoke test passed
- [x] If smoke failed: immediate rollback performed, rollback health verified, BLOCKED_DEPLOYMENT recorded
- [x] Version footer and changelog updated
- [x] Observed credit/cost entered only if exposed; otherwise NOT_EXPOSED
- [x] Status changed to COMPLETE

## Blockers / decisions

T00 BLOCKED_DEPLOYMENT: candidate publication succeeded, but required production version-link smoke test failed. Immediately rolled back to Sites65; rollback hosting status and populated Overview/Logbook health verified. Candidate source preserved. T01 not authorised/not started.

## Discovered repository map

Record exact paths as discovered so later tasks can reuse them without searching again:

- App shell/navigation: app/dashboard-client.tsx
- Version source: package.json (current1.0.1)
- Changelog route/component: components/app-changelog.tsx; lib/app-changelog.ts; /?section=Changelog
- Dive repository/mutation service: lib/offline/dives.ts; lib/offline/dive-store.ts
- Router: existing section state/deep-link handling in app/dashboard-client.tsx
- Equipment repository: lib/offline/dive-planning.ts
- Skills repository: current TrainingV2 in app/dashboard-client.tsx; components/knowledge-centre.tsx
- Question-bank repository: lib/knowledge-tests.ts; components/knowledge-centre.tsx
- Deployment command/pipeline: existing Sites canonical project; build and package helpers / established pnpm build; save/deploy immutable versions
- Editable source/project confirmed: appgprj_6a91926878b48191a80d70f1681ef135; same source worktree zeustek-expansion-v15
- Production origin: https://zeustek-dashboard.amzeus.chatgpt.site/
- PWA launch variant verified: /?source=pwa on same canonical origin; original manifest scope / unchanged
- Last known-good commit/version: 2f0e58a3c0f28cfb6d36e1368d8593dc07b8a3cc / app1.0.1 / Sites66
- Last known-good deployment/rollback reference: current appgdep_6aa585eb5bc88191926d2a8dd43c4408; rollback Sites65 / source898d5124b6cc4b728c25f6a0a4c6c1b867afdc13
- Current release candidate/deployment: NONE; T00 accepted, Sites66
- Current budget band: NOT_EXPOSED
- Current Astra handoff: NONE


## T00 persisted preflight / execution map

- Checkout: C:/Users/amzeu/Documents/Codex/2026-08-29/in-app-browser-context-source-ambient/zeustek-expansion-v15 (same repository clean worktree; existing dirty checkout preserved).
- Canonical project: appgprj_6a91926878b48191a80d70f1681ef135; audience public, unchanged.
- Known-good source: 898d5124b6cc4b728c25f6a0a4c6c1b867afdc13; Sites 65; formal package version 1.0.0.
- Editable source verified: existing repository main fetched, short-lived editor credential issued, push dry-run succeeded without remote mutation.
- Publish: existing Sites pipeline; build-site.mjs → commit/push same remote main → package-site.mjs → save_site_version → deploy_site_version → smoke.
- Rollback: deploy_site_version with the above archive-backed known-good saved version, then verify production health.
- Shell/router: app/dashboard-client.tsx; in-app section state and existing ?section= deep links; layout app/layout.tsx; styles app/focus.css.
- Version authority: package.json; T00 component components/app-changelog.tsx reads package version directly; changelog lib/app-changelog.ts.
- Dive repositories: lib/offline/dives.ts, lib/offline/dive-planning.ts; core mutations lib/offline/dive-store.ts; local DB lib/offline/db.ts; encrypted backup lib/offline/cloud-platform.ts.
- Equipment/site/plans/training/media repositories: lib/offline/dive-planning.ts; skills/knowledge UI components/knowledge-centre.tsx; canonical questions/attempts lib/knowledge-tests.ts.
- PWA registration components/pwa-register.tsx; same-origin manifest /manifest.webmanifest (hosted response 200); unchanged current PWA infrastructure. vite.config.ts:67 manifest start_url /?source=pwa confirms same application/origin.
- Browser baseline: Overview, Logbook, Sites, Equipment, Albums, Dive Plans, Training, Course Map, Dive News, Dive Media successfully opened on production65 with populated existing records; snapshots persisted separately. No console errors at baseline.
- Schema/mutation impact: NONE for T00. No domain data writes.
- Desktop API in host context resolved C:/Users/amzeu/OneDrive/Desktop; writes verified below.
- Cost rule supersession 2026-09-12: actual usage NOT_EXPOSED; no usage inference or percentage bands; envelopes complexity only. Exactly one task per owner authorization. Stop after COMPLETE with OWNER_BUDGET_CHECK_REQUIRED.
- Current task envelope: 15 planning credits; bounded repairs only; no Astra recommended.

## T00 release-candidate gate — 2026-09-12

- Focused test: tests/app-changelog.test.ts — 2/2 pass.
- Required regression: 20 test files, 92/92 tests pass, including local-dive-store and mobile-regressions durability suites.
- Typecheck: PASS after current locked dependencies were installed.
- Build: PASS via the established pnpm run build, emitted Worker dist/server/index.js, manifest and service worker. Final PWA precache 69 entries.
- Generic Sites install/build helpers rejected pre-existing package-lock.json + pnpm-lock.yaml ambiguity; used declared pnpm directly with frozen lockfile; neither lockfile or dependency manifest was changed except version patch. No unrelated refactor.
- Build warnings: existing large chunks; deprecated alias/inlineDynamicImports settings; intermediate PWA glob warnings, final precache populated. Non-blocking, retained for future consideration, no scope expansion.
- Responsive QA: changelog at 1280px desktop, 390px phone, 820px tablet — no horizontal overflow. Phone menu version link accessible via keyboard and closes menu after activation.
- Same app PWA deep link: /?section=Changelog&source=pwa successfully opens hydrated changelog. Original PWA manifest start_url /?source=pwa, scope / preserved. Native installed-device test not available here; no claim of physical iPhone testing.
- Read-only change: no new domain storage/network operations, schema or entity modifications. Existing offline/local-durability regression passes.
- React quality review: small typed components; stable release/list keys; semantic link/heading/list/time and focus outline; no effects or new fetching/mutations. No material changes required.
- Desktop sync: actual host Desktop API resolved C:/Users/amzeu/OneDrive/Desktop; file read back after apply_patch write. Repository and Desktop maintained together (newline representation may differ).
- Ready for same-project publish; production65 remains authoritative until smoke passes. T01 NOT_STARTED.

## T00 failed publication / immediate rollback — 2026-09-12

- Candidate formal version 1.0.1; Sites66 saved version appgprj_6a91926878b48191a80d70f1681ef135~appgver_3844a3e82a1881918526b2dde495a522.
- Exact pushed source: 2f0e58a3c0f28cfb6d36e1368d8593dc07b8a3cc. Same canonical project/main. Candidate deployment appgdep_6aa58303be648191b35e922dd19cafa9 reported succeeded at 16:51:47 UTC.
- Production smoke FAILED: after reload, accessible link “Version 1.0.1. Open changelog” was not present; waitFor reported no_matches. Existing old-looking dashboard remained visible with records. Local candidate checks had passed. Client/cache consistency is suspected but NOT established as root cause.
- Immediate rollback started as soon as smoke failed: redeployed archive-backed Sites65, saved version appgprj_6a91926878b48191a80d70f1681ef135~appgver_5c335973c06c81919119bcda15083f1d.
- Rollback deployment appgdep_6aa5834a7b6c8191bb56a206658589b2 reported succeeded at 16:52:39 UTC, env revision3 preserved.
- Rollback health verified using same-origin /?source=pwa: existing Overview showed66 dives and original navigation with no new version footer; Logbook opened and showed latest St Abbs Harbour – East, dive66, plus prior records. No console errors observed. Temporary inconsistent cached/loading content appeared during refresh; no deletion or domain data mutation performed.
- Production authority remains known-good Sites65 / source898d5124b6cc4b728c25f6a0a4c6c1b867afdc13. Remote main retains tested candidate for diagnosis; no claim that remote main currently equals live rollback source.
- T00 is BLOCKED_DEPLOYMENT, NOT COMPLETE. Candidate version/changelog not accepted as current live app. Failed-release record in docs/T00-release-record.md.
- Focused tests2/2, full regression92/92, typecheck PASS, build PASS. No additional implementation/debugging approach after production failure; STOP rule applied.
- Packaging Windows fallback: Sites helper executed via installed Git Bash with /c/... paths after default WSL Bash denied access; archive validated and saved. No arbitrary new packaging implementation.
- Astra recommendation: NONE. No invocation/model switch. Actual usage: NOT_EXPOSED. Planning percentages NOT used.
- Next required action: owner-authorised resumption of T00 deployment/client-cache smoke blocker (same T00 envelope15, complexity only). Next sequential feature task after T00 COMPLETE would be T01 Dive Log Multi-View — Overview / Debrief / Story, planning envelope30. T01 remains NOT_STARTED and its task specification has not been opened.
- OWNER_BUDGET_CHECK_REQUIRED. Do not proceed automatically.

## T00 authorized focused resumption — 2026-09-12

- Owner authorizes T00 only; one materially different repair attempt, no Astra, no T01. Baseline production remains restored65 / appgdep_6aa5834a7b6c8191bb56a206658589b2 until successful smoke.
- Planning envelope15 remains relative complexity only; actual usage NOT_EXPOSED. No percentage usage bands or spending inference.
- Diagnosis: focused test uses installed Workbox NetworkFirst to reproduce current networkTimeoutSeconds:1 returning cached release65 HTML before a healthy release66 response; cache then contains newer HTML after network completes. The previous waitFor against stale loaded HTML cannot insert a link. Prior post-rollback observation of candidate footer supports a delayed shell/cache transition.
- Excluded by evidence: candidate render contains exact aria-label “Version 1.0.1. Open changelog”, valid href /?section=Changelog, and built SSR chunk contains app-version-link. Candidate .openai manifest matches canonical project. Previously verified1280/390/820px layouts, accessible phone menu; no selector or responsive implementation correction warranted.
- Production HTTP probe outside browser was redirected to OpenAI sign-in/challenge; not used as deployment health evidence and no attempt to bypass challenge.
- Smallest correction is release smoke procedure, NOT product cache/auth/data code. Preserve existing PWA/offline behavior; explicitly warm the online root, await load settlement, then reload before final expected-link check, and wait for hydrated panel before navigation assertions. Single bounded procedure; if final acceptance fails, rollback65 and STOP without further approaches.
- Targeted checks: tests/t00-release-cache.test.ts plus tests/app-changelog.test.ts —4/4 PASS. Product source diff against candidate2f0e58a3c0f28cfb6d36e1368d8593dc07b8a3cc is empty. Preserve/reuse existing full92-test/typecheck/build PASS evidence; no rebuild or full regression justified.
- Reuse existing archive-backed saved Sites66 rather than rebuild/repackage/resave unchanged product. No remote/source push needed for same immutable candidate. New tests and release records are audit-only working-copy artifacts, not a competing production revision.
- Retry local gate PASS; ready for one same-project republish and corrected smoke gate.

## T00 COMPLETE — focused retry production evidence, 2026-09-12

- Accepted app version1.0.1, saved Sites66 version appgprj_6a91926878b48191a80d70f1681ef135~appgver_3844a3e82a1881918526b2dde495a522.
- Production deployment appgdep_6aa585eb5bc88191926d2a8dd43c4408 reported succeeded at17:03:51 UTC, env revision3, unchanged canonical https://zeustek-dashboard.amzeus.chatgpt.site/ and audience public.
- Exact production source2f0e58a3c0f28cfb6d36e1368d8593dc07b8a3cc. Reused the already built/pushed/archive-backed candidate; no competing app-version source or redundant rebuild/resave.
- Diagnosis confirmed operationally: first post-publish reload can show stale cached authenticated HTML due to current PWA NetworkFirst1-second race. Installed Workbox behavior was reproduced locally; warming online root and reloading after bounded settlement made the SAME unchanged candidate visible. Thus absent link was a stale-shell/smoke-procedure mismatch, not wrong project, malformed link/accessibility name, or responsive footer implementation.
- Corrected smoke procedure: reload existing /?source=pwa, wait for supported load milestone, allow5-second bounded cache settlement, reload, assert visible role=link exact accessible name “Version 1.0.1. Open changelog”, then activate with Enter and await visible Changelog heading. Browser networkidle method was unavailable; supported load + explicit bounded settlement used within same single authorized procedure, not another repair approach.
- Final production version-link assertion PASS. AX state showed footer link; activated link opened real read-only Changelog panel. DOM: heading=Changelog, currentVersionText=Current version:1.0.1, footer=v1.0.1 · Changelog; desktopwidth1448, no horizontal overflow.
- Unrelated production Logbook PASS: Dive logbook heading, latestSt Abbs Harbour – East, version footer remains1.0.1. Overview retained66dives before opening Changelog. Browser console errors observed: NONE.
- Regression/build: retain previously passed92/92 tests, typecheck and full production build because product/runtime code is unchanged. Targeted diagnostic + original changelog4/4 PASS. Diagnostic subsequently made independent of transient hashed build filenames/current patch number so it cannot break later clean checkouts; only changed diagnostic2/2 rerun PASS.
- Existing1280/390/820 responsive and same-app PWA deep-link evidence retained; no physical iPhone/native installed-app test claimed. Existing offline/local durability regression evidence retained. No new domain mutations or data/schema/encryption/sync/backup changes.
- Version/changelog accepted as1.0.1; release audit docs/T00-release-record.md records both initial rollback and accepted retry. Desktop and repository progress synchronized and read-back verified.
- T00 all6subtasks COMPLETE. T01 NOT_STARTED; specification not opened. Next taskT01 Dive Log Multi-View — Overview / Debrief / Story; relative planning envelope30credits. Do not start until owner explicitly authorizes it after budget inspection.
- Astra recommendation NONE; external review recommendation NONE (no active blocker). Actual credit/cash/token usage NOT_EXPOSED; no estimates/usage percentage thresholds used.
- Current checklist rollback item reflects initial failed smoke rollback65 and health verification; no retry rollback was needed. PWA/offline checklist reflects same-origin launch and retained durability tests, not physical installed-device validation.
- STOP: OWNER_BUDGET_CHECK_REQUIRED.

## Owner escalation rule — ChatGPT review before Astra (2026-09-12)

After bounded Sol attempts leave a genuine blocker, first assess suitability for compact external diagnostic/architecture review. Suitable: requirement interpretation, architecture/data-model ambiguity, logs/failing-test diagnosis, small source review, pack/implementation conflict, UI/deployment/acceptance root cause, safe migration/compatibility, or wrong test/assumption. Not suitable where compressed reasoning adds no value and direct mutation/credentials/live interaction/large-scale execution is fundamental.

Complete independent safe work, preserve known-good production, do not start the next task or invoke Astra. When suitable, create CHATGPT_REVIEW_HANDOFF.md with exact owner structure (TASK, CURRENT STATE, EXACT BLOCKER, EXPECTED BEHAVIOUR, ACTUAL BEHAVIOUR, ERROR / TEST / DEPLOYMENT OUTPUT, RELEVANT FILES [target3–6], WHAT I ALREADY TRIED, WHAT MUST NOT CHANGE, EXACT QUESTION FOR REVIEW, RECOMMENDED NEXT ACTION IF REVIEW CONFIRMS ROOT CAUSE, ASTRA STILL REQUIRED? YES/NO/UNKNOWN). Mark BLOCKED_REVIEW and stop CHATGPT_REVIEW_REQUIRED.

Owner-returned SOL_RETURN_INSTRUCTIONS are focused diagnostic/review input, not authority to expand scope. Implement only narrow recommended fix, targeted verification and task publish gate; stop OWNER_BUDGET_CHECK_REQUIRED. Only unresolved review, identified higher-capability reasoning need, or failure after returned narrow fix may lead to Astra proposal under existing owner-approved protocol. Never invoke Astra automatically or offload ordinary implementation. This rule is persisted for future tasks; no handoff needed for successful T00.

## T01 safe working-copy checkpoint — 2026-09-12

- Owner authorizes T01 only; task planning envelope30 is relative complexity. Actual usage NOT_EXPOSED; no estimates/percentages or account/billing changes.
- Previous task T00 COMPLETE. Before T01 edits, known-good production recorded: app1.0.1 / Sites66 / source2f0e58a3c0f28cfb6d36e1368d8593dc07b8a3cc / deploymentappgdep_6aa585eb5bc88191926d2a8dd43c4408, prior accepted smoke PASS. No production mutation or fresh smoke claim this run.
- T01 rollback authority: saved Sites66 appgprj_6a91926878b48191a80d70f1681ef135~appgver_3844a3e82a1881918526b2dde495a522. Older Sites65 entries above are historical T00 evidence, NOT the T01 rollback target.
- Working copy preserved, unpublished; package remains1.0.1. No candidate version/changelog, source push, package/save/deploy or full regression/build gate performed prematurely. T02 NOT_STARTED.
- Implemented and verified subtask detail: docs/T01-dive-perspectives-checkpoint.md. Exact new source: components/dive-record-detail.tsx; lib/offline/dive-perspectives.ts; optional interfaces lib/offline/dives.ts. Integration app/dashboard-client.tsx, styles app/focus.css, opt-in Story checkbox/error handling components/media-gallery.tsx.
- Targeted tests: tests/dive-perspectives.test.ts7/7, tests/dive-view-shell.test.ts2/2, existing tests/local-dive-store.test.ts8/8 =17/17 PASS. Final narrow Plan-link navigation guard shell2/2 PASS; final typecheck PASS. No failing/bounded-repair blocker remains; no review/Astra proposed.
- Local preview only, seedy@sites.test: existing Add Dive/save flow, same-ID popup, generic Overview, Debrief/Story edits, immediate switch/save feedback, keyboard Arrow + Enter, persisted text on remount, Story upload/select/unfeature retaining original. Disposable tests/fixtures/story-highlight.svg; no production upload/delete. Browser console errors NONE at checked point.
- Phone390/tablet820/desktop1280 no page/dialog horizontal overflow. Browser zoom shortcut did not change measured CSS viewport;200% text/PWA physical-device force-close NOT claimed verified.
- COMPLETE: locating existing integration/baseline; additive optional JSON model + compatibility mapping; shared header/selector shell. IN_PROGRESS: Overview integration, Debrief evidence links, Story offline/media verification, final responsive/offline/publish gate. No full-task completion claim.
- Precise next action: resume T01 at its remaining canonical skill/evidence adapter. Exact-string source search found no existing skill-session/skill-evidence implementation in lib/app/components/db; do not relabel training-progress as evidence or invent a duplicate skill system. Implement the minimum compatible shared reference integration, then verify contextual Dive/Plan links and original Plan provenance/comparison (no invented planned depth/runtime), offline media/editor durability, large text, attachment/add-edit/profile/Plan regressions.
- Then targeted checks, required full regression/typecheck/build once, prepare version1.0.2/changelog only after complete candidate passes; same-project publish + affected/unrelated production smoke. Failure -> immediate rollback Sites66 + verify + STOP. Success -> COMPLETE + owner budget check; never T02 automatically.
- Full existing source/deployment map reused; global pack/T00 discovery/baselines not repeated. Working preview is local only; restart established port5179 on resumption if stopped. Repository-root progress and real Windows Desktop tracker maintained together; verify read-back before handoff.
- Preview teardown: local server stopped normally by interruption; working files retained. Server output exposed a development/HMR warning: “Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported.” Browser error log was empty at its checked point. Warning is recorded for targeted release-gate verification, NOT assumed resolved or a production failure. Full build/regression remains pending.
- STOP: T01_CHECKPOINT_REACHED / OWNER_BUDGET_CHECK_REQUIRED.
