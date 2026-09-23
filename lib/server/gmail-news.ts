import {
  GMAIL_READ_SCOPE,
  NEWS_MAILBOX,
  gmailDiagnostic,
  type GmailDiagnosticCode,
  type GmailDiagnostic,
  type GmailSyncRun,
  type GmailConnectionStatus,
} from '../gmail-contract';
type GmailRuntimeEnv = {
  DB: D1Database;
  GOOGLE_GMAIL_CLIENT_ID?: string;
  GOOGLE_GMAIL_CLIENT_SECRET?: string;
  GMAIL_TOKEN_ENCRYPTION_KEY?: string;
};

type GmailConnection = {
  email: string;
  encryptedRefreshToken: string;
  iv: string;
  connectedAt: string;
  lastSyncAt?: string;
  lastSyncCount?: number;
  lastError?: string;
  diagnostic?: GmailDiagnostic;
};

export type GmailNewsItem = {
  gmailMessageId: string;
  threadId: string;
  source: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string;
  from: string;
};

const CONNECTION_KIND = 'gmail-connection-secret';
const NEWS_KIND = 'gmail-news';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function connectionId(userId: string) {
  return `gmail_connection:${userId}`;
}

export function gmailConfiguration(env: GmailRuntimeEnv) {
  return {
    configured: Boolean(
      env.GOOGLE_GMAIL_CLIENT_ID &&
      env.GOOGLE_GMAIL_CLIENT_SECRET &&
      env.GMAIL_TOKEN_ENCRYPTION_KEY,
    ),
    missing: [
      !env.GOOGLE_GMAIL_CLIENT_ID && 'Google client ID',
      !env.GOOGLE_GMAIL_CLIENT_SECRET && 'Google client secret',
      !env.GMAIL_TOKEN_ENCRYPTION_KEY && 'token encryption key',
    ].filter(Boolean) as string[],
  };
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

async function encryptToken(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(secret),
    encoder.encode(token),
  );
  return {
    encryptedRefreshToken: base64Url(new Uint8Array(cipher)),
    iv: base64Url(iv),
  };
}

async function decryptToken(connection: GmailConnection, secret: string) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(connection.iv) },
    await encryptionKey(secret),
    fromBase64Url(connection.encryptedRefreshToken),
  );
  return decoder.decode(plain);
}

async function ensureDiveRecords(env: GmailRuntimeEnv) {
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)',
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_dive_records_user_kind ON dive_records(user_id,kind,updated_at DESC)',
    ),
  ]);
}

export async function readGmailConnection(
  env: GmailRuntimeEnv,
  userId: string,
) {
  const row = await env.DB.prepare(
    'SELECT data_json AS dataJson FROM dive_records WHERE id=? AND user_id=? AND kind=? AND deleted_at IS NULL',
  )
    .bind(connectionId(userId), userId, CONNECTION_KIND)
    .first<{ dataJson: string }>()
    .catch((error: unknown) => {
      if (String(error).includes('no such table')) return null;
      throw error;
    });
  if (!row) return null;
  try {
    return JSON.parse(row.dataJson) as GmailConnection;
  } catch {
    return null;
  }
}

async function writeGmailConnection(
  env: GmailRuntimeEnv,
  userId: string,
  connection: GmailConnection,
) {
  await ensureDiveRecords(env);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at,deleted_at=NULL',
  )
    .bind(
      connectionId(userId),
      userId,
      CONNECTION_KIND,
      JSON.stringify(connection),
      now,
      now,
    )
    .run();
}

export async function removeGmailConnection(
  env: GmailRuntimeEnv,
  userId: string,
) {
  await ensureDiveRecords(env);
  await env.DB.prepare(
    'UPDATE dive_records SET deleted_at=?,updated_at=? WHERE id=? AND user_id=? AND kind=?',
  )
    .bind(Date.now(), Date.now(), connectionId(userId), userId, CONNECTION_KIND)
    .run();
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return base64Url(
    new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(value)),
    ),
  );
}

