# T14 Stage 5W implementation and source decisions

Owner addition is preserved in implementation-plan.md after the Dive Planning weather section. Existing owner Plan snapshots are never migrated, recalculated or saved when viewed. All nine frozen calculation files remain outside this change.

## Domain boundary

`/api/conditions` is authenticated and returns versioned normalized readings, diagnostic status and optional allowlisted site references. Site detail, Dive Planning and Overview consume that model. The legacy weather endpoint remains available to existing historical log/import consumers and supplies archive/seasonal/NASA fallback to the new server service. Provider-specific payloads do not enter the new UI.

Every reading retains metric, normalized unit, measurement depth, observed/forecast/modelled classification, source, coordinates, valid/observation time, retrieval time, model/station/resolution and datum where supplied. A missing observation time or depth remains missing. SST never populates the Plan water-at-depth field. Actual Dive minima have unknown measurement depth; paired device depth/temperature samples require the existing canonical profile-to-Dive association.

Auto selects one source per metric/depth/datum using geographic coverage, temporal coverage, freshness and source class. Inland operator observations and recent actual Dives have priority within comparable groups. Manual provider preference is explicit. Competing sources remain inspectable; values, tide datums and unrelated models are never averaged. Allocation and physiological readiness receive no weather-derived calculation changes.

## Providers and verified access

| Source | Implementation | Access evidence / activation |
|---|---|---|
| Open-Meteo | Atmospheric, marine, archive/seasonal compatibility | No-key default and fallback; live coastal atmosphere/SST/wave/current/MSL verified |
| Met Office | Server-side DataHub Global Spot hourly adapter | Supplied credential returned 403; disabled with product/subscription diagnostic. An Atmospheric Models credential does not prove Global Spot access |
| Vaisala Xweather | Atmospheric forecast and maritime point adapters; independent partial failure handling | Both products returned supported data. Bounded check reports actual X-Cost-Tokens access usage |
| Tomorrow.io | Hourly metric forecast adapter | Supplied credential returned supported hourly data |
| World Weather Online | Marine/past-marine adapter with unknown tide datum retained | Supplied credential returned supported marine data |
| MET Norway | Nordic Oceanforecast adapter with coverage checks | Public Nordic point returned data; temperature depth remains unknown where not stated |
| Copernicus Marine | Strict depth-resolved subset adapter via server service binding | Direct subset credentials/service not supplied. Disabled until a configured subset service returns a supported, geolocated, dated result. Open-Meteo Marine's Copernicus-derived products remain attributed separately |
| SwellCloud | Registry status with explicit approval/access requirement | No approved access/schema supplied; disabled, never simulated |
| PickADive | Read-only stateless MCP site_facts adapter | Official lowercase /mcp endpoint verified with structured site facts; absent sites yield actionable empty status |
| DiveNumber | Read-only nearby-site adapter with field allowlist | Credential valid; configured region returned zero sites. Empty results are not invented matches |

Met Office, Xweather, Tomorrow and WWO credentials are server bindings only. DiveNumber is similarly server-only. Local .dev.vars is ignored. No VITE_* secret, browser credential field or secret response/log is introduced.

Explicit Check access persists only a SHA-256 credential fingerprint, redacted status and 24-hour expiry in weather_provider_checks. Status reads never create/update its schema. Credential changes invalidate prior checks. Missing storage leaves the provider unverified after a restart. This runtime metadata is separate from canonical owner records.

## Operator sources

Capernwray's current official website is https://www.dive-site.co.uk/; the old capernwray.com address is parked. Its own website embeds a public Google Sheets CSV with surfaceWaterTemp, midLevelWaterTemp, waterVisibilty and visibilityDistance. Use that structured feed, including the published misspelling. Generic announcements are not inferred closures.

Ellerton Park, Stoney Cove and Vobster use bounded official HTML reads where a structured public feed was not found. Parsers extract current conditions blocks, date-only observations, depth bands and explicit status. Historical marketing/closure prose is excluded. Cache operator requests for six hours; never label retrieval as observation time.

## Cache, failure and privacy

The disposable zeustek-conditions-v1 IndexedDB holds up to 20 account-partitioned successful snapshots and 500 operator history readings. It creates no canonical records, events, outbox items or automatic Plan saves. Actual Dive/device evidence is read directly from local entities without list-helper repair/sync side effects and is excluded from the conditions cache.

Failure returns the last success with original timestamps. Partial failure retains prior readings only for the same complete request identity. Freshness remains per reading; a new atmospheric response cannot refresh old marine evidence. Changing Site/date/time/provider/depth invalidates pending work. Provider downloads, retries and response size are bounded; credentialed redirects are rejected.

Site references require explicit inclusion on refresh. Only allowlisted reference fields are displayed, with source links; no canonical Site is overwritten. Overview refresh is explicit and uses normalized data. Daily extrema use one model, not a blend; missing values never become zero.

## Release-gate decisions

The dashboard crossed the PWA's existing 2 MiB per-asset limit. Route-level lazy loading separates larger workspaces while retaining the limit and precaching the resulting application chunks. The 748-icon superset remains selectively precached and bounded at runtime.

Browser tests use isolated local fixtures only. No Stage 5W deployment or production provider configuration is performed. Final Stage 10 applies the complete release and verifies production server bindings without exposing their values.

## Authoritative references

- Open-Meteo Marine: https://open-meteo.com/en/docs/marine-weather-api
- Met Office Global Spot: https://datahub.metoffice.gov.uk/support/faqs
- Xweather Maritime: https://www.xweather.com/docs/weather-api/endpoints/maritime
- Tomorrow Forecast: https://docs.tomorrow.io/reference/weather-forecast
- WWO Marine: https://www.worldweatheronline.com/weather-api/api/docs/marine-weather-api.aspx
- MET Norway Oceanforecast: https://api.met.no/weatherapi/oceanforecast/2.0/documentation
- Copernicus Marine: https://help.marine.copernicus.eu/
- PickADive: https://pickadive.com/developers
- DiveNumber: https://divenumber.com/configuration_documentation
