import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AccessibleDialog,
  dialogAllowsImplicitDismiss,
  dialogNeedsDiscardConfirmation,
} from '../components/accessible-dialog';
import {
  CollapsibleWorkCard,
  type CollapsibleWorkCardProps,
} from '../components/workflow/collapsible-work-card';
import {
  WORKFLOW_SECTIONS,
  resolveWorkflowRoute,
  workflowRoutesForSection,
} from '../lib/workflow/workflow-model';
import { TechnicalWorkspace } from '../components/technical-workspace';

describe('T13 shared design-system behavior', () => {
  it('keeps minimized card status and warnings announced while hiding the body', () => {
    const html = renderToStaticMarkup(
      createElement(
        CollapsibleWorkCard,
        {
          id: 'readiness',
          title: 'Readiness',
          status: '2 checks current',
          alert: 'Review one warning',
          defaultMinimized: true,
        } satisfies CollapsibleWorkCardProps,
        createElement('p', null, 'Private expanded evidence'),
      ),
    );

    expect(html).toContain('data-zeustek-density-card="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('2 checks current');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Review one warning');
    expect(html).toContain('aria-label="Expand Readiness"');
    expect(html).toContain('>+</span>');
    expect(html).not.toContain('Private expanded evidence');
  });

  it('exposes the shared dialog hook without weakening editable dismissal safety', () => {
    const html = renderToStaticMarkup(
      createElement(
        AccessibleDialog,
        {
          label: 'Edit cylinder',
          className: 'focus-modal',
          close: () => {},
          editable: true,
        },
        createElement('input', { defaultValue: '01' }),
      ),
    );

    expect(html).toContain('data-zeustek-dialog="true"');
    expect(html).toContain('aria-label="Edit cylinder"');
    expect(html).toContain('data-editable="true"');
    expect(dialogAllowsImplicitDismiss(true)).toBe(false);
    expect(dialogNeedsDiscardConfirmation(true, true)).toBe(true);
  });
});

describe('T13 route and terminology preservation', () => {
  it('keeps the approved workflow groups and representative routes', () => {
    expect(WORKFLOW_SECTIONS.map((section) => section.label)).toEqual([
      'Overview',
      'Gear',
      'Dive Data',
      'Trip / Event Planning',
      'Dive Preparation',
      'Diving CPD',
      'Admin',
    ]);
    expect(workflowRoutesForSection('dive-preparation').map((route) => route.label)).toEqual([
      'Dive Planning Centre',
      'Gas Planning',
    ]);
    expect(workflowRoutesForSection('diving-cpd').map((route) => route.label)).toContain(
      'Technical Diving',
    );
  });

  it('keeps legacy links resolving to their canonical route identities', () => {
    expect(resolveWorkflowRoute('Home')).toBe('Overview');
    expect(resolveWorkflowRoute('Experience & Analytics')).toBe('Insights');
    expect(resolveWorkflowRoute('Loadouts & Cylinder Gas')).toBe('Loadouts & Gas');
    expect(resolveWorkflowRoute('Cylinder Gas')).toBe('Cylinders & Gas');
    expect(resolveWorkflowRoute('Dive Planning Centre')).toBe('Dive Plans');
    expect(resolveWorkflowRoute('Site Configuration')).toBe('Settings');
  });
});

describe('T13 targeted legacy-page alignment', () => {
  it('keeps Technical Diving advisory controls in a compact note after the hero', () => {
    const html = renderToStaticMarkup(
      createElement(TechnicalWorkspace, { go: () => {} }),
    );

    expect(html).toContain('role="note"');
    expect(html).toContain('Readiness is advisory');
    expect(html).toContain('Canonical Skill Group');
    expect(html.indexOf('<header')).toBeLessThan(html.indexOf('role="note"'));
  });
});
