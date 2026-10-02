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

Status vocabulary: OPEN, LOCAL PASS, OWNER AUTHORISED, AWAITING AUTHORISATION, BLOCKED, PRODUCTION VERIFIED. The current combined application is implemented locally as app1.0.71, static-v18. Full 992 tests / 155 files, typecheck and production build pass; targeted lint has zero new diagnostics. Production acceptance is still OPEN.

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
| 2.6 | #86 inventory read never repairs/saves | LOCAL PASS | Owner approved exact #86 patch; read-only inventory, no repairs or saves |
| 2.7 | #86 duplicate/missing diagnostics and explicit single-record reviewed correction | LOCAL PASS | Explicit one-record review; canonical IDs and references preserved; no bulk renumber |
| 2.8 | #86 new gap allocation/concurrency/rejection; IDs/links retained | LOCAL PASS | Gap reuse retained; serialised saves plus atomic owner/shared collision rejection; offline conflicts retained |
| 2.9 | People/entity separation, relationships/deletion, self identity/photo regressions | LOCAL PASS | Full retained suites and local human/entity/team/crop fixtures; no architecture recreated |
| 3.1 | #55 bounded original-cause evidence; redacted token/account/list/metadata/parse/transport/persistence diagnostics | LOCAL PASS | Versioned allowlist and safe messages/status; original historical failure cause remains UNKNOWN |
| 3.2 | Encrypted token storage/retention, cached stories/non-Gmail preserved | LOCAL PASS | Mock encrypted refresh retention; browser cached News retained; no real connection writes |
| 3.3 | Success/failure fixtures and minimal repair warranted by evidence | LOCAL PASS | 39 Gmail fixtures; bounded transport/storage/redaction/idempotence fixes and default-off acceptance gate |
| 3.4 | Separate live acceptance authorisation and concrete one-run procedure | OWNER AUTHORISED | One NEW run: 90 days, max 100 metadata/snippet messages, no retry/reconnect/credential/mailbox changes |
| 3.5 | Verified restoration + authorised enablement | OPEN | Manual-only restoration authorised conditionally on verified successful new run; background remains disabled |
| 4.1 | #75 establish actual image failure stage; PDF and DOCX selected images | LOCAL PASS | Blob transport TypeError before decode reproduced; bounded image loader/crop cleanup fixed |
| 4.2 | #76 licensed embedded Unicode glyph coverage | LOCAL PASS | SIL OFL Noto Sans/JP; Greek/Cyrillic/Japanese/subscripts; unsupported PDF glyphs report safely |
| 4.3 | #78 duplicate activity case normalisation without source writes | LOCAL PASS | Normalised per-Dive counts across five shared projections; saved tags untouched |
| 4.4 | Equipment/sections/record selection/number opt-in/error recovery | LOCAL PASS | Five actual downloads, equipment/final selected records and four dummy opt-out numbers checked |
| 4.5 | Card image disclosure warning/preview | LOCAL PASS | Included image pixels may contain details omitted from text; visible disclosure |
| 4.6 | Actual PDF/DOCX/TXT/CSV/JSON downloads; PDF/DOCX viewer layout | LOCAL PASS | PDFium + official LibreOffice: four pages each inspected; fonts/images/final Dive retained |
| 4.7 | Empty/long/missing/multilingual/formula/private-secret cases | LOCAL PASS | Five empty downloads plus focused fixtures; retained backup/export privacy coverage |
| 6.1 | #81/#50 bounded implementation/security plan approval | OWNER AUTHORISED | Implement-all-fixes direction approves reviewed bounded implementation/security plan |
| 6.2 | Owner editor: text/photo/selected Insights/allowlist/versioned snapshot | LOCAL PASS | Owner Settings editor, strict versioned projection, selected Insights and photo; existing stores |
| 6.3 | ChatGPT auth + anonymous/unapproved welcome/private exact deep links | LOCAL PASS | Approved private application/deep links; anonymous and unapproved generic welcome; ChatGPT auth retained |
| 6.4 | Disabled default, same-renderer exact preview/publish/update/revoke | LOCAL PASS | Disabled default; server-bound exact preview; explicit publish/update/revoke; real content remains unpublished |
| 6.5 | Metadata-stripped derivative; no attachment/account identifiers | LOCAL PASS | PNG/JPEG validation and server metadata stripping; dedicated opaque derivative; private originals untouched |
| 6.6 | Field/nested/XSS/owner/cache/revoke/private-route security | LOCAL PASS | SQL/R2 fixtures cover ownership, nested/private fields, injection, stale preview, cache and revocation |
| 6.7 | Real owner preview/publication consent | AWAITING AUTHORISATION | Exact real-owner preview approval required only for content publication; ship default off |
| 7.1 | #82 implementation/security review before coding | OWNER AUTHORISED | Reviewed security plan approved by implement-all-fixes direction |
| 7.2 | GET/HEAD v1 Dives/awards/equipment/confirmed usage | LOCAL PASS | Four GET/HEAD v1 resources; strict DTOs; no canonical/backup serialization |
| 7.3 | Per-client AMZeus/ZeusTek keys, scope and selected-record consent | LOCAL PASS | Separate clients, explicit fields and selected owned record consent; real keys unissued |
| 7.4 | Secret hash verification, once-only display, expiry/revoke/rotation | LOCAL PASS | Hash-only verification, RAM-only once display, expiry/revoke and atomic rotation |
| 7.5 | Every object/link owner checks; historical saved usage snapshots | LOCAL PASS | Owner/object/link rechecks; saved historical equipment evidence; withheld identities; no current-loadout inference |
| 7.6 | Bounded cursor paging, units/provenance, rate limits/OpenAPI/safe errors | LOCAL PASS | Bound signed cursors, 1�100 pagination, units/provenance, atomic key limit and OpenAPI 3.1 |
| 7.7 | Credential exclusion/log/cache boundaries + dummy backend clients | LOCAL PASS | Dummy keys/backend clients; credential/backup/log/cache security; no production credential issued |
| 7.8 | Production key issuance confirmation | AWAITING AUTHORISATION | Real client, scope, selected records/fields and expiration approval required; ship unissued |
| G.1 | Focused RED→GREEN before each implementation | LOCAL PASS | Usability/export/cylinder/Gmail/chart fixtures and actual responsive RED→GREEN retained |
| G.2 | Full retained regression (historical 888) | LOCAL PASS | 155 files / 992 tests; retained baseline assertions and suites |
| G.3 | Typecheck/build/PWA/version/cache/targeted lint | LOCAL PASS | Typecheck/build/PWA 427 entries; app1.0.71/static-v18; 0 new lint diagnostics, 83 unchanged baseline |
| G.4 | Privacy/auth/public/API/secret security tests | LOCAL PASS | Public/API auth/field/photo/cache/key/secret security fixtures and built-client credential scan |
| G.5 | Browser 320/390/430/820/1024/1440; keyboard/focus/contained content | OPEN | Six-width development checks pass; finished production-built checks in progress before release |
| G.6 | Nine protected hashes throughout and final comparison | LOCAL PASS | All 9 match current approved manifest; 8 byte-unchanged and exact owner-approved #86 ID-policy touchpoint |
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

