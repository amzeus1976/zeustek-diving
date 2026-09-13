import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { mergeCatalogSite } from '../../../lib/catalog-merge';

type CatalogSite = Record<string, unknown> & {
  catalogId?: string;
  name?: string;
};

async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)',
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_dive_records_user_kind ON dive_records(user_id,kind,updated_at DESC)',
    ),
  ]);
}

async function stableId(userId: string, catalogId: string) {
  const bytes = new TextEncoder().encode(`${userId}\n${catalogId}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `site-${[...digest]
    .slice(0, 18)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  const body = (await request.json()) as { sites?: CatalogSite[] };
  if (!Array.isArray(body.sites) || body.sites.length > 150)
    return Response.json(
      { error: 'Send between 1 and 150 catalogue sites per batch.' },
      { status: 400 },
    );
  await ensureSchema();
  const existingResult = await env.DB.prepare(
    "SELECT id,data_json AS dataJson FROM dive_records WHERE user_id=? AND kind='site' AND deleted_at IS NULL",
  ).bind(user.userId).all<{ id: string; dataJson: string }>();
  const existingSites = new Map(
    existingResult.results.map((row) => {
      try {
        return [row.id, JSON.parse(row.dataJson) as Record<string, unknown>] as const;
      } catch {
        return [row.id, {}] as const;
      }
    }),
  );
  const now = Date.now();
  const statements = [];
  for (const site of body.sites) {
    const catalogId = String(site.catalogId ?? '');
    const name = String(site.name ?? '').trim();
    if (!catalogId || !name) continue;
    const id = await stableId(user.userId, catalogId);
    const { catalogId: _, ...incoming } = site;
    const data = mergeCatalogSite(existingSites.get(id), incoming);
    const dataJson = JSON.stringify(data);
    if (dataJson.length > 200000) continue;
    statements.push(
      env.DB.prepare(
        'INSERT INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json,updated_at=excluded.updated_at,deleted_at=NULL WHERE dive_records.user_id=excluded.user_id',
      ).bind(id, user.userId, 'site', dataJson, now, now),
    );
  }
  for (let index = 0; index < statements.length; index += 75)
    await env.DB.batch(statements.slice(index, index + 75));
  return Response.json({ imported: statements.length });
}
