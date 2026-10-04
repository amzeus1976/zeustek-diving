# Selected ZeusTek tasks — implementation ledger

## Accepted production checkpoint (2 October 2026)

app1.0.71/Sites143/source525effa2e91eaf0347f86bd9362ed63730e0dfa3 is published and verified; deployment appgdep_6abfcc2de2e88191898a82be1dd2cbfc. PR#88 merged to main d1937fb022dd8ddc81bbb64d4a8ac6dc0e0794f2; full tree1758f60fac70951be0299c537ecea44be58c4835 exactly matches Sites. This documentation-only evidence branch is deliberately separate from accepted main. See selected-release-1.0.71-evidence.json.

Tasks1/2/4 PASS; Tasks6/7 implementation/security PASS with public content OFF and real keys UNISSUED awaiting separate activation consent. Task3 diagnostics PASS but restoration BLOCKED after the one new consumed FAILED token_refresh/transport run; explicit owner Gmail release exception retained. All thirteen completed issues are closed; #55 and broader #50 remain open. Task5/T15 excluded.

## Initial authority and baseline (historical, 2 October 2026)

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

Status vocabulary: VERIFIED (focused fixtures plus applicable safe live acceptance), VERIFIED; OFF/KEYS UNISSUED, OWNER AUTHORISED, AUTHORISED RUN CONSUMED, AWAITING AUTHORISATION, BLOCKED, PRODUCTION VERIFIED. app1.0.71/static-v18 is accepted live on Sites143. Mutation/secret-issuance/publication success paths use isolated fixtures; production profile is disabled and keys unissued. Task3 restoration is explicitly BLOCKED, not waived or relabelled PASS.