1. Preserve all local checkpoints and completed implementations. Finished app1.0.71 checks pass; record exact clean application commit and evidence before release.
2. Complete production-built fixture checks at 320/390/430/820/1024/1440 and read-only security/header checks. Reuse actual five-format download evidence only for unchanged export code.
3. Capture fresh production canonical IDs/counts/content hashes and relationship integrity through read-only backup; reverify current Sites141 artifact/source and GitHub main.
4. Configure only the separately authorised new Gmail run grant, leaving manual/background disabled. Freeze/package/push source to Sites and publish one combined version after every non-Gmail gate passes.
5. Execute that NEW bounded live run once. Resolve any uncertain outcome from persisted status without repeating. Enable manual-only sync only after verified success; no background ingestion.
6. Read-only live responsive/core/privacy/PWA/owner acceptance; rollback the verified prior deployment on a mandatory failure. Public profile stays disabled and integration keys unissued unless distinct exact content/key consent arrives.
7. Only after production acceptance push exact accepted GitHub source, attach/merge PR, verify main tree and update issues. Preserve Task 5/T15 exclusions. Do not claim Gmail verified before live success.

## Combined implementation checkpoint � 2 October 2026

Task 6/7 handlers, settings and SQL/R2 security fixtures are implemented locally. Added tests reproduced saved-runtime/mode projection mistakes and missing explicitly consented equipment-usage Dive links before corrections. Final 992/155 regression, typecheck and production build pass. Gmail new-run and conditional manual-only restoration consent received directly; no live request has occurred. Exact #86 application commit is 0fc19c5e20808a6db8c47f9beba4b624b0fe8563. No product source push/deployment/GitHub PR or real publication/key issuance has occurred.
