# T01 Dive multi-view release record

T01 is now COMPLETE: production app1.0.2 / Sites67 passed the full gate and live smoke. See T01-release-record.md and the progress tracker for authoritative current evidence. Pending/unpublished statements below describe earlier checkpoints only.

## Current release-candidate gate — 2026-09-12
## Production completion — 2026-09-12

- T01 is complete and published as app version 1.0.2 / Sites67 at `https://zeustek-dashboard.amzeus.chatgpt.site`.
- Production deployment `appgdep_6aa5a4e3e4cc81919753b7f3efd29a95` succeeded with source `46c84930ba676f1778ef93770b3b98e4604f2835`; the public audience and canonical address are unchanged.
- Fresh release verification passed: 24 test files / 108 tests, TypeScript validation and the full Vinext production build. The final PWA precache contains 69 entries.
- The existing Sites66 / app version 1.0.1 remains the rollback reference. No production records were created, edited, deleted or migrated during this release run.
- Native installed-iPhone behaviour was not re-claimed in the managed release environment; the completed local responsive, accessibility, offline-origin, IndexedDB reopen and backup/restore evidence below remains the applicable acceptance record.
- T02 was not started. Actual usage remains `NOT_EXPOSED`; owner budget check is required before the next task.

## Historical working-copy checkpoint

## Release-candidate gate — 2026-09-12

The earlier checkpoint below is historical. Remaining T01 implementation is now complete in the working copy; production publication/smoke remains pending.

- Shared skill_evidence adapter, reference selection and inline saved-evidence presentation implemented. This is the one shared canonical evidence kind for T06 to reuse, not a second skill/session system. No legacy skill-session repository exists in this checkout; no fake evidence or training-progress conversion was introduced.
- Plan-to-Dive conversion reads the current canonical Plan and retains its immutable event/hash reference. For legacy cloud-only projections, the existing same-ID Plan mutation API retains a revision before conversion. The Dive holds only the reference; comparison resolves that immutable event, not later Plan edits. Missing historical references render unavailable rather than fabricated values.
- Optional account-scoped media metadata UI cache retains original IDs/captions, never original binaries. Offline/unavailable originals show a clear message; Story selections remain editable and persistent.
- Save boundary now uses tested DiveEditorWrites: pending/failed writes block view switch/close/navigation; a full-draft retry is explicit, and edits queued while awaiting navigation are also awaited.
- Local browser verification: Plan creation/conversion/save, original-revision comparison, Plan detail link, immediate Story edit then Plan navigation, and contextual Story reopen all PASS. No production test records were created.
- With the local server stopped, Debrief and Story text saved, editor closed/reopened, featured attachment reference survived, and cached metadata/connection-required state displayed. Browser internet status remained online; this is an origin-network-loss test, not a claim of physical iPhone force-close. IndexedDB close/reopen plus backup/restore and no-network cases pass in focused tests.
- Narrow reflow equivalent verified: 240 CSS-pixel effective minimum browser viewport after requesting 195; clipped row labels were corrected with stacked, fully labelled tabs below 340px. Each label now has scrollWidth <= clientWidth; targets ~44px. Earlier 390/820/1280 checks remain valid. Physical VoiceOver/Dynamic Type hardware testing is not claimed; AX selected/tablist/labels and keyboard operation verified.
- Required regression:24 files/108 tests PASS at18:57:59 local. Final typecheck PASS. Full Vinext production build PASS with69 PWA precache entries. pnpm runner tried automatic reinstall and failed before building; direct existing generator + Vinext CLI completed the SAME scripts without dependency/lockfile changes. Existing build warnings: deprecations/chunk size/intermediate pre-cache pattern; final pre-cache populated. Prior development multiple-renderer warning was not observed in this build; production smoke still required.
- Candidate1.0.2; known-good rollback1.0.1/Sites66/source2f0e58a3c0f28cfb6d36e1368d8593dc07b8a3cc. Actual usage:NOT_EXPOSED. Do not begin T02 in this immediate run.

Production remains app 1.0.1 / Sites66 / source 2f0e58a3c0f28cfb6d36e1368d8593dc07b8a3cc.
Nothing in this T01 working copy is approved for publication yet.

## Implemented