| ID | Requirement / issue | Status | Evidence / dependency |
| --- | --- | --- | --- |
| 1.1 | #73 approved guide effective colours and one authoritative token layer | VERIFIED | Core/diving tokens and effective domain surfaces checked; guide unchanged |
| 1.2 | #73 typography, spacing, radii, heroes, product/PWA naming | VERIFIED | 27 text sheets and 22 domain sheets reconciled; actual card surface/radius evidence |
| 1.3 | #79 44px targets, focus, keyboard, active states, accessible names | VERIFIED | Six-width route sweep; Skills pager/mobile navigation and card actions tested |
| 1.4 | Retain 31 navigation PNGs, curated registry, 748 superset/vector controls | VERIFIED | 31 unique 128px approved route images; artwork/registry bytes unchanged |
| 2.1 | #74 exclude expired/cancelled/completed trips; ongoing/undated semantics | VERIFIED | Valid ISO dates, ongoing before future, cancelled/invalid/reversed/undated exclusions; no source writes |
| 2.2 | #77 every headline exact analysis and canonical evidence | VERIFIED | All 32 mappings; Certification/Person/Dive evidence destinations; no award-to-Dive fallback |
| 2.3 | #80 bounded Skills paging/filtering/counts/exact deep links | PRODUCTION VERIFIED | 3874 canonical Skills:3824 active/50 archived; main paging25, management batches75, search/filter/counts and exact record links pass |
| 2.4 | #85 320px crop controls visible, no intrinsic overflow | PRODUCTION VERIFIED | Live all six widths including320:160px true circle, visible44px controls, keyboard/zoom/reset/cancel; draft discarded |
| 2.5 | #87 internal KPI containment at all six widths | PRODUCTION VERIFIED | All selected live headlines across six widths; long award fixture bounds and actual internal clipping/overlap checks pass |
| 2.6 | #86 inventory read never repairs/saves | VERIFIED | Owner approved exact #86 patch; read-only inventory, no repairs or saves |
| 2.7 | #86 duplicate/missing diagnostics and explicit single-record reviewed correction | VERIFIED | Explicit one-record review; canonical IDs and references preserved; no bulk renumber |
| 2.8 | #86 new gap allocation/concurrency/rejection; IDs/links retained | VERIFIED | Gap reuse retained; serialised saves plus atomic owner/shared collision rejection; offline conflicts retained |
| 2.9 | People/entity separation, relationships/deletion, self identity/photo regressions | PRODUCTION VERIFIED | Live People/entity exact links, legacy pairs, circular crop, oneMe and valid instructor buddy/self leader; no saves |
| 3.1 | #55 bounded original-cause evidence; redacted token/account/list/metadata/parse/transport/persistence diagnostics | PRODUCTION VERIFIED | Redacted v1 phase/kind/status visible; new failure located at token_refresh/transport, no HTTP response; original transport cause UNRESOLVED |
| 3.2 | Encrypted token storage/retention, cached stories/non-Gmail preserved | VERIFIED | Encrypted connection/cached stories preserved; only expected consumed-failure connection/run metadata changed; no credentials printed or exported |
| 3.3 | Success/failure fixtures and minimal repair warranted by evidence | VERIFIED | 40 Gmail fixtures; bounded transport/storage/redaction/idempotence fixes and default-off acceptance gate |
| 3.4 | Separate live acceptance authorisation and concrete one-run procedure | AUTHORISED RUN CONSUMED | Exactly one new90-day/max100 metadata-snippet attempt f2356ba1-2c8d-4f55-af40-7c59feac342f; FAILED; no retry or run substitution |
| 3.5 | Verified restoration + authorised enablement | BLOCKED | New consented run consumed/FAILED token_refresh transport; sync stays disabled under existing release exception; no retry |
| 4.1 | #75 establish actual image failure stage; PDF and DOCX selected images | VERIFIED | Blob transport TypeError before decode reproduced; bounded image loader/crop cleanup fixed |
| 4.2 | #76 licensed embedded Unicode glyph coverage | VERIFIED | SIL OFL Noto Sans/JP; Greek/Cyrillic/Japanese/subscripts; unsupported PDF glyphs report safely |
| 4.3 | #78 duplicate activity case normalisation without source writes | VERIFIED | Normalised per-Dive counts across five shared projections; saved tags untouched |
| 4.4 | Equipment/sections/record selection/number opt-in/error recovery | PRODUCTION VERIFIED | Five actual owner downloads retain66Dives/13awards/52equipment/final records; text numbers opted out; fixture selection/error cases retained |
| 4.5 | Card image disclosure warning/preview | VERIFIED | Included image pixels may contain details omitted from text; visible disclosure |
| 4.6 | Actual PDF/DOCX/TXT/CSV/JSON downloads; PDF/DOCX viewer layout | PRODUCTION VERIFIED | Actual PDF/DOCX/TXT/CSV/JSON verified; PDFium/official LibreOffice19pages each/25images; wrapping/pagination/final records inspected |
| 4.7 | Empty/long/missing/multilingual/formula/private-secret cases | VERIFIED | Five empty downloads plus focused fixtures; retained backup/export privacy coverage |
| 6.1 | #81/#50 bounded implementation/security plan approval | OWNER AUTHORISED | Implement-all-fixes direction approves reviewed bounded implementation/security plan |
| 6.2 | Owner editor: text/photo/selected Insights/allowlist/versioned snapshot | VERIFIED; OFF | Owner Settings editor, strict versioned projection, selected Insights and photo; existing stores |
| 6.3 | ChatGPT auth + anonymous/unapproved welcome/private exact deep links | VERIFIED; OFF | Approved private application/deep links; anonymous and unapproved generic welcome; ChatGPT auth retained |
| 6.4 | Disabled default, same-renderer exact preview/publish/update/revoke | VERIFIED; OFF | Disabled default; server-bound exact preview; explicit publish/update/revoke; real content remains unpublished |
| 6.5 | Metadata-stripped derivative; no attachment/account identifiers | VERIFIED; OFF | PNG/JPEG validation and server metadata stripping; dedicated opaque derivative; private originals untouched |
| 6.6 | Field/nested/XSS/owner/cache/revoke/private-route security | VERIFIED; OFF | SQL/R2 fixtures cover ownership, nested/private fields, injection, stale preview, cache and revocation |
| 6.7 | Real owner preview/publication consent | AWAITING AUTHORISATION | Exact real-owner preview approval required only for content publication; ship default off |
| 7.1 | #82 implementation/security review before coding | OWNER AUTHORISED | Reviewed security plan approved by implement-all-fixes direction |
| 7.2 | GET/HEAD v1 Dives/awards/equipment/confirmed usage | VERIFIED; KEYS UNISSUED | Four GET/HEAD v1 resources; strict DTOs; no canonical/backup serialization |
| 7.3 | Per-client AMZeus/ZeusTek keys, scope and selected-record consent | VERIFIED; KEYS UNISSUED | Separate clients, explicit fields and selected owned record consent; real keys unissued |
| 7.4 | Secret hash verification, once-only display, expiry/revoke/rotation | VERIFIED; KEYS UNISSUED | Hash-only verification, RAM-only once display, expiry/revoke and atomic rotation |
| 7.5 | Every object/link owner checks; historical saved usage snapshots | VERIFIED; KEYS UNISSUED | Owner/object/link rechecks; saved historical equipment evidence; withheld identities; no current-loadout inference |
| 7.6 | Bounded cursor paging, units/provenance, rate limits/OpenAPI/safe errors | VERIFIED; KEYS UNISSUED | Bound signed cursors, 1–100 pagination, units/provenance, atomic key limit and OpenAPI 3.1 |
| 7.7 | Credential exclusion/log/cache boundaries + dummy backend clients | VERIFIED; KEYS UNISSUED | Dummy keys/backend clients; credential/backup/log/cache security; no production credential issued |
| 7.8 | Production key issuance confirmation | AWAITING AUTHORISATION | Real client, scope, selected records/fields and expiration approval required; ship unissued |
| G.1 | Focused RED→GREEN before each implementation | VERIFIED | Usability/export/cylinder/Gmail/chart fixtures and actual responsive RED→GREEN retained |
| G.2 | Full retained regression (historical 888) | VERIFIED | 156 files / 996 tests; retained baseline assertions and suites |
| G.3 | Typecheck/build/PWA/version/cache/targeted lint | VERIFIED | Typecheck/build/PWA 427 entries; app1.0.71/static-v18; 0 new lint diagnostics, 83 unchanged baseline |
| G.4 | Privacy/auth/public/API/secret security tests | VERIFIED | Public/API auth/field/photo/cache/key/secret security fixtures and built-client credential scan |
| G.5 | Browser 320/390/430/820/1024/1440; keyboard/focus/contained content | PRODUCTION VERIFIED | 186 compiled +186 live route checks, six widths; retained keyboard/focus/Insights/crop/team/evidence checks; zero app errors/overflow/broken images |
| G.6 | Nine protected hashes throughout and final comparison | VERIFIED | All 9 match current approved manifest; 8 byte-unchanged and exact owner-approved #86 ID-policy touchpoint |
| G.7 | Fresh owner IDs/counts/content/relationship evidence before/after | PRODUCTION VERIFIED | Fresh6485 IDs/content/timestamps all unchanged, fingerprint3f009f129e0298394fded5b5cf38b79c11723c633526f51c5392e0da08a95743; failed Gmail metadata separate |
| G.8 | Current recoverable rollback/version/source verification | PRODUCTION VERIFIED | Sites141 recoverable saved archive/source; restore appgdep_6abfc8b662388191b6655e46ec1607a9 succeeded and verified before corrected143 |
| G.9 | Clean frozen commit/version/cache/dependencies; single combined deploy | PRODUCTION VERIFIED | Clean frozen525effa/app1.0.71/static-v18, corrected combined Sites143 accepted; rejected combined142 preserved/restored, no partial stages |
| G.10 | Read-only production acceptance + separately authorised actions | PRODUCTION VERIFIED | Read-only final security/UI/export/PWA/owner acceptance PASS; one authorised Gmail run consumed FAILED under explicit exception; no publication/key writes |
| G.11 | Accepted exact source PR/main tree verification/issues update | PRODUCTION VERIFIED | PR88 merged; maind1937fb022dd8ddc81bbb64d4a8ac6dc0e0794f2 full tree equals published525effa;13closed,55/50remain open |

