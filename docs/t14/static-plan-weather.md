# Static saved Dive Plan weather — issue 99

Owner request, 6 October 2026: the Dive Planning log still delays text input; gathered weather should remain static until Refresh, without rendering the complete saved provider response.

Baseline: Sites177 / app1.0.104, native source d83544db69a9abd261e7c3c8ef7618105ef05996. Candidate: app1.0.105 / static cache52.

## Changes

- Initialize each Plan editor's source once. A copied Plan previously cloned the original large forecast on every render before resetting its conditions.
- Remove full provider-reading panels from the Plan editor and workbench. Saved measurements and provenance stay visible; their payload remains saved but no renderer, comparison-evidence read or freshness timer runs in Plans.
- Exclude the immutable conditionsV1 response from the compact form comparison, and explicitly mark replacement of its object as dirty. Normal Save still receives the complete draft and all saved weather evidence.
- Label retrieval as Refresh Weather once a snapshot is available. Retrieval remains an explicit button action. Only tagged provider-origin values may be replaced; manual observations, unlabelled legacy values, notes and planning limits are preserved. Retain earlier measurements when new marine coverage is missing. Manual seasonal sky edits are marked owner-origin.

## Validation

Nine focused behavioral regressions cover static opening, bounded form comparison, one-time copy initialization, explicit refresh, manual preservation, failed refresh retention, complete weather evidence on Save, provider-origin replacement and missing marine coverage.

Final complete regression: 1725/1725 tests pass; typecheck and production/PWA build pass; 422 precache entries. Changed-source lint has zero diagnostics. All nine protected calculation hashes are exact. The fresh Windows checkout initially converted line endings in unedited frozen files; their original bytes were restored, without changing their Git content. One unrelated calendar fixture timed out during concurrent full testing/building; the final complete suite ran independently with two workers and passed.

Independent final code review found no blocking issues. No production owner records were written. Interactive production typing timing has not been measured in this run; behavior is verified by regressions, not a claimed latency measurement.

Build and test logs are local task work files and are excluded from the publication artifact. Production publication status is recorded separately after the native deployment completes.
