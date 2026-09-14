# ZeusTek pre-coding baseline — app1.0.24 / Sites91

Start each candidate from the current GitHub main commit and record that SHA. This document is a source/deployment contract, not authorisation to implement a roadmap task, publish a candidate or accept owner snags.

## Verified source and release

- GitHub Gate2 PASS: PR11/main31559a59a5e2179055b06dfb70dd41147fcd10f1, snapshot7ba34ed2bfdf83f148835d9e3e9b2c3fd4b87e9c. Read-only fetched tree b04937c77fe6b83239833ee671b56b8a45edfdd5 exactly matches reviewed acceptance source; all16 changed blobs verified. Subsequent completion audit documents may be newer without changing product source. Preceding healthy-baseline PR9/PR10 sync retained; older candidate PR5/PR8 closed as superseded, not blindly merged.

- Repository: amzeus1976/zeustek-diving.
- Published application source: 7c11d76ce7ff32bf8a7c523a6b1193174466a42a.
- Acceptance documents may be newer than that unchanged verified product source.
- App/package version: 1.0.24; saved Sites version: 91.
- Saved version: appgprj_6a91926878b48191a80d70f1681ef135~appgver_84edb2993e548191851fe35217586916.
- Deployment: appgdep_6aa87f5d55588191bd830b1eb4df1440, SUCCEEDED 2026-09-14T23:12:44.476213+00:00, env revision3.
- Canonical project: appgprj_6a91926878b48191a80d70f1681ef135; production https://zeustek-dashboard.amzeus.chatgpt.site/; same-origin PWA /?source=pwa.
- Gate: focused27, full282/53 files, typecheck/build/PWA70 PASS; actual phone390/tablet820/desktop1280 T08 production smoke PASS; 66 Logbook entries retained.
- Immediate healthy rollback: app1.0.23/Sites90, saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_c323cf4d7adc8191a6b55c832e9f29b5; deployment appgdep_6aa874f286888191b17686ee44eb2144. Sites88 also retained.

The GitHub synchronization commit has only GitHub's existing main as its parent; it imports the verified source tree, not the entire separate Sites history. Repository issue templates, contribution guidance and licenses are retained. Product source is byte-identical to the published source; README/progress/release documentation may contain later verification evidence. No deployment is performed by this sync.

## Architectural invariants

- One existing responsive app/PWA, backend, canonical Site catalogue, Dive log and Skill/knowledge systems.
- Runtime `trip` remains Dive Plans; logistics Trips use `dive-trip`. Keep their IDs and immutable Plan→Dive provenance.
- `equipment-set` remains canonical reusable loadouts; physical cylinder identity remains Equipment. `cylinder-fill` and `gas-analysis` are time-dependent evidence, not replacement inventory.
- `site-overhead-profile` remains an optional child of the canonical Site; historical dated observations do not overwrite ordinary Site identity.
- `equipment-event` is additive generic record history, shared under existing shared-gear permissions with canonical Equipment-parent validation. Monitoring/resolution retain the same record; service baselines change only through an explicit saved Service event and retain an applied marker.
- T08 `professional-pathway` and `professional-evidence` use generic records and existing immutable `reference-requirement-set`. Evidence links use stable canonical IDs; evaluation against a newer standard appends a lightweight link, never rewrites older evidence/version provenance. No standards numbers are invented from certification names.
- Use domain helpers → saveRecord/saveLocalRecord → mutateEntity → existing event/outbox → /api/dive-data. Preserve IDs, immutable event history, conflicts, encryption, sync, backups, attachments and deep links.
- Do not directly mutate Dexie event/outbox from UI or add duplicate stores, backend tables or inventories. Existing generic JSON dive_records projection remains authoritative.
- Use current DIVE_RECORD_KINDS additively; never replace the list with a pre-coded snapshot's older list.

## Current status / unresolved work

- T00–T07 complete, including the Trip resources/media/compact sections and Technical Workspace release.
- Equipment SNAG-EQUIP-001/002/003 implemented, tested and production-smoked; owner acceptance and Gemma's signed-in shared-history UI check remain pending.
- T08 COMPLETE, production acceptance and GitHub Gate2 PASS. Preserved e4ca3e531acf6d353853a880ea6d89d1c92b88dd carried forward additively, not an old-source reset. The real app22/Sites89 phone overflow was repaired only with scoped native-select/container shrinking; original failure/rollback history remains in docs/T08-release-record.md.
- Production phone selector/editor fit, save/reopen, original PDF/photo, v1/v2 immutable evidence links and retained-route/all66 Logbook checks PASS.
- T09 and later tasks remain unstarted. Actual account/project usage NOT_EXPOSED; do not invent it. No Astra without explicit owner approval.

## Candidate workflow

Read the persisted source/progress map, current authorised task and directly relevant current files only. Integrate older pre-code additively; an anchor mismatch requires a narrow current-source merge, not overwriting the release. First run targeted tests, then the required test/typecheck/build and responsive/offline/accessibility publish gate. Keep known-good production until a complete candidate passes. Publish only to the same canonical Sites project and smoke actual user navigation, current hydrated PWA version, changed route plus existing routes/Logbook. Genuine smoke failure requires immediate recorded rollback and STOP.
