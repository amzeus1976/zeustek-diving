# Current accepted release and remaining work — 5 October 2026

Live app1.0.102 / Sites174 / zeustek-static-v49 is accepted. Published source b68323877ea9608dd4e755a4ca63a0fd8c18b056 and merged PR94/main fd974785d887f72c285ba699a89420e398ca9416 have the identical full tree 7b417510ce78f11ca390b496d4151f61ebc71c2e. Final release evidence is sites174-release-evidence.json; this documentation branch does not alter accepted main or production source.

The requested planning fixes are implemented and verified, including three top columns and each of the four lower cards spanning the whole three-column width independently. Duplicate Plan/Gas, reviewed unlink/delete, exact Calendar → Trip/Plan → Gas, travel, Trip editing, weather empty-field fill and private Centre contacts are accepted. No selected planning acceptance remains pending.

## Actual open GitHub issues

| Issue | Current state and concrete next step |
| --- | --- |
| [#55](https://github.com/amzeus1976/zeustek-diving/issues/55) | Gmail remains disabled and reconnect-required. The already consumed human acceptance failed at token_refresh with HTTP400; no message imported. The human owner must reconnect the dedicated read-only mailbox, then explicitly authorise a fresh bounded acceptance with live human review. Do not replay the consumed run or enable background retries. Diagnostics are implemented; restoration is not verified. |
| [#56](https://github.com/amzeus1976/zeustek-diving/issues/56) | Existing supplied secrets are configured, not missing. Xweather/Tomorrow/WWO access was verified; DiveNumber's empty200 result is legitimate. Met Office still needs compatible provider entitlement; direct Copernicus depth needs a reviewed subset bridge/binding; SwellCloud needs approved access/contract/schema before an adapter. Do not ask to resend keys or purchase/bypass access. |
| [#60](https://github.com/amzeus1976/zeustek-diving/issues/60) | Persistent feature intake/index. Keep open; link future bounded requirements and current release evidence. This is not an unimplemented defect. |
| [#61](https://github.com/amzeus1976/zeustek-diving/issues/61) | Persistent bug intake/index. Keep open; accepted planning defects point to PR94 and Sites174. Any new defect starts from this actual baseline. |

## Integration activation and optional follow-up

- API implementation and [usage documentation](API_USAGE.md) are available, including selected planning resources and compact consent controls. No real key has been issued (zero active/total keys). To activate AMZeus or ZeusTek clients, review the exact records, fields, scopes and expiry and perform the necessary credential confirmation. Keep keys out of public browser code and exports.
- The owner public profile is already published at https://dive.amzeus.co.uk/public-profile, last updated 4 Oct2026 09:43:27.911UTC. This release leaves it unchanged. New content needs the exact visitor preview/publish action; do not silently republish private records.
- Reviewed Calendar downloads/imports include canonical bookings and Trips. Automatic Google Calendar API synchronisation is not implemented and was outside this driving-directions release. No dummy calendars or calendar mutations were created during this release.
- Optional advanced sharing/password/client-encryption and subscription-feed work from broader #50/#83 scopes remains future work. #50 and #54's implemented approved scopes are closed; do not reopen or implement unrelated scope without a new bounded task.
- Targeted lint retains101 unchanged findings; zero new/changed findings. Raw exit1 is retained. Wider finishing/lint debt can be a separate bounded maintenance task, not a waived clean-lint claim.

## Selected goal status

Tasks1,2,4: implemented/verified; accepted143/144 evidence plus retained regression coverage. Tasks6,7: implemented/security verified; existing public snapshot is owner-published, real API keys unissued. Task3: diagnostic implementation verified, restoration blocked by the recorded token-refresh failure. Task5/T15/unrelated enhancements are excluded from this goal. Later explicit calendar/data-cleanup work already accepted in source is preserved; no new implementation is started here.

Final gates:1706tests/247files, typecheck/build/PWA PASS; nine approved hashes and31 artworks unchanged;1346files/zero credential matches;60 compiled +72 live valid observations at320/390/430/820/1024/1440 with no overflow/clipping/broken images or fresh-console warnings/errors. Fresh6540 owner records/IDs/content and integration rows are unchanged; zero missing relationship endpoints, encrypted recovery verified. Production smoke made no canonical, Gmail, provider, Google Calendar, profile or key writes.

No action is pending to publish or reconcile this planning release. Stop after handover; do not begin the optional backlog automatically.
