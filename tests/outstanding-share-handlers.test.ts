import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { sharingDatabase, sharingBucket } from './selected-sharing-fixture';
const state = vi.hoisted(() => ({
  db: null as unknown as D1Database,
  files: null as unknown as R2Bucket,
  user: { userId: 'fixture-owner', email: 'owner@fixture.invalid' } as {
    userId: string;
    email: string;
  } | null,
}));
vi.mock('cloudflare:workers', () => ({
  env: {
    get DB() {
      return state.db;
    },
    get FILES() {
      return state.files;
    },
  },
}));
vi.mock('../app/chatgpt-auth', () => ({
  getChatGPTUser: async () => state.user,
}));
vi.mock('../lib/server/household', () => ({
  OWNER_EMAIL: 'owner@fixture.invalid',
  isLocalPreviewUser: () => false,
}));
import { GET as list, POST as manage } from '../app/api/share/manage/route';
import { GET as visitor } from '../app/api/share/route';
import { GET as asset, POST as upload } from '../app/api/share/asset/route';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { ensureShareSchema } from '../lib/server/share-links';
let fixture: ReturnType<typeof sharingDatabase>,
  bucket: ReturnType<typeof sharingBucket>;
const input = {
  version: 1,
  kind: 'profile',
  label: 'Dummy share',
  expiresAt: null,
  attachmentIds: [],
  profile: {
    displayName: 'Dummy diver',
    insights: [],
    certificationIds: [],
    trainingIds: [],
  },
};
const request = (value: object, origin = 'https://fixture') =>
  new Request('https://fixture/api/share/manage', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(value),
  });
const read = (token: string, path = '/api/share') =>
  new Request('https://fixture' + path, {
    headers: { authorization: 'Bearer ' + token },
  });
const preview = async (value: object = input) =>
  (await (
    await manage(request({ action: 'preview', input: value }))
  ).json()) as { snapshot: { asOf: string }; previewHash: string };
