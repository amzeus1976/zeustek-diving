import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ZeusTekAssetIcon } from '../components/brand/zeustek-asset-icon';
import { ZEUSTEK_ICON_DEFINITIONS, findZeusTekIcon } from '../lib/brand/zeustek-icon-registry';
import { resolveDiscardEscapeAction } from '../lib/dialog/discard-confirmation-state';
import { buildVisibleInsightAwards, insightAwardsEmptyState } from '../lib/insights/visible-insight-awards';
import { DEFAULT_CYLINDER_COLUMNS, normaliseCylinderColumns } from '../lib/cylinders/cylinder-column-preferences';

const read = (path: string) => readFileSync(path, 'utf8');

describe('T14A shared presentation foundations', () => {
  it('uses selected awards as the inclusion list and the display choice only as a cap', () => {
    const definitions = [['dives', 'Dives'], ['depth', 'Depth'], ['rmv', 'RMV']] as const;
    expect(buildVisibleInsightAwards({ definitions, selectedAwardIds: ['rmv', 'dives'], maxAwards: 20, values: { dives: '66', rmv: '18 L/min' } })).toEqual([
      { id: 'rmv', label: 'RMV', value: '18 L/min' },
      { id: 'dives', label: 'Dives', value: '66' },
    ]);
    expect(buildVisibleInsightAwards({ definitions, selectedAwardIds: [], maxAwards: 20, values: {} })).toEqual([]);
    expect(insightAwardsEmptyState).toBe('No Insights awards selected. Choose awards in Site Configuration.');
  });

  it('keeps Escape inside the active confirmation before returning to the editor', () => {
    expect(resolveDiscardEscapeAction({ editable: true, dirty: true, confirmationOpen: true })).toBe('dismiss-confirmation');
    expect(resolveDiscardEscapeAction({ editable: true, dirty: true, confirmationOpen: false })).toBe('request-confirmation');
    expect(resolveDiscardEscapeAction({ editable: false, dirty: false, confirmationOpen: false })).toBe('close-editor');
  });

  it('maps all 131 brand icons and renders an accessible fallback', () => {
    expect(ZEUSTEK_ICON_DEFINITIONS).toHaveLength(131);
    expect(findZeusTekIcon('core-logbook-icons-dive-cylinder')?.label).toMatch(/cylinder/i);
    for (const icon of ZEUSTEK_ICON_DEFINITIONS) expect(existsSync(`public${icon.src}`), icon.src).toBe(true);
    const html = renderToStaticMarkup(createElement(ZeusTekAssetIcon, { name: 'missing-icon', label: 'Fallback gear', fallback: createElement('span', null, 'FG') }));
    expect(html).toContain('aria-label="Fallback gear"');
    expect(html).toContain('FG');
  });

  it('normalises cylinder table presentation without changing canonical records', () => {
    expect(DEFAULT_CYLINDER_COLUMNS).toEqual(['id', 'gas', 'oxygen', 'pressure', 'volume', 'analysis', 'nextTest']);
    expect(normaliseCylinderColumns(['serial', 'id', 'serial', 'not-a-column'])).toEqual(['id', 'serial']);
  });
});

describe('T14A route-level display contracts', () => {
  it('uses cyan focus and a viewport-fixed discard layer', () => {
    expect(read('app/theme-overrides.css')).toContain('--zt-focus: #00d8ff');
    const focus = read('app/focus.css');
    expect(focus).toMatch(/\.dialog-discard-backdrop\{position:fixed/);
    expect(focus).not.toContain('outline: 3px solid #fff11a');
  });

  it('removes broken Wishlist price search UI while retaining wishlist records', () => {
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).not.toContain('Wishlist price search');
    expect(dashboard).not.toContain('Check online prices');
    expect(dashboard).toContain('listGearWishlist()');
    expect(dashboard).toContain('saveGearWishlist');
  });

  it('centres Equipment media and exposes compact cylinder columns with stable IDs', () => {
    const dashboard = read('app/dashboard-client.tsx');
    const focus = read('app/focus.css');
    const cylinders = read('components/loadouts-gas.tsx');
    expect(dashboard).toContain('<MediaGallery ownerKind={ownerKind} ownerId={ownerId} accessibleViewer />');
    expect(focus).toContain('object-position:center');
    expect(cylinders).toContain('Cylinder table columns');
    expect(cylinders).toContain("item.cylinderNumber || '—'");
    expect(cylinders).not.toContain('cylinders.findIndex');
  });

  it('uses four centred award cells per desktop row and a compact Overview split', () => {
    const awards = read('components/experience-analytics.module.css');
    expect(awards).toContain('flex: 0 0 25%');
    expect(awards).toContain('justify-content: center');
    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain('overview-dashboard-layout');
    expect(dashboard).toContain('overview-dashboard-main');
  });
});
