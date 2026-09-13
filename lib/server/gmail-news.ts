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
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function connectionId(userId: string) {
  return `gmail_connection:${userId}`;
}

export function gmailConfiguration(env: GmailRuntimeEnv) {
  return {
    configured: Boolean(env.GOOGLE_GMAIL_CLIENT_ID && env.GOOGLE_GMAIL_CLIENT_SECRET && env.GMAIL_TOKEN_ENCRYPTION_KEY),
    missing: [
      !env.GOOGLE_GMAIL_CLIENT_ID && 'Google client ID',
      !env.GOOGLE_GMAIL_CLIENT_SECRET && 'Google client secret',
      !env.GMAIL_TOKEN_ENCRYPTION_KEY && 'token encryption key',
    ].filter(Boolean) as string[],
  };
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function encryptToken(token: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await encryptionKey(secret), encoder.encode(token));
  return { encryptedRefreshToken: base64Url(new Uint8Array(cipher)), iv: base64Url(iv) };
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
    env.DB.prepare('CREATE TABLE IF NOT EXISTS dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_dive_records_user_kind ON dive_records(user_id,kind,updated_at DESC)'),
  ]);
}

export async function readGmailConnection(env: GmailRuntimeEnv, userId: string) {
  await ensureDiveRecords(env);
  const row = await env.DB.prepare(
    'SELECT data_json AS dataJson FROM dive_records WHERE id=? AND user_id=? AND kind=? AND deleted_at IS NULL',
  ).bind(connectionId(userId), userId, CONNECTION_KIND).first<{ dataJson: string }>();
  if (!row) return null;
  try { return JSON.parse(row.dataJson) as GmailConnection; } catch { return null; }
}

async function writeGmailConnection(env: GmailRuntimeEnv, userId: string, connection: GmailConnection) {
  await ensureDiveRecords(env);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at,deleted_at=NULL',
  ).bind(connectionId(userId), userId, CONNECTION_KIND, JSON.stringify(connection), now, now).run();
}

