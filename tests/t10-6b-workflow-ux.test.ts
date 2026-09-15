import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('T10.6B workflow and data-control UX', () => {
  const dashboard = read('app/dashboard-client.tsx');
  const card = read('components/workflow/collapsible-work-card.tsx');
  const context = read('components/workflow/workflow-context-strip.tsx');
  const dataTools = read('components/workflow/synthetic-fixture-review.tsx');

  it('uses compact workflow disclosure instead of an always-visible strip', () => {
    expect(context).toContain('<details');
    expect(context).toContain('<summary');
    expect(context).not.toContain('<details open');
  });

  it('uses plus/minus density controls and keeps labels accessible', () => {
    expect(card).toContain("minimized ? '+' : '−'");
    expect(card).toContain("'Expand' : 'Collapse'");
    expect(dashboard).toContain("developmentPlanMinimised ? '+' : '−'");
    expect(dashboard).toContain("collapsed ? '+' : '−'");
    expect(dashboard).not.toContain("developmentPlanMinimised ? 'Expand' : 'Minimise'");
  });

  it('opens card details without generic button clutter', () => {
    expect(card).toContain('className={styles.headingButton}');
    expect(card).toContain('aria-label={`Open ${title}`}');
    expect(card).not.toContain('>Open detail</button>');
    expect(dataTools).not.toContain('View details');
    expect(dataTools).toContain('Open ${row.title} record details');
  });

  it('shows fixture evidence, dependency, safe action and reason', () => {
    for (const label of ['Matched field/value', 'Dependency', 'Available safe action', 'Why']) expect(dataTools).toContain(label);
    expect(dataTools).toContain('item.actionReason');
    expect(dataTools).toContain('Nothing is selected or deleted automatically');
    expect(dataTools).toContain('confirmation !== deletePhrase');
  });
});
