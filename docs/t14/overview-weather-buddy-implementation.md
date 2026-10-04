# Overview weather, buddy awards, favourites and Dive-of-day ledger

Owner request: 4 October 2026. Continue the preserved accepted architecture. One combined release after verification; no intermediate publication.

## Authority

- Starting documentation checkpoint: `894e5124f9b65791c280ec94a7573b5f22b1558e`, clean `t14/sites145-release-evidence`.
- Work branch: `t14/overview-weather-buddy`.
- Accepted production: app1.0.73 / Sites145; deployment `appgdep_6ac25ecb496081918583c186304346b9`; source `67c9706171ece312699c2c352fd94d5163137ee5`; tree `b5302252395a6394a875502f3bf1630703de6243`.
- GitHub accepted main: `4df0df63cea1e45c4b6159276def8c51127c987b` (PR90), same full tree. Preserve later valid work and recheck before release.
- Recovery: verified Sites145 saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_5a6c59007eac8191953b021550c59cc5`; official archive SHA256 `11d1766c12a31a52abe1c9139261a6c1dfed44f277e8d4eccb1981a97391ac30`.

## Requirements and deliberate design

| ID | Requirement | Implementation / verification status |
|---|---|---|
| O01 | Full-width seven-day Overview forecast, complete legible detail | LOCAL PASS. Removed both slicing and CSS hiding. All seven actual dates render with temperatures, wind/gusts, direction, rainfall and available sea details. Missing and shorter source coverage stays explicit. Two populated local Sites pass six widths, with seven atmospheric days and seven marine days at the coastal Site. |
| O02 | One source/time attribution line | LOCAL PASS. Actual attribution links appear once with retrieval time and cached/stale status. Genuine independent marine attribution remains separate; same source/time is deduplicated. |
| O03 | Remove Overview My Profile and Top Buddy cards | LOCAL PASS. Canonical People profiles, qualifications and preferences retained. Conflicting old Overview assertions deliberately changed to the new requirement. |
| O04 | Selectable Top Buddy Insights award and real evidence | LOCAL PASS. Shared pure resolver, canonical buddy links, one count per Dive, no owner/self, exact Person/Dive links and scoped/excluded evidence. Existing owner preference retained. Compiled enlarged analysis opens the actual Person and three supporting fixture Dives. No live selection saved. |
| O05 | Supplied Top Buddy PNG in People | LOCAL PASS. Originals byte-identical; transparent128px derivative registered in the existing curated system. All31 navigation assets and748 superset unchanged. Total curated registry133 includes the two additive owner status icons. |
| O06 | Supplied favourites PNG for owner favourites | LOCAL PASS. Site/Entity controls preserve existing data and pressed state. Person favourites are explicit additive private edits; original canonical Person is saved without persisting refreshed derived profile values. Local save/filter demonstrated; no production Person changed. |
| O07 | Dive of the day, beginning01 per saved date/start time | LOCAL PASS. Pure projection, separate from lifetime number. Cards/detail/editor preview agree. No historical migration. Invalid/partial dates remain unknown; unknown times follow known times and are provisional; equal times use lifetime number then stable ID. Compiled editor shows01 and exactly one Me. |
| O08 | Protection, full regression and release acceptance | LOCAL PASS; production acceptance pending. Full1388/206, focused81/10, typecheck/build/PWA/privacy/version/cache and all9 approved hashes pass. Targeted lint218 files has0 new/changed and92 unchanged baseline findings; rawexit1 retained. All31 routes at six widths pass186 observations; feature checks54 observations pass. No application console errors, page/heading overflow, clipping or broken visible images. |
| O09 | One publication and exact GitHub reconciliation | Pending after O08. Recheck actual baseline/rollback, freeze source, production smoke read-only, then PR/main full-tree match. |
| O10 | Dedicated Dive Skills practised page and batch entry | LOCAL PASS. Exact-record `view=skills` tab/page inside Logbook; Debrief links there. Search/group/paging and select-this-page support quick entry. Separate confidence/competence/notes, optional shared ratings, saved-Dive Environment projection and Assessment dropdown including Self assessed. Already-practised Skills and legacy aliases omitted only on this Dive. Stable attempt IDs and account-scoped serialisation retain partial successes and recover interrupted evidence/link saves without duplicates. Existing attachments/numeric ratings remain readable. Actual local Save2 persists Competent/4 and Developing/2 independently, notes retained, picker excludes both; Cancel restores drafts. No live evidence save. |

## Boundaries

No protected calculation edit, owner bulk migration, synthetic production records, new provider, private-profile publication or API key issuance. Preserve People/human and canonical Operator separation, many-to-many links, deletion/backup protections, circular crop and canonical `self` Dive identity. Gmail remains subject to its current human-only acceptance exception; no agent sync, reconnect or credential operation. Met Office denied, Copernicus/SwellCloud conditional states remain truthful.

## Checkpoints and exact next steps

### Final local gate — 4 October2026

Application version1.0.74; cache `zeustek-static-v21`. PWA422 entries/42675.01KiB. Source changes are bounded to these requirements; nine frozen files are byte-identical. No schema/database migration or dependency change. Full protected expected/actual values and aggregate gate are in `overview-weather-buddy-local-gate.json`.

Tests were written before implementation: original forecast/daily/icon/buddy RED and Skills missing-module RED remain in ignored work evidence. Raw initial concurrent regression `STACK_TRACE_ERROR` in an unchanged Calendar suite and the Windows build lock/CLI attempts are retained. Final bounded two-worker full regression and unlocked production build pass without weakened tests. Targeted lint intentionally reports retained pre-existing findings; it is not falsely reported as zero total warnings.

Compiled loopback privacy gates:12 sharing/auth checks,10 weather/API transport/auth denials, provider-status redaction and1344 artifact files scanned with0 credential matches. Only two128px runtime status icons are public; original1254px masters are outside public/precache. Existing API and revocable public/private cache boundaries remain protected.

Fresh normal signed-in read-only production backup16:49:50.727UTC:6494 ordinary rows,68 Dives,12 People,5 Operators,0 Gas Plans,17 Skill evidence records; fingerprint `6f9c3549c8f3416abfe02769854ee9d25eb50e7d40ad3ee7a7757fb083de8acc`. Unique IDs,8 legacy Person/Entity pairs,1 explicit link,0 missing endpoints; connection secrets excluded. AES-GCM/Windows-user-DPAPI recoverability verified. Raw rows, per-record fingerprints, encrypted recovery and screenshots remain ignored. This fresh snapshot includes owner activity since Sites145 acceptance; historical6488 is not a target.

Native Sites145/version/source/recovery artifact, GitHub main4df0df6 and environment revision6 were reverified before freeze. Preserve all17 configured bindings and the existing owner-enabled public snapshot. No Gmail sync, provider check/credential change, publication, API key issuance or synthetic owner record occurred.

**Next:** commit/freeze this clean candidate and source bundle; use fresh Sites credential with the existing project/source helper to push/package the exact built source, save/deploy one version, verify live source/version/new page/weather/assets/PWA/security/responsiveness and fresh owner comparison. Then open/attach/merge the exact GitHub candidate and verify the full main tree. Record accepted identifiers in a separate documentation checkpoint; do not deploy a later evidence-only commit as product source.

1. Write focused behavioural tests for forecast completeness/provenance, shared Top Buddy evidence, icon preservation/favourite actions and derived daily numbering; record expected failures before application changes.
2. Implement the bounded components/helpers and replace conflicting CSS deliberately. Preserve originals and canonical data.
3. Run focused and complete gates; inspect real compiled local screens at320/390/430/820/1024/1440, including populated weather and ordinal previews. Record results against the exact candidate.
4. Capture a fresh read-only production owner baseline, freeze clean commit/version/cache and recoverable source. Publish one Sites version, verify live/source/assets/PWA/owner integrity without Gmail or owner saves.
5. Reconcile the identical accepted source through GitHub PR, verify main tree, then save acceptance evidence using the established separate documentation checkpoint convention.
