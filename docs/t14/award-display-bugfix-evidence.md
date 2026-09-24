# Post-Sites128 display-award correction — release evidence

## Authority and source

Accepted production before this correction: app1.0.56 / Sites128, deployment `appgdep_6ab537321c7c819187aeec7abf0c69bb`, source `095026d926e1cf8e1f97c1cc79314b94885e7a2a`. This is the rollback target unless an immediate pre-deployment check proves it unhealthy. Branch: `t14/master-forward-build`. The owner-approved Gmail-sync exception continues; no live sync or reconnect is part of this change.

## Diagnosis and implementation

The live owner has canonical Open Water, Advanced Open Water, Rescue Diver and Master Scuba Diver Certification records. The Master Scuba Diver record uses `courseType: other` and `awardPriority: 4`. The owner Person separately retains an older owner-entered Rescue Diver profile value. Insights used the first matching record; Overview preferred the stale Person field. No owner data needs correction.

`resolvePersonDisplayAwards` now supplies read-only, per-track display awards to Insights, Overview and People profile views. It recognises named recreational ratings such as Master Scuba Diver even when stored as `other` or `experience`, without treating generic experience records as awards or deriving depth/permissions. It uses an established complete explicit rank scale where available, otherwise the existing title hierarchy. Canonical evidence takes precedence for display, while the Person field remains unchanged and remains available as a fallback when evidence is absent. The displayed source is derived from the selected award. The recreational summary is labelled “Highest recreational award.” The owner Dive Team's “Me” qualification uses the same evidence module.

## Verification completed locally

- Focused tests: 31/31 PASS. Full regression: 763/763 across 132 files PASS, including retained T14 tests.
- Typecheck PASS. Production build/PWA PASS; 429 precache entries, 748-icon master library excluded by the established rule. Targeted changed-module lint PASS. Client privacy scan: six private credential fingerprints checked, zero matches.
- Protected calculation hashes: all nine files match `protected-calculations.json`; no calculation touchpoint.
- Local fixture Overview at 390/820/1024/1440: “Highest recreational award” renders Master Scuba Diver, zero page-level overflow. Insights at the same four widths: zero overflow and zero application console errors. People profile detail renders “Recreational award: Master Scuba Diver.” The fixture owner has no selected Insights award card, so its exact award value is covered by focused resolver/Insights tests rather than this browser fixture. The production-built local Worker returned HTTP 200 with isolated fixture authentication.
- Read-only live pre-release backup: 6,400 exportable active records, including 66 Dives, one Gas Plan, 11 People, five Operators and 13 Certifications. Aggregate per-ID content fingerprint: FNV64 `354de62ecc6c20de`. These are a point-in-time baseline and must be refreshed immediately before publication; legitimate owner activity is not to be reset.

## Release continuation

1. Reconfirm the current Sites128 deployment/source and collect fresh owner per-ID fingerprints. Package the production build from the clean committed source.
2. Push the exact candidate to the Sites source branch, save one Sites version, deploy once, then smoke Overview/Insights/People, PWA, console, overflow and owner-data preservation. Never invoke Gmail sync.
3. On failure, restore verified Sites128 and retain the candidate. On success, reconcile the exact published source to GitHub through the established PR workflow and verify main's tree.
