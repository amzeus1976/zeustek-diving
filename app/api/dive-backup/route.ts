import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { DIVE_RECORD_KINDS } from '@/lib/record-identity';

async function ensureSchema(){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)`).run();await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_dive_records_user_kind ON dive_records(user_id,kind,updated_at DESC)').run()}

export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  await ensureSchema();
  const result = await env.DB.prepare('SELECT id,kind,data_json AS dataJson,created_at AS createdAt,updated_at AS updatedAt FROM dive_records WHERE user_id=? AND deleted_at IS NULL ORDER BY kind,updated_at').bind(user.userId).all();
  return Response.json({ format: 'zeustek-dive-cloud-data', version: 1, exportedAt: new Date().toISOString(), records: result.results });
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  await ensureSchema();
  const body = await request.json() as { format?: string; version?: number; records?: Array<Record<string, unknown>> };
  if (body.format !== 'zeustek-dive-cloud-data' || body.version !== 1 || !Array.isArray(body.records)) return Response.json({ error: 'Invalid backup data' }, { status: 400 });
  if (body.records.length > 100000) return Response.json({error:'Backup exceeds the record limit.'},{status:400});
  const ids = new Set<string>();
  for (const record of body.records) {
    if (typeof record.id !== 'string' || !record.id || ids.has(record.id) || !(DIVE_RECORD_KINDS as readonly unknown[]).includes(record.kind) || typeof record.dataJson !== 'string' || record.dataJson.length > 200000) return Response.json({error:'Invalid or duplicate backup record. Nothing restored.'},{status:400});
    try { const data = JSON.parse(record.dataJson); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); } catch { return Response.json({error:'Malformed backup record. Nothing restored.'},{status:400}); }
    ids.add(record.id);
  }
  let restored = 0, skipped = 0, conflicts = 0;
  for (const record of body.records) {
    const existing = await env.DB.prepare('SELECT user_id AS owner,kind,data_json AS dataJson FROM dive_records WHERE id=?').bind(record.id).first<{owner:string;kind:string;dataJson:string}>();
    if (existing) {
      if (existing.owner === user.userId && existing.kind === record.kind && existing.dataJson === record.dataJson) skipped++;
      else conflicts++;
      continue;
    }
    const result = await env.DB.prepare('INSERT OR IGNORE INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)').bind(record.id,user.userId,record.kind,record.dataJson,Number(record.createdAt)||Date.now(),Number(record.updatedAt)||Date.now()).run();
    result.meta.changes ? restored++ : conflicts++;
  }
  return Response.json({ restored, skipped, conflicts });
}
