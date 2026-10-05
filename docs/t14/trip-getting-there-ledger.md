# Trip travel time and directions — implementation ledger

Owner approved the Google Maps-only driving plan on 5 October 2026. Baseline app1.0.81 / Sites153, published source b154febb, accepted main5193651; preserved documentation567cfe0. Branch feat/trip-getting-there. No paid routing service, new permission, Google write, Gmail operation or protected calculation change.

| Requirement | Completion / evidence |
|---|---|
| G01 | Full-width collapsible Getting there card in canonical Trip detail/editor — implemented; focused/local PASS |
| G02 | Current location, reviewed canonical owner Home, temporary address/postcode — implemented; focused/local PASS |
| G03 | Explicit linked-Site road arrival selection and harbour override; no offshore-coordinate fallback — implemented; focused/local PASS |
| G04 | Optional travelArrivalPoint saved only by normal Trip Save; legacy/backup compatibility — implemented; focused/local PASS |
| G05 | User-opened Google Maps driving URL, current origin omitted, no estimate invented — implemented; focused/local PASS |
| G06 | No origins/location history persisted; new private field excluded from public/API allowlists — implemented; focused/local PASS |
| G07 | Focused RED/GREEN, regression/typecheck/build/PWA/lint/privacy/version/cache/nine hashes — pending |
| G08 | Six-width keyboard/control/console/overflow acceptance, fresh owner comparison and verified current recovery artifact — pending |
| G09 | Exact candidate publish/read-only acceptance, GitHub review/main match and separate final evidence — pending |

Implementation uses existing TripSection disclosure and owner-profile identity, canonical linked Sites and generic dive-trip persistence. Road arrival uses address/postcode; missing/ambiguous owner Home or Site road location remains unavailable rather than guessed. A saved harbour override belongs to the Trip; starting points stay component state. Maps opens only after an explicit labelled link click. Existing public/API projections remain explicit allowlists. No production owner fixture/save or actual private route launch for testing; use dummy URL assertions/local fixtures.

Owner added Calendar List archive visibility on 5 October: archived entries hidden by default, Show archived opt-in, selection cleared on hiding, exact historical deep links preserved. Three RED tests preceded implementation; dummy browser toggle/reselection checks passed. No archive/delete/write of production records.

Local gate: 1499 tests /222 files; focused77/8, typecheck/build/PWA422 entries/42707.02KiB, privacy1346files/0credential matches/31original nav assets, nine unchanged approved hashes, lint0new/11unchanged baseline (rawexit1). Six genuine widths320/390/430/820/1024/1440:12 Trip +6Calendar observations with containment, keyboard and no application errors. Earlier deferred/hidden lazy images were excluded after verifying collapsed ancestors, not relabelled as missing artwork.

Fresh read-only live baseline09:00:52UTC:6501 original rows/uniqueIDs, fingerprintd869f67baf00986cd210f0a88e6028392745ecf27cbd6cd1b868a9e02697719b; zero broken relationship endpoints; encrypted recovery verified. Current Sites153 rollback artifact/sourceb154febb reverified natively, archive8153a7a5. Environment6/all17bindings preserved. App1.0.82/cachev29 candidate; publication and exact GitHub match pending.

## Owner-added bounded release scope — 5 October

G11/G12: confirmed recoverable Dive Plan and original Calendar-event deletion, with account-scoped local and atomic server dependencies checked. Implemented locally; 18 persistence/API +2 dialog tests and12six-width dialog checks PASS. Previous current candidate had1519/225 full,97/11 focused, typecheck/build/PWA and9hashes PASS; it has not been published.

G13: reduce site typography by20% at browser100%, retain44px controls and supplied31 navigation artworks. G14: private YouTube links in existing Dive story, no remote fetch/embed/tracking; owner supplied TZNYXImh9V0 for exact Dive67, explicit one-record edit after acceptance. G15: Calendar two-column30/70 desktop with selected event in wide column; compact filters and download workspace at bottom, mobile stacking. These new changes require new focused/visual and full candidate gates. New video tests recorded RED before implementation. Production remains verified153/sourceb154febb; preserve all prior evidence and native0d8413e source push, never deploy that earlier packaged candidate.
