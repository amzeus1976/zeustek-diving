# T13 Design Ethos / UI Consistency / Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a shared-system-first T13 visual, responsive and accessibility consistency pass without changing canonical data, route structure or Gas Planner calculations.

**Architecture:** Extend the existing ZeusTek token and global interaction layer, then make small CSS/markup corrections in representative route families. Existing `CollapsibleWorkCard`, `AccessibleDialog`, workflow routing and record stores remain authoritative; no alternate shell or component framework is introduced.

**Tech Stack:** React 19, TypeScript 5.9, CSS modules plus the existing global CSS layers, Vitest, Vinext/Vite PWA, Playwright-compatible browser verification through the local and production UI.

**Spec:** `docs/superpowers/specs/2026-09-22-t13-design-ethos-compliance-design.md`

## Global Constraints

- Source baseline is GitHub main `1ceeecf5cdb564fb5487e81465c03a9ca94418ec`; production baseline is app1.0.49 / Sites120.
- Preserve all canonical records, all 66 Dive logs and the zero-visible-Gas-Plan production state.
- Do not change Gas Planner calculations, coefficient data, NDL, MOD, PPO2, EAD, gas-time, reserve or route/checkpoint logic.
- Do not edit `lib/offline/buhlmann-ndl.ts`, `lib/offline/recreational-gas-planner.ts` or `lib/offline/recreational-gas-reserve.ts`.
- Preserve owned/rental cylinder behavior, fill/root-fill and analysis/origin-fill provenance, Plan-to-Dive provenance and local-first sync/history/outbox behavior.
- Preserve workflow groups, legacy aliases and existing route identities.
- No T14 or T15 work, no synthetic production records and no route-by-route redesign.
- Every product behavior or markup change begins with an observed failing test.
- Any unavoidable calculation-file contact is reported as `CALCULATION_TOUCHPOINT` with its display-only, typing-only or test-only reason.

## Review Focus

- Long labels and action groups at 390 px must wrap within the viewport rather than overlap or create page-level horizontal scrolling; Task 4 pins responsive CSS hooks and browser acceptance verifies rendered bounds.
- Minimized cards must keep status and warnings visible while hiding only their body; Task 2 renders and asserts this behavior.
- Editable overlays must keep explicit-dismiss and discard-confirmation behavior while gaining consistent layout hooks; Task 2 asserts both contracts together.
- Warning/readiness meaning must remain visible in text without relying on color; Task 2 asserts status text and shared labelled variants.
- Gas Planning presentation changes must not import, edit or reinterpret calculation modules; Task 4 uses a source boundary test and Task 6 verifies the protected files are unchanged from the baseline.

---

### Task 1: Establish the focused T13 compliance test

**Files:**
- Create: `tests/t13-design-ethos-compliance.test.ts`
- Read: `app/theme-overrides.css`
- Read: `app/focus.css`
- Read: `components/workflow/collapsible-work-card.tsx`
- Read: `components/accessible-dialog.tsx`
- Read: representative route CSS and shell files listed in Tasks 3 and 4

**Interfaces:**
- Consumes: current shared global CSS, `CollapsibleWorkCard`, `AccessibleDialog`, `WORKFLOW_SECTIONS` and `resolveWorkflowRoute`.
- Produces: a focused, source-level and render-level regression contract for T13.

- [ ] **Step 1: Write the failing shared-system tests**

Create the test with helpers that read repository source and render the two shared components. Include assertions equivalent to:

```ts
expect(theme).toContain('--zt-surface-card:');
expect(theme).toContain('--zt-border-cyan:');
expect(theme).toContain('.zt-status-chip');
expect(theme).toContain('.zt-warning-callout');
expect(theme).toContain('.zt-table-wrap');
expect(theme).toContain('.zt-dialog-actions');
expect(theme).toContain(':focus-visible');
expect(theme).toContain('@media (max-width: 640px)');
```

Render a minimized `CollapsibleWorkCard` and an editable `AccessibleDialog`, asserting the visible status/alert copy, `+`/`−` labels, `data-zeustek-density-card` and `data-zeustek-dialog` hooks, and the existing discard-confirmation contract.

- [ ] **Step 2: Write the failing route-family and safety tests**

