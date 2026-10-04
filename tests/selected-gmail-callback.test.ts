import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gmailDiagnostic, normaliseGmailDiagnosticCode } from '../lib/gmail-contract';

const fixture = vi.hoisted(() => ({ error: 'timeout' }));
vi.mock('cloudflare:workers', () => ({ env: {} }));
vi.mock('../app/chatgpt-auth', () => ({ getChatGPTUser: async () => ({ userId: 'fixture-owner' }) }));
vi.mock('../lib/server/gmail-news', async () => {
  const real = await vi.importActual<typeof import('../lib/server/gmail-news')>('../lib/server/gmail-news');
  return {
    ...real,
    gmailConfiguration: () => ({ configured: true, missing: [] }),
    consumeOAuthState: async () => true,
    finishGmailConnection: async () => {
      if (fixture.error === 'timeout') throw new real.GmailError('request_timeout', { version: 2, phase: 'token_exchange', kind: 'transport', requestStage: 'response_body', httpStatus: 200 });
      throw new Error('PRIVATE_CALLBACK_EXCEPTION');
    },
  };
});
import { GET } from '../app/api/gmail/callback/route';

beforeEach(() => { fixture.error = 'timeout'; });
describe('Gmail OAuth callback diagnostics', () => {
  it('preserves a timeout code through the redirect and the shared display validator', async () => {
    const response = await GET(new Request('https://dive.amzeus.co.uk/api/gmail/callback?code=fixture-code&state=fixture-state'));
    expect(response.status).toBe(302);
    const destination = new URL(response.headers.get('location')!);
    expect(destination.searchParams.get('gmailError')).toBe('request_timeout');
    const diagnostic = gmailDiagnostic(normaliseGmailDiagnosticCode(destination.searchParams.get('gmailError')));
    expect(diagnostic.code).toBe('request_timeout');
    expect(diagnostic.message).toBe('The mailbox request exceeded its time limit.');
    expect(destination.searchParams.has('httpStatus')).toBe(false);
    expect(destination.searchParams.has('requestStage')).toBe(false);
  });

  it('projects an unexpected callback exception into a fixed safe redirect code', async () => {
    fixture.error = 'unknown';
    const response = await GET(new Request('https://dive.amzeus.co.uk/api/gmail/callback?code=fixture-code&state=fixture-state'));
    const location = response.headers.get('location')!;
    expect(new URL(location).searchParams.get('gmailError')).toBe('upstream_failure');
    expect(location).not.toContain('PRIVATE');
  });
});