export async function createOAuthState(secret: string, userId: string) {
  const payload = base64Url(
    encoder.encode(
      JSON.stringify({
        userId,
        expiresAt: Date.now() + 10 * 60_000,
        nonce: crypto.randomUUID(),
      }),
    ),
  );
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyOAuthState(
  secret: string,
  state: string,
  expectedUserId: string,
) {
  try {
    const parts = state.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    if (
      !(await crypto.subtle.verify(
        'HMAC',
        key,
        fromBase64Url(parts[1]),
        encoder.encode(parts[0]),
      ))
    )
      return false;
    const decoded = JSON.parse(decoder.decode(fromBase64Url(parts[0]))) as {
      userId: string;
      expiresAt: number;
    };
    return decoded.userId === expectedUserId && decoded.expiresAt > Date.now();
  } catch {
    return false;
  }
}

export function gmailAuthorizationUrl(
  env: GmailRuntimeEnv,
  redirectUri: string,
  state: string,
  loginHint?: string,
) {
  const parameters = new URLSearchParams({
    client_id: env.GOOGLE_GMAIL_CLIENT_ID ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  if (loginHint) parameters.set('login_hint', loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${parameters}`;
}

export class GmailError extends Error {
  readonly diagnostic: GmailDiagnostic;
  constructor(readonly code: GmailDiagnosticCode) {
    const diagnostic = gmailDiagnostic(code);
    super(diagnostic.message);
    this.diagnostic = diagnostic;
  }
}
export function gmailFailure(status: number, reason: string): GmailDiagnostic {
  const code: GmailDiagnosticCode =
    reason === 'redirect_uri_mismatch'
      ? 'callback_mismatch'
      : reason === 'access_denied'
        ? 'consent_denied'
        : reason === 'invalid_grant' || status === 401
          ? 'reconnect_required'
          : reason === 'invalid_client'
            ? 'missing_configuration'
            : status === 429 ||
                /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|dailyLimitExceeded/.test(
                  reason,
                )
              ? 'rate_limited'
              : status === 403
                ? 'insufficient_scope'
                : status === 400
                  ? 'invalid_request'
                  : 'upstream_failure';
  return gmailDiagnostic(code);
}
const safeDiagnostic = (error: unknown) =>
  error instanceof GmailError
    ? error.diagnostic
    : gmailDiagnostic('upstream_failure');
export function gmailCallbackUri(requestUrl: string) {
  const url = new URL(requestUrl);
  return `${['localhost', '127.0.0.1'].includes(url.hostname) ? url.origin : 'https://dive.amzeus.co.uk'}/api/gmail/callback`;
}
async function googleJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    });
  } catch {
    throw new GmailError('upstream_failure');
  }
  const body = (await response.json().catch(() => null)) as
    | (T & {
        error?:
          | string
          | { errors?: Array<{ reason?: string }>; status?: string };
      })
    | null;
  if (!response.ok) {
    const reason =
      typeof body?.error === 'string'
        ? body.error
        : (body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? '');
    throw new GmailError(gmailFailure(response.status, reason).code);
  }
  if (!body) throw new GmailError('upstream_failure');
  return body;
}
async function tokenRequest(env: GmailRuntimeEnv, parameters: URLSearchParams) {
  if (!gmailConfiguration(env).configured)
    throw new GmailError('missing_configuration');
  const tokens = await googleJson<{
    access_token?: string;
    refresh_token?: string;
    scope?: string;
  }>('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: parameters,
  });
  if (!tokens.access_token) throw new GmailError('reconnect_required');
  if (tokens.scope && !tokens.scope.split(/\s+/).includes(GMAIL_READ_SCOPE))
    throw new GmailError('insufficient_scope');
  return { ...tokens, access_token: tokens.access_token };
}
async function verifyMailbox(token: string) {
  const profile = await googleJson<{ emailAddress?: string }>(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (profile.emailAddress?.toLowerCase() !== NEWS_MAILBOX)
    throw new GmailError('wrong_account');
  return NEWS_MAILBOX;
}
export async function finishGmailConnection(
  env: GmailRuntimeEnv,
  userId: string,
  code: string,
  redirectUri: string,
) {
  if (redirectUri !== gmailCallbackUri(redirectUri))
    throw new GmailError('callback_mismatch');
  const tokens = await tokenRequest(
    env,
    new URLSearchParams({
      code,
      client_id: env.GOOGLE_GMAIL_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  );
  const email = await verifyMailbox(tokens.access_token);
  const current = await readGmailConnection(env, userId);
  let encrypted: Pick<GmailConnection, 'encryptedRefreshToken' | 'iv'>;
  if (tokens.refresh_token)
    encrypted = await encryptToken(
      tokens.refresh_token,
      env.GMAIL_TOKEN_ENCRYPTION_KEY!,
    );
  else {
    if (!current || current.email.toLowerCase() !== email)
      throw new GmailError('reconnect_required');
    // A newly granted access token is not proof the old refresh token still works.
    const access = await accessToken(env, current);
    await verifyMailbox(access.accessToken);
    encrypted = access.credentials;
  }
  await writeGmailConnection(env, userId, {
    ...encrypted,
    email,
    connectedAt: new Date().toISOString(),
    ...(current?.lastSyncAt ? { lastSyncAt: current.lastSyncAt } : {}),
    ...(current?.lastSyncCount != null
      ? { lastSyncCount: current.lastSyncCount }
      : {}),
  });
  return email;
}
export async function consumeOAuthState(
  env: GmailRuntimeEnv,
  state: string,
  userId: string,
) {
  if (
    !(await verifyOAuthState(
      env.GMAIL_TOKEN_ENCRYPTION_KEY ?? '',
      state,
      userId,
    ))
  )
    return false;
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS gmail_oauth_consumed (state_hash TEXT PRIMARY KEY,expires INTEGER NOT NULL)',
  ).run();
  const hash = base64Url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(state)),
    ),
  );
  await env.DB.prepare('DELETE FROM gmail_oauth_consumed WHERE expires < ?')
    .bind(Date.now())
    .run();
  const result = await env.DB.prepare(
    'INSERT OR IGNORE INTO gmail_oauth_consumed(state_hash,expires) VALUES (?,?)',
  )
    .bind(hash, Date.now() + 10 * 60_000)
    .run();
  return Number(result.meta.changes) === 1;
}

function header(
  headers: Array<{ name?: string; value?: string }> | undefined,
  name: string,
) {
  return (
    headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())
      ?.value ?? ''
  );
}

function sourceName(from: string) {
  return (
    from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() ||
    from.split('@')[0] ||
    'Newsletter'
  );
}

async function accessToken(env: GmailRuntimeEnv, connection: GmailConnection) {
  if (!env.GMAIL_TOKEN_ENCRYPTION_KEY)
    throw new GmailError('missing_configuration');
  let refreshToken: string;
  try {
    refreshToken = await decryptToken(
      connection,
      env.GMAIL_TOKEN_ENCRYPTION_KEY,
    );
  } catch {
    throw new GmailError('reconnect_required');
  }
  const tokens = await tokenRequest(
    env,
    new URLSearchParams({
      client_id: env.GOOGLE_GMAIL_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  );
  const credentials = tokens.refresh_token
    ? await encryptToken(tokens.refresh_token, env.GMAIL_TOKEN_ENCRYPTION_KEY)
    : {
        encryptedRefreshToken: connection.encryptedRefreshToken,
        iv: connection.iv,
      };
  return { accessToken: tokens.access_token, credentials };
}
async function readRun(
  env: GmailRuntimeEnv,
  userId: string,
  runId?: string,
): Promise<GmailSyncRun | null> {
  const row = await env.DB.prepare(
    `SELECT result_json FROM gmail_sync_runs WHERE user_id=? ${runId ? 'AND run_id=?' : 'ORDER BY started DESC LIMIT 1'}`,
  )
    .bind(...(runId ? [userId, runId] : [userId]))
    .first<{ result_json: string }>()
    .catch((error: unknown) => {
      if (String(error).includes('no such table')) return null;
      throw error;
    });
  return row ? (JSON.parse(row.result_json) as GmailSyncRun) : null;
}
export async function gmailConnectionStatus(
  env: GmailRuntimeEnv,
  userId: string,
  requestUrl: string,
): Promise<GmailConnectionStatus> {
  const config = gmailConfiguration(env);
  const connection = await readGmailConnection(env, userId);
  const diagnostic = !config.configured
    ? gmailDiagnostic('missing_configuration')
    : connection?.email.toLowerCase() !== NEWS_MAILBOX && connection
      ? gmailDiagnostic('wrong_account')
      : (connection?.diagnostic ?? null);
  return {
    ...config,
    redirectUri: gmailCallbackUri(requestUrl),
    connected: Boolean(connection),
    email: connection?.email ?? '',
    expectedEmail: NEWS_MAILBOX,
    connectedAt: connection?.connectedAt ?? '',
    lastSyncAt: connection?.lastSyncAt ?? '',
    lastSyncCount: connection?.lastSyncCount ?? 0,
    lastError: diagnostic?.message ?? '',
    diagnostic,
    reconnectRequired: diagnostic?.reconnect ?? false,
    syncMode: 'manual',
    lastRun: await readRun(env, userId),
  };
}
export async function syncGmailNews(
  env: GmailRuntimeEnv,
  userId: string,
  runId: string,
): Promise<GmailSyncRun> {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(runId))
    throw new GmailError('invalid_request');
  if (!gmailConfiguration(env).configured)
    throw new GmailError('missing_configuration');
  const previous = await readRun(env, userId, runId);
  if (previous) return previous;
  let connection = await readGmailConnection(env, userId);
  if (!connection) throw new GmailError('reconnect_required');
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS gmail_sync_runs (user_id TEXT NOT NULL,run_id TEXT NOT NULL,status TEXT NOT NULL,started INTEGER NOT NULL,result_json TEXT NOT NULL,PRIMARY KEY(user_id,run_id))',
    ),
    env.DB.prepare(
      "CREATE UNIQUE INDEX IF NOT EXISTS gmail_sync_active ON gmail_sync_runs(user_id) WHERE status IN ('running','uncertain')",
    ),
  ]);
  const initial: GmailSyncRun = {
    runId,
    status: 'running',
    startedAt: new Date().toISOString(),
    count: 0,
    imported: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    hasMore: false,
  };
  try {
    await env.DB.prepare(
      'INSERT INTO gmail_sync_runs(user_id,run_id,status,started,result_json) VALUES (?,?,?,?,?)',
    )
      .bind(userId, runId, 'running', Date.now(), JSON.stringify(initial))
      .run();
  } catch {
    const duplicate = await readRun(env, userId, runId);
    if (duplicate) return duplicate;
    throw new GmailError('sync_in_progress');
  }
  let writing = false;
  try {
    if (connection.email.toLowerCase() !== NEWS_MAILBOX)
      throw new GmailError('wrong_account');
    const access = await accessToken(env, connection);
    const token = access.accessToken;
    await verifyMailbox(token);
    connection = { ...connection, ...access.credentials };
    const auth = { headers: { authorization: `Bearer ${token}` } };
    const query = new URLSearchParams({
      maxResults: '100',
      q: 'newer_than:90d -in:spam -in:trash',
    });
    const list = await googleJson<{
      messages?: Array<{ id: string; threadId: string }>;
      nextPageToken?: string;
    }>(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query}`,
      auth,
    );
    const messages = list.messages ?? [];
    if (messages.length > 100) throw new GmailError('upstream_failure');
    const items: GmailNewsItem[] = [];
    // Failure in any metadata batch keeps the cached mailbox intact; report a safe diagnostic.
    for (let index = 0; index < messages.length; index += 10) {
      const chunk = await Promise.all(
        messages.slice(index, index + 10).map(async (message) => {
          if (!/^[a-zA-Z0-9]+$/.test(message.id))
            throw new GmailError('upstream_failure');
          const details = new URLSearchParams({ format: 'metadata' });
          for (const name of ['Subject', 'From', 'Date'])
            details.append('metadataHeaders', name);
          const data = await googleJson<{
            id: string;
            threadId: string;
            snippet?: string;
            internalDate?: string;
            payload?: { headers?: Array<{ name?: string; value?: string }> };
          }>(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message.id)}?${details}`,
            auth,
          );
          if (data.id !== message.id) throw new GmailError('upstream_failure');
          const from = header(data.payload?.headers, 'From');
          const timestamp =
            Number(data.internalDate) ||
            Date.parse(header(data.payload?.headers, 'Date'));
          return {
            gmailMessageId: data.id,
            threadId: data.threadId,
            source: sourceName(from),
            title: header(data.payload?.headers, 'Subject') || '(No subject)',
            link: `https://mail.google.com/mail/u/0/#inbox/${data.id}`,
            summary: data.snippet ?? '',
            publishedAt: Number.isFinite(timestamp)
              ? new Date(timestamp).toISOString()
              : '',
            from,
          } satisfies GmailNewsItem;
        }),
      );
      items.push(...chunk);
    }
    const result: GmailSyncRun = {
      ...initial,
      status: 'completed',
      completedAt: new Date().toISOString(),
      count: items.length,
      hasMore: Boolean(list.nextPageToken),
    };
    const now = Date.now();
    const statements: D1PreparedStatement[] = [];
    for (const item of items) {
      // Retain legacy IDs only for this owner's matching mailbox record. Other owners cannot collide.
      const existing = await env.DB.prepare(
        'SELECT id,data_json,deleted_at FROM dive_records WHERE user_id=? AND kind=? AND (id=? OR id=?)',
      )
        .bind(
          userId,
          NEWS_KIND,
          `gmail_message:${userId}:${item.gmailMessageId}`,
          `gmail_message:${item.gmailMessageId}`,
        )
        .first<{ id: string; data_json: string; deleted_at: number | null }>();
      const payload = JSON.stringify(item);
      if (existing?.data_json === payload && existing.deleted_at === null) {
        result.unchanged++;
        continue;
      }
      if (existing) result.updated++;
      else result.imported++;
      statements.push(
        env.DB.prepare(
          'INSERT INTO dive_records(id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at,deleted_at=NULL WHERE dive_records.user_id=excluded.user_id AND dive_records.kind=excluded.kind',
        ).bind(
          existing?.id ?? `gmail_message:${userId}:${item.gmailMessageId}`,
          userId,
          NEWS_KIND,
          payload,
          now,
          now,
        ),
      );
    }
    const next = {
      ...connection,
      lastSyncAt: result.completedAt!,
      lastSyncCount: items.length,
      lastError: '',
    };
    delete next.diagnostic;
    statements.push(
      env.DB.prepare(
        'UPDATE dive_records SET data_json=?,updated_at=? WHERE id=? AND user_id=? AND kind=?',
      ).bind(
        JSON.stringify(next),
        now,
        connectionId(userId),
        userId,
        CONNECTION_KIND,
      ),
    );
    statements.push(
      env.DB.prepare(
        'UPDATE gmail_sync_runs SET status=?,result_json=? WHERE user_id=? AND run_id=?',
      ).bind('completed', JSON.stringify(result), userId, runId),
    );
    writing = true;
    await env.DB.batch(statements);
    return result;
  } catch (error) {
    // A lost D1 response can follow a committed batch. Resolve its durable result first.
    const recorded = await readRun(env, userId, runId).catch(() => null);
    if (recorded?.status === 'completed') return recorded;
    const diagnostic = writing
      ? gmailDiagnostic('uncertain_outcome')
      : safeDiagnostic(error);
    const failed: GmailSyncRun = {
      ...initial,
      status: writing ? 'uncertain' : 'failed',
      completedAt: new Date().toISOString(),
      failed: 1,
      diagnostic,
    };
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE gmail_sync_runs SET status=?,result_json=? WHERE user_id=? AND run_id=?',
      ).bind(failed.status, JSON.stringify(failed), userId, runId),
      env.DB.prepare(
        'UPDATE dive_records SET data_json=?,updated_at=? WHERE id=? AND user_id=? AND kind=?',
      ).bind(
        JSON.stringify({
          ...connection,
          lastError: diagnostic.message,
          diagnostic,
        }),
        Date.now(),
        connectionId(userId),
        userId,
        CONNECTION_KIND,
      ),
    ]);
    return failed;
  }
}
