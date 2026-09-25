# Issue #63 — 24-skill circuit mapping and implementation plan (review gate)

Status: **implementation in local verification**, branch `t14/issue-63-circuit` from accepted GitHub main `14c89f221b3d5bbb66bf4d09175a92889ea7ebc6`. The owner selected the PADI-published sequence, pending instructor confirmation. No schema, migration or production owner records changed. Accepted production is app1.0.67 / Sites138, deployment `appgdep_6ab6aaf866bc8191864d3ab02ee53868`, source `3106744c407a7374291865eaa6fca9a4e90fde91`; both source and GitHub main have tree `69ac7e215882636c91676d26468c33ea61802927`. Verified rollback: accepted app1.0.66 / Sites137. Prior release comparison: 6,435 owner records (66 Dives, one Gas Plan), zero per-record changes. This is historical; refresh it before publication. Gmail remains disabled.

## Source conflict requiring owner review

The issue's first twelve skills and surface equipment rows 19–20 match the [2021 PADI Instructor Manual, Divemaster Course, Dive Skills Workshop pp. 120–122](https://pro-cms.padi.com/sites/default/files/documents/training-hub/79173_Instructor_Manual_2021_EN.pdf) in substance. Its rows **13–18 and 21–24 differ** from that manual and from [PADI's January 2026 course overview](https://blog.padi.com/divemaster-course-parts/). The manual calls for all skills, at least 3 per skill, 82 total, and an underwater 5; the issue's alternative content cannot automatically be labelled the PADI circuit. The published blog describes the same 24-item sequence as the manual, but its skin-dive item has different wording and does not expressly include the manual's blast-clear step. A current instructor may have newer binding materials; neither source is claimed to supersede those.

**Proposed decision:** use the 2026 PADI-published 24-skill list as the default *source-versioned progress rubric*, subject to owner/instructor confirmation. If the issue list is intentional, capture it as a separate **custom 24-skill practice circuit**, with no PADI standard-met claim. Never silently combine the two lists, count one list's attempts toward the other, or treat a blog as proof of course certification.

## Current canonical architecture

`skill` and `skill_evidence` are owner-scoped kinds in the existing generic offline/cloud record store (`lib/offline/dive-context.ts`, `lib/offline/dive-store.ts`, `app/api/dive-data/route.ts`). A canonical Skill has immutable `entityId`, optional `skillKey`/legacy `key`, name, group, descriptions and archive state. Skill Evidence links by `skillKey` with date, optional Dive, evaluator, competence level, attachments and notes; it has **no demonstration score**. Professional Development uses `professional-pathway`, immutable `reference-requirement-set` snapshots and `professional-evidence`. #59 adds exact version/key/source mapping and deletion guards; #58 uses a versioned rubric and append-only attempts. Current owner pathway is linked to a captured v2 requirement whose row 13 has an empty assessment rule and remains Unknown. Reading it causes no migration write.

Read-only production-backed inventory: 3,874 distinct canonical Skill names (50 archived), 11 Skill Evidence records and 10 Professional Evidence records. This is an audit snapshot, not a migration target. No catalogue record is created by this plan. Weather `operatorId` and Dive Entity links are unrelated.

## Provisional 24-row map against current saved Skills

The ordered rows below use the PADI-published list. **Exact** means the saved Skill name is a close direct match; **partial** means the saved evidence does not by itself prove the complete circuit action; **gap** means no safe canonical equivalent was found. The captured rubric will bind actual canonical IDs only after owner review. A gap may use Professional Evidence with a null Skill link; no duplicate Skill is auto-created.

| # | PADI-published circuit action (short label) | Current canonical Skill candidate | Match |
|---|---|---|---|
| 1 | Equipment assembly through disassembly | `Backplate-and-wing assembly` covers one configuration only | Gap |
| 2 | Predive safety check (BWRAF) | `Buddy check completion` | Partial; BWRAF sequence not explicit |
| 3 | Deep-water entry | No direct Skill | Gap |
| 4 | Surface buoyancy check | `Surface buoyancy control` | Partial; check procedure not explicit |
| 5 | Snorkel ↔ regulator exchange | `Snorkel-to-regulator transition` + `Regulator-to-snorkel transition` | Composite |
| 6 | Five-point descent | `Descent initiation` + `Controlled descent rate` | Partial; five points missing |
| 7 | Regulator recovery and clearing | `Regulator recovery while neutral`; `Receiver regulator clearing` is not the same self-clearing skill | Partial |
| 8 | Mask removal, replacement and clearing | `Mask removal while neutral` + `Mask-clear while neutral` | Partial; replacement must be observed |
| 9 | Air depletion + stationary alternate source | `Alternate air source receiving` | Partial; air depletion missing |
| 10 | Alternate-source assisted ascent | `Alternate-air-source ascent` | Exact |
| 11 | Free-flowing regulator breathing | `Free-flow breathing drill` | Exact |
| 12 | Neutral buoyancy by LP inflation/rise-fall | `Neutral buoyancy establishment` | Partial; method/rise-fall observation needed |
| 13 | Five-point ascent | `Controlled ascent` | Partial; five points missing |
| 14 | Controlled emergency swimming ascent | `Controlled emergency swimming ascent` | Exact |
| 15 | Oral BCD inflation and ≥60 s hover | `Oral inflation while neutral` | Partial; hover duration missing |
| 16 | Underwater swim without mask | No direct Skill; no-mask gas-sharing is different | Gap |
| 17 | Remove/replace weight system underwater | No direct Skill | Gap |
| 18 | Remove/replace scuba unit underwater | No direct Skill | Gap |
| 19 | Remove/replace scuba unit at surface | `Deep-water equipment removal` + `Deep-water equipment donning` | Partial; complete unit/surface context must be confirmed |
| 20 | Remove/replace weight system at surface | `Weight-belt removal at surface` + `Weight-belt replacement at surface` | Composite; integrated weights need explicit handling |
| 21 | Head-first surface dive, snorkel out of mouth (2026 article); 2021 manual instead specifies a surface dive plus blast clear | `Head-first descent`; no blast-clear Skill | Partial; edition-specific wording must remain separate |
| 22 | Disconnect low-pressure inflator | `BC inflator disconnect under pressure` | Partial; confirm same procedure/context |
| 23 | Re-secure loose cylinder band | No direct Skill | Gap |
| 24 | Emergency weight drop | No direct Skill; accessibility/placement are different | Gap |

The existing Skills are supporting links, not automatic numerical scores. Composite/partial links require an evaluator's single attempt record for the entire circuit item; never add component competence levels into a 1–5 score. If an instructor wants a new canonical Skill for a gap, show a duplicate review against saved names and create it only as a deliberate separate owner action. No historical Skill Evidence is rewritten.

## Proposed additive model and evaluator

Extend the existing `reference-requirement-set` assessment rule with a copied, versioned circuit rubric: source edition/citation, 24 ordered stable item keys/labels, optional canonical Skill IDs, explicit underwater flags, per-item 1–5 maximum, minimum 3, total target 82/120, an underwater-5 condition and item-specific observation requirements. Rows 7 and 8 require an explicit neutral-buoyancy observation for score 5 in the 2021 manual. Keep the list and flags in the captured snapshot, never in a mutable global PADI map. A later source/list change creates a new requirement version. The source conflict must be resolved before choosing the initial 24 labels and flags.

Record each practice or formal attempt as a new canonical `professional-evidence` item with pathway/version/requirement/item/rubric IDs, evaluator-entered integer score, date, site/pool, optional canonical Skill Evidence/Dive links, observations, notes and attachments. Reuse and generalise #58's append-only local/cloud guards and source-dependency checks; no new record kind or hidden parallel Skill store. A saved attempt is immutable except attachment references. Failed sync retains local evidence for review. The owner must explicitly capture a newer cited snapshot; historical v2 and evidence remain untouched.

The pure projection retains all attempts; shows latest, best and latest qualifying evaluator-backed formal score per item; counts every item exactly once in the **current formal total**. Practice cannot replace formal. Missing score/evaluator, broken links, contradictory required observations or wrong rubric version cannot contribute. Check all 24 attempted, every formal score ≥3, formal total ≥82 and at least one explicitly flagged underwater item scored 5. Display total/120 and progress above 82 without capping. A source-verified rubric may show *circuit minimum met*; it never awards Divemaster certification or permissions. A custom issue-list rubric is labelled practice and cannot make a PADI minimum claim.

## UI, compatibility and tests

Place a compact 24-row tracker beside the #58 Water Skills area in Professional Development. Each row exposes score, current formal/best/latest distinction, evaluator/date/location, below-3 and underwater-5 state, plus source-record navigation and expandable attempt history. Mobile uses single-column rows without page overflow. Existing professional evidence and the v2 empty row remain visible/Unknown; no automatic migration or deletion. Use the current in-route `RecordEditorWorkspace` for attempt capture and dirty-exit safety.

Likely modules: `lib/offline/professional-development.ts`, `lib/professional-development/*` (new pure circuit projector beside `water-skills.ts`), `lib/offline/dive-context.ts` only if a deliberate Skill link helper is needed, `lib/professional-development/evidence-dependencies.ts`, `app/api/dive-data/route.ts`, `components/professional-development.tsx`, its CSS and requirement builder, plus focused tests. No dive/gas calculation file should change.

Tests before code: exact 24 ordered keys/no duplicate; source-list decision and explicit underwater flags; 1–5/evaluator/neutral-buoyancy validation; 81/82/120 boundaries; 82 with one score 2 fails; 82 without underwater 5 fails; latest formal vs better practice; history and source links; version mismatch; missing/deleted Skill references; append-only cloud/local update/delete; owner isolation; old v2 Unknown; no auto-created Skill; mobile 390/820/1024/1440, keyboard/focus, console/broken images. Finish with full regression, typecheck, build/PWA, privacy, nine protected hashes and fresh owner-data/rollback checks. No Gmail sync.

## Owner decision and local implementation evidence (2026-09-25)

The owner chose **PADI-published sequence, pending instructor confirmation**. The 2026 public list is copied into a versioned progress rubric with 24 stable item keys and explicit underwater flags. It does not claim current instructor-manual authority, a PADI pass, certification or permission. An owner-captured new requirement snapshot is required; the existing v2 row 13 stays Unknown. No canonical Skill or historical evidence is auto-created or rewritten.

The local implementation adds a pure scorer/projection, an assessment-rule option, a 24-row tracker, and append-only professional-evidence attempts within the existing record store. Practice and formal attempts remain separate; only the latest valid evaluator-backed formal result per item contributes. Missing evaluator, broken links, wrong version and missing row-specific neutral-buoyancy observation prevent contribution. Supporting canonical Skill mapping stays null pending deliberate owner review. Source-record actions open the saved attempt. A local-only fixture exercised capture and editing through the browser; no production record was touched.

Before release-version changes, the full local regression passed **140 files / 869 tests**, typecheck, production build/PWA and focused lint passed. The Professional Development tracker rendered 24 rows at 390, 820, 1024 and 1440 pixels with no page-level overflow; an in-route attempt editor was inspected at 390 pixels. The browser reported no application errors. Twenty images in collapsed navigation were lazy/unloaded, not broken; their runtime files exist. Final exact-candidate checks, fresh production owner baseline, release version/cache, protected hashes and production acceptance remain pending.

## Accepted core release and full issue completion follow-up

The scoring core above was published and owner-data verified as app1.0.68 / Sites139, source `7d06414ba986fa86f1dabef242b1d71c0c3dd3e9`; GitHub main matches its tree. A full acceptance-list review found missing score-view toggles, attempt context and status detail, so issue #63 was reopened immediately and the issue comment corrected the earlier completion claim.

The follow-up on `t14/issue-63-completion` is a **new captured rubric v2**, not a rewrite of any saved v1 rubric or owner evidence. It versions the 1–5 scoring descriptions, five-point maximum, underwater-five rule and item-specific neutral-buoyancy condition. The v1 read path remains valid. The workspace now gives separate not-started/in-progress/all-attempted/needs-improvement/needs-underwater-five/minimum-progress/above-minimum states, a formal/best/latest view control, complete attempt history and contribution labels, evaluator/site/pool/notes, exact Skill Evidence links, and an expandable scoring scale. The requirement evaluator stays advisory/manual-review pending instructor confirmation and never makes a PADI pass claim.

Focused tests were red before these additions and green after. The local app1.0.69 candidate passes **141 files / 875 tests**, typecheck, build/PWA, targeted lint, six-credential privacy and nine protected-calculation hashes. Four-width local browser checks show 25 detail elements (24 skills plus score scale), no page overflow or completed broken images; the score toggle was exercised and application console remained clear. Sites139 owner data was freshly rechecked: 6,435 records, 66 Dives, one Gas Plan, aggregate fingerprint `994c86268971903af6d59fe4b43e337f1f68e3244744063e34f5ee4d0a2e6bca`. The follow-up is **not yet published**; see HANDOVER for exact release steps.
