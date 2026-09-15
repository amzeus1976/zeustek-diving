import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ZEUSTEK_ICON_IDS,
  ZEUSTEK_TRANSPARENT_ICONS,
  getZeusTekIcon,
  resolveDiveIconId,
  resolvePageIconId,
  resolveZeusTekIconId,
} from '../lib/zeustek-icons';

const assetRoot = 'public/zeustek-icons/transparent';
const read = (path: string) => readFileSync(path, 'utf8');

describe('T12.2 transparent icon assets', () => {
  it('registers one unique transparent PNG for every supplied icon', () => {
    const files = readdirSync(assetRoot).filter((name) => name.endsWith('.png'));
    expect(ZEUSTEK_ICON_IDS).toHaveLength(131);
    expect(new Set(ZEUSTEK_ICON_IDS).size).toBe(131);
    expect(files).toHaveLength(131);

    for (const id of ZEUSTEK_ICON_IDS) {
      const path = `${assetRoot}/${id}.png`;
      const bytes = readFileSync(path);
      expect(existsSync(path), id).toBe(true);
      expect(statSync(path).size, id).toBeGreaterThan(1_000);
      expect([...bytes.subarray(1, 4)], id).toEqual([80, 78, 71]);
      expect([4, 6], `${id} must retain an alpha channel`).toContain(bytes[25]);
      expect(ZEUSTEK_TRANSPARENT_ICONS[id].src).toBe(`/zeustek-icons/transparent/${id}.png`);
    }
  });

  it('does not ship the large source sheets in the runtime asset folder', () => {
    expect(readdirSync('public/zeustek-icons')).toEqual(['transparent']);
    expect(existsSync('public/zeustek-icons/sources')).toBe(false);
  });

  it('resolves high-value page, dive, site, equipment and training semantics with safe fallbacks', () => {
    expect(resolvePageIconId('Dive Planning Centre')).toBe('dive-plan');
    expect(resolvePageIconId('Dive Computer Imports')).toBe('dive-computer');
    expect(resolveZeusTekIconId('Advanced Open Water Diver')).toBe('advanced-open-water');
    expect(resolveZeusTekIconId('North Sea wreck')).toBe('wreck-diver');
    expect(resolveZeusTekIconId('Twinset technical loadout')).toBe('twinset');
    expect(resolveDiveIconId({ source: 'Oceanic+ UDDF import' })).toBe('imported-log');
    expect(resolveDiveIconId({ source: 'manual', diveMode: 'technical-training' })).toBe('technical-diving');
    expect(getZeusTekIcon('not-a-real-icon')).toBeUndefined();
  });

  it('integrates the icon component without replacing accessible text or canonical data flows', () => {
    const dashboard = read('app/dashboard-client.tsx');
    const icon = read('components/zeustek-icon.tsx');
    expect(dashboard).toContain('resolvePageIconId(title)');
    expect(dashboard).toContain('resolveDiveIconId(dive)');
    expect(dashboard).toContain('resolveZeusTekIconId(item.certification');
    expect(icon).toContain("alt={label ?? ''}");
    expect(icon).toContain('aria-hidden={label ? undefined : true}');
    expect(dashboard).toContain('saveDive(');
  });
});
