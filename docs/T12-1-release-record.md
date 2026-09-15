# T12.1 release record — Dive Computer Import Workflow Correction

## Complete release — 2026-09-15

- Starting authority: app 1.0.31 / Sites99 / deployment `appgdep_6aa9702cf4888191b782b29722302941` / source `f4299807fbd12f17570d1a464fdd12f9d41f4b49`.
- Candidate app: 1.0.32.
- Scope: import-all-before-linking, searchable post-import profile review, late link/change/unlink, explicit field decisions, repeat-import/version preservation, and dependency-aware removal.
- Record kinds remain `computer-import`, `computer-profile` and `import-resolution`; no database migration, second Dive store, raw UDDF-in-Dive data or destructive canonical rewrite.
- Focused T12.1 checks: 5 files / 26 tests PASS.
- Full regression: 72 files / 378 tests PASS.
- TypeScript: PASS.
- Production build: PASS; final PWA precache 70 entries.
- PWA/version gate: 2 files / 4 tests PASS.
- Strict targeted lint: PASS for all changed T12.1 TypeScript/React/test files.
- Local browser: import-all completed with two unlinked profiles; identical reimport retained two profiles; link-only preserved Dive values; linked/unlinked filters, candidate reasons, Escape/focus restoration and linked-import dependency blocking PASS.
- Responsive widths: 390, 820, 1024 and 1440px PASS with no horizontal overflow.
- Browser console errors: none.
- Rollback if production fails: app 1.0.31 / Sites99 / saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_6d599c30a2f081919eb08b56d042c3ed` / deployment `appgdep_6aa9702cf4888191b782b29722302941`.
- Same-project publication: app 1.0.32 / Sites100 / saved version `appgprj_6a91926878b48191a80d70f1681ef135~appgver_82721151d8a48191b6af846195e0cfc5` / deployment `appgdep_6aa987d09c888191920f07575f0f483a` / published source `f25a804afffeeb58d3b07a245eee9c7d2c0c0bdb` / archive `sha256:dfb753be9e353b9b68a46f813ac0822b0857cf00099963928fae4916d61d47cc` (22,210,560 bytes / 183 files). No rollback required.
- Production smoke PASS: import-all with zero assignments, exact reimport dedupe, all-profile review and filters, explained date/time-first linking, link-only no Dive overwrite, Unlink retention, and dependency-aware removal all passed. After explicit owner confirmation, only the synthetic import and its two unlinked profiles were removed; the owner's full-history import remains and the profile count returned from 34 to 32.
- Regression smoke PASS: T09 Insights, T10 Dive Planning Centre, T11 Dive Knowledge and Site Configuration load; production phone/tablet/1024/desktop layouts have no horizontal overflow; exactly 66 Dive logs remain.
- Runtime evidence: Sites worker logs contain no failed requests/exceptions. The pre-existing route-independent shared-shell React hydration warning is still emitted on fresh production loads; no T12.1 feature failure accompanies it.
- GitHub exact production-source sync PASS through PR27: release commit `d95a21cc270d6d51fe73ff00be8e55e875ef4d87` merged to main as `07763f9baec8011b088e944fad3dbae996b1eed8`. Fourteen product/test blobs matched the published Sites100 source exactly; no private import, local artifact, credential or deployment archive was included. Final documentation-only evidence sync follows.
- Actual usage: NOT_EXPOSED. Max/Astra not invoked or recommended.
