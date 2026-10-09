# Cylinders & Gas sorting — 1.0.114

The owner requested ordering by clicking table headings, including ID, gas and Fill bar. Every selectable cylinder column now has a keyboard-operable heading button. The first activation orders ascending and a second activation reverses it, with an arrow and `aria-sort` on the active heading. Initial ordering is ID ascending; hiding the ordered column selects the first visible column.

Ordering uses a copied presentation array. IDs and serials use natural number ordering, quantities use numeric ordering, dates use chronological ordering and missing values remain last in both directions. Equal values retain their previous relative order. The table uses the same derived current fill/remaining-pressure event, current-or-historical analysis and next-test display as before. Cylinder identities, saved history, protected calculations and public API fields are unchanged.

Validation on 9 October 2026:

- Initial regression: 255 files / 1,791 tests passed. The reviewed column-visibility follow-up passed 7 files / 61 tests, including the added hide/show regression. A previously date-dependent weather forecast test now freezes its fixture date; production weather logic is unchanged.
- Typecheck, changed-file lint and native build/PWA passed. All nine protected calculation hashes matched.
- Packaged-output privacy scan: 1,381 files, zero credential matches, 31 navigation icon hashes preserved; 439 precache entries.
- Compiled isolated-browser test ordered pressure as 50, 120, 200; keyboard Enter reversed it without opening a row. Sort direction was announced on the corresponding column header.
- Checks at 320, 390, 430, 820, 1080 and 3440 pixels showed no document-level horizontal overflow. Header buttons retained 44 px targets; the table retains its own contained scrolling at narrow widths.
- Fresh owner baseline: 6,544 cloud records read without writes. Rollback is the saved archive-backed 1.0.112 Site version 194, source `846851306504da9c8abe5ab966cd0a9287ea6a5f`.

The release review found that a hidden sort column could resume its old order when made visible again. Column selection now updates the stored presentation sort alongside the visible columns, retaining the replacement order after hide/show. Persisted column preferences also initialize sorting from their first visible heading.

Exact publication identifiers, post-release owner fingerprint comparison and GitHub reconciliation are recorded in ignored `work/cylinder-sort/release-evidence.json` after publication. The PWA static and anonymous shell caches advance together to v61; automatic phone selection remains disabled.
