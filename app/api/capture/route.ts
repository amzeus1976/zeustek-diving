import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';

async function ensureSchema() {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS captures (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    claim_type TEXT NOT NULL DEFAULT 'observation',
    storage_policy TEXT NOT NULL DEFAULT 'cloud',
    created_at INTEGER NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_captures_user_created ON captures(user_id, created_at DESC)').run();
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  await ensureSchema();
  const result = await env.DB.prepare('SELECT id, kind, content, claim_type AS claimType, storage_policy AS storagePolicy, created_at AS createdAt FROM captures WHERE user_id = ? ORDER BY created_at DESC LIMIT 20').bind(user.userId).all();
  return Response.json({ items: result.results });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json() as { kind?: string; content?: string };
  const content = body.content?.trim();
  if (!content || content.length > 10000) return Response.json({ error: 'Enter between 1 and 10,000 characters' }, { status: 400 });
  const kind = ['journal','task','event'].includes(body.kind ?? '') ? body.kind! : 'journal';
  const record = { id: crypto.randomUUID(), kind, content, claimType: kind === 'journal' ? 'opinion' : 'observation', storagePolicy: 'cloud', createdAt: Date.now() };
  await ensureSchema();
  await env.DB.prepare('INSERT INTO captures (id, user_id, kind, content, claim_type, storage_policy, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(record.id, user.userId, record.kind, record.content, record.claimType, record.storagePolicy, record.createdAt).run();
  return Response.json(record, { status: 201 });
}
