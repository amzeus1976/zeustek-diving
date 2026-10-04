import { it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
vi.mock('next/server', async () => await import('vinext/shims/server'));
import { middleware, config } from '../middleware';
import { SharedSnapshotView } from '../components/sharing/shared-snapshot-view';
import {
  SHARE_NOTICE,
  SHARE_SCENARIO_BASIS,
  type SharedSnapshot,
} from '../lib/sharing/share-links';
it('applies no-store and privacy headers to both canonical and trailing-slash visitor URLs', () => {
  for (const path of ['/share', '/share/']) {
    const response = middleware(new NextRequest('https://fixture' + path));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  }
  expect(config.matcher).toContain('/share/:path*');
});
it('uses the exact selected visitor presentation with escaped text, award provenance and no implicit private navigation', () => {
  const snapshot: SharedSnapshot = {
    version: 1,
    kind: 'profile',
    label: 'Selected profile',
    asOf: '2026-10-03T12:00:00Z',
    source: 'Owner-selected canonical evidence',
    expiresAt: null,
    attachments: [],
    profile: {
      displayName: '<script>not executable</script>',
      biography: 'Owner chosen text',
      insights: [
        { key: 'totalDives', label: 'Logged Dives', value: 68, unit: 'Dives' },
      ],
      certifications: [{ title: 'Master Scuba Diver', agency: 'PADI' }],
      training: [],
    },
  };
  const html = renderToStaticMarkup(
    createElement(SharedSnapshotView, { snapshot, ownerPreview: true }),
  );
  expect(html).toContain('&lt;script&gt;not executable&lt;/script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('Master Scuba Diver');
  expect(html).toContain('Snapshot');
  expect(html).not.toMatch(
    /\?section=|dive_records|personId|certificateNumber|dashboard/,
  );
});
it('presents unavailable saved results, each supply and blocked contingency without a Ready claim', () => {
  const snapshot: SharedSnapshot = {
    version: 1,
    kind: 'gas-plan',
    label: 'Selected plan',
    asOf: '2026-10-03T12:00:00Z',
    source: 'Owner-selected canonical evidence',
    expiresAt: null,
    attachments: [],
    gasPlan: {
      modelVersion: null,
      allocationVersion: null,
      physiologicalStatus: 'Not recorded',
      recordedAt: null,
      inputs: [],
      outputs: [],
      supplies: [],
      scenarios: [
        {
          label: 'Contingency 1',
          kind: 'contingency/bailout',
          at: 'Start',
          failedSupplies: [],
          status: 'BLOCKED',
          factor: 1.2,
          basis: SHARE_SCENARIO_BASIS,
          cylinders: [
            {
              label: 'Supply 1',
              availableLitres: 1000,
              requiredLitres: 1200,
              reserveLitres: 800,
              status: 'BLOCKED',
            },
          ],
        },
      ],
      reservePhases: [],
      warnings: [],
      omittedWarnings: 1,
      notice: SHARE_NOTICE,
    },
  };
  const html = renderToStaticMarkup(
    createElement(SharedSnapshotView, { snapshot, ownerPreview: true }),
  );
  expect(html).toContain('BLOCKED');
  expect(html).toContain('1200');
  expect(html).toContain('unavailable');
  expect(html).toContain('private plan');
  expect(html).not.toContain('Ready');
});
it('keeps capability material in the fragment/header, never query/storage, and excludes every share response from persistent caches', () => {
  const client = readFileSync(
    'components/sharing/shared-link-visitor.tsx',
    'utf8',
  );
  expect(client).toContain('window.location.hash');
  expect(client).toContain('authorization');
  expect(client).toMatch(/credentials:\s*['"]omit['"]/);
  expect(client).not.toMatch(
    /localStorage|sessionStorage|searchParams\.get\(['"]token|console\./,
  );
  const worker = readFileSync('app/service-worker.ts', 'utf8');
  expect(worker).toContain('new NavigationRoute(new NetworkOnly())');
  expect(worker).toContain("url.pathname.startsWith('/api/')");
  const middleware = readFileSync('middleware.ts', 'utf8');
  expect(middleware).toContain("'/share'");
  expect(middleware).toContain("'private, no-store'");
});
