# Issue54 Topic Explorer — proposed implementation plan

## Current source and requested slice

Current accepted app1.0.71/Sites143 has the existing nine-card Insights workbench, six defaults, flat+advanced scope/exclusions and exact Skills/evidence/Certification/Dive/Site navigation. It has Knowledge topics and Bibliography labels but no cross-domain Topic Explorer. Topic cards must reuse canonical stores and preserve current layout/settings. This plan is submitted for the issue’s required owner topic-model approval before coding.

## Information architecture

Add one opt-in registry metric `topic-explorer` with `topics` and accessible `table` visualisations. It occupies one existing slot; no new navigation route, default card or second knowledge store. Compact view has topic selection/search, source counts and Explore topic. Enlarged/Data views group canonical results into Knowledge, Bibliography, News, Skills, Training and Related Dives/Sites with25-row paging, exact source links and match explanations.

Discover labels from KNOWLEDGE_TOPICS, recorded question topic/exactTopic, Bibliography topics and Skill groups. Normalize Unicode NFKC/case/whitespace for deduplication while retaining a readable recorded label. Permit a bounded owner-entered phrase. Show three distinct match classes: Explicit topic, Recorded text match and Exact saved relationship. No semantic/fuzzy merging, invented relationships or proficiency claims.

## Canonical projection and provenance

- Knowledge: current reviewed/unsuppressed question-set material, preserving bank/version/question identity. Historical test-attempt snapshots remain separately labelled and never remapped to a newer bank.
- Bibliography: dive-media explicit topics/title/creator/format/status; no hidden indexing of private notes or arbitrary recommendation prose.
- News: saved canonical news-article title/summary/publisher/date/link; no Gmail/RSS retrieval, News seeding or raw mailbox cache exposure.
- Skills: canonical skill title/group/description and supported canonical aliases for exact skill_evidence references; distinguish recorded practice from qualification.
- Training: exact training-progress IDs, recorded agency/course/status and exact catalog context. Preserve duplicate progress history; never replace it with Course Map’s aggregated display identity. Owner Certifications can be additional exact recorded references.
- Dives/Sites: only recorded Dive type matches or exact evidence-to-Dive-to-Site links. Missing/deleted endpoints are unavailable; names never establish a relationship.

Use a strict in-memory DTO of kind/canonical record ID/title/status/date/match class/field/reason/safe recorded URL/related IDs/unavailable-reference count. No complete canonical spreading, credential/attachment enumeration or private-note index.

## Analysis Scope semantics

Reuse projection.includedDiveIds after flat filters, advanced AND/OR/NOT, environment focus and explicit exclusions. It constrains related Dive/Site evidence and Dive-linked Skill Evidence. Independent library records have no general Dive date/site relationship; label them separately: “Library material uses recorded topics and text; related Dives and Sites follow the current Analysis Scope.” Excluding a Dive removes its relationship contribution immediately, not independent library content.

## Configuration, reads and exact navigation

Optional versioned per-card settings contain bounded query, explicit-and-text or explicit-only mode and supported source kinds. Validate them while preserving unrelated settings through mergeWorkbenchSettings. Empty layout, six defaults and max9 remain unchanged.

Use direct account-scoped read-only Dexie transactions with bounded batches, deleted/suppressed filtering, ownership/module/kind/ID validation and account-switch cancellation. Do not call the side-effecting ordinary list helper, fetch upstream, seed records or persist an inferred index. Explain malformed/partial/unavailable sources.

Existing media, News, Knowledge and Course Map lack exact record receivers. Add safe read-only receivers or a canonical source-detail panel preserving exact bank/version/attempt/progress identity. Unknown IDs show unavailable, never an arbitrary first record.

## Focused tests and gate

Test all five required source families, Unicode normalization, explicit/text distinctions, duplicate URLs without record merging, reviewed/historical Knowledge, archived/malformed sources, aliases and missing endpoints, duplicate progress, full scope/exclusion equivalence, account isolation/races/no-write/no-network, configuration/defaults/max9, every exact source destination and six-width accessible/error/empty/partial UI.

Run all retained regression, typecheck/build/PWA/lint/security/privacy/owner-data/protected-hash gates against the new combined candidate. No real owner record changes or new calculation logic. Publication remains one combined accepted release, not a partial topic preview.

## Proposed decision

Approve this read-only canonical Topic Explorer slice. A graph that invents semantic relationships, autonomous factual content, new private-data indexing and new stores are outside the request. The card remains optional in the owner’s existing layout.