const publish = async (value: object = input) => {
  const p = await preview(value);
  return (await (
    await manage(
      request({
        action: 'create',
        input: value,
        asOf: p.snapshot.asOf,
        previewHash: p.previewHash,
      }),
    )
  ).json()) as {
    id: string;
    token: string;
    revision: number;
    snapshot: unknown;
  };
};
it('enforces the owner link bound atomically under concurrent creates without orphan publications', async () => {
  await publish();
  const seed = fixture.sqlite
    .prepare('SELECT * FROM dive_share_links LIMIT 1')
    .get() as { selection_json: string };
  const saved = fixture.sqlite
    .prepare('SELECT snapshot_json FROM dive_publications LIMIT 1')
    .get() as { snapshot_json: string };
  for (let index = 1; index < 199; index++) {
    const id = crypto.randomUUID();
    fixture.sqlite
      .prepare('INSERT INTO dive_share_links VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(
        id,
        'fixture-owner',
        'dummy-hash-' + index,
        null,
        1,
        1,
        100,
        100,
        seed.selection_json,
        crypto.randomUUID(),
      );
    fixture.sqlite
      .prepare('INSERT INTO dive_publications VALUES (?,?,?,?,?,?,?,?)')
      .run(
        'share:' + id,
        'fixture-owner',
        id,
        1,
        saved.snapshot_json,
        null,
        100,
        100,
      );
  }
  const p = await preview(),
    body = {
      action: 'create',
      input,
      asOf: p.snapshot.asOf,
      previewHash: p.previewHash,
    };
  const results = await Promise.all([
    manage(request(body)),
    manage(request(body)),
  ]);
  expect(results.map((result) => result.status).sort((a, b) => a - b)).toEqual([
    200, 409,
  ]);
  expect(
    fixture.sqlite
      .prepare('SELECT COUNT(*) AS total FROM dive_share_links')
      .get(),
  ).toEqual({ total: 200 });
  expect(
    fixture.sqlite
      .prepare('SELECT COUNT(*) AS total FROM dive_publications')
      .get(),
  ).toEqual({ total: 200 });
});
it('does not reactivate a revoked capability by replacing its snapshot and refuses oversized stored artifacts', async () => {
  const created = await publish(),
    p = await preview();
  await manage(request({ action: 'revoke', id: created.id, revision: 1 }));
  expect(
    (
      await manage(
        request({
          action: 'replace',
          id: created.id,
          revision: 2,
          input,
          asOf: p.snapshot.asOf,
          previewHash: p.previewHash,
        }),
      )
    ).status,
  ).toBe(409);
  expect((await visitor(read(created.token))).status).toBe(404);
  fixture.sqlite.prepare('UPDATE dive_share_links SET enabled=1').run();
  fixture.sqlite
    .prepare('UPDATE dive_publications SET enabled=1,snapshot_json=?')
    .run(' '.repeat(256 * 1024) + JSON.stringify(created.snapshot));
  expect((await visitor(read(created.token))).status).toBe(404);
});
beforeEach(() => {
  fixture = sharingDatabase();
  bucket = sharingBucket();
  state.db = fixture.db;
  state.files = bucket.bucket;
  state.user = { userId: 'fixture-owner', email: 'owner@fixture.invalid' };
  fixture.add('owner', 'person', {
    roles: { ownerProfile: true },
    name: 'Dummy owner',
  });
});
afterEach(() => {
  fixture.sqlite.close();
  vi.useRealTimers();
});
it('keeps anonymous reads unavailable and read-only before an explicit publication', async () => {
  const before = fixture.records();
  state.user = null;
  expect((await visitor(read('x'.repeat(43)))).status).toBe(404);
  expect(
    (await list(new Request('https://fixture/api/share/manage'))).status,
  ).toBe(401);
  expect(fixture.records()).toEqual(before);
  expect(
    fixture.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE name='dive_share_links'")
      .get(),
  ).toBeUndefined();
});
it('binds create/update to a fresh exact preview; anonymous visitors receive only the saved snapshot; listing never reveals verification material', async () => {
  const before = fixture.records();
  const p = await preview();
  expect(
    (
      await manage(
        request({
          action: 'create',
          input,
          asOf: p.snapshot.asOf,
          previewHash: 'wrong',
        }),
      )
    ).status,
  ).toBe(409);
  const created = await publish();
  expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const stored = fixture.sqlite.prepare('SELECT * FROM dive_share_links').get();
  expect(JSON.stringify(stored)).not.toContain(created.token);
  const ownerList = await (
    await list(new Request('https://fixture/api/share/manage'))
  ).json();
  expect(JSON.stringify(ownerList)).not.toMatch(
    /token_hash|"token"|object_key|fixture-owner/,
  );
  state.user = null;
  const response = await visitor(read(created.token));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  expect(await response.json()).toEqual(created.snapshot);
  expect(
    (
      await visitor(
        new Request('https://fixture/api/share?token=' + created.token),
      )
    ).status,
  ).toBe(404);
  expect(fixture.records()).toEqual(before);
});
it('atomically regenerates the capability and revokes both data and selected asset access without changing ordinary records', async () => {
  await ensureShareSchema(fixture.db);
  const assetId = crypto.randomUUID(),
    bytes = new Uint8Array([1, 2, 3]);
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
  fixture.sqlite
    .prepare('INSERT INTO dive_share_assets VALUES (?,?,?,?,?,?,?,?)')
    .run(
      assetId,
      'fixture-owner',
      'dummy-object',
      'image/png',
      'Dummy asset',
      3,
      hash,
      100,
    );
  await bucket.bucket.put('dummy-object', bytes);
  const created = await publish({ ...input, attachmentIds: [assetId] });
  state.user = null;
  expect(
    (await asset(read(created.token, '/api/share/asset?id=' + assetId))).status,
  ).toBe(200);
  expect(
    (
      await asset(
        read(created.token, '/api/share/asset?id=' + crypto.randomUUID()),
      )
    ).status,
  ).toBe(404);
  state.user = { userId: 'fixture-owner', email: 'owner@fixture.invalid' };
  const regenerated = (await (
    await manage(
      request({
        action: 'regenerate',
        id: created.id,
        revision: created.revision,
      }),
    )
  ).json()) as { token: string; revision: number };
  expect(regenerated.token).not.toBe(created.token);
  expect((await visitor(read(created.token))).status).toBe(404);
  expect((await visitor(read(regenerated.token))).status).toBe(200);
  expect(
    (
      await manage(
        request({
          action: 'regenerate',
          id: created.id,
          revision: created.revision,
        }),
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await manage(
        request({
          action: 'revoke',
          id: created.id,
          revision: regenerated.revision,
        }),
      )
    ).status,
  ).toBe(200);
  state.user = null;
  expect((await visitor(read(regenerated.token))).status).toBe(404);
  expect(
    (await asset(read(regenerated.token, '/api/share/asset?id=' + assetId)))
      .status,
  ).toBe(404);
});
it('does not grant cross-share, cross-account, unknown field or unauthorised write access', async () => {
  const created = await publish();
  state.user = { userId: 'partner', email: 'owner@fixture.invalid' };
  expect(
    (
      await manage(
        request({
          action: 'revoke',
          id: created.id,
          revision: created.revision,
        }),
      )
    ).status,
  ).toBe(404);
  expect(
    JSON.stringify(
      await (
        await list(new Request('https://fixture/api/share/manage'))
      ).json(),
    ),
  ).not.toContain(created.id);
  state.user = { userId: 'fixture-owner', email: 'owner@fixture.invalid' };
  expect(
    (
      await manage(
        request(
          { action: 'revoke', id: created.id, revision: created.revision },
          'https://evil.invalid',
        ),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await manage(
        request({
          action: 'revoke',
          id: created.id,
          revision: created.revision,
          credential: 'dummy-secret',
        }),
      )
    ).status,
  ).toBe(400);
  state.user = null;
  expect(
    (
      await manage(
        request({
          action: 'revoke',
          id: created.id,
          revision: created.revision,
        }),
      )
    ).status,
  ).toBe(401);
});
it('expires data and assets and presents invalid, expired and revoked capabilities through the same unavailable shape', async () => {
  const created = await publish({
    ...input,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  const invalid = await (await visitor(read('z'.repeat(43)))).json();
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 120000);
  const expired = await visitor(read(created.token));
  expect(expired.status).toBe(404);
  expect(await expired.json()).toEqual(invalid);
});
it('does not silently update a published snapshot from later private evidence, and detects stale explicit updates', async () => {
  fixture.add('d1', 'dive', { site: 'Private', maxDepthM: 10 });
  const selected = {
    ...input,
    profile: { ...input.profile, insights: ['totalDives'] },
  };
  const created = await publish(selected),
    before = await (await visitor(read(created.token))).json();
  const p = await preview(selected);
  fixture.add('d2', 'dive', { site: 'Another private', maxDepthM: 20 });
  expect(await (await visitor(read(created.token))).json()).toEqual(before);
  expect(
    (
      await manage(
        request({
          action: 'replace',
          id: created.id,
          revision: created.revision,
          input: selected,
          asOf: p.snapshot.asOf,
          previewHash: p.previewHash,
        }),
      )
    ).status,
  ).toBe(409);
  const next = await preview(selected);
  expect(
    (
      await manage(
        request({
          action: 'replace',
          id: created.id,
          revision: created.revision,
          input: selected,
          asOf: next.snapshot.asOf,
          previewHash: next.previewHash,
        }),
      )
    ).status,
  ).toBe(200);
  expect(
    JSON.stringify(await (await visitor(read(created.token))).json()),
  ).toContain('"value":2');
});
it('enforces bounded per-share anonymous reads without collecting visitor identifiers', async () => {
  const created = await publish();
  for (let i = 0; i < 50; i++)
    expect((await visitor(read(created.token))).status).toBe(200);
  const limited = await visitor(read(created.token));
  expect(limited.status).toBe(429);
  expect(limited.headers.get('retry-after')).toBe('60');
  expect(
    Object.keys(
      fixture.sqlite.prepare('SELECT * FROM dive_share_rate').get() ?? {},
    ),
  ).toEqual(['share_id', 'window_start', 'hits']);
});
it('binds a separately selected photo to prepared immutable image bytes, rejects PDF-as-photo, and blocks tampered storage', async () => {
  const bytes = readFileSync('public/brand/icons/navigation/people.png'),
    response = await upload(
      new Request('https://fixture/api/share/asset', {
        method: 'POST',
        headers: {
          origin: 'https://fixture',
          'content-type': 'image/png',
          'x-share-asset-label': 'Dummy%20photograph',
        },
        body: bytes,
      }),
    );
  expect(response.status).toBe(200);
  const prepared = (await response.json()) as { id: string };
  const selected = {
    ...input,
    profile: { ...input.profile, photoId: prepared.id },
  };
  const created = await publish(selected);
  expect(JSON.stringify(created.snapshot)).not.toMatch(
    /object_key|private\/|remoteKey/,
  );
  state.user = null;
  expect(
    (await asset(read(created.token, '/api/share/asset?id=' + prepared.id)))
      .status,
  ).toBe(200);
  const row = fixture.sqlite
    .prepare('SELECT object_key FROM dive_share_assets WHERE id=?')
    .get(prepared.id) as { object_key: string };
  await bucket.bucket.put(row.object_key, new Uint8Array([1, 2, 3]));
  expect(
    (await asset(read(created.token, '/api/share/asset?id=' + prepared.id)))
      .status,
  ).toBe(404);
  state.user = { userId: 'fixture-owner', email: 'owner@fixture.invalid' };
  fixture.sqlite
    .prepare(
      "UPDATE dive_share_assets SET content_type='application/pdf' WHERE id=?",
    )
    .run(prepared.id);
  expect(
    (await manage(request({ action: 'preview', input: selected }))).status,
  ).toBe(409);
});
it('prepares bounded static attachments privately and grants only explicit selection; unsupported input never creates an asset', async () => {
  const document = await PDFDocument.create({ updateMetadata: false }),
    page = document.addPage([420, 594]),
    font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText('Dummy approved attachment', { x: 30, y: 540, font });
  document.setAuthor('PRIVATE-AUTHOR');
  document.addJavaScript('PRIVATE-SCRIPT', 'app.alert("PRIVATE-CONTENT")');
  const bytes = await document.save({ useObjectStreams: false });
  const make = (
    body: Uint8Array,
    type = 'application/pdf',
    origin = 'https://fixture',
  ) =>
    new Request('https://fixture/api/share/asset', {
      method: 'POST',
      headers: {
        origin,
        'content-type': type,
        'x-share-asset-label': encodeURIComponent('Chosen document'),
      },
      body: new Uint8Array(body).buffer,
    });
  expect(
    (await upload(make(bytes, 'application/pdf', 'https://evil.invalid')))
      .status,
  ).toBe(403);
  const before = fixture.records();
  const response = await upload(make(bytes));
  expect(response.status).toBe(200);
  const prepared = (await response.json()) as {
    id: string;
    bytes: number;
    contentType: string;
  };
  expect(prepared.contentType).toBe('application/pdf');
  expect(prepared.bytes).toBeGreaterThan(0);
  expect(JSON.stringify(prepared)).not.toMatch(
    /object_key|PRIVATE|owner_user_id/,
  );
  expect((await upload(make(bytes))).status).toBe(200);
  expect(
    fixture.sqlite
      .prepare('SELECT COUNT(*) AS count FROM dive_share_assets')
      .get()?.count,
  ).toBe(1);
  const empty = await publish(),
    selected = await publish({ ...input, attachmentIds: [prepared.id] });
  state.user = null;
  expect(
    (await asset(read(empty.token, '/api/share/asset?id=' + prepared.id)))
      .status,
  ).toBe(404);
  const download = await asset(
    read(selected.token, '/api/share/asset?id=' + prepared.id),
  );
  expect(download.status).toBe(200);
  expect(download.headers.get('content-security-policy')).toContain('sandbox');
  expect(new TextDecoder().decode(await download.arrayBuffer())).not.toMatch(
    /PRIVATE|\/JavaScript|\/EmbeddedFiles/,
  );
  expect((await upload(make(bytes))).status).toBe(401);
  state.user = { userId: 'fixture-owner', email: 'owner@fixture.invalid' };
  const malformed = await upload(make(new Uint8Array([1, 2, 3]))),
    unsupported = await upload(make(bytes, 'text/html'));
  expect(malformed.status).toBe(400);
  expect(unsupported.status).toBe(400);
  expect(fixture.records()).toEqual(before);
});
