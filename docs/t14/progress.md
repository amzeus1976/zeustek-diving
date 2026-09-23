# T14 execution ledger — plan: docs/t14/implementation-plan.md

## Resume contract

Read this ledger and implementation-plan.md, inspect git log/status, then continue the first incomplete stage. Never discard earlier checkpoint work or publish partial stages. Reference specs/candidates live in ../t14-master-reference. User corrections in the approved plan supersede package rollback/multiplier/optional advice.

## Stage 0 — in progress

- Isolated branch t14/master-forward-build at b2e86827c19239776c80b51fc93067c7dc4b18ac.
- GitHub connector main unchanged; Sites connector latest124, successful accepted deployment/source unchanged.
- Sites workflow opened selected checkout successfully, no push/publish. Credential stays in session only.
- Fresh regression: 91 files / 522 tests PASS. Typecheck PASS. Full output: ignored work/t14-evidence/stage0-*.log.
- Freeze: docs/t14/protected-calculations.json records Git-byte and working-byte SHA256 for nine calculation-bearing modules.
- Authenticated read-only backup view confirms6363 active records, including66 Dives,1 GasPlan,4 operators,10 people,1 cylinder; all kinds fingerprinted. No records written.
- Source inspection: cylinder list may repair IDs; generic data GET registers household user; Gmail News refresh may sync on open; backup includes encrypted Gmail connection record. Avoid these side effects during smoke; fix connection-secret export in Stage8.
- Ruling: native worktree tool could not operate from project-mirror root (not a Git repository). Used git worktree from existing GitHub repository into sibling zeustek-t14-master; no existing checkout changed.
- Ruling: pnpm shim invokes11.25.0 despite packageManager10.15.1. Frozen-lock installation succeeded without tracked changes; baseline tests/typecheck pass. Keep lock files unchanged unless a justified dependency is needed.
- Ruling: candidate references were moved OUTSIDE checkout so TypeScript's broad include cannot compile candidate scaffolding. All reference files remain intact; sources/ untouched.

## Pre-flight shared interfaces / rulings

- Stage1 ->2/4/5/6/9: workspace and typed navigation must preserve existing string go callers and Escape/discard/focus semantics.
- Stage2 ->4: optional OperatorRecord extension, existing person operatorId/currentDiveOperatorId; no second store.
- Stage3 ->8/9: additive versioned workbench/scopes settings; domain saves merge latest settings to avoid clobbering awards/maps/news.
- Stage5 ->6: preserve immutable Plan-to-Dive; gas metadata extensions outside protected planning-pages/loadouts files.
- Stage6 ->release: independent assignment cannot be replaced by pooling or altered default math. Freeze includes mixed persistence/calculation modules; add types/adapters elsewhere.
- Stage7 ->10: remove sync-on-open; one authorised production mailbox sync only AFTER complete release, never a partial Stage7 deployment.
- Stage8 ->9: public profile uses explicit redacted projection, never generic record/export spreading; owner opt-in stays off in production acceptance.
- Stage9 ->10: all additional capabilities included after mandatory acceptance, then full combined gate.

## Remaining checkpoints

Stages1–10 NOT STARTED. No production deployment or GitHub source push performed.

Stage 0: complete — baseline522/522, typecheck PASS; new protection10/10 PASS. 748 PNGs extracted/validated in ignored staging, manifest748, curated131 unchanged,112 overlapping basenames. Owner baseline captured2026-09-23T16:17:52.726Z; hashes of sorted [id,dataJson,createdAt,updatedAt] per kind in ignored work/t14-evidence/owner-baseline.csv. Sites124 rollback verified. Next: Stage1 foundations and focused tests.
