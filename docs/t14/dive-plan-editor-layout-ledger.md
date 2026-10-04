# Dive Plan editor layout — authorised bounded follow-up

4 October2026. Branch `fix/dive-plan-editor-layout`, preserved accepted application source58edbe3/app1.0.75/Sites147 and documentation74cb375. PR91/main9d4ceb0 match the accepted full tree. This follows publication of the sync/large-Plan fixes; no restart or rollback to older source.

| Requirement | Implementation and acceptance |
|---|---|
| P01 Full-width cards | All ten editor sections use one column at every supported width; short fields may share an inner row. |
| P02 Minimise/expand each card | Native keyboard-accessible disclosure, initially open; content remains mounted when closed. Collapse does not navigate, save, discard or alter records. |
| P03 Larger long-text boxes | Every multiline field spans its section; at least224px editing height, readable line spacing, padding and vertical resizing. Includes Safety, Emergency, objectives and Notes. |
| P04 Draft/data safety | Collapse/reopen after edits retains text, selections and canonical references; normal Save/Cancel/unsaved guard remain. Local dummy persistence only; production smoke is read-only. |
| P05 Accessibility/responsiveness | Descriptive section names, visible expanded state/focus,44px disclosure target,320/390/430/820/1024/1440; no clipping/page overflow/application errors. |
| P06 Release protection | Focused then full regression, typecheck/build/PWA/lint/privacy,9unchanged protected hashes, fresh owner baseline, actual147 rollback artifact, clean exact source, one release and subsequent GitHub tree match. |

Source audit: `components/dive-planning-centre.tsx` owns the Plan editor and unchanged save/draft handlers. Its CSS uses two card columns and two inner field columns. Long Safety fields such as Task loading and Communication are half width. Textarea minimums vary44/112/128px. The shared CollapsibleWorkCard invokes navigation/discard and unmounts its body; it is inappropriate for collapsing a dirty editor. A scoped native disclosure keeps controls mounted and avoids that guard.

Only presentation components/styles and release identifiers change. No store/schema/calculation/dependency/Gmail/provider/API/public-profile change. Current owner data and imported conditions stay unchanged. Document RED reproduction, focused GREEN and final candidate evidence before publication. Current147 recovery and a fresh owner baseline must be reverified at freeze; older counts are not targets.

## Final local gate

P01–P05 PASS: ten full-width native cards,23full-width224px/vertical-resize textareas; actual six widths verified. Dirty collapse/rerender/reopen, local-only save-while-collapsed/reload and next-visible-header keyboard focus pass. All existing input/select/textarea bindings match accepted147 byte-for-byte. The generic brand44px !important target and inline-summary style required scoped editor overrides; shared/global styles are unchanged.

P06 local PASS:1421tests/213files, focused12/3, typecheck/build/PWA422entries/42680.76KiB, targetedlint6files/0diagnostics, compiled privacy1355files/0credentials, nine matching protected hashes. All31local routes ×six actual widths pass186observations without errors/overflow/clipping/broken visible images. Earlier ineffective IAB viewport measurements are retained as rejected; Brave extension widths were directly checked. Fresh private baseline/encrypted recovery and actual147rollback artifact verified. Native publication/live acceptance/GitHub remain pending for this exact checkpoint.

## Final local gate

P01–P05 PASS: ten full-width native cards,23full-width224px/vertical-resize textareas; actual six widths verified. Dirty collapse/rerender/reopen, local-only save-while-collapsed/reload and next-visible-header keyboard focus pass. All existing input/select/textarea bindings match accepted147 byte-for-byte. The generic brand44px !important target and inline-summary style required scoped editor overrides; shared/global styles are unchanged.

P06 local PASS:1421tests/213files, focused12/3, typecheck/build/PWA422entries/42680.76KiB, targetedlint6files/0diagnostics, compiled privacy1355files/0credentials, nine matching protected hashes. All31local routes ×six actual widths pass186observations without errors/overflow/clipping/broken visible images. Earlier ineffective IAB viewport measurements are retained as rejected; Brave extension widths were directly checked. Fresh private baseline/encrypted recovery and actual147rollback artifact verified. Native publication/live acceptance/GitHub remain pending for this exact checkpoint.
