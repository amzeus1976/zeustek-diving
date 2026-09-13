import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiveRecordDetail } from '../components/dive-record-detail';
import type { DiveRecord } from '../lib/offline/dives';

const dive: DiveRecord & { entityId: string } = { entityId: 'same-dive-id', site: 'Historical quarry Dive', date: '2026-09-01', maxDepthM: 12, bottomTimeMin: 38, gas: 'Air', notes: '', source: 'manual', createdAt: '2026-09-01', modifiedAt: '2026-09-01' };
const props = { dive, title: dive.site, eyebrow: 'manual dive', ownerKind: 'dive', ownerId: dive.entityId, rows: [['Maximum depth', '12 m'], ['Notes', 'Original factual notes']] as Array<[string, string]>, close: () => {}, edit: () => {}, remove: () => {} };

describe('Dive segmented-view shell', () => {
  it('renders one shared identity and a fully labelled semantic selector with Overview default', () => {
    const html = renderToStaticMarkup(createElement(DiveRecordDetail, props));
    expect(html).toContain('aria-label="Dive view"');
    expect(html.match(/role="tab"/g)).toHaveLength(3);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-selected="true"[^>]*>Overview<\/button>/);
    expect(html.match(/<h2>/g)).toHaveLength(1);
    expect(html).toContain('Original factual notes');
    expect(html).toContain('Edit Dive facts');
  });
  it('supports an explicit Story perspective without requiring historical new fields', () => {
    const html = renderToStaticMarkup(createElement(DiveRecordDetail, { ...props, initialView: 'story' }));
    expect(html).toMatch(/aria-selected="true"[^>]*>Story<\/button>/);
    expect(html).toContain('Your Dive story');
    expect(html).toContain('What happened');
    expect(html).toContain('Add timeline note');
    expect(html).not.toContain('required=""');
  });
});