Assert that Overview, Insights, Gear, People, Dive Planning, Gas Planning, Technical Diving and Admin sources expose the shared surface/form/table/dialog hooks or shared variables described in later tasks. Assert workflow sections and aliases remain unchanged. Read the three protected calculation files into baseline constants and assert no presentation component imports private calculation internals beyond the already-public projection APIs.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```powershell
pnpm test -- tests/t13-design-ethos-compliance.test.ts
```

Expected: FAIL because the `--zt-*` shared tokens, shared pattern classes and component data hooks do not yet exist.

- [ ] **Step 4: Commit the failing test**

```powershell
git add tests/t13-design-ethos-compliance.test.ts
git commit -m "test: define T13 design-system compliance contract"
```

---

### Task 2: Normalize the shared ZeusTek visual and interaction foundation

**Files:**
- Modify: `app/theme-overrides.css`
- Modify: `app/focus.css`
- Modify: `components/workflow/collapsible-work-card.tsx`
- Modify: `components/workflow/collapsible-work-card.module.css`
- Modify: `components/accessible-dialog.tsx`

**Interfaces:**
- Consumes: existing `focus-*` classes, CSS variables and accessible-dialog behavior.
- Produces: reusable `--zt-*` tokens, `.zt-status-chip`, `.zt-warning-callout`, `.zt-table-wrap`, `.zt-dialog-actions`, consistent focus/form/action states and stable data hooks for shared cards/dialogs.

- [ ] **Step 1: Add the shared tokens and pattern classes**

Extend `:root,.dark` in `theme-overrides.css` with:

```css
--zt-surface-page:#080808;
--zt-surface-card:#0b1418;
--zt-surface-raised:#111b20;
--zt-border-cyan:rgba(0,190,242,.34);
--zt-border-muted:rgba(174,213,226,.18);
--zt-accent-cyan:#21c8f2;
--zt-accent-orange:#ff8a00;
--zt-accent-yellow:#ffe11a;
--zt-text:#f4fbfd;
--zt-text-muted:#adc0c8;
--zt-ready:#58e3a4;
--zt-caution:#ffc15c;
--zt-blocked:#ff776d;
--zt-focus:#fff11a;
--zt-radius-card:14px;
--zt-target:44px;
```

Add shared status, warning, table wrapper, dialog action, form control and `:focus-visible` patterns. Preserve `.focus-primary`, `.focus-secondary`, `.focus-badge`, existing warning classes and their public names while mapping them to the shared tokens.

- [ ] **Step 2: Add non-invasive shared component hooks**

Add `data-zeustek-density-card` to the `CollapsibleWorkCard` section and `data-zeustek-dialog` to `AccessibleDialog`. Do not change their state logic, persistence, dismissal or focus behavior.

- [ ] **Step 3: Refine shared card and dialog layout**

Update the card module to use `--zt-*` tokens, retain visible status/alert copy while minimized, and keep 44 px density controls. Add global dialog action wrapping/sticky-footer behavior only through opt-in `.zt-dialog-actions` or existing dialog footer selectors so unrelated dialogs do not regress.

- [ ] **Step 4: Run the focused tests and verify GREEN for shared contracts**

```powershell
pnpm test -- tests/t13-design-ethos-compliance.test.ts tests/workflow-components.test.ts tests/accessible-dialog.test.ts
```

Expected: shared-system assertions PASS; route-family assertions may remain RED until Tasks 3 and 4.

- [ ] **Step 5: Commit the shared foundation**

```powershell
git add app/theme-overrides.css app/focus.css components/workflow/collapsible-work-card.tsx components/workflow/collapsible-work-card.module.css components/accessible-dialog.tsx
git commit -m "style: unify ZeusTek shared UI foundation"
```

---

### Task 3: Apply targeted Overview, Insights, Gear, People and Admin fixes

**Files:**
- Modify: `app/dashboard-client.tsx`
- Modify: `components/experience-analytics.module.css`
- Modify: `components/loadouts-gas.module.css`
- Modify: `components/people-operators.module.css`
- Modify only if a semantic hook is missing: `components/loadouts-gas.tsx`
- Modify only if a semantic hook is missing: `components/people-operators.tsx`
- Test: `tests/t13-design-ethos-compliance.test.ts`

