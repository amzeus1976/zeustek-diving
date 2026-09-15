import { describe, expect, it } from 'vitest';
import {
  hiddenRowCount,
  looksLikeSyntheticFixture,
  resolveWorkflowRoute,
  SITE_CONFIGURATION_SECTIONS,
  visibleRows,
  workflowRoutesForSection,
  WORKFLOW_ROUTES,
  WORKFLOW_SECTIONS,
} from '../lib/workflow/workflow-model';

describe('T10.5 workflow model', () => {
  it('keeps old section links and renamed display labels routable', () => {
    expect(resolveWorkflowRoute('Skills & Currency')).toBe('Skills & Currency');
    expect(resolveWorkflowRoute('Dive Skills')).toBe('Skills & Currency');
    expect(resolveWorkflowRoute('Dive Media')).toBe('Dive Media');
    expect(resolveWorkflowRoute('Dive Bibliography')).toBe('Dive Media');
    expect(resolveWorkflowRoute('Dive Plans')).toBe('Dive Plans');
    expect(resolveWorkflowRoute('Dive Planning Centre')).toBe('Dive Plans');
    expect(resolveWorkflowRoute('Course Map')).toBe('Course Map');
    expect(resolveWorkflowRoute('Planned Training')).toBe('Course Map');
    expect(resolveWorkflowRoute('Bucket list')).toBe('Dive Bucket List');
  });

  it('defines the six owner-approved workflow groups in order', () => {
    expect(WORKFLOW_SECTIONS.map((section) => section.label)).toEqual([
      'Overview', 'Gear', 'Dive Data', 'Planning', 'Diving CPD', 'Admin',
    ]);
  });

  it('groups planning without duplicating the operational planner', () => {
    const planning = workflowRoutesForSection('planning').map((route) => route.label);
    expect(planning).toContain('Dive Planning Centre');
    expect(planning).toContain('Diving Calendar & Bookings');
    expect(planning).toContain('Gas Planning');
    expect(planning.filter((label) => label === 'Dive Planning Centre')).toHaveLength(1);
  });

  it('has unique route identifiers', () => {
    expect(new Set(WORKFLOW_ROUTES.map((route) => route.route)).size).toBe(WORKFLOW_ROUTES.length);
  });

  it('supports show more, show less and minimise row rules', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7];
    expect(visibleRows(rows, {}, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(hiddenRowCount(rows, {}, 5)).toBe(2);
    expect(visibleRows(rows, { expanded: true }, 5)).toHaveLength(7);
    expect(visibleRows(rows, { minimized: true }, 5)).toHaveLength(0);
  });

  it('keeps the Site Configuration order explicit and reviewable', () => {
    expect(SITE_CONFIGURATION_SECTIONS[0]).toBe('Settings overview');
    expect(SITE_CONFIGURATION_SECTIONS).toContain('Acceptance fixture review');
    expect(SITE_CONFIGURATION_SECTIONS.at(-1)).toBe('Other site data tools');
  });

  it('conservatively detects only explicitly labelled fixtures', () => {
    expect(looksLikeSyntheticFixture({ name: 'T10 PRODUCTION ACCEPTANCE ONLY' })).toBe(true);
    expect(looksLikeSyntheticFixture({ notes: 'Synthetic test only — safe to remove' })).toBe(true);
    expect(looksLikeSyntheticFixture({ name: 'St Abbs September trip' })).toBe(false);
  });
});
