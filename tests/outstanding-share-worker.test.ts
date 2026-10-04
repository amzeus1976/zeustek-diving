import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('vinext/server/fetch-handler', () => ({
  default: { fetch: state.fetch },
}));
import worker from '../worker';
beforeEach(() => state.fetch.mockReset());
it('protects early shared-page redirects before framework middleware without losing status or destination', async () => {
  for (const path of ['/share', '/share/', '/share/nested']) {
    state.fetch.mockResolvedValue(
      new Response(null, {
        status: 308,
        headers: { location: '/share', vary: 'RSC' },
      }),
    );
    const response = await worker.fetch(
      new Request('https://fixture' + path),
      {} as never,
      {} as never,
    );
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('/share');
    expect(response.headers.get('vary')).toBe('RSC');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  }
});
it('retains the shared response body, permissions, cookies and runtime arguments', async () => {
  const request = new Request('https://fixture/share'),
    env = { fixture: true },
    ctx = { fixtureContext: true };
  state.fetch.mockResolvedValue(
    new Response('generic unavailable', {
      status: 403,
      headers: {
        'set-cookie': 'dummy=1; HttpOnly; Secure',
        'cache-control': 'public, max-age=30',
      },
    }),
  );
  const response = await worker.fetch(request, env as never, ctx as never);
  expect(state.fetch).toHaveBeenCalledWith(request, env, ctx);
  expect(response.status).toBe(403);
  expect(await response.text()).toBe('generic unavailable');
  expect(response.headers.get('set-cookie')).toContain('dummy=1');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
it('leaves unrelated static, login, private API and navigation responses identical', async () => {
  for (const path of [
    '/',
    '/signin-with-chatgpt',
    '/api/share',
    '/brand/icons/navigation/people.png',
    '/shared-other',
  ]) {
    const expected = new Response('unchanged', {
      headers: { 'cache-control': 'public, max-age=120' },
    });
    state.fetch.mockResolvedValue(expected);
    expect(
      await worker.fetch(
        new Request('https://fixture' + path),
        {} as never,
        {} as never,
      ),
    ).toBe(expected);
  }
});
it('registers the bounded application wrapper in the existing Worker build', () => {
  expect(readFileSync('vite.config.ts', 'utf8')).toContain(
    "main: './worker.ts'",
  );
});