- Existing Logbook Dive popup uses the same canonical ID, factual row source and attachment gallery.
- One shared header, date/time, summary strip and global actions above the labelled Overview / Debrief / Story tabs.
- Existing factual content retained in Overview, with advanced rows under progressive disclosure.
- Optional structured Debrief / human factors / confidence rubric and Story / timeline editors on the Dive.
- Immediate local writes through the existing core mutation/history/pending-sync API; switch/close/edit/delete waits for writes. Failed saves keep the editor mounted with retry.
- New perspective patch service serializes rapid writes, merges latest section/HF siblings, preserves unknown fields, rejects absent/deleted/account-mismatched records.
- Generic cards default to Overview. Existing query convention: `/?section=Logbook&diveId=<existing-id>&view=debrief` (or story); invalid view falls back to Overview. No new route/entity.
- Story features existing attachment IDs through an opt-in checkbox in the shared gallery, with local save and selected border; unfeaturing does not call attachment deletion. Metadata failures retain selections and show unavailable/retry rather than a false empty state. Gallery stays mounted across view switches, so switching does not refetch its metadata.
- New trip-to-Dive drafts preserve originatingPlanId and the existing siteId; the factual editor retains that reference. Shared header links to the existing Dive Plans popup using `?section=Dive%20Plans&planId=...`, and waits for local edits before navigation. Full provenance/comparison verification remains pending.
- Skill reference fields are additive; skill-selection/link integration remains pending. Targeted exact-string search found no existing skill-session/skill-evidence repository/entity implementation in lib/app/components/db; course training-progress is not equivalent evidence.

## Verified so far

- tests/dive-perspectives.test.ts: seven focused tests passed, covering historical empty sections, IDs/facts/unknown-field retention, no view-selection events, offline save/no network, local DB close/reopen, rapid edits/nested HF, factual-edit compatibility, backup/history round-trip and existing conflict retention.
- Final typecheck passed after query-link, Plan-reference, media integration and the narrow Plan-link save guard. Final shell2/2 rerun PASS after the guard.
- Local UI at localhost:5179 (preview account seedy@sites.test, NOT production): existing Add Dive created one local test Dive through its normal flow. Popup showed Overview selected, same header/stats, three labelled semantic tabs.
- Debrief edit then immediate Story switch showed local-save confirmation; switching back retained the text.
- Story edit, keyboard Arrow navigation + Enter activation worked. Tabs exposed selected state; observed target height ~44 CSS pixels; dialog had no horizontal overflow at current viewport.
- Three focused files passed17/17 tests (Dive perspective7, shell2, existing local store8). Shell verifies one shared header, semantic labelled pills/default/explicit Story, factual content and optional historical fields.
- Phone390, tablet820 and desktop1280 widths: no horizontal page/dialog overflow observed; labelled44px tabs retained. Keyboard Arrow changes focus; Enter activates the chosen perspective. Attempted browser zoom shortcut did not alter measured CSS viewport; 200% text QA is NOT claimed verified.
- Disposable SVG fixture uploaded via the unchanged local media API/gallery. Checkbox selected existing image and showed1 featured + local-save confirmation. Unticking and switching Overview/Story left original image present and showed0 featured. No production upload or deletion performed. Local browser console errors observed: NONE.
- No physical iPhone/PWA force-close, offline browser switch, skill references, plan/profile regressions or release-candidate gate are claimed complete.

## Remaining, in order

1. Targeted verification of contextual query links and save-failure/retry/switch guarding (including navigation away from Logbook).
2. Integrate references to existing shared skill/evidence records without introducing T06's full workspace or duplicate skill entities. Training-progress alone is NOT skill evidence; inspect minimum current evidence source before choosing adapter.
3. Finish offline media availability and reopen/restore selection verification. Feature-selection UI is implemented/locally verified; existing gallery still uses online /api/media. Preserve common IDs/originals; do not create duplicate binaries.
4. Verify new canonical Plan-ID conversion/link and complete original Plan provenance/factual comparison. Do not invent planned depth/runtime or reconstruct absent historical provenance; current trip schema has no planned maximum-depth/runtime fields.
5. Confirm computer profile/source content already present and keep it. Complete phone/tablet/desktop + large-text/keyboard QA and actual local editor reopen/offline workflow.
6. Targeted tests for corrections, then full T01 release-candidate regression/typecheck/build once. Only after complete local gate prepare version1.0.2/changelog, push/package/publish same canonical project, production smoke affected + unrelated route, rollback immediately to saved Sites66 if smoke fails.
7. Update tracker + Desktop, mark COMPLETE only after successful publish/smoke. STOP owner budget check; no T02.

## Compatibility / migration

Optional Dive JSON sections require no SQL/IndexedDB table delta or fabricated backfill. Existing core local writer merges prior unknown top-level fields. Old factual edit flow therefore retains new sections, tested. Server stale-revision conflict handling is reused unchanged; same-field branches are retained (no new automatic merge claim). Existing backups export full canonical record/history and restore optional sections, tested. Current code is not a destructive normalization or a replacement store.

Actual usage: NOT_EXPOSED. Planning envelope30 is complexity only. No Astra or external-review blocker has been reached.

Local preview server stopped at checkpoint. Teardown output included development/HMR warning: “Detected multiple renderers concurrently rendering the same context provider. This is currently unsupported.” Record for targeted release-gate verification; not classified as resolved or as a production failure. Browser console error check was empty. No full production build was run this checkpoint.
