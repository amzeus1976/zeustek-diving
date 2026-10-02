# Selected ZeusTek tasks — implementation ledger

## Authority and baseline (2 October 2026)

Owner authorises tasks 1, 2, 3, 4, 6 and 7 through one combined accepted release. Task 5, calendar export, data-health centre, T15 and unrelated work are excluded. Audit findings are requirements, not completed implementation.

Preserved audit checkpoint dc1d453, clean, no subsequent commits. Implementation branch `t14/tasks-1-2-3-4-6-7` starts there; accepted application 7fcb27ac2fa96d44d06de01e3ce91e58320f646c. GitHub main bb6cae3a4d5537f20db9d3a80c4a4eca3b647a51 rechecked. Sites141/app1.0.70, saved version appgprj_6a91926878b48191a80d70f1681ef135~appgver_2c15683c77348191875aa8b81cb488cd, deployment appgdep_6ab6c6ce4bcc8191abe78eb20dd45ab2 remains succeeded with a recoverable archive. Reverify before publication. No source push, production change or Gmail operation at this checkpoint.

Approved nine-file hash manifest remains docs/t14/protected-calculations.json. Historical 03→02 automatic repair is preserved and must not be reversed. Fresh release owner snapshot is still required; historical counts are not a target.

## Sequence and checkpoints

1. Persist review/ledger; prepare exact protected ID-policy diff and public/API security plan. Approval gates precede those changes.
2. Test-first usability: upcoming trips, exact Insights analysis/evidence, bounded Skills catalogue, cylinder read/write boundary.
3. Brand/44px/responsive correction; retain all artwork and domain architecture.
4. Export image root cause, licensed Unicode fonts, case-insensitive categories, five-format content and actual PDF/DOCX rendering.
5. Redacted Gmail diagnostic stages and mocked success/failure; prepare separately authorised live procedure. Current consumed failure stays recorded; sync stays disabled.
6. Approved public snapshot/editor/auth routing and photo derivative; disabled by default. Real-owner publication needs exact preview approval.
7. Approved scoped read-only API, owner settings, key lifecycle, selected-record consent, historical usage, OpenAPI and security fixtures. No production keys without confirmation.
8. Complete full exact-candidate gate; fresh owner/relationship evidence; freeze version/cache/source. One combined Sites release, read-only smoke, rollback on blockers. Accepted source reconciles through GitHub PR only after production acceptance.

Each stage gets a recoverable commit. No intermediate stage deployment. Approval requests must link a concrete plan/diff; independent implementation continues meanwhile.

## Requirement tracking

Status vocabulary: OPEN, LOCAL PASS, LOCAL PREPARATION, AWAITING AUTHORISATION, BLOCKED, PRODUCTION VERIFIED. Local results do not imply release acceptance. Current application checkpoint: `bd0ba8ced8e45cc0718b7a7b5d04b03547a6c459`; documentation commits after it must not be mistaken for untested application changes. Task 2 is incomplete while the protected read-policy change is awaiting approval. Gmail is not verified; public/API features are not implemented.

