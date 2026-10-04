# Gmail installed-runtime compatibility checkpoint

Issue55/PR72 continuation; local fixtures only. Original accepted source d2eb4f5 and corrected working source were bundled into the installed workerd1.20260515.1 using compatibility2026-05-15/nodejs_compat. External networking was disabled by MockAgent. Both Worker and Node mock bridge use manual redirect handling so the bridge cannot conceal a redirect.

| Fixture | Accepted source | Corrected source |
| --- | --- | --- |
| Dummy successful OAuth/token/profile | Fails transport before provider calls; token0/profile0/writes0 | Connects against mocks; token1/profile1/mock writes1 |
| Dummy token302 | Same setup incompatibility; token0/profile0 | Explicit HTTP302 failure; token1/profile0/destination0/writes0 |
| Request constructor | redirect:error TypeError | redirect:manual accepted |

Correction constructs the bounded request explicitly, rejects every3xx before reading its Location/body, retains20-second timeout and never forwards credentials to another host. Allowlisted v2 evidence distinguishes request_setup/fetch/response_body; only owned timeout/deadline evidence claims request_timeout. Unknown TypeError/AbortError is not invented DNS/network/timeout proof. Shared callback validation eliminates the stale per-UI diagnostic list. Stored v1 failure evidence remains unchanged.

Focused gate: **59tests/5files PASS**; isolated typecheck and focused lint PASS; whitespace PASS. Root reverified all nine approved protected hashes. New health/calendar files may still be at their test-first red stage; final combined checks remain pending.

Reusable harness and before/after evidence are preserved under ignored work/selected-tasks/gmail-runtime-diagnostics*. No real connection, credential, mailbox or production record was modified. Current Cloudflare documentation lists redirect:error among API options, so the conclusion is limited to the tested installed version/configuration, not a universal platform claim. [Cloudflare Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/)

The saved live f2356ba1-2c8d-4f55-af40-7c59feac342f result remains **FAILED upstream_failure/token_refresh/transport**. Its relation to the demonstrated setup defect is plausible but unconfirmed: its v1 evidence cannot distinguish setup from fetch. Historical failure remains preserved. No successful live Gmail acceptance or restoration is claimed. No new invocation is authorised by these fixtures; current isolation and owner-approved release exception remain intact.
