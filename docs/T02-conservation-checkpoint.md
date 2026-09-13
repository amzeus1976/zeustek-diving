# T02 Conservation & AWARE — candidate1.0.3

Started from verified app1.0.2/Sites67 on2026-09-12 at22:36 Europe/London. Same working copy/project/publish path. No T00/T01 discovery or baseline repeat. T03 not authorized.

Known-good source46c84930ba676f1778ef93770b3b98e4604f2835; deployment appgdep_6aa5936c62dc819196ad17dae023e745; rollback saved version appgprj_6a91926878b48191a80d70f1681ef135~appgver_09881d6e2a84819182a7601053363090.

## Implementation/invariants

- Canonical conservation_activity and sourced conservation-programme kinds use existing account-scoped core immutable-event APIs. No new datastore/backend/log, SQL migration, destructive normalization or backfill.
- Seven activity types; local CRUD, search/filter, summaries, progressive fields, existing Dive/Site/Person deep links. Unknown fields and unavailable historical references preserved.
- Sourced version-bound count requirements never rewrite earlier activity evidence, certify completion or claim external submission. Surveys separate from removals; unknown mass distinguished from measured mass; unique linked Dive/subject totals derived from records.
- Owner explicitly permits either media storage. Reuse existing private cloud media/R2 and account-scoped metadata cache; no claim of end-to-end encryption. No new permission/bucket/attachment system. PDF/text acceptance scoped to conservation; old image/video defaults retained.
- Uploaded original IDs linked through core activity mutation; recover-link action handles uploaded-but-unlinked originals. Upload errors remain visible independently of gallery refresh.

## Verification

- Targeted3 files/12 tests PASS: conservation/schema/persistence8, SSR/media-defaults2, existing Dive shell2.
- Full regression26 files/118 PASS; typecheck PASS. Final version/changelog targeted2 files/4 PASS.
- Vinext production build PASS,69 PWA precache entries. Established direct generator/Vinext build used because generic helper rejects existing dual lockfiles; no dependencies/locks modified. Existing non-fatal deprecation/chunk/intermediate precache warnings retained.
- Local UI: existing Site/Dive linked;4 items/2.5kg debris removed; categories retained on edit/reopen. Sourced test-v1 requirement explicitly linked changed count0/1 to1/1, not certification.
- Existing Site link opened canonical popup. Person/Dive route identity additionally verified by unit tests; no duplicate linked records.
- Text upload via existing API returned original attachment72b921d0-6ed1-4295-81ed-3295c183b3dd; filename/link/reference count persisted on reopen/reload. Fixture local only, not production data.
- Local origin stopped: activity saved locally, cloud change queued, notes/programme/Dive/Site/attachment IDs retained on reopen. Restart/reload retained edit and original file. Unit DB-close/reopen, backup, account isolation and no-network checks PASS.
-390px mobile,820px tablet,1280px desktop no horizontal overflow;44px controls; labelled dialogs/fields, Escape dismissal/focus return. T02 media headers/buttons wrap at240px; pre-existing global header/bottom-nav overflow at240px outside this task is not claimed fixed. Physical iPhone/VoiceOver/Dynamic Type not claimed.

## Publish gate

Local candidate passed; publication/production smoke pending. Failure requires immediate rollback67, verify and STOP. No Astra/ChatGPT review recommended. Planning envelope35 relative credits; actual usage NOT_EXPOSED.
