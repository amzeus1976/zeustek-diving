# ZeusTek pre-coding baseline — app1.0.23 / Sites90

Start each candidate from the current GitHub main commit and record that SHA. This document is a source/deployment contract, not authorisation to implement a roadmap task, publish a candidate or accept owner snags.

## Verified source and release

- GitHub healthy-baseline sync: PR9 merged, main72d4b71f96bfd2a53aed9899f11f27a32c1f1c12; exact snapshot tree f465db9359077a750484e1fbd0aaeb50a74030b6 verified. Older candidate PR5/PR8 closed as superseded, not blindly merged. Owner subsequently authorised the preserved T08 narrow repair; this baseline is the preceding healthy release, not that candidate.

- Repository: amzeus1976/zeustek-diving.
- Published application source: 487ab0bfd36dd04323ad96b7ac674a59f842a04d.
- Source with production acceptance documentation: 8b643250a2e0baab800f5af7076a3eb3fcd40e41.
- App/package version: 1.0.23; saved Sites version: 90.
- Saved version: appgprj_6a91926878b48191a80d70f1681ef135~appgver_c323cf4d7adc8191a6b55c832e9f29b5.
- Deployment: appgdep_6aa874f286888191b17686ee44eb2144, SUCCEEDED 2026-09-14T22:28:19.488741+00:00, env revision3.
- Canonical project: appgprj_6a91926878b48191a80d70f1681ef135; production https://zeustek-dashboard.amzeus.chatgpt.site/; same-origin PWA /?source=pwa.
- Gate: focused36, full255/50 files, typecheck/build PASS; final release metadata4 and PWA70 precache PASS; production smoke PASS; 66 Logbook entries retained.
- Retained rollback: app1.0.21/Sites88, saved appgprj_6a91926878b48191a80d70f1681ef135~appgver_b55f093aaab881919f69a5e731fff72e; healthy rollback deployment appgdep_6aa86d96ec6081918f2ee780cff8b6a7.

The GitHub synchronization commit has only GitHub's existing main as its parent; it imports the verified source tree, not the entire separate Sites history. Repository issue templates, contribution guidance and licenses are retained. Product source is byte-identical to the published source; README/progress/release documentation may contain later verification evidence. No deployment is performed by this sync.

## Architectural invariants

- One existing responsive app/PWA, backend, canonical Site catalogue, Dive log and Skill/knowledge systems.
- Runtime `trip` remains Dive Plans; logistics Trips use `dive-trip`. Keep their IDs and immutable Plan→Dive provenance.
- `equipment-set` remains canonical reusable loadouts; physical cylinder identity remains Equipment. `cylinder-fill` and `gas-analysis` are time-dependent evidence, not replacement inventory.
- `site-overhead-profile` remains an optional child of the canonical Site; historical dated observations do not overwrite ordinary Site identity.
- `equipment-event` is additive generic record history, shared under existing shared-gear permissions with canonical Equipment-parent validation. Monitoring/resolution retain the same record; service baselines change only through an explicit saved Service event and retain an applied marker.
- Use domain helpers → saveRecord/saveLocalRecord → mutateEntity → existing event/outbox → /api/dive-data. Preserve IDs, immutable event history, conflicts, encryption, sync, backups, attachments and deep links.
- Do not directly mutate Dexie event/outbox from UI or add duplicate stores, backend tables or inventories. Existing generic JSON dive_records projection remains authoritative.
- Use current DIVE_RECORD_KINDS additively; never replace the list with a pre-coded snapshot's older list.

## Current status / unresolved work

- T00–T07 complete, including the Trip resources/media/compact sections and Technical Workspace release.
- Equipment SNAG-EQUIP-001/002/003 implemented, tested and production-smoked; owner acceptance and Gemma's signed-in shared-history UI check remain pending.
- T08 BLOCKED_DEPLOYMENT. Separate app1.0.22/Sites89 candidate passed its automated gate but failed actual phone smoke: viewport390, selector width532.4503173828125/right545.4470062255859, document scrollWidth546. It was immediately rolled back. This is a real responsive defect, not a closed menu or stale shell.
- Preserved blocked T08 source checkpoint: e4ca3e531acf6d353853a880ea6d89d1c92b88dd on the existing local zeustek-t03-v17 branch. It is not published in this baseline. Any narrow T08 recovery needs owner authorisation; do not reconstruct it or skip the blocked task as part of an unrelated candidate.
- Later tasks remain unstarted. Actual account/project usage NOT_EXPOSED; do not invent it. No Astra without explicit owner approval.

## Candidate workflow

Read the persisted source/progress map, current authorised task and directly relevant current files only. Integrate older pre-code additively; an anchor mismatch requires a narrow current-source merge, not overwriting the release. First run targeted tests, then the required test/typecheck/build and responsive/offline/accessibility publish gate. Keep known-good production until a complete candidate passes. Publish only to the same canonical Sites project and smoke actual user navigation, current hydrated PWA version, changed route plus existing routes/Logbook. Genuine smoke failure requires immediate recorded rollback and STOP.
