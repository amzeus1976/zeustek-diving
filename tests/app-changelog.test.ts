import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { appChangelog } from '../lib/app-changelog';
import { version } from '../package.json';

describe('T00 version and read-only changelog', () => {
  it('uses the existing package version and matching release entry', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(appChangelog[0].version).toBe(version);
    expect(new Set(appChangelog.map(entry => entry.version)).size).toBe(appChangelog.length);
  });
  it('provides an accessible footer deep link and in-app panel without data mutations', () => {
    const component = readFileSync(new URL('../components/app-changelog.tsx', import.meta.url), 'utf8');
    const shell = readFileSync(new URL('../app/dashboard-client.tsx', import.meta.url), 'utf8');
    expect(component).toContain('href="/?section=Changelog"');
    expect(component).toContain('aria-label=');
    expect(component).not.toMatch(/fetch\(|localStorage|saveDive|diveOperation/);
    expect(shell).toContain("go('Changelog')");
    expect(shell).toContain("active === 'Changelog'");
  });
});