**Interfaces:**
- Consumes: shared `--zt-*` tokens/classes and existing route behavior.
- Produces: consistent route-family surfaces, tables, overlays, action groups and narrow-screen behavior without data changes.

- [ ] **Step 1: Extend the failing tests for representative route behavior**

Assert the following before implementation:

```ts
expect(dashboard).toContain('NEXT DIVE');
expect(dashboard).toContain('MY PROFILE');
expect(dashboard).toContain('TOP DIVE BUDDY');
expect(insightsCss).toContain('var(--zt-border-cyan)');
expect(loadoutsCss).toContain('var(--zt-surface-card)');
expect(peopleCss).toContain('var(--zt-focus)');
expect(loadouts).toContain("event.key === 'Enter' || event.key === ' '");
```

Also retain assertions that Insights awards are configured in Site Configuration, incomplete rows remain centered, Loadouts does not own gas, cylinder `ID #` and serial remain separate, and owner/profile privacy text remains present.

- [ ] **Step 2: Run the route-family tests and verify RED**

```powershell
pnpm test -- tests/t13-design-ethos-compliance.test.ts tests/tweaks-workflow-insights-gear.test.ts tests/people-operator-profiles.test.ts tests/loadouts-gas-shell.test.ts
```

Expected: FAIL only on the new shared-token/hook assertions.

- [ ] **Step 3: Apply minimal route-level styling and markup hooks**

Refactor hard-coded card borders/surfaces/focus colors in the three CSS modules to shared tokens. Add only the minimum class names needed in TSX for shared table wrapping, status chips, warning callouts, action rows or dialog actions. Keep all record reads/writes and component event handlers unchanged.

For `dashboard-client.tsx`, apply shared page, form, table and status classes to Overview and the Site Logs/Site Configuration/Data & Backups surfaces already rendered in this file. Do not reintroduce analytics on Overview or move award settings out of Site Configuration.

- [ ] **Step 4: Verify GREEN and run touched-family regressions**

