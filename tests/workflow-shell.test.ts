import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('T10.5 application shell integration', () => {
  const dashboard = read('app/dashboard-client.tsx');
  const styles = read('app/focus.css');
  const planner = read('components/dive-planning-centre.tsx');

  it('uses grouped workflow navigation and the owner-approved display names', () => {
    expect(dashboard).toContain('<WorkflowNavigation active={active} go={go}/>');
    for (const label of ['Certifications', 'Planned Training', 'Dive Skills', 'Dive Bibliography', 'Dive Knowledge', 'Site Configuration']) {
      expect(read('lib/workflow/workflow-model.ts')).toContain(`label: '${label}'`);
    }
  });

  it('mounts Dive Knowledge while keeping T12 and future workflow destinations honest', () => {
    expect(dashboard).toContain("active === 'Dive Knowledge' && <KnowledgeCentre go={go}");
    expect(dashboard).toContain("['Dive Computer Imports','Diving Calendar & Bookings','Gas Planning']");
    expect(dashboard).toContain('<WorkflowPlaceholder route={active} go={go}/>');
  });

  it('adds density controls without replacing the T10 planner', () => {
    expect(dashboard).toContain('overview-equipment-status');
    expect(dashboard).toContain('settings-overview');
    expect(dashboard).toContain('id="settings-overview" defaultMinimized');
    expect(planner).toContain('<CollapsibleWorkCard');
    expect(planner).toContain('createDiveDraftFromEnrichedPlan');
  });

  it('keeps alert/status content visible and prevents compact horizontal overflow', () => {
    const card = read('components/workflow/collapsible-work-card.tsx');
    const strip = read('components/workflow/workflow-context-strip.tsx');
    expect(card).toContain("(status || alert)");
    expect(card).toContain("minimized ? '+' : '−'");
    expect(card).not.toContain('>Open detail</button>');
    expect(strip).toContain('<details');
    expect(strip).toContain('<summary');
    expect(styles).toContain('.workflow-nav-group');
    expect(styles).toContain('overflow-x:hidden');
  });

  it('uses the canonical delete path for confirmed synthetic fixtures', () => {
    const review = read('components/workflow/synthetic-fixture-review.tsx');
    expect(review).toContain('deleteLocalRecord');
    expect(review).toContain('Nothing is selected or deleted automatically');
    expect(review).toContain('confirmation !== deletePhrase');
  });
});
