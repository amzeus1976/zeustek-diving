import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import * as conflictViews from '../components/dive-conflict-review';

type Choice = 'local' | 'cloud';
type ComparisonProps = {
  local: Record<string, unknown> | null; cloud: Record<string, unknown> | null;
  busy: boolean; resolve: (choice: Choice) => void; close: () => void;
  showUnchanged: boolean; changeShowUnchanged: (value: boolean) => void;
};
const comparison = () => {
  const component = (conflictViews as unknown as { ConflictComparison?: (props: ComparisonProps) => ReactNode }).ConflictComparison;
  expect(typeof component).toBe('function');
  return component!;
};
const props: ComparisonProps = { local: { title: 'Saved device title', notes: 'Device notes', equipmentId: 'same-equipment' }, cloud: { title: 'Cloud title', notes: 'Cloud notes', equipmentId: 'same-equipment' }, busy: false, resolve: () => {}, close: () => {}, showUnchanged: false, changeShowUnchanged: () => {} };

describe('record-specific sync review', () => {
  it('renders nested recorded values with readable labels rather than raw JSON', () => {
    const html = renderToStaticMarkup(createElement(comparison(), { ...props, local: { story: { narrative: 'Device story', timeline: [{ depthM: 12, note: 'Dummy moment' }] } }, cloud: { story: { narrative: 'Cloud story' } } }));
    expect(html).toContain('<dt>Narrative</dt>');
    expect(html).toContain('<dt>Depth M</dt>');
    expect(html).toContain('Dummy moment');
    expect(html).not.toContain('&quot;narrative&quot;');
    expect(html).toContain('1 field differs.');
  });
  it('keeps each choice within its named data column and Close outside both choices', () => {
    const html = renderToStaticMarkup(createElement(comparison(), props));
    const local = html.slice(html.indexOf('data-version="local"'), html.indexOf('data-version="cloud"'));
    const cloud = html.slice(html.indexOf('data-version="cloud"'));
    expect(local).toContain('This device'); expect(local).toContain('Saved device title');
    expect(local).toContain('Keep this device version'); expect(local).not.toContain('Use cloud version');
    expect(cloud).toContain('Cloud'); expect(cloud).toContain('Cloud title'); expect(cloud).toContain('Use cloud version');
    expect(local).not.toContain('>Close</button>');
    expect(html).toContain('Show unchanged fields');
  });
  it('dispatches the correct version and never resolves merely by rendering', () => {
    const resolve = vi.fn();
    const tree = comparison()({ ...props, resolve });
    expect(resolve).not.toHaveBeenCalled();
    const visit = (node: ReactNode, version?: Choice) => {
      if (Array.isArray(node)) return node.forEach(child => visit(child, version));
      if (!isValidElement(node)) return;
      const data = node.props as { children?: ReactNode; 'data-version'?: Choice; onClick?: () => void };
      const active = data['data-version'] ?? version;
      if (node.type === 'button' && active) { data.onClick?.(); expect(resolve).toHaveBeenLastCalledWith(active); }
      visit(data.children, active);
    };
    visit(tree); expect(resolve.mock.calls.map(call => call[0])).toEqual(['local', 'cloud']);
  });
  it('reports matching values without dumping unchanged fields and exposes an explicit all-fields view', () => {
    const same = { title: 'Same title', notes: 'Same notes' };
    const html = renderToStaticMarkup(createElement(comparison(), { ...props, local: same, cloud: { ...same } }));
    expect(html).toContain('The recorded field values match.');
    expect(html).not.toContain('<dt>Notes</dt>');
    const all = renderToStaticMarkup(createElement(comparison(), { ...props, local: same, cloud: same, showUnchanged: true }));
    expect(all).toContain('Same notes');
  });
  it('renders deletion/unavailable records truthfully, long values safely, and disables both choices while saving', () => {
    const html = renderToStaticMarkup(createElement(comparison(), { ...props, local: null, cloud: { title: 'Long '.repeat(200), notes: '<script>unsafe()</script>' }, busy: true }));
    expect(html).toContain('Deletion on this device');
    expect(html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it('places the full sync panel outside the application header', () => {
    const source = readFileSync(new URL('../app/dashboard-client.tsx', import.meta.url), 'utf8');
    const header = source.slice(source.indexOf('<header className="focus-topbar">'), source.indexOf('<RecordOperationStatus />'));
    expect(header).not.toContain('<DiveSyncStatus');
    expect(source).toMatch(/className="focus-content"[^>]*><DiveSyncStatus\s*\/>/);
  });
});
