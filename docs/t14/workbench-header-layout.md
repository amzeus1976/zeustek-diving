# Plan workbench header layout

Owner screenshot, 6 October 2026: PLAN WORKBENCH wraps over SITE & CONDITIONS, TEAM & ROLES and LINKED GAS PLANS. Baseline is live app1.0.105 / cache52 / Sites178, source a6df51213290ca1bfcf4b9787725b76518ee9590; this release retains its static weather fix.

The desktop label was absolutely positioned over a title button with only 16px of reserved space. A short title restricted the heading column, forcing the longer label onto two lines. The shared header now gives its text column the available width, keeps the label in normal document flow and permits both labels and titles to wrap. Header height follows its contents. Detail buttons and minimise controls retain their 44px minimum targets. The three top cards and four individually full-width lower cards are unchanged.

Candidate app1.0.106 / cache53. All 1725 regressions across 250 files, typecheck and production/PWA build pass. Changed release-source lint has no diagnostics; all nine protected calculation files retain their exact approved hashes. The 1346-file artifact scan has zero credential matches; 31 navigation icons match their unchanged masters.

Browser acceptance uses the real compiled Plan page at effective 3440x1440, 1080x1920, 1440x900, 1024x768, 820x1180, 430x932, 390x844 and 320x740 with scale1. All seven headers have disjoint label/title areas, contained titles and no card/body horizontal overflow. Target measurements permit 0.02px fractional browser rounding around the 44px minimum. Screenshots and detailed measurements are private local work files. Fresh live owner fingerprints and encrypted recovery precede release; rollback Sites178 is archive-backed and its deployment succeeded at unchanged environment revision6. No owner-data or calculation writes are part of this change.

Publication requires complete-head review, exact native source/archive publication, fresh read-only live header verification and owner comparison, then exact GitHub tree reconciliation. Release evidence is recorded after those actions; this source note does not itself claim deployment success.
