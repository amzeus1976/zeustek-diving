# T14A implementation plan

1. Record the accepted Git/source baseline and protected calculation-file hashes.
2. Add failing focused tests for award selection/empty state, discard/Escape state, icon registry/fallback/assets, cyan focus, hidden Wishlist price search, Equipment media containment, and cylinder column preferences/stable ID display.
3. Implement shared award projection, dialog state/focus restoration, icon registry/component/assets, focus tokens, and cylinder presentation preferences.
4. Apply bounded route presentation changes to Insights settings, Overview, Equipment media, Gear Wishlist, and Cylinders & Gas.
5. Re-run focused T14A, T13, Insights, and Gear/Cylinders tests; fix only T14A regressions.
6. Run full regression, typecheck, build/PWA, targeted lint, and confirm protected calculation hashes/diff are unchanged.
7. Verify 390, 820, 1024, and desktop layouts locally, including dialog scrolling/Escape and no horizontal overflow.
8. Bump release metadata only after the gate passes, publish to the canonical Sites project, production-smoke read-only, and confirm 66 Dive logs plus zero Gas Plans.
9. Synchronise the exact verified production source through a normal GitHub PR, verify main HEAD, and produce the final T14A evidence report.
