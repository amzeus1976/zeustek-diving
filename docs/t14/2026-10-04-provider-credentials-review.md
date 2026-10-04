# Issue #56 — supplied credentials and actual runtime gap

Reviewed 4 October 2026 after the owner corrected the outstanding-provider report and located the original `DIVE APIS AND MCPS.txt`. This is a read-only configuration/source audit and a correction to the backlog, not a provider activation or a new release.

## Current authority

Accepted production remains **app1.0.72 / Sites144**, deployment `appgdep_6ac22c0bb1a081918ace0a0a0fbc88c0`, published source `c39210be47cab1a21d7d6c6ea24b279cf41597bd`. Accepted GitHub main is `d57e1536921bd20d49a6d1c51a381db2adb7234a`, with the same published tree. This audit starts on the separate documentation branch `t14/sites144-release-evidence`, checkpoint `d4c238fd74b09e2e7d39c730fa6956ea4302d01a`; it does not change that accepted product source.

## Evidence recovered

- The original private reference is accessible at the owner-supplied `B:/ZeustekDiving/zeustek build/DIVE APIS AND MCPS.txt`, modified **23 September 2026, 16:33:26 UTC**. The previous Desktop path is no longer present. Do not copy its contents into GitHub, source, fixtures, logs or support exports.
- All **six credential values** used by the existing Stage 5W parser are present and match the ignored local server configuration: `MET_OFFICE_API_KEY`, `XWEATHER_CLIENT_ID`, `XWEATHER_CLIENT_SECRET`, `TOMORROW_API_KEY`, `WWO_API_KEY` and `DIVENUMBER_API_KEY`. Values were compared privately; no credential value is recorded here.
- Historical Stage 5W checks recorded Met Office HTTP403; Xweather atmospheric/marine, Tomorrow.io, WWO and DiveNumber HTTP200. DiveNumber returned zero nearby sites. These are historical local checks, not current production access evidence. The historical Met Office JSON also contains a misleading derived `success: true`; HTTP403 and zero returned periods remain the authoritative failure evidence.
- The current native Sites runtime environment, **revision5**, contains **none of those six provider bindings**. The signed-in live Weather & Conditions UI independently reports Met Office, Xweather, Tomorrow.io and WWO as **Not configured / unconfigured**. No Check access control was invoked.
- The supplied file records a **SwellCloud API approval request**, not an issued production key or response schema. It contains no Copernicus account/subset-service configuration. This does not prove that other chats contain no later information; those broader claims must not be made.
- Available recent and archived chat inventories were checked, including an archived Zeus Dive project chat. They yielded no additional provider-access evidence. The recent-chat listing is limited to50 entries and is not a complete account-wide history search. The recovered original file and preserved Stage 5W evidence establish that the six existing credentials were already supplied.

## Corrected status and ownership

| Provider | Supplied / implemented evidence | Current operational status | Remaining work |
| --- | --- | --- | --- |
| Met Office Global Spot | Credential already supplied; hourly adapter exists; historical compatible endpoint returned403 | Production binding absent; not currently configured. No new denial or successful entitlement check was performed | Configure the supplied server secret and perform a bounded, explicit compatible access check. If403 persists, record the exact product/entitlement failure; only then identify any genuinely necessary provider/account action. Do not ask the owner to resend the existing key. |
| Xweather atmospheric/marine | Client ID and secret already supplied; both adapters historically returned supported data | Production bindings absent; disabled/unconfigured | Existing integration configuration and current access verification are our implementation work, not a missing-owner-credentials dependency. Preserve returned provenance, quota accounting and partial-failure fallback. |
| Tomorrow.io | Key already supplied; adapter historically returned hourly data | Production binding absent; disabled/unconfigured | Configure the existing server-only binding and verify the actual supported response. |
| WWO Marine | Key already supplied; marine adapter historically returned data | Production binding absent; disabled/unconfigured | Configure the existing server-only binding and verify marine data with truthful tide/depth attribution. |
| DiveNumber enrichment | Key already supplied; read-only adapter exists; historical check returned zero nearby sites | Production binding absent | Configure the supplied binding and distinguish valid empty results from access/transport failures. Never invent a site match. |
| Direct Copernicus Marine | Strict subset adapter exists in the app; Open-Meteo's Copernicus-derived surface products remain separate | No `COPERNICUS_CONDITIONS` service binding; direct depth service not operational | Select a concrete dataset/version and supported depth/time/coverage contract, implement and deploy the compatible bounded subset bridge, and invalidate checks when its version changes. This is integration work; credentials alone cannot substitute for the missing service. Do not label all Copernicus data unavailable. |
| SwellCloud | Approval request recorded in the supplied reference; registry entry only, no fetch adapter/binding/normaliser/allowed host | Disabled; approved production access and complete schema not evidenced by this reference | Establish the recorded application's outcome from existing account/chat evidence, then implement the adapter against the approved contract if access permits. Do not restart an access application, accept new terms, purchase a plan or claim an issued key from this file. |

The former blanket wording **“await owner credentials/access requirements” is incorrect** for the already supplied credentialed providers. Issue #56 stays open because configuration, direct-provider implementation and live verification remain unfinished. A supplied key, an adapter or a historical fixture PASS is not an active production integration.

## Exact next steps

1. Preserve the current production environment and recovery metadata. Use the existing Sites secret controls to set only the six approved provider bindings from the private reference; retain all other settings and do not put credentials in a browser form, bundle or repository.
2. Apply configuration through the established release process, using the exact accepted source unless a reviewed implementation change is required. Verify secret exclusion, protected hashes, owner-data integrity and recoverable rollback. Do not report a new release as already performed by this audit.
3. Use explicit bounded provider checks for existing adapters; record only redacted HTTP/product status, supported field/count evidence, freshness and fallback. Met Office stays disabled unless a compatible check succeeds. No paid subscription or access workaround is implied.
4. Treat direct Copernicus bridge and SwellCloud adapter requirements as their own remaining integration tasks. Preserve the approved current providers and no-key fallback throughout. Do not present unsupported water-at-depth values as available.
5. Update #56 with actual verification results before marking any operational acceptance complete. No Gmail sync, reconnect, key issuance or owner-record migration belongs to this provider task.

## Audit safety and verification

Application code, provider settings, live owner records, existing credentials, app/cache identifiers and deployment are unchanged. Only documentation and the GitHub issue status are corrected. Secret-presence/match checks output booleans and names only; current runtime values were masked and never recorded. The nine protected-file hashes and credential-exclusion scan are rechecked for this documentation checkpoint; the accepted1302-test release evidence remains evidence for the unchanged application, not a new provider activation.
