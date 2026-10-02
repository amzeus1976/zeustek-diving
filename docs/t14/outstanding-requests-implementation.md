# Outstanding ZeusTek requests — implementation ledger

## Current authority and accepted baseline

On 2 October 2026 the owner expanded the active goal to include Task 5, calendar export and the data-health centre, alongside all genuinely outstanding GitHub feature/bug requests. This supersedes the earlier Task 5 exclusion. Preserve earlier release evidence as history; do not reopen completed architecture.

Work branch: `t14/outstanding-requests`, based on documentation checkpoint `d2eb4f5c7f2f19ef593d052799abee9fad0a1532`. Accepted application source remains `525effa2e91eaf0347f86bd9362ed63730e0dfa3`, app 1.0.71 / Sites143, deployment `appgdep_6abfcc2de2e88191898a82be1dd2cbfc`. PR88/main `d1937fb022dd8ddc81bbb64d4a8ac6dc0e0794f2` matches published full tree `1758f60fac70951be0299c537ecea44be58c4835`. Current local source/evidence and later valid edits must survive. Reverify the actual accepted deployment and rollback before any future release; do not guess the next Sites number.

All thirteen issues #73–#82 and #85–#87 are closed with Sites143 evidence. Tasks1/2/4 are verified; public landing/API capabilities are implemented, public content off and real keys unissued. Their real-content/client activation approvals remain separate from implementation. Preserve all 31 navigation PNGs, 131 curated icons, 748 superset, People/entity many-to-many/deletion/photo/self work and five-format export/connection-secret exclusion.

## Authoritative open-work audit

Connector audit inspected all eight open issues, all comments, PR72 and its unresolved reviews. #60/#61 are standing intake/index portals, not missing product capabilities.

| Item | Required end state | Current evidence/status | Approval dependency |
| --- | --- | --- | --- |
| #50 | Snapshot capability-link sharing for selected Diver Profile and Gas Plan, attachments, exact preview, expiry/revoke/regenerate and owner Shared Links manager | Architecture/security audit complete; concrete plan in outstanding-sharing-plan.md; no share feature code yet | Issue explicitly requires owner approval of plan/slicing before coding. Real private publication requires exact preview consent |
| #54 | Optional registry-controlled Topic Explorer using canonical Knowledge/Bibliography/News/Skills/Training, exact provenance and scoped saved Dive/Site relationships | Source audit/IA complete; concrete plan in outstanding-topic-plan.md; no topic feature code yet | Issue requires approved topic model before coding |
| #55 | Gmail transport defect repaired and authorised live restoration verified | Actual installed Workers rejects original redirect error mode before dummy interceptor; local repair/tests in progress. Saved live run remains FAILED; no new live operation | Any future live sync/reconnect/credential operation requires new explicit consent; both consumed runs stay consumed |
| #56 | Independent, truthful provider feasibility/access/provenance/fallback assessment; activate only verified viable integrations | Existing Met Office/Copernicus adapters retained; Met Office denied/unverified, Copernicus/SwellCloud conditional/off | No access bypass; real credential or activation checks require appropriate owner/tool confirmations |
| #83 / Task5 | Owner-selected RFC5545 calendar download with exact preview, date/timezone precision, stable UID/revisions/cancellations and privacy | Source plan complete; test-first implementation in progress | No automatic calendar upload/feed. Actual dummy supported-calendar import acceptance remains required |
| #84 / Task5 | Owner-only, bounded read-only data/evidence health registry, exact source navigation, uncertainty and safe reports | Source plan complete; implementation pending | Ordinary editor corrections require their explicit save. No automatic repair/migration or safety score |
| PR72 | Resolve overlapping Gmail diagnostics and two review gaps coherently against current accepted contract | Not merge-ready; callback code allowlist and response-body timeout gaps confirmed | Do not merge stale/unverified source; no live Gmail operation needed to repair/verify fixtures |
| #60/#61 | Keep standing feature/bug portal links/status current | No unfiled feature found in complete portal audit | Update after actual delivery, keep portals as standing indexes |

## Task5 implementation contract

Calendar receives a bounded owner-scoped read-only snapshot and covers both canonical `trip` bookings/plans and separate `dive-trip` trips, itinerary children and payment due dates, equipment service, cylinder inspections and owner qualification expiry. Never duplicate the same booking/plan record. Defaults omit source titles, locations and internal record links; each is an explicit independent opt-in. No contacts, team/guest/medical/financial details, serials, notes, organisers, attendees, alarms or automatic uploads.

Strictly validate Gregorian dates. Owner-inclusive date-only trip endings become exclusive next-day DTEND. Floating saved timestamps require a visibly selected timezone; omit spring gaps and require an earlier/later choice for autumn folds. Preserve offset-qualified instants. Missing/invalid/reversed dates produce explained omissions with exact editor destinations. A month-only inspection becomes a labelled month-spanning TRANSPARENT reminder: “due month; exact day unknown,” never a first-day deadline or inspection/serviceability claim. Existing frozen inspection/service helpers are reused unchanged; dive-count-only service thresholds do not establish dates.

