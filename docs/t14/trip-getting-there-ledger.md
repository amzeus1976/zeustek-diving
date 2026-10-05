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


## Combined reviewed candidate — local gates complete

G07/G08 now pass for all added scope: 1,539 tests / 228 files, focused 117 / 14; typecheck, production build/PWA 422 entries / 42,717.68 KiB, privacy 1,346 artifact files / zero credential matches, 31 unchanged navigation artworks and 9/9 approved protected hashes. Final packaging repeats the production build from clean frozen source. Targeted lint: 16 latest files, zero new diagnostics, 12 byte-equivalent accepted Sites153 diagnostics; the earlier 14-file directions/deletion lint evidence remains applicable for unchanged modules. Raw nonzero baseline lint results are retained, not described as a clean whole-repository lint.

G13 text reduction is font-only: 12.8px root/body from 16px, matching reduction of application absolute font sizes; 44px target sizes and approved PNG artwork retained. G14 private YouTube URLs are normalized and escaped, never fetched or embedded; dummy link persists across reopening with existing story text. G15 Calendar uses 30/70 desktop columns, mobile stacking, contained labelled day-grid scrolling and downloads below selection. G16 Cloud account uses green/synced, orange/pending/review/offline and red/disabled, with accessible text and distinct icons; review/error actions remain. G17 Dive/Gas duplicates are unsaved new drafts, retain editable inputs, clear IDs, old completed/ready/safety claims and relationships, then save via existing canonical writers. Both dummy copies saved to different IDs and originals remain intact.

186 compiled page checks cover all 31 routes at genuine 320/390/430/820/1024/1440 widths: no page overflow, broken visible images or application console errors. Six additional video and six calendar layout observations verify internal containment, 44px controls, 30/70 sizing, bottom downloads and absence of redundant enabled text. Existing Trip and deletion dialog acceptance remains recorded. Browser screenshot capture on Brave timed out; production proof must be captured on the working in-app browser after deployment.

Fresh pre-publication snapshot at 10:10:28 UTC has 6,540 rows and identical unique-ID accounting, zero missing relationship endpoints, fingerprint 565806f47fc64a8f06228174cbc8bca4c7d128d472c2c8281f4e62b7b4437eac; encrypted recovery verified. Since 09:29, 39 rows were added and one changed before any agent production write. This owner/live activity is preserved, never reversed to historical counts. Unique canonical Dive67 is resolved privately from the snapshot; the owner's exact requested YouTube edit is the only authorised canonical release action. Current rollback Sites153/source b154febb and its recoverable archive were reverified natively. Publication/GitHub G09 remain pending; never deploy the preserved earlier 0d8413e archive.
