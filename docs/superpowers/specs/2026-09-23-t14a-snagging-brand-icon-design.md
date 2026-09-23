# T14A snagging and brand-icon design

## Scope

T14A is a shared-system-first display correction. It changes presentation and UI configuration only. Canonical diving records, navigation identity, sync/history/outbox behaviour, and Gas Planner calculations remain untouched.

## Shared foundations

- Make the Insights award inclusion list authoritative and apply the display count only as a cap/layout choice.
- Centralise discard-confirmation and Escape transitions in the shared accessible dialog.
- Add a semantic ZeusTek PNG icon registry with accessible fallback rendering while retaining vector icons for controls.
- Use cyan for primary keyboard focus and orange only for active/selected emphasis.
- Add a reusable presentation-only cylinder column model.

## Targeted route fixes

- Compact Overview into a main status area plus a right-side weather stack on desktop, with weather later and compact on mobile.
- Centre Equipment media in viewport-safe overlays.
- Remove broken Wishlist price-search UI without deleting saved wishlist or price-store data.
- Reduce Cylinders & Gas table width and expose column visibility controls while retaining stable two-digit cylinder IDs.

## Safety boundaries

- Protected calculation files are guarded by pre/post hashes and Git diff checks.
- No owner records are created, edited, or deleted.
- Brand assets copied to production are limited to the 131 manifest-backed PNG icons and the public brand-kit tokens/styles.
- Production must retain 66 Dive logs and zero Gas Plans.

## Acceptance

Focused T14A tests, retained T13/Insights/Gear tests, full regression, typecheck, production build, PWA/version gate, targeted lint, four responsive widths, production smoke, then exact-source GitHub synchronisation.
