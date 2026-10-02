import { DatabaseSync } from 'node:sqlite';
import {
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
  type Mock,
} from 'vitest';
import {
  finishGmailConnection,
  readGmailConnection,
  gmailConnectionStatus,
  syncGmailNews,
  gmailCallbackUri,
  gmailFailure,
  createOAuthState,
  consumeOAuthState,
} from '../lib/server/gmail-news';
import {normaliseGmailSyncRun,gmailDiagnosticEvidenceLabel,normaliseGmailDiagnosticCode} from '../lib/gmail-contract';
let sqlite: DatabaseSync;
function database() {
  const wrap = (sql: string, args: unknown[] = []) => ({
    bind: (...values: unknown[]) => wrap(sql, values),
    first: async () => sqlite.prepare(sql).get(...(args as never[])) ?? null,
    all: async () => ({
      results: sqlite.prepare(sql).all(...(args as never[])),
    }),
    run: async () => ({ meta: sqlite.prepare(sql).run(...(args as never[])) }),
  });
  return {
    prepare: (sql: string) => wrap(sql),
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      sqlite.exec('BEGIN');
      try {
        const result = [];
        for (const statement of statements) result.push(await statement.run());
        sqlite.exec('COMMIT');
        return result;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as D1Database;
}
const owner = 'fixture-owner';
const expected = 'zeustekdivenews@gmail.com';
const environment = () => ({
  DB: database(),
  GOOGLE_GMAIL_CLIENT_ID: 'fixture-client',
  GOOGLE_GMAIL_CLIENT_SECRET: 'fixture-secret',
  GMAIL_TOKEN_ENCRYPTION_KEY: 'fixture-encryption',
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
let issueRefresh = true;
let mailbox = expected;
let tokenError = '';
let refreshedValue = 'fixture-refresh';
const fixtureUrl = (input: string | URL | Request) => input instanceof Request ? input.url : String(input);
let fetcher: Mock<
  (input: string | URL | Request, init?: RequestInit) => Promise<Response>
>;
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  issueRefresh = true;
  mailbox = expected;
  tokenError = '';
  refreshedValue = 'fixture-refresh';
  fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = fixtureUrl(input);
    if (url.includes('/token'))
      return tokenError
        ? json(
            { error: tokenError, error_description: 'secret upstream value' },
            400,
          )
        : json({
            access_token: 'fixture-access',
            ...(issueRefresh ? { refresh_token: refreshedValue } : {}),
            scope: 'https://www.googleapis.com/auth/gmail.readonly',
          });
    if (url.endsWith('/profile')) return json({ emailAddress: mailbox });
    if (url.includes('/messages?'))
      return json({ messages: [{ id: 'abc123', threadId: 'thread1' }] });
    if (url.includes('/messages/'))
      return json({
        id: 'abc123',
        threadId: 'thread1',
        internalDate: '1789900000000',
        snippet: 'Fixture newsletter',
        payload: {
          headers: [
            { name: 'Subject', value: 'Fixture news' },
            { name: 'From', value: 'Diving <fixture@example.com>' },
          ],
        },
      });
    throw new Error('Unexpected fixture URL');
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  sqlite.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('T14 Gmail manual acceptance contract', () => {
  it('persists a provider-rotated refresh credential for the next manual run', async () => {
    const env = environment();
    await finishGmailConnection(
      env,
      owner,
      'code',
      gmailCallbackUri('https://dive.amzeus.co.uk'),
    );
    refreshedValue = 'fixture-rotated-refresh';
    await syncGmailNews(env, owner, 'fixture-rotation-a');
    issueRefresh = false;
    fetcher.mockClear();
    await syncGmailNews(env, owner, 'fixture-rotation-b');
    const tokenCall = fetcher.mock.calls.find(([url]) => fixtureUrl(url).includes('/token'));
    const body = tokenCall?.[0] instanceof Request
      ? new URLSearchParams(await tokenCall[0].clone().text())
      : tokenCall?.[1]?.body;
    expect(
      body instanceof URLSearchParams ? body.get('refresh_token') : null,
    ).toBe('fixture-rotated-refresh');
    expect(
      JSON.stringify(
        await gmailConnectionStatus(env, owner, 'https://dive.amzeus.co.uk'),
      ),
    ).not.toContain('fixture-rotated');
  });
  it('keeps a cached mailbox intact when message metadata fails and reports the cause', async () => {
    const env = environment();
    await finishGmailConnection(
      env,
      owner,
      'code',
      gmailCallbackUri('https://dive.amzeus.co.uk'),
    );
    await syncGmailNews(env, owner, 'fixture-initial');
    const before = sqlite
      .prepare("SELECT * FROM dive_records WHERE kind='gmail-news'")
      .all();
    const original = fetcher.getMockImplementation()!;
    fetcher.mockImplementation(async (url: string | URL | Request) =>
      fixtureUrl(url).includes('/messages/')
        ? json({ error: { errors: [{ reason: 'rateLimitExceeded' }] } }, 403)
        : original(url),
    );
    expect(
      await syncGmailNews(env, owner, 'fixture-rate-limited'),
    ).toMatchObject({ status: 'failed', diagnostic: { code: 'rate_limited' } });
    expect(
      sqlite
        .prepare("SELECT * FROM dive_records WHERE kind='gmail-news'")
        .all(),
    ).toEqual(before);
  });
  it('refuses a duplicate concurrent run before another mailbox request', async () => {
    const env = environment();
    await finishGmailConnection(
      env,
      owner,
      'code',
      gmailCallbackUri('https://dive.amzeus.co.uk'),
    );
    const original = fetcher.getMockImplementation()!;
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started: () => void = () => {};
    const running = new Promise<void>((resolve) => {
      started = resolve;
    });
    fetcher.mockImplementation(async (url: string | URL | Request) => {
      if (fixtureUrl(url).includes('/token')) {
        started();
        await held;
      }
      return original(url);
    });
    const first = syncGmailNews(env, owner, 'fixture-concurrent-a');
    await running;
    await expect(
      syncGmailNews(env, owner, 'fixture-concurrent-b'),
    ).rejects.toMatchObject({ code: 'sync_in_progress' });
    expect(
      await syncGmailNews(env, owner, 'fixture-concurrent-a'),
    ).toMatchObject({ status: 'running' });
    release();
    expect(await first).toMatchObject({ status: 'completed' });
  });
  it('reads unconnected status without database writes or provider calls', async () => {
    const status = await gmailConnectionStatus(
      environment(),
      owner,
      'https://dive.amzeus.co.uk/',
    );
    expect(status).toMatchObject({
      configured: true,
      connected: false,
      syncMode: 'disabled',
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all(),
    ).toHaveLength(0);
  });
  it('keeps encrypted refresh credentials when a valid reconnect omits replacement', async () => {
    const env = environment();
    await finishGmailConnection(
      env,
      owner,
      'fixture-code',
      gmailCallbackUri('https://dive.amzeus.co.uk'),
    );
    const before = await readGmailConnection(env, owner);
    issueRefresh = false;
    await finishGmailConnection(
      env,
      owner,
      'second-code',
      gmailCallbackUri('https://dive.amzeus.co.uk'),
    );
    const after = await readGmailConnection(env, owner);
    expect(after?.encryptedRefreshToken).toBe(before?.encryptedRefreshToken);
    expect(after?.encryptedRefreshToken).not.toContain('fixture-refresh');
    const status = JSON.stringify(
      await gmailConnectionStatus(env, owner, 'https://dive.amzeus.co.uk/'),
    );
    expect(status).not.toMatch(
      /fixture-refresh|encryptedRefreshToken|fixture-secret|fixture-access/,
    );
  });
  it('rejects another mailbox without overwriting the dedicated connection', async () => {
    const env = environment();
    await finishGmailConnection(
      env,
      owner,
      'code',
      gmailCallbackUri('https://dive.amzeus.co.uk'),
    );
    const before = await readGmailConnection(env, owner);
    mailbox = 'other@example.com';
    await expect(
      finishGmailConnection(
        env,
        owner,
        'code',
        gmailCallbackUri('https://dive.amzeus.co.uk'),
      ),
    ).rejects.toMatchObject({ code: 'wrong_account' });
    expect(await readGmailConnection(env, owner)).toEqual(before);
  });
  it('runs bounded read-only mailbox access exactly once for a repeated run ID and deduplicates subsequent runs', async () => {
    const env = environment();
    await finishGmailConnection(
      env,
      owner,
      'code',
      gmailCallbackUri('https://dive.amzeus.co.uk'),
    );
    fetcher.mockClear();
    const result = await syncGmailNews(env, owner, 'acceptance-fixture-1');
    const calls = fetcher.mock.calls.length;
    expect(result).toMatchObject({
      status: 'completed',
      count: 1,
      imported: 1,
      updated: 0,
    });
    expect(await syncGmailNews(env, owner, 'acceptance-fixture-1')).toEqual(
      result,
    );
    expect(fetcher).toHaveBeenCalledTimes(calls);
    expect(await syncGmailNews(env, owner, 'manual-fixture-2')).toMatchObject({
      imported: 0,
      updated: 0,
      unchanged: 1,
    });
    const rows = sqlite
      .prepare("SELECT id,data_json FROM dive_records WHERE kind='gmail-news'")
      .all();
    expect(rows).toHaveLength(1);
    expect(String(rows[0]?.id)).toContain(owner);
    expect(String(rows[0]?.data_json)).toContain('abc123');
    expect(
      fetcher.mock.calls.every(
        ([url]) =>
          !new URL(fixtureUrl(url)).pathname.match(/send|modify|trash|delete/),
      ),
    ).toBe(true);
  });
  it('marks revoked refresh access as reconnect required without storing upstream error text', async () => {
    const env = environment();
    await finishGmailConnection(
      env,
      owner,
      'code',
      gmailCallbackUri('https://dive.amzeus.co.uk'),
    );
    tokenError = 'invalid_grant';
    const result = await syncGmailNews(env, owner, 'revoked-fixture');
    expect(result).toMatchObject({
      status: 'failed',
      diagnostic: { code: 'reconnect_required' },
    });
    const status = await gmailConnectionStatus(
      env,
      owner,
      'https://dive.amzeus.co.uk',
    );
    expect(status.reconnectRequired).toBe(true);
    expect(JSON.stringify(status)).not.toContain('secret upstream');
  });
  it('consumes owner-bound OAuth state once and uses the canonical callback for the Sites alias', async () => {
    const env = environment();
    const state = await createOAuthState(env.GMAIL_TOKEN_ENCRYPTION_KEY, owner);
    expect(await consumeOAuthState(env, state, 'other')).toBe(false);
    expect(await consumeOAuthState(env, state, owner)).toBe(true);
    expect(await consumeOAuthState(env, state, owner)).toBe(false);
    expect(gmailCallbackUri('https://zeustek-dive.amzeus.chatgpt.site')).toBe(
      'https://dive.amzeus.co.uk/api/gmail/callback',
    );
  });
  it('distinguishes configuration, callback, consent, scope, rate and upstream errors safely', () => {
    for (const [status, reason, code] of [
      [400, 'redirect_uri_mismatch', 'callback_mismatch'],
      [400, 'access_denied', 'consent_denied'],
      [403, 'insufficientPermissions', 'insufficient_scope'],
      [403, 'rateLimitExceeded', 'rate_limited'],
      [429, '', 'rate_limited'],
      [503, '', 'upstream_failure'],
    ] as const) {
      expect(gmailFailure(status, reason).code).toBe(code);
    }
  });
});

describe('Selected Gmail bounded diagnostic stages',()=>{
 it('classifies run-table persistence failure before any provider request',async()=>{
  const env=environment();await finishGmailConnection(env,owner,'code',gmailCallbackUri('https://dive.amzeus.co.uk'));const connection=await readGmailConnection(env,owner);fetcher.mockClear();
  vi.spyOn(env.DB,'batch').mockRejectedValueOnce(new Error('PRIVATE_STORAGE_CONNECTION'));
  await expect(syncGmailNews(env,owner,'fixture-schema-failure')).rejects.toMatchObject({diagnostic:{code:'upstream_failure',evidence:{phase:'persistence',kind:'storage'}}});expect(fetcher).not.toHaveBeenCalled();expect((await readGmailConnection(env,owner))?.encryptedRefreshToken).toBe(connection?.encryptedRefreshToken);
 });
 it('does not misreport run insertion storage failure as another sync in progress',async()=>{
  const env=environment();await finishGmailConnection(env,owner,'code',gmailCallbackUri('https://dive.amzeus.co.uk'));fetcher.mockClear();const original=env.DB.prepare.bind(env.DB);
  vi.spyOn(env.DB,'prepare').mockImplementation(sql=>{const statement=original(sql);if(!sql.startsWith('INSERT INTO gmail_sync_runs'))return statement;const bound=statement.bind.bind(statement);vi.spyOn(statement,'bind').mockImplementation((...values)=>{const value=bound(...values);vi.spyOn(value,'run').mockRejectedValueOnce(new Error('PRIVATE_STORAGE_CONNECTION'));return value;});return statement;});
  await expect(syncGmailNews(env,owner,'fixture-run-insert-failure')).rejects.toMatchObject({diagnostic:{code:'upstream_failure',evidence:{phase:'persistence',kind:'storage'}}});expect(fetcher).not.toHaveBeenCalled();
 });

 it.each([
  ['token_refresh','/token'],['account_verification','/profile'],
  ['message_listing','/messages?'],['metadata_retrieval','/messages/'],
 ])('distinguishes %s HTTP failure without changing cached stories or credentials',async(phase,path)=>{
  const env=environment();await finishGmailConnection(env,owner,'code',gmailCallbackUri('https://dive.amzeus.co.uk'));
  await syncGmailNews(env,owner,'fixture-cached-before');const before=sqlite.prepare("SELECT * FROM dive_records WHERE kind='gmail-news'").all();const connection=await readGmailConnection(env,owner);issueRefresh=false;
  const original=fetcher.getMockImplementation()!;fetcher.mockImplementation(async url=>fixtureUrl(url).includes(path)?json({error:'PRIVATE_UPSTREAM_CONTENT'},503):original(url));
  const result=await syncGmailNews(env,owner,'fixture-phase-'+phase.replaceAll('_','-'));
  expect(result).toMatchObject({status:'failed',diagnostic:{code:'upstream_failure',evidence:{version:2,phase,kind:'http',requestStage:'response_body',httpStatus:503}}});
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE|fixture-secret|fixture-access|fixture-refresh/);
  expect(sqlite.prepare("SELECT * FROM dive_records WHERE kind='gmail-news'").all()).toEqual(before);
  expect((await readGmailConnection(env,owner))?.encryptedRefreshToken).toBe(connection?.encryptedRefreshToken);
 });
 it('distinguishes transport failure at its operation without raw network errors',async()=>{
  const env=environment();await finishGmailConnection(env,owner,'code',gmailCallbackUri('https://dive.amzeus.co.uk'));
  fetcher.mockRejectedValue(new TypeError('PRIVATE_NETWORK_URL_BEARER_CONTENT'));
  const result=await syncGmailNews(env,owner,'fixture-network-failure');expect(result).toMatchObject({status:'failed',diagnostic:{evidence:{phase:'token_refresh',kind:'transport'}}});expect(JSON.stringify(result)).not.toContain('PRIVATE');
 });
 it('distinguishes JSON parsing from HTTP and transport failure',async()=>{
  const env=environment();await finishGmailConnection(env,owner,'code',gmailCallbackUri('https://dive.amzeus.co.uk'));
  const original=fetcher.getMockImplementation()!;fetcher.mockImplementation(async url=>fixtureUrl(url).includes('/messages/')?new Response('PRIVATE_MALFORMED_CONTENT',{status:200}):original(url));
  const result=await syncGmailNews(env,owner,'fixture-json-failure');expect(result).toMatchObject({status:'failed',diagnostic:{evidence:{phase:'metadata_retrieval',kind:'parsing',httpStatus:200}}});expect(JSON.stringify(result)).not.toContain('PRIVATE');
 });
 it('rejects malformed metadata before any newsletter persistence',async()=>{
  const env=environment();await finishGmailConnection(env,owner,'code',gmailCallbackUri('https://dive.amzeus.co.uk'));
  const original=fetcher.getMockImplementation()!;fetcher.mockImplementation(async url=>fixtureUrl(url).includes('/messages/')?json({id:'abc123',threadId:'thread1',payload:{headers:'PRIVATE_INVALID_HEADERS'}}):original(url));
  const result=await syncGmailNews(env,owner,'fixture-invalid-payload');expect(result).toMatchObject({status:'failed',diagnostic:{evidence:{phase:'parsing',kind:'validation'}}});expect(sqlite.prepare("SELECT * FROM dive_records WHERE kind='gmail-news'").all()).toHaveLength(0);expect(JSON.stringify(result)).not.toContain('PRIVATE');
 });
 it('records a persistence failure as uncertain and prevents another live operation',async()=>{
  const env=environment();await finishGmailConnection(env,owner,'code',gmailCallbackUri('https://dive.amzeus.co.uk'));
  const original=env.DB.batch.bind(env.DB);let batch=0;vi.spyOn(env.DB,'batch').mockImplementation(async statements=>{if(++batch===2)throw new Error('PRIVATE_DATABASE_CONNECTION');return original(statements);});
  const result=await syncGmailNews(env,owner,'fixture-persistence-failure');expect(result).toMatchObject({status:'uncertain',diagnostic:{code:'uncertain_outcome',evidence:{phase:'persistence',kind:'storage'}}});expect(sqlite.prepare("SELECT * FROM dive_records WHERE kind='gmail-news'").all()).toHaveLength(0);
  const calls=fetcher.mock.calls.length;expect(await syncGmailNews(env,owner,'fixture-persistence-failure')).toEqual(result);expect(fetcher).toHaveBeenCalledTimes(calls);expect(JSON.stringify(result)).not.toContain('PRIVATE');
 });
 it('redacts unknown stored diagnostic properties and does not invent a historical phase',async()=>{
  const env=environment();await finishGmailConnection(env,owner,'code',gmailCallbackUri('https://dive.amzeus.co.uk'));const connection=await readGmailConnection(env,owner);
  sqlite.prepare("UPDATE dive_records SET data_json=? WHERE kind='gmail-connection-secret'").run(JSON.stringify({...connection,diagnostic:{code:'upstream_failure',message:'PRIVATE_RAW_ERROR',remedy:'PRIVATE_SECRET',reconnect:false,token:'PRIVATE_TOKEN',evidence:{version:1,phase:'PRIVATE_URL',kind:'PRIVATE_SECRET'}}}));fetcher.mockClear();
  const status=await gmailConnectionStatus(env,owner,'https://dive.amzeus.co.uk');expect(status.diagnostic).toEqual(gmailFailure(503,''));expect(JSON.stringify(status)).not.toContain('PRIVATE');expect(fetcher).not.toHaveBeenCalled();
 });
});

describe('Gmail request lifecycle diagnostics', () => {
  async function connectedFixture() {
    const env = environment();
    await finishGmailConnection(env, owner, 'code', gmailCallbackUri('https://dive.amzeus.co.uk'));
    const connection = await readGmailConnection(env, owner);
    fetcher.mockClear();
    return { env, connection };
  }

  it('records timeout signal setup failure before fetch and preserves credentials', async () => {
    const { env, connection } = await connectedFixture();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => { throw new TypeError('PRIVATE_TIMEOUT_SETUP'); });
    const result = await syncGmailNews(env, owner, 'fixture-signal-setup');
    expect(result).toMatchObject({ status: 'failed', diagnostic: { code: 'upstream_failure', evidence: { version: 2, phase: 'token_refresh', kind: 'validation', requestStage: 'request_setup' } } });
    expect(fetcher).not.toHaveBeenCalled();
    expect((await readGmailConnection(env, owner))?.encryptedRefreshToken).toBe(connection?.encryptedRefreshToken);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it('records Request construction failure before fetch', async () => {
    const { env } = await connectedFixture();
    const NativeRequest = Request;
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, init); throw new TypeError('PRIVATE_REQUEST_SETUP'); }
    });
    const result = await syncGmailNews(env, owner, 'fixture-request-setup');
    expect(result).toMatchObject({ status: 'failed', diagnostic: { code: 'upstream_failure', evidence: { version: 2, kind: 'validation', requestStage: 'request_setup' } } });
    expect(fetcher).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it.each([new TypeError('PRIVATE_FETCH_DETAIL'), new DOMException('PRIVATE_ABORT_DETAIL', 'AbortError'), new Error('PRIVATE_UNKNOWN_DETAIL')])('keeps an unproven fetch rejection bounded', async (error) => {
    const { env } = await connectedFixture();
    fetcher.mockRejectedValueOnce(error);
    const result = await syncGmailNews(env, owner, 'fixture-immediate-rejection');
    expect(result).toMatchObject({ status: 'failed', diagnostic: { code: 'upstream_failure', evidence: { version: 2, phase: 'token_refresh', kind: 'transport', requestStage: 'fetch' } } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it('classifies an explicit fetch TimeoutError without inventing an HTTP response', async () => {
    const { env } = await connectedFixture();
    fetcher.mockRejectedValueOnce(new DOMException('PRIVATE_TIMEOUT', 'TimeoutError'));
    const result = await syncGmailNews(env, owner, 'fixture-fetch-timeout');
    expect(result).toMatchObject({ status: 'failed', diagnostic: { code: 'request_timeout', evidence: { version: 2, kind: 'transport', requestStage: 'fetch' } } });
    expect(result.diagnostic?.evidence).not.toHaveProperty('httpStatus');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it.each([200, 503])('classifies the owned deadline during a HTTP %i body read', async (status) => {
    const { env, connection } = await connectedFixture();
    const deadline = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    const response = new Response('fixture', { status });
    vi.spyOn(response, 'json').mockImplementation(async () => {
      deadline.abort(new DOMException('PRIVATE_BODY_REASON', 'TimeoutError'));
      throw new DOMException('PRIVATE_BODY_ABORT', 'AbortError');
    });
    fetcher.mockResolvedValueOnce(response);
    const result = await syncGmailNews(env, owner, 'fixture-body-timeout');
    expect(result).toMatchObject({ status: 'failed', diagnostic: { code: 'request_timeout', evidence: { version: 2, phase: 'token_refresh', kind: 'transport', requestStage: 'response_body', httpStatus: status } } });
    expect((await readGmailConnection(env, owner))?.encryptedRefreshToken).toBe(connection?.encryptedRefreshToken);
    const calls = fetcher.mock.calls.length;
    expect(await syncGmailNews(env, owner, 'fixture-body-timeout')).toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(calls);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it('distinguishes an unproven body transport error from malformed JSON', async () => {
    const { env } = await connectedFixture();
    const response = json({});
    vi.spyOn(response, 'json').mockRejectedValueOnce(new TypeError('PRIVATE_BODY_NETWORK'));
    fetcher.mockResolvedValueOnce(response);
    const result = await syncGmailNews(env, owner, 'fixture-body-transport');
    expect(result).toMatchObject({ diagnostic: { code: 'upstream_failure', evidence: { version: 2, kind: 'transport', requestStage: 'response_body', httpStatus: 200 } } });
    fetcher.mockResolvedValueOnce(new Response('PRIVATE_MALFORMED', { status: 200 }));
    expect(await syncGmailNews(env, owner, 'fixture-body-parsing')).toMatchObject({ diagnostic: { code: 'upstream_failure', evidence: { version: 2, kind: 'parsing', requestStage: 'response_body', httpStatus: 200 } } });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

  it('uses the retained 20-second deadline and manual redirect mode', async () => {
    const { env } = await connectedFixture();
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect(await syncGmailNews(env, owner, 'fixture-runtime-options')).toMatchObject({ status: 'completed' });
    expect(timeout.mock.calls.every(([duration]) => duration === 20_000)).toBe(true);
    expect(fetcher.mock.calls.every(([input]) => input instanceof Request && input.redirect === 'manual')).toBe(true);
  });

  it.each([301, 302, 303, 307, 308])('rejects HTTP %i redirects before reading the body or destination', async (status) => {
    const { env, connection } = await connectedFixture();
    const response = new Response('PRIVATE_REDIRECT_BODY', { status, headers: { location: 'https://private-fixture.invalid/PRIVATE_LOCATION' } });
    const jsonRead = vi.spyOn(response, 'json');
    const headerRead = vi.spyOn(response.headers, 'get');
    fetcher.mockResolvedValueOnce(response);
    const result = await syncGmailNews(env, owner, 'fixture-manual-redirect');
    expect(result).toMatchObject({ status: 'failed', diagnostic: { code: 'upstream_failure', evidence: { version: 2, kind: 'http', requestStage: 'fetch', httpStatus: status } } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(jsonRead).not.toHaveBeenCalled();
    expect(headerRead).not.toHaveBeenCalled();
    expect((await readGmailConnection(env, owner))?.encryptedRefreshToken).toBe(connection?.encryptedRefreshToken);
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });
});

describe('Gmail status projection privacy',()=>{
 it('drops unknown run fields and nested provider messages while preserving the recorded outcome',()=>{const raw={runId:'fixture-historical',status:'failed',startedAt:'2026-09-23T22:41:59.261Z',completedAt:'2026-09-23T22:41:59.612Z',count:0,imported:0,updated:0,unchanged:0,failed:1,hasMore:false,token:'PRIVATE',diagnostic:{code:'upstream_failure',message:'PRIVATE',evidence:{version:1,phase:'token_refresh',kind:'http',httpStatus:503,token:'PRIVATE'}}};const before=JSON.stringify(raw);const projected=normaliseGmailSyncRun(raw);expect(projected).toMatchObject({status:'failed',failed:1,diagnostic:{code:'upstream_failure',evidence:{phase:'token_refresh',httpStatus:503}}});expect(JSON.stringify(projected)).not.toContain('PRIVATE');expect(JSON.stringify(raw)).toBe(before);});
  it('shows a truthful historic unknown stage and a bounded new failure label',()=>{expect(gmailDiagnosticEvidenceLabel(gmailFailure(503,''))).toContain('not recorded');expect(gmailDiagnosticEvidenceLabel({...gmailFailure(503,''),evidence:{version:1,phase:'message_listing',kind:'http',httpStatus:503}})).toBe('Message listing · Provider response · HTTP 503');});
  it('preserves only safe version 2 request stages and leaves old evidence unchanged', () => {
    const original = {runId:'fixture-current-run',status:'failed',startedAt:'2026-10-02T14:56:44.569Z',failed:1,diagnostic:{code:'request_timeout',message:'PRIVATE',evidence:{version:2,phase:'token_refresh',kind:'transport',requestStage:'response_body',httpStatus:200,secret:'PRIVATE'}}};
    const before = JSON.stringify(original);
    const result = normaliseGmailSyncRun(original);
    expect(result?.diagnostic).toMatchObject({code:'request_timeout',evidence:{version:2,phase:'token_refresh',kind:'transport',requestStage:'response_body',httpStatus:200}});
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(JSON.stringify(original)).toBe(before);
    expect(gmailDiagnosticEvidenceLabel(result?.diagnostic)).toContain('Response body');
    const invalid = normaliseGmailSyncRun({...original,diagnostic:{code:'upstream_failure',evidence:{version:2,phase:'token_refresh',kind:'transport',requestStage:'PRIVATE'}}});
    expect(invalid?.diagnostic).not.toHaveProperty('evidence');
  });
  it('shares strict diagnostic code validation with the OAuth redirect consumer', () => {
    expect(normaliseGmailDiagnosticCode('request_timeout')).toBe('request_timeout');
    expect(normaliseGmailDiagnosticCode('callback_mismatch')).toBe('callback_mismatch');
    for (const unknown of ['PRIVATE_UNKNOWN', '__proto__', 'constructor', null, {code:'request_timeout'}]) expect(normaliseGmailDiagnosticCode(unknown)).toBe('upstream_failure');
  });
});
