import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { AppVersionLink } from '../components/app-changelog';
import { version } from '../package.json';
import { appChangelog } from '../lib/app-changelog';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('renders the exact accessible current-version link and preserves the canonical project target', () => {
  const html = renderToStaticMarkup(createElement(AppVersionLink, { open: () => {} }));
  expect(html).toContain(`aria-label="Version ${version}. Open changelog"`);
  expect(html).toContain('href="/?section=Changelog"');
  expect(html).toContain(`v${version}`);
  const hosting = JSON.parse(readFileSync(new URL('../.openai/hosting.json', import.meta.url), 'utf8'));
  expect(hosting.project_id).toBe('appgprj_6a91926878b48191a80d70f1681ef135');
});

it('advances the Stage 9 release and isolates its navigation and static caches', () => {
  expect(version).toBe('1.0.66');
  expect(appChangelog[0]?.version).toBe(version);
  const worker = readFileSync(new URL('../app/service-worker.ts', import.meta.url), 'utf8');
  expect(worker).toContain("cacheName:'zeustek-navigation-v14'");
  expect(worker).toContain("cacheName: 'zeustek-static-v13'");
  expect(worker).toContain("'zeustek-navigation-v14'].map(name=>caches.delete(name))");
});

it('reproduces the existing PWA timeout returning stale HTML despite a healthy newer network response', async () => {
  vi.stubGlobal('self', { location: new URL('https://zeustek-dashboard.amzeus.chatgpt.site/') });
  vi.stubEnv('NODE_ENV', 'production');
  const { NetworkFirst } = await import('workbox-strategies/NetworkFirst.js');
  vi.useFakeTimers();
  const oldShell = new Response('<main>release65, no version link</main>');
  const freshShell = new Response('<a aria-label="Version 1.0.1. Open changelog">v1.0.1</a>');
  let resolveNetwork!: (response: Response) => void;
  const network = new Promise<Response>(resolve => { resolveNetwork = resolve; });
  let cached = oldShell;
  const handler = {
    waitUntil: <T>(promise: Promise<T>) => promise,
    cacheMatch: vi.fn(async () => cached),
    fetchAndCachePut: async () => { const response = await network; cached = response; return response; },
  };
  const strategy = new NetworkFirst({ cacheName: 'zeustek-navigation-v2', networkTimeoutSeconds: 1 });
  const run = strategy as unknown as { _handle: (request: Request, handler: unknown) => Promise<Response> };
  const response = run._handle(new Request('https://zeustek-dashboard.amzeus.chatgpt.site/'), handler);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await (await response).text()).toContain('no version link');
  resolveNetwork(freshShell);
  await vi.advanceTimersByTimeAsync(1);
  expect(await cached.text()).toContain('Version 1.0.1. Open changelog');
});
