import { describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  providerCalls: 0,
  databaseReads: 0,
}));
vi.mock('cloudflare:workers', () => ({
  env: {
    get DB() {
      fixture.databaseReads++;
      throw new Error('A disabled sync must not open the database.');
    },
  },
}));
vi.mock('../app/chatgpt-auth', () => ({
  getChatGPTUser: async () => ({ userId: 'fixture-owner' }),
}));
vi.mock('../lib/server/gmail-news', () => ({
  GmailError: class GmailError extends Error {},
  syncGmailNews: async () => {
    fixture.providerCalls++;
    throw new Error('A disabled sync must not contact Gmail.');
  },
}));

import { POST } from '../app/api/gmail/sync/route';

describe('T14 scoped-release Gmail isolation', () => {
  it('rejects an authenticated manual sync before touching the connection, database, or provider', async () => {
    const response = await POST(
      new Request('https://dive.amzeus.co.uk/api/gmail/sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId: 'fixture-disabled-run' }),
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(await response.json()).toMatchObject({
      code: 'gmail_sync_disabled',
      error: 'Gmail sync temporarily unavailable — repair deferred.',
    });
    expect(fixture.databaseReads).toBe(0);
    expect(fixture.providerCalls).toBe(0);
  });
});
