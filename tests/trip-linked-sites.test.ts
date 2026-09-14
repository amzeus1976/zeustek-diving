import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TripLinkedSites } from '../components/trip-linked-sites';
import type { DiveSiteRecord, Stored } from '../lib/offline/dive-planning';
import { readFileSync } from 'node:fs';

const siteIds = Array.from({ length: 6 }, (_, index) => `site-${index + 1}`);
const sites = siteIds.map(entityId => ({ entityId, name: entityId })) as Array<Stored<DiveSiteRecord>>;
const render = (ids: string[]) => renderToStaticMarkup(createElement(TripLinkedSites, { siteIds: ids, sites }));

describe('Trip linked Dive Sites disclosure', () => {
  it('shows exactly four initial links and retains the remainder in a closed native keyboard disclosure', () => {
    const before = JSON.stringify({ siteIds, sites });
    const html = render(siteIds);
    const initial = html.split('<details')[0]!;
    expect(initial.match(/<a /g)).toHaveLength(4);
    expect(html.match(/<a /g)).toHaveLength(6);
    expect(html).toMatch(/<details[^>]*><summary>/);
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|>)/);
    expect(html).toContain('… more');
    expect(html).toContain('… less');
    expect(html).toContain('siteId=site-6');
    expect(JSON.stringify({ siteIds, sites })).toBe(before);
    const css = readFileSync('components/trips-expeditions.module.css', 'utf8');
    expect(css).toContain('.linkedSitesDisclosure[open] .moreSites { display: none; }');
    expect(css).toContain('.linkedSitesDisclosure[open] .lessSites { display: inline; }');
    expect(css).toContain('summary:focus-visible');
  });
  it('does not offer expansion for four or fewer links', () => {
    expect(render(siteIds.slice(0, 4))).not.toContain('<details');
    expect(render(siteIds.slice(0, 2)).match(/<a /g)).toHaveLength(2);
  });
  it('keeps empty and unavailable canonical Site references truthful', () => {
    expect(render([])).toContain('No Sites linked.');
    const html = render(['unavailable-site']);
    expect(html).toContain('Site unavailable');
    expect(html).toContain('siteId=unavailable-site');
  });
});