## Checkpoint / test / decision log

- 2026-10-02: resume verified clean dc1d453, create implementation branch, Sites/GitHub reads match audit. No implementation yet. Read parent AGENTS.md; sources/ remains read-only.
- Exact protected diff posted to #86 comment 5945009501; public/API plan posted to #81/#82 comments 5945009640/5945009774. Both separately requested; no feature/frozen code begun.
- First usability checkpoint: 13 focused tests passed after 9 functional failures plus 2 exact-evidence deep-link failures. Retained relevant 7-file run: 53 PASS. Typecheck PASS including the final route-parameter addition. Upcoming eligibility, all 32 headline evidence mappings, bounded 25-row paging and Certification/Skill/Evidence route parameters implemented locally. Full retained regression: 145 files / 901 tests PASS. Browser verification still required; this is not release acceptance.

## Exact next actions

1. Preserve frozen source branch t14/tasks-1-2-3-4-6-7 at525effa, accepted GitHub main d1937fb and the separate evidence branch. Reverify actual state before any future work; do not deploy documentation as a new application or reset completed work.
2. Task3/#55 remains BLOCKED. Continue only redacted fixture/platform transport diagnosis unless separately instructed; neither consumed Gmail acceptance run may be retried. Another live operation/reconnect/credential change requires fresh owner consent. No manual/background sync until authorised persisted successful acceptance.
3. Public content remains disabled. If the owner requests activation, obtain approval of the exact visitor preview; never publish owner data implicitly during smoke.
4. API real keys remain unissued. If requested, obtain client/scopes/selected records/fields/expiry confirmation using the existing reviewed controls; no browser-embedded integration secrets.
5. No outstanding mandatory non-Gmail release or reconciliation action. Keep excluded Task5/T15, broader#50 sharing modes and unrelated enhancements out. Report the actual blocked/awaiting-consent states.

