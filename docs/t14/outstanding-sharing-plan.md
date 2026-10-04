# Issue50 snapshot share links — proposed implementation/security plan

## Audit and approval boundary

The current app1.0.71/Sites143 has authenticated private routes, owner-only publication/integration controls, strict public projection and metadata-stripped photo derivatives. dive_publications currently uses a single landing slot; it does not implement per-record capability links or Gas Plan publication. Reuse these mechanisms, canonical Person/Gas Plan stores, existing authentication and Sites project. No changes to Sites visibility or normal private APIs.

Issue50 explicitly requires owner approval of architecture, slicing and access choices before feature coding. This is that concrete plan; actual private publication/credential exposure remains a separate exact-content/security confirmation, even after code approval.

## First delivery and optional modes

Deliver snapshot publication for selected Diver Profile and Gas Plan, individual supported attachments, exact visitor preview, expiry, copy/visitor-preview, revoke, replace snapshot and regenerate link; add an owner-only Shared Links section to existing Settings/Admin.

Publication mode is snapshot. Access mode is anyone-with-the-unguessable-link. Later private edits do not silently update published content; explicit replacement must bind to a fresh exact preview. Live updates, password protection and client-side encrypted-link modes are design options in the issue, not mandatory first-delivery capabilities. They remain named follow-ups pending their own reviewed access/decryption/throttling design. No view-count/visitor identification analytics.

## Selected data and calculations

Profile uses the existing owner Person/canonical Certification resolver and allowlisted display/experience fields, with bounded owner-edited biography and approved photo. Offer certification titles/agencies and recorded training references as individually selected fields/records. Do not publish numbers, private contact/address/DOB, medical/insurance/emergency information, private notes, other people, internal account/import IDs or arbitrary canonical JSON.

Gas Plan publishes only chosen existing summary inputs and saved supported outputs: units, depth/runtime, gas fractions, role/configuration, chosen pressures/reserve/allocation summaries and source model/version/time. No new calculations, physiological/decompression claims or gas-switch credit. Missing legacy output stays unavailable; no invented result or Ready claim. Preserve relevant model assumptions/warnings in a privacy-aware projection and state that this is an owner-selected planning snapshot, not independent safety verification. Team/private notes/serials/internal record references are excluded.

Unknown/new fields remain private. Source ownership is rechecked for every record/link/attachment; selection does not grant related records automatically. Preview is made from the same strict validated snapshot/attachment projection used by visitors, with freshness/hash binding to prevent changed private evidence from bypassing review.

## Attachments and exact review

Each supported attachment is separately selected and previewed. Reuse server ownership checks and dedicated opaque derivative IDs; never expose original R2/attachment keys or general media listings. PNG/JPEG derivatives strip metadata and preserve approved content. Bounded PDF support must pass a sanitised derivative/viewer gate that removes metadata, active actions and embedded attachments; reject unsupported/encrypted/malformed documents rather than publish arbitrary originals. Tests and actual viewer review precede enabling that type.

The UI warns that image/PDF pixels can contain information omitted from text. Selecting a source record does not select all media. Visitor handlers recheck the active share’s explicit attachment list before every asset response. Revocation/expiry disables both JSON and assets. No claim that revocation erases already obtained screenshots/downloads.

## Tokens, routes and metadata

Prefer `/share/#<capability>`: the fragment is not sent in the initial URL, limiting token exposure in access logs/referrers. The generic share page loads only the approved snapshot through a dedicated read-only request with the capability in an authorization header; it never mounts private navigation or loads the owner account. No ChatGPT login required for active shares. Invalid/expired/revoked tokens give the same safe unavailable view.

Generate32 random bytes; store only verification hash. Owner gets plaintext once for copying; listing never reveals it again. Regeneration atomically replaces the hash and invalidates the old token; unrelated links remain valid. Public opaque share IDs, optional expiry and update time are publication metadata, not another Person/plan store. Reuse existing publication slots/derivative infrastructure and add only bounded share-control metadata where token/expiry indexes require it.

Manager supports default disabled/unpublished state, exact preview, explicit create/update, selected fields/assets, expiry, revoke and regenerate. Use existing same-origin owner authorization, bounded input schemas, safe errors and atomic ownership checks. No bearer token/provider/OAuth/vault key in public payloads, HTML, logs, reports, backups or caches.

## Anonymous access and caching

Every page/data/asset path independently validates capability, ownership scope, expiry/revocation and selection. No anonymous canonical lookup or public record-ID route. Enforce noindex/nofollow, no-referrer, nosniff and private/no-store on shared responses; exclude share routes/assets from PWA/CDN offline caches. Purge Blob URLs and stale displayed content when a request is revoked/unavailable. Explain offline/copied-content limits truthfully.

Use bounded per-link anonymous request throttling and minimal nonidentifying abuse metadata; no third-party analytics. API/client key access remains separate, not a way to bypass share scopes. Existing approved private authentication, offline owner data and exact private deep links stay intact.

## Tests and rollout

Test strict nested allowlists and schema evolution, source/asset ownership, guessed IDs/tokens, cross-account/cross-share tampering, expiry/revoke/regenerate, stale previews, snapshot stability after private edits, same-origin writes, hash-only storage/once-only token, rate bounds, text/script injection, metadata sanitisation, safe download/viewer headers, alternative asset paths and all cache boundaries. Dummy isolated fixtures only.

Test anonymous profile and Gas Plan views at390/820/1024/1440 plus320/430, keyboard/focus/44px targets, long/missing content and actual chosen attachment rendering. Preserve all nine approved calculation hashes and canonical owner fingerprints. Use the full combined release gate and verified rollback; no partial production publication.

Production smoke leaves real links/profile content unpublished unless the owner approves that exact visitor/attachment preview and required tool confirmation. Only accepted production source is reconciled to GitHub main; #50 is not marked delivered by this proposal.

## Proposed decision

Approve the snapshot + anyone-with-link first slice, including expiry/revoke/regenerate and the bounded attachment gate. Explicitly defer optional live/password/encrypted modes and visitor analytics to named later designs. Real content publication remains a separate approval.