export async function removeGmailConnection(env: GmailRuntimeEnv, userId: string) {
  await ensureDiveRecords(env);
  await env.DB.prepare('UPDATE dive_records SET deleted_at=?,updated_at=? WHERE id=? AND user_id=? AND kind=?')
    .bind(Date.now(), Date.now(), connectionId(userId), userId, CONNECTION_KIND).run();
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

export async function createOAuthState(secret: string, userId: string) {
  const payload = base64Url(encoder.encode(JSON.stringify({ userId, expiresAt: Date.now() + 10 * 60_000, nonce: crypto.randomUUID() })));
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifyOAuthState(secret: string, state: string, expectedUserId: string) {
  const [payload, signature] = state.split('.');
  if (!payload || !signature || await hmac(secret, payload) !== signature) return false;
  try {
    const decoded = JSON.parse(decoder.decode(fromBase64Url(payload))) as { userId: string; expiresAt: number };
    return decoded.userId === expectedUserId && decoded.expiresAt > Date.now();
  } catch { return false; }
}

export function gmailAuthorizationUrl(env: GmailRuntimeEnv, redirectUri: string, state: string, loginHint?: string) {
  const parameters = new URLSearchParams({
    client_id: env.GOOGLE_GMAIL_CLIENT_ID ?? '', redirect_uri: redirectUri, response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly', access_type: 'offline',
    include_granted_scopes: 'true', prompt: 'consent', state,
  });
  if (loginHint) parameters.set('login_hint', loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${parameters}`;
}

async function tokenRequest(env: GmailRuntimeEnv, parameters: URLSearchParams) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: parameters,
  });
  const result = await response.json() as { access_token?: string; refresh_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || 'Google did not return an access token.');
  return result;
}

export async function finishGmailConnection(env: GmailRuntimeEnv, userId: string, code: string, redirectUri: string) {
  const tokens = await tokenRequest(env, new URLSearchParams({
    code, client_id: env.GOOGLE_GMAIL_CLIENT_ID ?? '', client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET ?? '',
    redirect_uri: redirectUri, grant_type: 'authorization_code',
  }));
  if (!tokens.refresh_token || !env.GMAIL_TOKEN_ENCRYPTION_KEY) throw new Error('Google did not issue offline mailbox access. Reconnect and approve access.');
  const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = await profileResponse.json() as { emailAddress?: string };
  if (!profileResponse.ok || !profile.emailAddress) throw new Error('The Gmail profile could not be read.');
  const encrypted = await encryptToken(tokens.refresh_token, env.GMAIL_TOKEN_ENCRYPTION_KEY);
  await writeGmailConnection(env, userId, { email: profile.emailAddress, ...encrypted, connectedAt: new Date().toISOString() });
  return profile.emailAddress;
}

function header(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function sourceName(from: string) {
  return from.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim() || from.split('@')[0] || 'Newsletter';
}

async function accessToken(env: GmailRuntimeEnv, connection: GmailConnection) {
  if (!env.GMAIL_TOKEN_ENCRYPTION_KEY) throw new Error('Mailbox encryption is not configured.');
  const refreshToken = await decryptToken(connection, env.GMAIL_TOKEN_ENCRYPTION_KEY);
  return (await tokenRequest(env, new URLSearchParams({
    client_id: env.GOOGLE_GMAIL_CLIENT_ID ?? '', client_secret: env.GOOGLE_GMAIL_CLIENT_SECRET ?? '',
    refresh_token: refreshToken, grant_type: 'refresh_token',
  }))).access_token as string;
}

export async function syncGmailNews(env: GmailRuntimeEnv, userId: string) {
  const connection = await readGmailConnection(env, userId);
  if (!connection) throw new Error('Connect the newsletter Gmail account first.');
  try {
    const token = await accessToken(env, connection);
    const query = new URLSearchParams({ maxResults: '100', q: 'newer_than:90d -in:spam -in:trash' });
    const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${query}`, { headers: { authorization: `Bearer ${token}` } });
    const list = await listResponse.json() as { messages?: Array<{ id: string; threadId: string }>; error?: { message?: string } };
    if (!listResponse.ok) throw new Error(list.error?.message || 'Gmail messages could not be listed.');
    const messages = list.messages ?? [];
    const items: GmailNewsItem[] = [];
    for (let index = 0; index < messages.length; index += 10) {
      const chunk = await Promise.all(messages.slice(index, index + 10).map(async (message) => {
        const details = new URLSearchParams({ format: 'metadata' });
        for (const name of ['Subject', 'From', 'Date']) details.append('metadataHeaders', name);
        const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(message.id)}?${details}`, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) return null;
        const data = await response.json() as { id: string; threadId: string; snippet?: string; internalDate?: string; payload?: { headers?: Array<{ name?: string; value?: string }> } };
        const from = header(data.payload?.headers, 'From');
        const subject = header(data.payload?.headers, 'Subject') || '(No subject)';
        const date = Number(data.internalDate) ? new Date(Number(data.internalDate)).toISOString() : new Date(header(data.payload?.headers, 'Date') || Date.now()).toISOString();
        return { gmailMessageId: data.id, threadId: data.threadId, source: sourceName(from), title: subject, link: `https://mail.google.com/mail/u/0/#inbox/${data.id}`, summary: data.snippet ?? '', publishedAt: date, from } satisfies GmailNewsItem;
      }));
      items.push(...chunk.filter((item): item is GmailNewsItem => Boolean(item)));
    }
    const now = Date.now();
    for (let index = 0; index < items.length; index += 50) {
      await env.DB.batch(items.slice(index, index + 50).map((item) => env.DB.prepare(
        'INSERT INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at,deleted_at=NULL',
      ).bind(`gmail_message:${item.gmailMessageId}`, userId, NEWS_KIND, JSON.stringify(item), now, now)));
    }
    await writeGmailConnection(env, userId, { ...connection, lastSyncAt: new Date().toISOString(), lastSyncCount: items.length, lastError: '' });
    return { count: items.length };
  } catch (error) {
    await writeGmailConnection(env, userId, { ...connection, lastError: error instanceof Error ? error.message : 'Mailbox sync failed.' });
    throw error;
  }
}
