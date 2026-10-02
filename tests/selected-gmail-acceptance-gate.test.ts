import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hasGmailAcceptanceGrant,
  hasGmailManualReleaseConfiguration,
  isGmailAcceptanceRunAllowed,
  verifiedGmailManualRelease,
  type GmailReleaseEnv,
} from '../lib/server/gmail-release-policy';
import type { GmailSyncRun } from '../lib/gmail-contract';

const runId = '78f7763e-5e56-4a65-bdd8-980693118efe';
const ownerId = 'fixture-owner';
const now = Date.parse('2026-10-02T08:00:00.000Z');
const grant: GmailReleaseEnv = {
  GMAIL_ACCEPTANCE_ENABLED: 'true',
  GMAIL_ACCEPTANCE_OWNER_ID: ownerId,
  GMAIL_ACCEPTANCE_RUN_ID: runId,
  GMAIL_ACCEPTANCE_ISSUED_AT: '2026-10-02T07:30:00.000Z',
  GMAIL_ACCEPTANCE_EXPIRES_AT: '2026-10-02T08:30:00.000Z',
};
const completed: GmailSyncRun = {
  runId, status: 'completed', startedAt: '2026-10-02T07:45:00.000Z',
  completedAt: '2026-10-02T07:46:00.000Z', count: 2,
  imported: 1, updated: 0, unchanged: 1, failed: 0, hasMore: false,
};
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => vi.useRealTimers());

describe('default-disabled Gmail acceptance and manual restoration policy', () => {
  it('requires an explicit complete server grant and never treats configuration as acceptance', () => {
    expect(hasGmailAcceptanceGrant({}, ownerId, now)).toBe(false);
    expect(hasGmailAcceptanceGrant(grant, ownerId, now)).toBe(true);
    expect(hasGmailManualReleaseConfiguration(grant, ownerId)).toBe(false);
    for (const key of Object.keys(grant)) {
      const incomplete = { ...grant }; delete incomplete[key as keyof GmailReleaseEnv];
      expect(hasGmailAcceptanceGrant(incomplete, ownerId, now)).toBe(false);
    }
  });
  it('binds the new run to the authenticated owner, exact opaque ID and a bounded interval', () => {
    expect(isGmailAcceptanceRunAllowed(grant, ownerId, runId, now)).toBe(true);
    expect(isGmailAcceptanceRunAllowed(grant, 'other-owner', runId, now)).toBe(false);
    expect(isGmailAcceptanceRunAllowed(grant, ownerId, '88f7763e-5e56-4a65-bdd8-980693118efe', now)).toBe(false);
    expect(hasGmailAcceptanceGrant(grant, ownerId, now - 60 * 60_000)).toBe(false);
    expect(hasGmailAcceptanceGrant(grant, ownerId, now + 60 * 60_000)).toBe(false);
    expect(hasGmailAcceptanceGrant({ ...grant, GMAIL_ACCEPTANCE_EXPIRES_AT: '2026-10-05T08:30:00.000Z' }, ownerId, now)).toBe(false);
    expect(hasGmailAcceptanceGrant({ ...grant, GMAIL_ACCEPTANCE_ISSUED_AT: 'invalid' }, ownerId, now)).toBe(false);
  });
  it('cannot reuse the consumed historical failure, malformed IDs or truthy non-boolean grants', () => {
    expect(hasGmailAcceptanceGrant({ ...grant, GMAIL_ACCEPTANCE_RUN_ID: 'fdeda6a4-5504-49d0-881d-d1795839955b' }, ownerId, now)).toBe(false);
    expect(hasGmailAcceptanceGrant({ ...grant, GMAIL_ACCEPTANCE_RUN_ID: 'a/provider?secret=value' }, ownerId, now)).toBe(false);
    expect(hasGmailAcceptanceGrant({ ...grant, GMAIL_ACCEPTANCE_ENABLED: 'yes' }, ownerId, now)).toBe(false);
  });
  it('keeps ordinary sync unavailable without separate manual restoration consent, with no storage access', async () => {
    const read = vi.fn(async () => completed);
    expect(await verifiedGmailManualRelease(grant, ownerId, read)).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });
  it('allows manual-only restoration only against the exact successful granted run', async () => {
    const env = { ...grant, GMAIL_MANUAL_SYNC_ENABLED: 'true', GMAIL_MANUAL_SYNC_VERIFIED_RUN_ID: runId };
    const read = vi.fn(async () => completed);
    expect(await verifiedGmailManualRelease(env, ownerId, read)).toBe(true);
    expect(read).toHaveBeenCalledWith(ownerId, runId);
    expect(await verifiedGmailManualRelease(env, 'other-owner', read)).toBe(false);
    expect(hasGmailManualReleaseConfiguration({ ...env, GMAIL_MANUAL_SYNC_VERIFIED_RUN_ID: '88f7763e-5e56-4a65-bdd8-980693118efe' }, ownerId)).toBe(false);
    expect(await verifiedGmailManualRelease({ ...env, GMAIL_ACCEPTANCE_ENABLED: 'false' }, ownerId, read)).toBe(true);
  });
  it('rejects failed, running, uncertain, mistimed, diagnostic-bearing or missing acceptance evidence', async () => {
    const env = { ...grant, GMAIL_MANUAL_SYNC_ENABLED: 'true', GMAIL_MANUAL_SYNC_VERIFIED_RUN_ID: runId };
    for (const result of [null, { ...completed, status: 'failed' }, { ...completed, status: 'uncertain' },
      { ...completed, status: 'running' }, { ...completed, failed: 1 },
      { ...completed, runId: '88f7763e-5e56-4a65-bdd8-980693118efe' },
      { ...completed, startedAt: '2026-10-02T06:00:00.000Z' },
      { ...completed, completedAt: '2026-10-02T09:00:00.000Z' },
      { ...completed, completedAt: '2026-10-02T08:15:00.000Z' },
      { ...completed, completedAt: undefined }, { ...completed, diagnostic: { code: 'upstream_failure' } }]) {
      expect(await verifiedGmailManualRelease(env, ownerId, async () => result as GmailSyncRun | null)).toBe(false);
    }
  });
});