```powershell
pnpm test -- tests/t13-design-ethos-compliance.test.ts tests/tweaks-workflow-insights-gear.test.ts tests/people-operator-profiles.test.ts tests/loadouts-gas-shell.test.ts tests/loadouts-gas-persistence.test.ts tests/t12-5e-cylinder-gas-planner.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the first route-family pass**

```powershell
git add app/dashboard-client.tsx components/experience-analytics.module.css components/loadouts-gas.module.css components/loadouts-gas.tsx components/people-operators.module.css components/people-operators.tsx tests/t13-design-ethos-compliance.test.ts
git commit -m "style: align overview insights gear people and admin"
```

---

### Task 4: Apply targeted Dive Planning, Gas Planning and Technical Diving fixes

**Files:**
- Modify: `components/dive-planning-centre.module.css`
- Modify: `components/planning/planning-pages.module.css`
- Modify: `components/planning/recreational-gas-planner.module.css`
- Modify: `components/technical-workspace.module.css`
- Modify only for presentation hooks: `components/dive-planning-centre.tsx`
- Modify only for presentation hooks: `components/planning/gas-planning.tsx`
- Modify only for presentation hooks: `components/planning/recreational-gas-planner.tsx`
- Modify only for presentation hooks: `components/technical-workspace.tsx`
- Test: `tests/t13-design-ethos-compliance.test.ts`

**Interfaces:**
- Consumes: public planner projections and the shared T13 visual foundation.
- Produces: responsive, consistent planning/technical presentation without altering calculations, persistence or canonical references.

- [ ] **Step 1: Extend tests for planning and calculation boundaries**

Add assertions for shared tokens, 44 px controls, mobile single-column rules, readable table wrappers and warning labels in the four CSS modules/components. Assert the three protected calculation files are absent from `git diff --name-only 1ceeecf..HEAD` and that presentation files do not contain copied coefficient arrays or reserve formulas.

- [ ] **Step 2: Run focused planning tests and verify RED**

```powershell
pnpm test -- tests/t13-design-ethos-compliance.test.ts tests/dive-planning-centre.test.ts tests/t12-6r-planner-ui.test.ts tests/technical-workspace-shell.test.ts
```

Expected: FAIL on new visual/responsive contract assertions, while existing domain tests remain PASS.

- [ ] **Step 3: Apply display-only consistency changes**

Use `--zt-*` variables for card surfaces, borders, section headings, controls, focus states, warnings and readiness colors. Add `.zt-table-wrap`, `.zt-warning-callout`, `.zt-status-chip` or `.zt-dialog-actions` hooks where the presentation needs them. Preserve component state, planner inputs, projections, saves, snapshots and all calculation calls.

At 390 px, make editor grids and route rows one column where necessary; at approximately 820 px and 1024 px, use compact two-column or stacked layouts without page-level overflow. Keep desktop hierarchy dense and aligned.

- [ ] **Step 4: Run focused and domain regressions and verify GREEN**

```powershell
pnpm test -- tests/t13-design-ethos-compliance.test.ts tests/dive-planning-centre.test.ts tests/t12-6r-planner-ui.test.ts tests/t12-6r-recreational-gas.test.ts tests/t12-5e-cylinder-gas-planner.test.ts tests/t12-5e-rental-cylinder-mode.test.ts tests/technical-workspace-shell.test.ts
```

Expected: PASS with no calculation-output change.

- [ ] **Step 5: Verify protected calculation files are untouched**

```powershell
git diff --name-only 1ceeecf5cdb564fb5487e81465c03a9ca94418ec...HEAD -- lib/offline/buhlmann-ndl.ts lib/offline/recreational-gas-planner.ts lib/offline/recreational-gas-reserve.ts
```

Expected: no output. Any output stops implementation and is reported as `CALCULATION_TOUCHPOINT` before proceeding.

- [ ] **Step 6: Commit the planning-family pass**

```powershell
git add components/dive-planning-centre.module.css components/dive-planning-centre.tsx components/planning/planning-pages.module.css components/planning/gas-planning.tsx components/planning/recreational-gas-planner.module.css components/planning/recreational-gas-planner.tsx components/technical-workspace.module.css components/technical-workspace.tsx tests/t13-design-ethos-compliance.test.ts
git commit -m "style: align planning gas and technical workspaces"
```

---

### Task 5: Perform local visual and responsive acceptance

**Files:**
- Modify only when a verified visual/accessibility defect has a failing test: the files from Tasks 2–4
- Test: `tests/t13-design-ethos-compliance.test.ts`

**Interfaces:**
- Consumes: locally built T13 UI and current seeded/local canonical records.
- Produces: browser-verified behavior at the four required viewport classes.

- [ ] **Step 1: Start the local app**

```powershell
pnpm dev -- --host 127.0.0.1
```

Open the emitted local URL and record it for the browser run.

- [ ] **Step 2: Audit representative pages at desktop and 1024 px**

Open Overview, Insights, Equipment, Cylinders & Gas, People & Operators, Dive Planning Centre, Gas Planning, Technical Diving, Site Configuration and Data & Backups. Verify hierarchy, compact cards, usable tables/dialogs, warning labels, actions, keyboard focus, `+`/`−` controls and no console errors.

- [ ] **Step 3: Audit representative pages at 820 px and 390 px**

Verify no page-level horizontal overflow, no overlap, no clipped dialog actions, usable fields/tables, compact mobile navigation and 44 px primary interactive targets.

- [ ] **Step 4: Reproduce every discovered defect with a failing test before fixing it**

For each issue, add the smallest CSS/source assertion or rendered-component test that fails for that issue, run it RED, make the minimal implementation change, then run it GREEN. Do not change a visual defect without a regression test.

- [ ] **Step 5: Re-run the focused T13 test**

```powershell
pnpm test -- tests/t13-design-ethos-compliance.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit visual-acceptance corrections**

```powershell
git add tests/t13-design-ethos-compliance.test.ts app components
git commit -m "fix: close T13 responsive and accessibility gaps"
```

If there are no corrections, skip this commit.

---

### Task 6: Run the release gate and prepare release evidence

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `lib/app-changelog.ts`
- Modify: `ZEUSTEK_Diving_Upgrade_Progress.md`
- Create: `docs/T13-release-record.md`

**Interfaces:**
- Consumes: fully verified local T13 source.
- Produces: app1.0.50 release metadata and auditable T13 evidence.

