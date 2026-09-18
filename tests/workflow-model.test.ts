import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    expect(resolveWorkflowRoute('Dive Bucket List')).toBe('Dive Bucket List');
    expect(resolveWorkflowRoute('Trips')).toBe('Trips');
    expect(resolveWorkflowRoute('Diving Calendar & Bookings')).toBe('Diving Calendar & Bookings');
    expect(resolveWorkflowRoute('Gas Planning')).toBe('Gas Planning');
    expect(resolveWorkflowRoute('Technical Diving')).toBe('Technical Diving');
  });

  it('separates trip/event logistics from dive-specific preparation', () => {
    expect(WORKFLOW_SECTIONS.map((section) => section.label)).toEqual([
      'Overview', 'Gear', 'Dive Data', 'Trip / Event Planning', 'Dive Preparation', 'Diving CPD', 'Admin',
    ]);
  });

  it('groups each planning destination once and moves Technical Diving into CPD', () => {
    expect(workflowRoutesForSection('trip-event-planning').map((route) => route.label)).toEqual([
      'Diving Calendar & Bookings', 'Trips & Expeditions', 'Bucket List',
    ]);
    expect(workflowRoutesForSection('dive-preparation').map((route) => route.label)).toEqual([
      'Dive Planning Centre', 'Gas Planning',
    ]);
    expect(workflowRoutesForSection('diving-cpd').map((route) => route.label)).toContain('Technical Diving');
    expect(workflowRoutesForSection('dive-preparation').map((route) => route.label)).not.toContain('Technical Diving');
  });

  it('has unique route identifiers', () => {
    expect(new Set(WORKFLOW_ROUTES.map((route) => route.route)).size).toBe(WORKFLOW_ROUTES.length);
  });

  it('keeps five compact mobile destinations with Dive Preparation primary, and leaves records untouched', () => {
    const shell = readFileSync(resolve(process.cwd(), 'app/dashboard-client.tsx'), 'utf8');
    expect(shell).toContain("['Overview', 'Logbook', 'Dive Plans', 'Equipment', 'Data & Backups']");
    expect(shell).toContain("item.route === 'Dive Plans' ? 'Dive Prep' : item.label");
    expect(shell).toContain("aria-label={item.route === 'Dive Plans' ? 'Dive Preparation — Dive Planning Centre' : item.label}");
    expect(shell).toContain('workflowRoutesForSection(section.key)');
    expect(resolveWorkflowRoute('Dive Plans')).toBe('Dive Plans');
    expect(resolveWorkflowRoute('Technical Diving')).toBe('Technical Diving');
    expect(readFileSync(resolve(process.cwd(), 'lib/record-identity.ts'), 'utf8')).toContain("'trip'");
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