| ID | Requirement / issue | Status | Evidence / dependency |
| --- | --- | --- | --- |
| 1.1 | #73 approved guide effective colours and one authoritative token layer | LOCAL PASS | Core/diving tokens and effective domain surfaces checked; guide unchanged |
| 1.2 | #73 typography, spacing, radii, heroes, product/PWA naming | LOCAL PASS | 27 text sheets and 22 domain sheets reconciled; actual card surface/radius evidence |
| 1.3 | #79 44px targets, focus, keyboard, active states, accessible names | LOCAL PASS | Six-width route sweep; Skills pager/mobile navigation and card actions tested |
| 1.4 | Retain 31 navigation PNGs, curated registry, 748 superset/vector controls | LOCAL PASS | 31 unique 128px approved route images; artwork/registry bytes unchanged |
| 2.1 | #74 exclude expired/cancelled/completed trips; ongoing/undated semantics | LOCAL PASS | Valid ISO dates, ongoing before future, cancelled/invalid/reversed/undated exclusions; no source writes |
| 2.2 | #77 every headline exact analysis and canonical evidence | LOCAL PASS | All 32 mappings; Certification/Person/Dive evidence destinations; no award-to-Dive fallback |
| 2.3 | #80 bounded Skills paging/filtering/counts/exact deep links | LOCAL PASS | Unit large-catalogue cases; browser 61 Skills: 25/25/11, filters and exact skill/evidence links |
| 2.4 | #85 320px crop controls visible, no intrinsic overflow | LOCAL PASS | True 160px circular preview, drag/keyboard/zoom/reset/cancel/draft Save Crop retained |
| 2.5 | #87 internal KPI containment at all six widths | LOCAL PASS | Long award fixtures, seven positive chart bounds, actual scroll/clipping checks |
| 2.6 | #86 inventory read never repairs/saves | AWAITING AUTHORISATION | Exact frozen-file diff posted; NOT applied. Inventory reads still repair; do not claim fixed |
| 2.7 | #86 duplicate/missing diagnostics and explicit single-record reviewed correction | LOCAL PREPARATION | Pure helper + 10 tests committed; UI/persistence still OPEN until approved read-policy change |
| 2.8 | #86 new gap allocation/concurrency/rejection; IDs/links retained | OPEN | Existing gap policy retained; new atomic conflict/read-side-effect tests and correction wiring remain |
| 2.9 | People/entity separation, relationships/deletion, self identity/photo regressions | LOCAL PASS | Full retained suites and local human/entity/team/crop fixtures; no architecture recreated |
| 3.1 | #55 bounded original-cause evidence; redacted token/account/list/metadata/parse/transport/persistence diagnostics | LOCAL PASS | Versioned allowlist and safe messages/status; original historical failure cause remains UNKNOWN |
| 3.2 | Encrypted token storage/retention, cached stories/non-Gmail preserved | LOCAL PASS | Mock encrypted refresh retention; browser cached News retained; no real connection writes |
| 3.3 | Success/failure fixtures and minimal repair warranted by evidence | LOCAL PASS | 39 Gmail fixtures; bounded transport/storage/redaction/idempotence fixes and default-off acceptance gate |
| 3.4 | Separate live acceptance authorisation and concrete one-run procedure | AWAITING AUTHORISATION | Historical consumed failed run must not repeat |
| 3.5 | Verified restoration + authorised enablement | AWAITING AUTHORISATION | Remains disabled until verified |
| 4.1 | #75 establish actual image failure stage; PDF and DOCX selected images | LOCAL PASS | Blob transport TypeError before decode reproduced; bounded image loader/crop cleanup fixed |
| 4.2 | #76 licensed embedded Unicode glyph coverage | LOCAL PASS | SIL OFL Noto Sans/JP; Greek/Cyrillic/Japanese/subscripts; unsupported PDF glyphs report safely |
| 4.3 | #78 duplicate activity case normalisation without source writes | LOCAL PASS | Normalised per-Dive counts across five shared projections; saved tags untouched |
| 4.4 | Equipment/sections/record selection/number opt-in/error recovery | LOCAL PASS | Five actual downloads, equipment/final selected records and four dummy opt-out numbers checked |
| 4.5 | Card image disclosure warning/preview | LOCAL PASS | Included image pixels may contain details omitted from text; visible disclosure |
| 4.6 | Actual PDF/DOCX/TXT/CSV/JSON downloads; PDF/DOCX viewer layout | LOCAL PASS | PDFium + official LibreOffice: four pages each inspected; fonts/images/final Dive retained |
| 4.7 | Empty/long/missing/multilingual/formula/private-secret cases | LOCAL PASS | Five empty downloads plus focused fixtures; retained backup/export privacy coverage |
| 6.1 | #81/#50 bounded implementation/security plan approval | AWAITING AUTHORISATION | public-api-implementation-plan.md |
| 6.2 | Owner editor: text/photo/selected Insights/allowlist/versioned snapshot | OPEN | No competing Person store |
| 6.3 | ChatGPT auth + anonymous/unapproved welcome/private exact deep links | OPEN | Private APIs unchanged |
| 6.4 | Disabled default, same-renderer exact preview/publish/update/revoke | OPEN | No real publication during smoke |
| 6.5 | Metadata-stripped derivative; no attachment/account identifiers | OPEN | Private original unchanged |
| 6.6 | Field/nested/XSS/owner/cache/revoke/private-route security | OPEN | Public handlers never query canonical records |
| 6.7 | Real owner preview/publication consent | AWAITING AUTHORISATION | Can ship controls disabled; publication not presumed |
| 7.1 | #82 implementation/security review before coding | AWAITING AUTHORISATION | public-api-implementation-plan.md |
| 7.2 | GET/HEAD v1 Dives/awards/equipment/confirmed usage | OPEN | Strict DTOs; no backup API |
| 7.3 | Per-client AMZeus/ZeusTek keys, scope and selected-record consent | OPEN | Owner-bound server-to-server only |
| 7.4 | Secret hash verification, once-only display, expiry/revoke/rotation | OPEN | Separate server credential table |
| 7.5 | Every object/link owner checks; historical saved usage snapshots | OPEN | No current-loadout inference |
| 7.6 | Bounded cursor paging, units/provenance, rate limits/OpenAPI/safe errors | OPEN | No unsupported global-quota claim |
| 7.7 | Credential exclusion/log/cache boundaries + dummy backend clients | OPEN | Secrets absent backups/diagnostics |
| 7.8 | Production key issuance confirmation | AWAITING AUTHORISATION | No live keys created during smoke |
| G.1 | Focused RED→GREEN before each implementation | LOCAL PASS | Usability/export/cylinder/Gmail/chart fixtures and actual responsive RED→GREEN retained |
| G.2 | Full retained regression (historical 888) | LOCAL PASS | Current application checkpoint: 150 files / 952 tests; no test deleted or assertion weakened |
| G.3 | Typecheck/build/PWA/version/cache/targeted lint | LOCAL PASS | Local typecheck/build/PWA; targeted lint has 0 new/changed diagnostics, 83 unchanged baseline diagnostics. Final version/cache freeze remains OPEN |
| G.4 | Privacy/auth/public/API/secret security tests | OPEN | Current privacy tests/client scan pass; future public/API handler/security tests await approved implementation |
| G.5 | Browser 320/390/430/820/1024/1440; keyboard/focus/contained content | LOCAL PASS | 31 routes/six widths with final Technical correction; two earlier concurrent-build renderer crashes retained as incidents. Finished combined production-built/live gate remains OPEN |
| G.6 | Nine protected hashes throughout and final comparison | LOCAL PASS | All nine unchanged; #86 patch remains unapplied pending separate approval |
| G.7 | Fresh owner IDs/counts/content/relationship evidence before/after | OPEN | No synthetic owner records |
| G.8 | Current recoverable rollback/version/source verification | LOCAL PASS | Actual Sites141 saved artifact/deployment/source verified; reverify immediately before release |
| G.9 | Clean frozen commit/version/cache/dependencies; single combined deploy | OPEN | No partial release |
| G.10 | Read-only production acceptance + separately authorised actions | OPEN | Gmail/profile/key writes never implicit |
| G.11 | Accepted exact source PR/main tree verification/issues update | OPEN | Only after production acceptance |

