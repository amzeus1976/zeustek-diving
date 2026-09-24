# People / Dive Entity separation — approved implementation plan

Owner approval: 2026-09-24. This corrects the product model after the scoped Stage 8 release. Keep Person records human-only and the existing `operator` kind canonical for non-human dive operations, organisations and vessels. No parallel store and no automatic owner-record rewrite.

## Audit baseline

Branch `t14/master-forward-build`, starting commit `14a5fe8540bf6e6acc664a3ccf71df4982ae2b04`, clean before implementation. Existing focused tests: 4 files, 30 pass. Read-only live backup: 11 People, 4 operators, 8 distinct legacy pairs across 8 People and all 4 operators; no missing targets. One operator has `dive-centre` type and three are untyped. No live Person has populated organisation-profile fields or enabled organisation flags. Counts are evidence, never migration targets.

The `person` and `operator` kinds share account-scoped offline persistence and owner-scoped D1 `dive_records`. Person has single `operatorId` and `currentDiveOperatorId`, embedded organisation fields, `profileImage` and legacy `profileImageId`. Operator deletion currently guards only those two fields. The People route is canonical but labelled “People & Operators”; Dive Centres has canonical Operator CRUD and only legacy-linked People. Weather conditions' `operatorId` selects a provider and is unrelated.

## Decision and interfaces

1. Extend `OperatorType` with separate Dive Boat, Charter Operator, Dive School, Dive Operator and diving accommodation values while keeping old enum values readable. Show absent type as Unclassified. Do not infer the three untyped live records. Independent instructors are People; an independent-instructor *business* may remain a legacy Operator pending explicit owner classification. Dive Sites remain Sites.
2. Add owner-scoped `person-operator-link` and `operator-operator-link` record kinds to the existing generic store. Person links contain `personId`, `operatorId`, role key/label, active, optional primary, start/end dates and notes. Entity links contain two Operator IDs, directed relation type, active and optional dates/notes. No endpoint ownership by links; no cross-owner/self/deleted endpoint links. One active primary Person link at most; current derives from status/dates.
3. Canonicalise inverse entity relationships to one record, with reciprocal display. Support operates/operated by, owns/owned by, based at, part of, associated with, affiliated with, uses, provides boat for, resort dive centre, training partner, chartered by and Other with explicit reverse wording. Symmetric pairs sort endpoints.
4. Build one relationship projection for both workspaces. Read explicit records plus virtual legacy pairs from Person fields, dedupe by pair. Reads never write. New links stay in relationship records and do not overwrite legacy single fields. An explicit unlink of a legacy pair clears only its corresponding old fields and removes any explicit link; keep local conflicts for review. A failed or partial sync cannot make a parent deletable until cloud dependencies clear.
5. Use stable relation identity and server-side validation for duplicate and endpoint checks; sync unsaved parents before their links. Review similar People and Operators before create, never auto-merge. Shared business websites must not hard-block distinct boats/branches.
6. Add local and atomic cloud deletion guards for both endpoints of both link kinds, in addition to legacy references. Relationship deletion never cascades. Backup/restore includes ordinary links, validates owner/endpoints and restores parents first. Household copy/share never propagates cross-owner private links.
7. Rename normal UI text to People, retaining “People & Operators” as a route alias. People alone owns Person CRUD, qualifications, contact, notes, avatar and Person–Entity links. Dive Centres alone owns non-human CRUD and Entity–Entity links. Each displays links with exact-record navigation to the other's route. Remove dead legacy dashboard CRUD after verifying no callers.
8. Use a dedicated circular Person avatar renderer/editor. Preserve 1:1 object-fit cover and existing CardImage `x/y/zoom`; add drag/recentre, keyboard adjustment, zoom buttons/slider, Reset, Replace, Cancel and Save Crop. Draft changes persist only with Person Save. Legacy `profileImageId` renders centred and remains readable without byte migration.

## Tests and release safety

Write failing focused tests before each implementation slice: zero/one/many links, different roles, independent unlink, legacy projection, duplicate prevention, all types, reciprocal entity links, deep links, owner isolation, deletion guards, offline sync, backup/restore, household privacy and avatar interactions. Run retained People/operator and Dive Planning tests, full regression, typecheck, production build/PWA, targeted lint and 390/820/1024/1440 browser checks. Preserve all protected calculation hashes.

Before any deployment capture current owner IDs/content fingerprints and verify the *then-current* accepted Sites rollback artifact; do not assume the old Sites124 target. No automatic owner migration or synthetic production records. A failed candidate is retained with evidence; restore verified rollback and keep rejected source off accepted GitHub main.

## Implementation checkpoints

- [ ] Model, relation projection and local/server integrity, with focused tests.
- [ ] People and Dive Centres separation, navigation and duplicate review, with focused tests.
- [ ] Circular avatar editor and legacy compatibility, with focused tests.
- [ ] Backup/household boundaries and deletion protections, with focused tests.
- [ ] Full regression, security/data/protected-calculation and responsive gates.
- [ ] Release decision and, if authorised and safe, accepted source reconciliation.

Ruling: This plan uses the existing T14 planning/evidence ledger instead of creating a separate execution workspace, preserving the project's established handover convention.
