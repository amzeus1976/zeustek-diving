# Cylinder detail Save controls — app1.0.65 candidate

## Root cause and correction

The fill, gas-use and analysis forms saved through actions labelled “Add fill”, “Record gas remaining” and “Add analysis”. `AccessibleDialog` latched its unsaved warning on any input and did not clear it after those forms saved successfully. The footer had only Close, making the section-specific saves easy to miss and the warning misleading.

The controls now say “Save fill”, “Save gas remaining” and “Save analysis”, and the detail header explains that sections save independently. The discard guard compares each section with its last successful save. Saving a fill clears only the fill draft; a separate unsaved profile, gas-use or analysis draft still requires confirmation. A newly selected fill is an untouched analysis default, not an unsaved edit. Edit cylinder also passes through the guard. No owner records, calculations or persistence schemas are changed by this hotfix.

## Local release gate

- Focused draft/dialog/cylinder shell tests: 9 PASS. Full regression: 133 files, 768 tests PASS. One initial full run hit the 5-second timeout in the icon-library test under parallel load; the complete suite passed with a 15-second test timeout and unchanged assertions.
- Typecheck PASS; production build/PWA PASS (429 precache entries; complete icon library not eagerly precached); targeted lint PASS; client bundle privacy scan across 78 files and six private reference values: zero matches.
- All nine protected calculation hashes match the accepted app1.0.63 manifest. The previously approved ID-allocation-only `loadouts-gas.ts` touchpoint remains unchanged.
- Production-built local Worker returns HTTP 200 for the app, cylinder data route and service worker with isolated local D1 and fixture identity.
- Isolated browser: saved a test fill, then closed cylinder details without a false discard warning; an unsaved fill still warned; saving a fill did not hide an unsaved analysis. At 390, 820, 1024 and 1440 pixels, all three Save controls existed, no page-level overflow, broken images or application console errors. The fixture is local only.

## Release steps

Freeze and commit the clean candidate; take a fresh production owner-record ID/content snapshot and confirm live Sites135/app1.0.63 as rollback. Publish one saved Sites version from the exact candidate tree, verify its live app version, controls, warning behavior without saving test owner data, PWA and owner-record preservation. Only after acceptance reconcile the exact published source to GitHub main. Keep Stage 9 PR #65 separate and unpublished. Gmail sync remains deferred; do not invoke it.