## Checkpoint / test / decision log

- 2026-10-02: resume verified clean dc1d453, create implementation branch, Sites/GitHub reads match audit. No implementation yet. Read parent AGENTS.md; sources/ remains read-only.
- Exact protected diff posted to #86 comment 5945009501; public/API plan posted to #81/#82 comments 5945009640/5945009774. Both separately requested; no feature/frozen code begun.
- First usability checkpoint: 13 focused tests passed after 9 functional failures plus 2 exact-evidence deep-link failures. Retained relevant 7-file run: 53 PASS. Typecheck PASS including the final route-parameter addition. Upcoming eligibility, all 32 headline evidence mappings, bounded 25-row paging and Certification/Skill/Evidence route parameters implemented locally. Full retained regression: 145 files / 901 tests PASS. Browser verification still required; this is not release acceptance.

## Exact next actions

1. Verify branch tip/working tree and preserve all checkpoints. Read this ledger, HANDOVER.md, selected-local-verification.json, selected-browser-checkpoint.json and selected-gmail-evidence-and-acceptance.md. Restore the isolated local fixture server only when needed; do not run production builds concurrently with the dev server/browser tests. The QA-only ignored wrapper excludes work/ from file watching and does not modify the tracked Vite configuration.
2. Wait for the three existing explicit approval requests: (a) the exact #86 CALCULATION_TOUCHPOINT patch; (b) the #81/#82 implementation/security plan including its security addendum; (c) one new bounded Gmail acceptance and, if expressly selected, conditional manual-only restoration. An agent's own issue comment under the connected GitHub account is not owner approval. No reply/time elapsed is not approval.
3. After #86 approval, apply only the reviewed frozen-file diff, wire pure diagnostics/one-record review into Cylinders, add atomic owner-scoped collision rejection and offline/concurrent/read-side-effect tests. Preserve canonical IDs and fill/analysis/plan links; never reverse the prior 03→02 or bulk renumber. Record the approved new hash separately, retaining all other frozen hashes.
4. After the public/API plan is approved, write failing handler/DTO/auth/cache/key/photo/usage tests first, then implement the exact bounded plan. Remove private identity literals from public client artifacts; publication remains disabled and no real keys are issued. Real content needs exact visitor-preview approval; live key issuance needs its later separate confirmation. Do not expand #50 into Gas Plan shares or Task 5.
5. Gmail's default-off acceptance/manual gates are already implemented and mock-tested; do not rebuild them. Do not configure/execute a live grant without the separate authorisation. After the complete combined candidate's gate/deployment, configure one new owner/run/expiry, invoke once, use status-only recovery for a lost response, and retain FAILED/uncertain evidence. Conditional manual restoration requires successful persisted evidence AND its explicit owner consent. No retry/reconnect/background scope is implied.
6. Once selected scope is implemented, derive the then-next app/cache identifiers, complete all retained and new tests, typecheck/build/PWA/version/lint/privacy/security and six-width browser checks against the exact source. Recheck the two retained renderer incidents using the finished built/live candidate without concurrent dev/build activity; do not attribute local fixture evidence to untested source.
7. Reverify actual GitHub/Sites production and recoverable rollback; capture a fresh read-only owner ID/content/count/relationship baseline through safe API/backup reads. Historical audit counts are not current targets. Avoid production inventory browsing until the read-side-effect fix is verified. Freeze a clean source commit and one archive. No intermediate deploy/push.
8. Deploy one complete candidate to the existing Sites project; run read-only live routes, exports, PWA/cache/auth/content/console/image/overflow checks plus only separately authorised actions. Compare owner IDs/content/relationships, accounting separately for approved publication/key/Gmail metadata. On failed mandatory acceptance restore the freshly verified accepted release and report BLOCKED_DEPLOYMENT.
9. Only after acceptance, reconcile the exact published product through the established GitHub PR workflow, attach the PR, merge and verify main's tree matches. Close issues only with accepted evidence. Final task-by-task report must distinguish implemented/verified, awaiting authorisation and blocked; do not claim Gmail PASS or all tasks complete prematurely.