Use stable opaque UIDs independent of dates/selected fields. Preview is pure. Explicit download alone updates a small device-local delivery manifest of UID/projection digest/sequence, outside canonical records; unchanged exports retain sequence, significant changes increment it, selected cancellations retain UID and use CANCELLED. Explain that file import is not synchronisation and client re-import/cancellation behaviour varies. RFC text escaping, CRLF and 75-octet UTF-8 folding must preserve final records and Unicode without property injection.

Health and calendar must not call ordinary list helpers: listLocalDiveRecords triggers cloud refresh and diagnostic/cache writes. Use bounded direct account-scoped Dexie read transactions, completeness/coverage and household ownership checks. Do not read secret/key tables or perform provider, image-cache, attachment-flush or ingestion operations. Cache gaps/legacy ownership/remote-only images are Unknown, not broken. Canonical source references use explicit maps, not recursive arbitrary JSON scanning.

Health checks cover missing/conflicting dates, demonstrably broken references, unresolved imports, declared unavailable export images and evidence completeness. Preserve Skill aliases, relationship endpoint types and archived/history semantics. Results identify fixed check/reason/severity/uncertainty/count/scope/time and exact affected source destinations. No automatic repair/merge/delete, no safety/readiness/proficiency certificate. Reports use a strict DTO of fixed summaries/counts/uncertainty; no raw records, private labels/notes/contact data, attachment keys/filenames, credentials or other owners’ full records. Corrections navigate existing editors and preserve their ordinary Save/Cancel ownership.

## Working sequence and recoverable checkpoints

1. Save this expanded authority/requirements ledger and concrete approval plans; preserve accepted evidence.
2. In parallel, implement/test calendar and read-only health foundations; repair the demonstrated Gmail Workers compatibility defect and diagnostic review gaps with network-disabled fixtures.
3. Complete #50/#54 owner plan gates while independent work proceeds; then test-first approved sharing/topic implementations.
4. Assess #56 against actual current permitted products/configuration; retain truthful disabled states and tested fallbacks where access is unavailable.
5. Integrate exact route receivers, owner-only controls, revision metadata and configuration preservation. Reconcile historical issue-matrix statuses using accepted evidence, never relabel deferred work complete.
6. Run focused tests after each stage and recoverable commits. No intermediate production deployment.
7. Run the full exact-candidate regression/typecheck/build/PWA/version/cache/lint/security/privacy suite and all six browser widths. Verify actual calendar dummy downloads/imports and five-format exports.
8. Capture fresh owner canonical IDs/counts/content fingerprints/relationship integrity, approved nine hashes and verified recoverable accepted rollback. Freeze exact clean source/artifact.
9. Publish one combined completed candidate; read-only smoke except distinct approved acceptance actions. Roll back genuine blockers. Gmail exceptions remain explicit; no consumed run retry.
10. After production acceptance reconcile exact source through GitHub PR/main, disposition PR72 and update dedicated issues/portals with actual evidence. Public/private data activation remains separately consented.

## Release/approval invariants

All nine current approved hashes must match throughout. The exact prior #86 approval is not blanket permission for another byte change. Any necessary new frozen diff raises CALCULATION_TOUCHPOINT for separate approval before editing/production. No canonical owner bulk rewrite, migration or synthetic production records.

The two previously consumed Gmail runs stay FAILED. A local compatibility reproduction does not prove production restoration. Public profile remains off and integration keys unissued; future real snapshot/link publication requires exact visitor/attachment review and necessary security/tool confirmations. No credential material in browser code, logs, exports, reports or backups.

Every acceptance item needs authoritative evidence. Existing 996 tests and six-width Sites143 observations are historical for unchanged work, not a gate for this changed candidate. Record actual new candidate/version/source/results rather than assumed identifiers.

## Progress log

- 2 October 2026: previous goal turn made verified progress (Sites143 acceptance, PR88 exact-source merge, thirteen issue closures and recoverable d2eb4f5 handover).
- Expanded owner objective includes Task5. Current branch created from preserved evidence/application; production and accepted main unchanged.
- Read-only audit confirms eight open issues/one open PR; no additional unfiled work in standing portals. Calendar/health source boundaries and exact-link gaps mapped.
- Gmail isolated workerd1.20260515.1/compatibility2026-05-15 with outbound networking disabled reproduces redirect-mode rejection before token/profile mock interceptors. Minimal manual-redirect/reject-all-3xx correction and bounded setup/fetch/body diagnostics are being tested. This is local evidence only; saved live result not changed.
- Native log lookup respects workspace maximum100; available bounded recent sample does not include saved14:56:44 invocation. Later data/media cancellations are not attributed to Gmail.

## Exact next steps

Complete current test-first local work and save its evidence. Submit/review the concrete #50/#54 plans before those feature edits. Continue independently permitted Task5/provider work while approvals are pending. Revalidate current live/app/branch before release; no Gmail run, real publication, key issuance or frozen-byte change is inferred from broad goal access.

