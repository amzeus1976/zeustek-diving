import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CollapsibleWorkCard,
  type CollapsibleWorkCardProps,
} from '../components/workflow/collapsible-work-card';
import { WorkflowContextStrip } from '../components/workflow/workflow-context-strip';
import { WorkflowPlaceholder } from '../components/workflow/workflow-placeholder';

describe('T10.5 workflow components', () => {
  it('exposes accessible density and detail controls while keeping status visible', () => {
    const props = {
      id: 'test-density',
      title: 'Safety',
      status: '2 warnings',
      alert: 'Review required',
      rowCount: 8,
      previewLimit: 5,
      onOpenDetail: () => {},
    } as CollapsibleWorkCardProps;
    const html = renderToStaticMarkup(
      createElement(
        CollapsibleWorkCard,
        props,
        createElement('p', null, 'Details'),
      ),
    );
    expect(html).toContain('2 warnings');
    expect(html).toContain('Review required');
    expect(html).toContain('aria-label="Open Safety"');
    expect(html).toContain('Show more (3)');
    expect(html).toContain('aria-label="Collapse Safety"');
    expect(html).toContain('>−</span>');
    expect(html).not.toContain('Open detail');
    expect(html).not.toContain('>Minimise<');
    expect(html).toContain('aria-expanded="true"');
  });

  it('renders the page journey as genuine buttons', () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowContextStrip, {
        from: [{ label: 'Trips', route: 'Trips' }],
        current: 'Dive Planning Centre',
        next: [{ label: 'Dive Skills', route: 'Skills & Currency' }],
        go: () => {},
      }),
    );
    expect(html).toContain('aria-label="Dive Planning Centre workflow"');
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).not.toContain('<details open');
    expect(html).toContain('<button');
    expect(html).toContain('Dive Skills');
  });

  it('keeps future destinations honest and does not create records', () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowPlaceholder, {
        route: 'Future test destination',
        go: () => {},
      }),
    );
    expect(html).toContain('Future test destination');
    expect(html).toContain('Coming in a future task');
    expect(html).toContain('No data has been created or migrated');
  });
});