const fixture = vi.hoisted(() => ({
  env: {} as Record<string, unknown>, owner: 'fixture-owner' as string | null,
  sync: vi.fn(), manual: vi.fn(), databaseReads: 0,
}));
vi.mock('cloudflare:workers', () => ({ env: fixture.env }));
vi.mock('../app/chatgpt-auth', () => ({ getChatGPTUser: async () => fixture.owner ? { userId: fixture.owner } : null }));
vi.mock('../lib/server/gmail-news', async () => {
  const real = await vi.importActual<typeof import('../lib/server/gmail-news')>('../lib/server/gmail-news');
  return { ...real, syncGmailNews: fixture.sync, gmailManualSyncAllowed: fixture.manual };
});
import { POST } from '../app/api/gmail/sync/route';

describe('bounded Gmail acceptance route', () => {
  beforeEach(() => {
    for (const key of Object.keys(fixture.env)) delete fixture.env[key];
    fixture.owner = ownerId; fixture.databaseReads = 0;
    fixture.sync.mockReset().mockResolvedValue(completed);
    fixture.manual.mockReset().mockResolvedValue(false);
    vi.useFakeTimers(); vi.setSystemTime(now);
  });
  const request = (id = runId, origin = 'https://dive.amzeus.co.uk') => new Request('https://dive.amzeus.co.uk/api/gmail/sync', {
    method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ runId: id }),
  });
  it('remains disabled before any database/provider call when no grant exists', async () => {
    Object.defineProperty(fixture.env, 'DB', { configurable: true, get() { fixture.databaseReads++; throw new Error('PRIVATE_DB_FAILURE'); } });
    expect((await POST(request())).status).toBe(503);
    expect(fixture.databaseReads).toBe(0); expect(fixture.sync).not.toHaveBeenCalled();
    expect(fixture.manual).not.toHaveBeenCalled();
    delete fixture.env.DB;
  });
  it('requires authentication and same-origin owner intent before the authorised run', async () => {
    Object.assign(fixture.env, grant);
    fixture.owner = null; expect((await POST(request())).status).toBe(401);
    fixture.owner = ownerId; expect((await POST(request(runId, 'https://attacker.example'))).status).toBe(403);
    expect((await POST(request(runId, ''))).status).toBe(403);
    expect(fixture.sync).not.toHaveBeenCalled();
  });
  it('allows only the exact owner/run grant and preserves private no-store responses', async () => {
    Object.assign(fixture.env, grant);
    fixture.owner = 'other-owner'; expect((await POST(request())).status).toBe(503);
    fixture.owner = ownerId;
    expect((await POST(request('88f7763e-5e56-4a65-bdd8-980693118efe'))).status).toBe(503);
    const response = await POST(request());
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(fixture.sync).toHaveBeenCalledExactlyOnceWith(fixture.env, ownerId, runId);
    expect(await response.text()).not.toContain('GMAIL_ACCEPTANCE');
  });
  it('does not enable normal manual sync merely because a live gate is configured', async () => {
    Object.assign(fixture.env, grant);
    expect((await POST(request('88f7763e-5e56-4a65-bdd8-980693118efe'))).status).toBe(503);
    expect(fixture.sync).not.toHaveBeenCalled(); expect(fixture.manual).not.toHaveBeenCalled();
  });
  it('does not accept expired grants or expose unexpected private failure text', async () => {
    Object.assign(fixture.env, grant);
    vi.setSystemTime(now + 60 * 60_000);
    expect((await POST(request())).status).toBe(503); expect(fixture.sync).not.toHaveBeenCalled();
    vi.setSystemTime(now); fixture.sync.mockRejectedValue(new Error('PRIVATE_CREDENTIAL_RESPONSE'));
    const response = await POST(request()); expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('PRIVATE');
  });
  it('requires both restoration configuration and verified evidence for an ordinary manual request', async () => {
    Object.assign(fixture.env, grant, { GMAIL_MANUAL_SYNC_ENABLED: 'true', GMAIL_MANUAL_SYNC_VERIFIED_RUN_ID: runId });
    const ordinary = '88f7763e-5e56-4a65-bdd8-980693118efe';
    expect((await POST(request(ordinary))).status).toBe(503);
    expect(fixture.sync).not.toHaveBeenCalled();
    fixture.manual.mockResolvedValue(true);
    expect((await POST(request(ordinary))).status).toBe(200);
    expect(fixture.sync).toHaveBeenCalledExactlyOnceWith(fixture.env, ownerId, ordinary);
    delete fixture.env.GMAIL_MANUAL_SYNC_ENABLED;
    expect((await POST(request(ordinary))).status).toBe(503);
    expect(fixture.sync).toHaveBeenCalledTimes(1);
  });
});
