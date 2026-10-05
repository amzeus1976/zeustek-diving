# Trip travel time and directions — implementation ledger

Owner approved the Google Maps-only driving plan on 5 October 2026. Baseline app1.0.81 / Sites153, published source b154febb, accepted main5193651; preserved documentation567cfe0. Branch feat/trip-getting-there. No paid routing service, new permission, Google write, Gmail operation or protected calculation change.

| Requirement | Completion / evidence |
|---|---|
| G01 | Full-width collapsible Getting there card in canonical Trip detail/editor — pending |
| G02 | Current location, reviewed canonical owner Home, temporary address/postcode — pending |
| G03 | Explicit linked-Site road arrival selection and harbour override; no offshore-coordinate fallback — pending |
| G04 | Optional travelArrivalPoint saved only by normal Trip Save; legacy/backup compatibility — pending |
| G05 | User-opened Google Maps driving URL, current origin omitted, no estimate invented — pending |
| G06 | No origins/location history persisted; new private field excluded from public/API allowlists — pending |
| G07 | Focused RED/GREEN, regression/typecheck/build/PWA/lint/privacy/version/cache/nine hashes — pending |
| G08 | Six-width keyboard/control/console/overflow acceptance, fresh owner comparison and verified current recovery artifact — pending |
| G09 | Exact candidate publish/read-only acceptance, GitHub review/main match and separate final evidence — pending |

Implementation uses existing TripSection disclosure and owner-profile identity, canonical linked Sites and generic dive-trip persistence. Road arrival uses address/postcode; missing/ambiguous owner Home or Site road location remains unavailable rather than guessed. A saved harbour override belongs to the Trip; starting points stay component state. Maps opens only after an explicit labelled link click. Existing public/API projections remain explicit allowlists. No production owner fixture/save or actual private route launch for testing; use dummy URL assertions/local fixtures.