- [ ] **Step 1: Run the full pre-version gate**

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm lint -- components/workflow/collapsible-work-card.tsx components/accessible-dialog.tsx app/dashboard-client.tsx components/loadouts-gas.tsx components/people-operators.tsx components/dive-planning-centre.tsx components/planning/gas-planning.tsx components/planning/recreational-gas-planner.tsx components/technical-workspace.tsx tests/t13-design-ethos-compliance.test.ts
```

Expected: all commands PASS. Record the final regression count exactly.

- [ ] **Step 2: Confirm the calculation boundary and data schema boundary**

```powershell
git diff --name-only 1ceeecf5cdb564fb5487e81465c03a9ca94418ec...HEAD -- lib/offline/buhlmann-ndl.ts lib/offline/recreational-gas-planner.ts lib/offline/recreational-gas-reserve.ts db drizzle schemas
```

Expected: no output.

- [ ] **Step 3: Update release metadata only after the gate passes**

Set package/lock version to `1.0.50`. Add a changelog entry stating the shared-system-first T13 scope and explicitly stating that Gas Planner calculations and canonical data were unchanged. Add a T13 release record and append progress evidence with local gates, responsive results and the pending deployment/GitHub identifiers.

- [ ] **Step 4: Run the version/PWA and final release gate**

Run the existing version/PWA tests discovered in the repository, then repeat:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

Expected: PASS at app1.0.50 with the same or higher legitimate regression count.

- [ ] **Step 5: Commit the verified release candidate**

```powershell
git add package.json pnpm-lock.yaml lib/app-changelog.ts ZEUSTEK_Diving_Upgrade_Progress.md docs/T13-release-record.md
git commit -m "release: prepare verified T13 app1.0.50"
```

---

### Task 7: Publish, smoke production and synchronize the verified source

**Files:**
- Modify after deployment identifiers are known: `docs/T13-release-record.md`
- Modify after deployment identifiers are known: `ZEUSTEK_Diving_Upgrade_Progress.md`

**Interfaces:**
- Consumes: exact locally verified app1.0.50 source and the canonical ZeusTek Sites project.
- Produces: Sites121 candidate, production acceptance evidence and an exact GitHub synchronization commit/PR.

- [ ] **Step 1: Load and follow the Sites hosting skill**

Read `C:/Users/amzeu/.codex/plugins/cache/openai-curated-remote/sites/0.1.70/skills/sites-hosting/SKILL.md` completely. Verify the canonical project ID before creating the source archive or deployment.

- [ ] **Step 2: Publish only the verified release candidate**

Push the exact candidate to the Sites source remote, package the same commit, create the new site version and deploy it publicly to the existing project. Keep app1.0.49 / Sites120 available as rollback.

- [ ] **Step 3: Production-smoke the required routes read-only**

At `https://zeustek-dive.amzeus.chatgpt.site/`, verify Overview, Insights, Equipment, Loadouts, Cylinders & Gas, People & Operators, Dive Planning Centre, Gas Planning, Technical Diving, Site Logs, Site Configuration, Data & Backups and Diver Summary Export. Check desktop and phone widths, dialogs, focus, cards, warnings, console and horizontal overflow.

- [ ] **Step 4: Verify retained production state**

Confirm exactly 66 Dive logs remain, Gas Planning shows zero visible plans, and no owner record was created, edited or deleted by the T13 smoke.

- [ ] **Step 5: Complete release evidence**

Record final app/Sites version, deployment ID, published-source SHA, rollback, regression count, responsive/smoke results, retained data counts and `CALCULATION_TOUCHPOINT: none` unless the protected-file check proves otherwise.

- [ ] **Step 6: Synchronize exact verified production source to GitHub**

Commit the final evidence, push the branch, open a normal PR, attach it to the task, merge only after production smoke passes, and verify GitHub main contains the expected commit and its source tree matches the Sites published source.

- [ ] **Step 7: Final verification before reporting completion**

Use the verification-before-completion skill. Re-check production version, deployment state, GitHub HEAD/tree equality, 66 Dive logs, zero Gas Plans, protected calculation files and clean repository status. Report T13 complete only if every check passes; otherwise restore Sites120 and report `BLOCKED_DEPLOYMENT`.
