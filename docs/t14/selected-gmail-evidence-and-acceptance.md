# Gmail #55 — diagnostic checkpoint and bounded live acceptance proposal

## Current authority

The consumed historical acceptance run `fdeda6a4-5504-49d0-881d-d1795839955b` remains **FAILED — upstream_failure**, started 2026-09-23T22:41:59.261Z and completed .612Z. It did not record the failing phase or HTTP status. New fixtures cannot reconstruct that original cause. Do not overwrite its result, rerun that ID, reconnect, rotate credentials, revoke the connection or enable background ingestion.

The hard release isolation flag remains enabled; ordinary manual sync returns disabled before database/provider activity. News browsing reads connection status and cached stories only. Current production remains Sites141/app1.0.70. No live Gmail request has been made during this implementation.

## Implemented locally

- Versioned operation evidence identifies OAuth exchange/refresh, account verification, listing, metadata retrieval, message parsing and application persistence.
- Failure kind distinguishes bounded HTTP status, transport, parsing, validation and storage. Messages/remedies come from a static allowlist, never provider bodies, URLs or unexpected exception text.
- Stored diagnostics and run results are projected through explicit allowlists. Unknown/nested fields are dropped on response without rewriting stored history.
- Status failures return safe private/no-store errors. A failed/uncertain run is not presented as verified.
- Refresh credentials remain encrypted. A valid stored refresh token survives a response without a replacement. Existing provider rotation and cached non-Gmail functionality are preserved.
- Metadata failures occur before the atomic story write. Durable completed results resolve a lost response; uncertain runs cannot trigger duplicate provider operations.
- Run-table and run-insertion storage failures are reported as persistence failures; actual concurrent active runs remain distinguishable.

The single-run acceptance gate and conditional manual release control are now implemented locally in `lib/server/gmail-release-policy.ts` and the existing sync/status routes. They are not configured or enabled in production. Server-only controls are `GMAIL_ACCEPTANCE_ENABLED`, `GMAIL_ACCEPTANCE_OWNER_ID`, `GMAIL_ACCEPTANCE_RUN_ID`, `GMAIL_ACCEPTANCE_ISSUED_AT`, `GMAIL_ACCEPTANCE_EXPIRES_AT`, `GMAIL_MANUAL_SYNC_ENABLED` and `GMAIL_MANUAL_SYNC_VERIFIED_RUN_ID`. No corresponding secret or owner/run configuration is embedded in the client.

An active acceptance grant requires explicit true, the exact authorised owner, a new UUID different from the consumed historical ID, canonical timestamps and a positive window of at most 24 hours. An authenticated same-origin request must use that exact ID. Default absence/false rejects sync before database or provider calls. Manual restoration separately requires explicit true, a verified run ID equal to the granted ID, and an owner-scoped completed run with zero failures/no diagnostic and timestamps inside the grant. Merely removing the disabling constant cannot establish acceptance. No implicit/scheduled retry was added.

Focused mock/database coverage: 23 Gmail engine tests, three status route tests, the retained disabled-route test and 12 new gate tests = **39 PASS**, with export/privacy coverage in the full suite. Gate tests use dummy configuration and fake time; they cover default isolation, unauthorised/cross-owner/exact-run/origin/expiry validation, uncertain/failed outcomes and explicit manual consent. Current application checkpoint `bd0ba8ced8e45cc0718b7a7b5d04b03547a6c459` passes 150 files / 952 retained tests and typecheck/build. The historical failure remains unknown; Task 3 is not production verified or complete.

## Proposed separately authorised acceptance

Approval is required by the owner's Task 3 instruction, not inferred from the earlier consumed acceptance authorisation.

1. Finish the combined candidate and its non-Gmail gates. Reverify the accepted deployment/rollback and capture fresh owner IDs/content, cached story counts and connection/run metadata using safe fingerprints; do not print credentials or message content.
2. Reuse the already implemented and fixture-tested default-off gate. After explicit approval, prepare one opaque **new** run ID, approved owner, issue time and expiry (no more than 24 hours) in server-only configuration. An authenticated same-origin owner request can consume only that exact ID while ordinary sync and all background retries stay disabled. Existing durable run and active-run constraints prevent concurrent/repeated provider work. Do not add a new authentication scheme or relax mailbox/scope checks.
3. Deploy the complete candidate once. Configure the temporary gate only after explicit owner approval; do not expose gate/connection secrets in browser source, logs, exports or support files.
4. Invoke the new run **once** against the existing dedicated Dive News account, using its persisted encrypted refresh credentials and existing gmail.readonly scope. Bound the existing newsletter query to the prior 90 days, maximum 100 messages, metadata/snippets only, batches of ten and existing per-request timeout. No automatic pagination, bodies/attachments, mail sending, deletion, labels or read-state changes.
5. Observe one durable outcome. Record safe phase/kind/status and imported/updated/unchanged counts, deduplication, source preservation and owner-data delta. If a response is lost, query recorded status only; never submit another sync to get a PASS.
6. On failed/uncertain outcome, disable the temporary gate, preserve evidence, keep normal Gmail disabled and report the precise blocker. No second run/reconnect/credential change is covered.
7. If and only if the run completes, the dedicated account/scope and cached story preservation are verified, and the owner has authorised conditional restoration, enable **manual-only** sync through an owner server control. Test enabled/disabled state against fixtures beforehand. No scheduled/implicit/background sync is authorised.
8. Disable/expire the temporary gate and verify ordinary production smoke causes no Gmail sync requests. Preserve its non-secret owner/run/time metadata if the separately authorised verified manual control needs it; clear the active acceptance flag. Retain the old failed result and the new result separately. No production token is copied into the acceptance metadata.

The proposed grant may authorise one new bounded run plus conditional manual-only restoration on successful acceptance. It must not be treated as permission for additional runs or upstream authentication redesign. If runtime evidence identifies a broader security/data-integrity fault, stop and report it.

## Remaining steps

Obtain the separately requested live-operation approval, then configure the existing default-off gate only at the complete combined candidate's designated acceptance point. Inspect the then-current ledger before execution to prove this new grant has not been consumed. A completed or uncertain run is resolved through status, never another invocation. Until approval arrives, leave both controls off and finish independent work. Real connection storage remains untouched. Plan approval for public/API or a protected-file change does not authorise a Gmail operation.