- Brand/responsive checkpoint: effective approved core + Diving brand imported; legacy aliases reconciled, minimum UI text raised in 27 existing sheets, shared 44px controls/focus, product/PWA naming corrected. Images unchanged. RED browser: 66px award cells scrolled 195/553/702px, title controls 24px. GREEN: all six widths have no headline clipping/page overflow/undersized visible targets. 320px crop viewport remains 160px circle; Zoom/Reset/Cancel/Save Crop fit; keyboard recenter works. Full retained 145-file / 901-test regression PASS. Evidence: selected-brand-browser-evidence.json. Broader final browser gate remains.

- Export checkpoint: bounded card loader removes reproduced Blob-URL transport failure; licensed dual-font Unicode, consistent per-Dive activity counts, safe image diagnostics/disclosure and five actual downloads. Four PDF and four DOCX pages inspected; five empty formats verified. Focused export/backup 32 PASS; typecheck PASS; nine hashes unchanged. See selected-export-evidence.md. Full finished-candidate gate remains.

- `a1115b3`: inspected remaining effective domain styles rather than relying on token declarations. Dive Centre card was RGB(9,26,34)/12px before correction and RGB(18,18,18)/18px afterward. Professional Development's 320px intrinsic grid/header excess was 52px before correction and zero at all six widths afterward. Preserved semantic status colours/artwork and existing workflows. Recharts initial-size warning reproduced with a failing SSR fixture, then corrected using the existing chart container pattern. Skills filter paging now resets through user actions, not a render-time state change.
- `bfaa200`: pure cylinder-number diagnostic/review helper, 10 focused tests after failing fixtures. Read-only missing/invalid/duplicate diagnostics and stale/collision checks return a proposal only. No inventory reader, persistence or protected source changed. #86 remains incomplete awaiting its exact touchpoint approval.
- `0b82351`: redacted Gmail phase/kind/status evidence and timeout/atomic-persistence/storage distinction; mock success/failure fixtures. The consumed 23 September FAILED upstream_failure has no phase/status and remains UNKNOWN as to original cause. No live provider, credential or connection operation.
- `c39c301`: independently completed default-disabled single-run acceptance gate and explicitly consented verified manual release controls. Twelve gate tests plus 23 engine, three status and retained isolation test = 39 focused Gmail tests. Exact owner/new-run/24h expiry, same-origin request, successful durable outcome, and separate manual flag are required; server controls absent/off by default. Full 150-file/952-test local regression, typecheck and build passed for that source.
- `4c9f26e`: actual browser RED at 1024px Technical Diving: squeezed Loadouts control client44/scroll74, card client225/scroll261, one-pixel root scroll with actual fractional horizontal movement. Four bounded CSS rules wrap card headings/actions and long text. GREEN: all six widths have zero root scroll excess, zero scrolling card/header/button and retained keyboard Loadouts navigation. No overflow hiding or relaxed measurement tolerance. Re-run full retained regression: 150 files / 952 PASS; typecheck PASS. Build/PWA verification recorded in selected-local-verification.json.
- Local browser history includes two renderer crashes while dev and production build were concurrent. Neither is silently discarded or claimed to prove a code cause. Restarting only the isolated dev server and using a fresh test tab with no concurrent build yielded 18 affected-view checks without console warnings/errors; final Technical six-width checks also passed. This remains a local checkpoint; finished built/live acceptance must recheck stability.
- Pending plans refined on #81/#82 comments 5947397663/5947397820: private client identity literals and independent server raster/metadata validation are explicit security requirements. No public/API feature implementation, publication or credential issuance has occurred.
- Final local `4c9f26e` gate: 150 files / 952 tests, typecheck and production build PASS; PWA 427 entries / 42,453.78 KiB. Targeted 28-file lint re-run: raw exit 1, all 83 diagnostics matched byte-unchanged dc1d453 lines, zero new/changed. Client privacy recheck: five credential values / 15 variants / 62 compiled files, zero matches; all seven server Gmail gate names also absent. Nine approved hashes and approved artwork/registry bytes match. The earlier working-tree whitespace check passed; the final full-range check later exposed added CRLF lines and the deliberately literal stored patch. See the normalisation checkpoint below. These results certify only the current local implementation, not the unfinished selected scope.
- GitHub progress comments #55 5947642079 and #61 5947642276 distinguish local implementation/preparation/plan from release acceptance. Latest Sites and GitHub read rechecks still show Sites141/succeeded/env revision3, archive 95,477,760 bytes, published 7fcb27ac and main bb6cae3a with the same accepted tree. No product-source reconciliation was attempted before acceptance.
- Production remains app1.0.70/Sites141 and accepted GitHub main bb6cae3a4d5537f20db9d3a80c4a4eca3b647a51. No production owner write, live Gmail request, source push, PR or deployment in this selected-task execution. Fresh release owner comparison, finished candidate version/freeze, public/API implementation, approved #86 correction, Gmail acceptance and production/GitHub gates remain outstanding.

- `bd0ba8c`: normalised only 27 added lines in app/issue-register.css, tests/selected-gmail-status.test.ts and vite.config.ts. Normalised content is byte-identical to 4c9f26e; no semantic implementation or protected-file change. Full 150-file / 952-test regression, typecheck, production build/PWA (427 / 42,453.78 KiB), client secret/Gmail-control scan, nine protected hashes and targeted lint were rerun for this commit. Targeted lint remains raw exit 1 with all 83 baseline diagnostics matched and zero new/changed. Browser and actual download evidence is reused only for unchanged content; finished built/live acceptance remains OPEN. Added evidence CRLF lines corrected without rewriting historical handover lines. Full-range whitespace flags only the literal unapplied reviewed CRLF/context patch; source/evidence check excluding that evidence artifact passes. The patch bytes, Git rules and assertions remain unchanged. Three existing approval requests remain pending, production/main unchanged.
