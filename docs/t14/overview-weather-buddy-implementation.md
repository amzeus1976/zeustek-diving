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
| O01 | Full-width seven-day Overview forecast, complete legible detail | Pending. Both component four-day slicing and CSS hiding days five onward are confirmed causes. Remove both. Render every returned day up to seven; shorter provider coverage is labelled truthfully. No invented data. |
| O02 | One source/time attribution line | Pending. Link the actual attribution once, with retrieval time and genuine cached/stale status. Independent marine sources retain separate attribution. |
| O03 | Remove Overview My Profile and Top Buddy cards | Pending. Keep canonical People profiles, qualifications and preferences elsewhere. Update conflicting old Overview assertions to the new owner instruction. |
| O04 | Selectable Top Buddy Insights award and real evidence | Pending. Shared read-only resolver, scoped canonical buddy links, one count per Dive, no owner/self, exact Person/Dive links. Preserve existing owner preference; no write on read. |
| O05 | Supplied Top Buddy PNG in People | Pending. Preserve supplied original bytes; register transparent128px derivative in the existing curated registry. Do not change31 navigation artwork or748 superset. |
| O06 | Supplied favourites PNG for owner favourites | Pending. Existing Site/Entity favourites plus explicit Person favourite selection; no automatic edits. Accessible pressed state and labels survive. |
| O07 | Dive of the day, beginning01 per saved date/start time | Pending. Pure display projection, separate from lifetime Dive number. Cards/detail/editor preview share it; no canonical field or historical migration. Missing/partial dates remain unknown; missing start times are ordered after known starts and labelled provisional. Stable tie ordering is documented. |
| O08 | Protection, full regression and release acceptance | Pending. All nine approved protected hashes, privacy, retained suites, typecheck/build/PWA/version/cache/lint; six viewport widths including320/430; exact candidate and fresh owner fingerprint comparison. |
| O09 | One publication and exact GitHub reconciliation | Pending after O08. Recheck actual baseline/rollback, freeze source, production smoke read-only, then PR/main full-tree match. |

## Boundaries

No protected calculation edit, owner bulk migration, synthetic production records, new provider, private-profile publication or API key issuance. Preserve People/human and canonical Operator separation, many-to-many links, deletion/backup protections, circular crop and canonical `self` Dive identity. Gmail remains subject to its current human-only acceptance exception; no agent sync, reconnect or credential operation. Met Office denied, Copernicus/SwellCloud conditional states remain truthful.

## Checkpoints and exact next steps

1. Write focused behavioural tests for forecast completeness/provenance, shared Top Buddy evidence, icon preservation/favourite actions and derived daily numbering; record expected failures before application changes.
2. Implement the bounded components/helpers and replace conflicting CSS deliberately. Preserve originals and canonical data.
3. Run focused and complete gates; inspect real compiled local screens at320/390/430/820/1024/1440, including populated weather and ordinal previews. Record results against the exact candidate.
4. Capture a fresh read-only production owner baseline, freeze clean commit/version/cache and recoverable source. Publish one Sites version, verify live/source/assets/PWA/owner integrity without Gmail or owner saves.
5. Reconcile the identical accepted source through GitHub PR, verify main tree, then save acceptance evidence using the established separate documentation checkpoint convention.