The following checkpoint log is historical; its earlier OPEN/next-deploy statements are superseded by the accepted checkpoint above.

## Combined implementation checkpoint — 2 October 2026

Task 6/7 handlers, settings and SQL/R2 security fixtures are implemented locally. Added tests reproduced saved-runtime/mode projection mistakes and missing explicitly consented equipment-usage Dive links before corrections. Final 992/155 regression, typecheck and production build pass. Gmail new-run and conditional manual-only restoration consent received directly; no live request has occurred. Exact #86 application commit is 0fc19c5e20808a6db8c47f9beba4b624b0fe8563. No product source push/deployment/GitHub PR or real publication/key issuance has occurred.

## Final local checkpoint 6a939efee044afe011e6dae3a03281a7e55cc541

996/156 retained regression, typecheck, build/PWA (427 / 42484.07 KiB), zero new targeted lint, privacy/artwork/protected-hash gate pass. See selected-local-verification.json and selected-compiled-browser-evidence.json. The backup endpoint returns all 6485 live records; the inspection-tool returned array was truncated to2000, not the application. No backup implementation rewrite was retained. Two real-SQL large-owner/empty fixtures were added and pass. Fresh recovery decrypt verified. Publication/keys remain off/unissued; Gmail remains unverified until the one new consented live run. No partial production release.

## Corrected application checkpoint e28ebf4d73740fe356e3a9c3c3cc1640b4317a86

Sites142 was rejected for an actual internal heading collapse and verified Sites141 restored. All6485 ordinary owner fingerprints unchanged after recovery. Header correction passes186 stronger compiled checks and final996/156 tests/typecheck/build/PWA/privacy/hash/lint checks. Gmail new run f2356ba1-2c8d-4f55-af40-7c59feac342f is consumed/FAILED token_refresh transport. Task3 restoration BLOCKED; retain existing Gmail release exception, never retry or imply PASS. Corrected combined publication and GitHub acceptance remain OPEN.
