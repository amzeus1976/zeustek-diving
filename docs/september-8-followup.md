# September 8 follow-up corrections

- Cloud sync label distinguishes enabled sync from the offline cache; pending edits retain their existing status.
- Cloud downloads cache in batches of 40 with bounded transaction retries, preserving unsent and newer edits. Absence reconciliation follows successful downloads only.
- OpenStreetMap tile host is allowed by CSP; tile requests send an origin referrer. Styles load before map initialization. Failed tiles show a retry action.
- Course layout uses available desktop width, stacked core stages, compact collapsible sections, and a vertical mobile layout. Development plan has no forced inner scroll. EFR, oxygen and refresh tiles share the specialty area; EFR Care for Children links to the official course.
- Site and log activity choices share one constant. Town, region, country and address have distinct fields. Both owned and hired gear can be selected and owned usage is counted correctly.
- Log icons expose missing/partial/recorded status with accessible names. Runtime sums bottom time, actual deco stops and the completed safety stop; missing actual stop durations leave it unknown.
- Site map upload/import uses the existing account-scoped image pipeline. Albums can be tagged to a site and opened from its details.
- Site sorting, immediate record refresh, wishlist card sizing and automatically dismissed success notices corrected.
- Weather requests share cached upstream results and respect rate-limit cooldowns. Recent dates use the forecast endpoint. Errors no longer promise an unimplemented fallback; external rate limits can still make weather unavailable.

Validation: 65 tests pass; TypeScript passes. Browser checks: map tile naturalWidth > 0, mobile course layout without page overflow, 40 + 3 runtime = 43, both gear checkboxes active, immediate site-description display and correct site-to-log autofill. Physical iPhone verification still required.

## Additional site-entry and gas/weather follow-up

Site editing is grouped into seven topic sections with two columns on desktop and one on mobile. Location fields stay together; activity choices occupy their own full-width row. Browser verified the activity row and parent grid have the same width.

Calculate SAC / RMV is available in the gas section and a missing-values action is available in the logbook. SAC is stored separately in bar/min; RMV remains L/min. Existing values are preserved. Automatic estimates require a single open-circuit tank, valid volume/pressures, average depth and complete elapsed runtime. Switched/multiple cylinders and CCR need segment measurements and are skipped. Browser fixture: 12 L, 200 to 80 bar, 20 m average, 40 minutes -> 1 bar/min SAC and 12 L/min RMV.

NASA POWER is the independent historical fallback for Open-Meteo failures or absent historical data. Fallback temperature and wind are explicitly daily UTC averages, with persisted provider, resolution and attribution. Missing marine conditions are not fabricated. Cache and rate-limit cooldowns are respected. Live NASA sample API returned temperature and wind; automated integration test simulates primary failure and verifies NASA response.

References: https://dan.org/alert-diver/article/estimating-your-air-consumption/ and https://power.larc.nasa.gov/docs/services/api/temporal/daily/
