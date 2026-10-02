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

All rows initially OPEN. Status vocabulary: OPEN, LOCAL PASS, AWAITING AUTHORISATION, BLOCKED, PRODUCTION VERIFIED. Local results do not imply release acceptance.

| ID | Requirement / issue | Status | Evidence / dependency |
| --- | --- | --- | --- |
| 1.1 | #73 approved guide effective colours and one authoritative token layer | OPEN | Guide SHA in audit |
| 1.2 | #73 typography, spacing, radii, heroes, product/PWA naming | OPEN | Full app sampled at six widths |
| 1.3 | #79 44px targets, focus, keyboard, active states, accessible names | OPEN | Actual controls, not CSS alone |
| 1.4 | Retain 31 navigation PNGs, curated registry, 748 superset/vector controls | OPEN | Retained asset tests/hash comparison |
| 2.1 | #74 exclude expired/cancelled/completed trips; ongoing/undated semantics | OPEN | Date fixtures; no record edits |
| 2.2 | #77 every headline exact analysis and canonical evidence | OPEN | Awards use Certification evidence, no Dive fallback |
| 2.3 | #80 bounded Skills paging/filtering/counts/exact deep links | OPEN | Thousands-row fixture + browser |
| 2.4 | #85 320px crop controls visible, no intrinsic overflow | OPEN | Drag/zoom/reset/replace/cancel preserved |
| 2.5 | #87 internal KPI containment at all six widths | OPEN | Long awards/value/unit fixtures |
| 2.6 | #86 inventory read never repairs/saves | OPEN | Separate protected-file approval before byte edit |
| 2.7 | #86 duplicate/missing diagnostics and explicit single-record reviewed correction | OPEN | No automatic reversal/merge/bulk repair |
| 2.8 | #86 new gap allocation/concurrency/rejection; IDs/links retained | OPEN | Offline/cross-device conflict fixtures |
| 2.9 | People/entity separation, relationships/deletion, self identity/photo regressions | OPEN | Retained suites |
| 3.1 | #55 bounded original-cause evidence; redacted token/account/list/metadata/parse/transport/persistence diagnostics | OPEN | No guessed original cause |
| 3.2 | Encrypted token storage/retention, cached stories/non-Gmail preserved | OPEN | Dummy credentials only |
| 3.3 | Success/failure fixtures and minimal repair warranted by evidence | OPEN | Do not remove gate speculatively |
| 3.4 | Separate live acceptance authorisation and concrete one-run procedure | AWAITING AUTHORISATION | Historical consumed failed run must not repeat |
| 3.5 | Verified restoration + authorised enablement | AWAITING AUTHORISATION | Remains disabled until verified |
| 4.1 | #75 establish actual image failure stage; PDF and DOCX selected images | OPEN | Browser image load/decode evidence |
| 4.2 | #76 licensed embedded Unicode glyph coverage | OPEN | Greek/Cyrillic/Japanese + unsupported handling |
| 4.3 | #78 duplicate activity case normalisation without source writes | OPEN | One per Dive; all five outputs |
| 4.4 | Equipment/sections/record selection/number opt-in/error recovery | OPEN | Shared DTO only |
| 4.5 | Card image disclosure warning/preview | OPEN | Text omissions do not redact image pixels |
| 4.6 | Actual PDF/DOCX/TXT/CSV/JSON downloads; PDF/DOCX viewer layout | OPEN | Need supported DOCX renderer |
| 4.7 | Empty/long/missing/multilingual/formula/private-secret cases | OPEN | No credentials printed |
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
| G.1 | Focused RED→GREEN before each implementation | OPEN | Commands/results recorded below |
| G.2 | Full retained regression (historical 888) | OPEN | No coverage weakened |
| G.3 | Typecheck/build/PWA/version/cache/targeted lint | OPEN | Exact finished candidate |
| G.4 | Privacy/auth/public/API/secret security tests | OPEN | Before deployment |
| G.5 | Browser 320/390/430/820/1024/1440; keyboard/focus/contained content | OPEN | No error/overflow/broken image claims without evidence |
| G.6 | Nine protected hashes throughout and final comparison | OPEN | Any exception individually approved |
| G.7 | Fresh owner IDs/counts/content/relationship evidence before/after | OPEN | No synthetic owner records |
| G.8 | Current recoverable rollback/version/source verification | OPEN | Sites141 currently accepted |
| G.9 | Clean frozen commit/version/cache/dependencies; single combined deploy | OPEN | No partial release |
| G.10 | Read-only production acceptance + separately authorised actions | OPEN | Gmail/profile/key writes never implicit |
| G.11 | Accepted exact source PR/main tree verification/issues update | OPEN | Only after production acceptance |

## Checkpoint / test / decision log

- 2026-10-02: resume verified clean dc1d453, create implementation branch, Sites/GitHub reads match audit. No implementation yet. Read parent AGENTS.md; sources/ remains read-only.
- Exact protected diff posted to #86 comment 5945009501; public/API plan posted to #81/#82 comments 5945009640/5945009774. Both separately requested; no feature/frozen code begun.
- First usability checkpoint: 13 focused tests passed after 9 functional failures plus 2 exact-evidence deep-link failures. Retained relevant 7-file run: 53 PASS. Typecheck PASS including the final route-parameter addition. Upcoming eligibility, all 32 headline evidence mappings, bounded 25-row paging and Certification/Skill/Evidence route parameters implemented locally. Full retained regression: 145 files / 901 tests PASS. Browser verification still required; this is not release acceptance.

## Exact next actions

Inspect remaining targeted modules; add focused failure fixtures for trip/headline/paging and ID read side effects. Persist exact #86 diff before requesting its approval. Submit public/API plan for approval; continue ordinary usability/exports/Gmail mocked diagnostics while waiting. Recheck all approvals and owner data before any production action.

- Brand/responsive checkpoint: effective approved core + Diving brand imported; legacy aliases reconciled, minimum UI text raised in 27 existing sheets, shared 44px controls/focus, product/PWA naming corrected. Images unchanged. RED browser: 66px award cells scrolled 195/553/702px, title controls 24px. GREEN: all six widths have no headline clipping/page overflow/undersized visible targets. 320px crop viewport remains 160px circle; Zoom/Reset/Cancel/Save Crop fit; keyboard recenter works. Full retained 145-file / 901-test regression PASS. Evidence: selected-brand-browser-evidence.json. Broader final browser gate remains.

- Export checkpoint: bounded card loader removes reproduced Blob-URL transport failure; licensed dual-font Unicode, consistent per-Dive activity counts, safe image diagnostics/disclosure and five actual downloads. Four PDF and four DOCX pages inspected; five empty formats verified. Focused export/backup 32 PASS; typecheck PASS; nine hashes unchanged. See selected-export-evidence.md. Full finished-candidate gate remains.
