import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { exportableCloudRows } from '@/lib/server/backup-boundary';
import { DIVE_RECORD_KINDS,recordIdentity } from '@/lib/record-identity';
import {normaliseEntityRelation} from '@/lib/operators/entity-relationships';

async function ensureSchema(){await env.DB.prepare(`CREATE TABLE IF NOT EXISTS dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)`).run();await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_dive_records_user_kind ON dive_records(user_id,kind,updated_at DESC)').run()}

export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dive_records'").first<{ name: string }>();
  if (!table) return Response.json({ format: 'zeustek-dive-cloud-data', version: 1, exportedAt: new Date().toISOString(), records: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
  const kinds = DIVE_RECORD_KINDS.map(() => '?').join(',');
  const result = await env.DB.prepare(`SELECT id,kind,data_json AS dataJson,created_at AS createdAt,updated_at AS updatedAt FROM dive_records WHERE user_id=? AND deleted_at IS NULL AND kind IN (${kinds}) ORDER BY kind,updated_at`).bind(user.userId,...DIVE_RECORD_KINDS).all();
  return Response.json({ format: 'zeustek-dive-cloud-data', version: 1, exportedAt: new Date().toISOString(), records: exportableCloudRows(result.results as Array<Record<string,unknown>&{kind:unknown}>) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  await ensureSchema();
  const body = await request.json() as { format?: string; version?: number; records?: Array<Record<string, unknown>> };
  if (body.format !== 'zeustek-dive-cloud-data' || body.version !== 1 || !Array.isArray(body.records)) return Response.json({ error: 'Invalid backup data' }, { status: 400 });
  if (body.records.length > 100000) return Response.json({error:'Backup exceeds the record limit.'},{status:400});
  // Older encrypted backups may contain this former server-only row. Restore
  // ordinary records from them, but never import connection credentials.
  const restorable = body.records.filter(record => record.kind !== 'gmail-connection-secret');
  const ids = new Set<string>();
  for (const record of restorable) {
    if (typeof record.id !== 'string' || !record.id || ids.has(record.id) || !(DIVE_RECORD_KINDS as readonly unknown[]).includes(record.kind) || typeof record.dataJson !== 'string' || record.dataJson.length > 200000) return Response.json({error:'Invalid or duplicate backup record. Nothing restored.'},{status:400});
    try { const data = JSON.parse(record.dataJson); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); } catch { return Response.json({error:'Malformed backup record. Nothing restored.'},{status:400}); }
    ids.add(record.id);
  }
  const byId=new Map(restorable.map(record=>[String(record.id),record]));
  const primaryPeople=new Set<string>();
  for(const record of restorable){
    if(record.kind!=='person-operator-link'&&record.kind!=='operator-operator-link')continue;
    const data=JSON.parse(String(record.dataJson)) as Record<string,unknown>;
    let identity:string;
    try{identity=recordIdentity(String(record.kind),data);}catch{return Response.json({error:'Invalid relationship in backup. Nothing restored.'},{status:400});}
    if(record.id!==identity)return Response.json({error:'Relationship identity mismatch. Nothing restored.'},{status:400});
    if(typeof data.active!=='boolean'||(data.startDate&&typeof data.startDate!=='string')||(data.endDate&&typeof data.endDate!=='string')||(typeof data.startDate==='string'&&typeof data.endDate==='string'&&data.endDate<data.startDate))return Response.json({error:'Invalid relationship status or dates. Nothing restored.'},{status:400});
    if(record.kind==='operator-operator-link'){
      try{const canonical=normaliseEntityRelation(data as unknown as Parameters<typeof normaliseEntityRelation>[0]);if(canonical.fromOperatorId!==data.fromOperatorId||canonical.toOperatorId!==data.toOperatorId||canonical.relationType!==data.relationType)throw new Error();}
      catch{return Response.json({error:'Noncanonical entity relationship. Nothing restored.'},{status:400});}
    }
    if(record.kind==='person-operator-link'&&data.active===true&&data.primary===true){
      const personId=String(data.personId);
      if(primaryPeople.has(personId))return Response.json({error:'Multiple active primary affiliations in backup. Nothing restored.'},{status:400});
      primaryPeople.add(personId);
      const current=await env.DB.prepare("SELECT id FROM dive_records WHERE user_id=? AND kind='person-operator-link' AND deleted_at IS NULL AND id!=? AND json_extract(data_json,'$.personId')=? AND json_extract(data_json,'$.active')=1 AND json_extract(data_json,'$.primary')=1 LIMIT 1").bind(user.userId,record.id,personId).first();
      if(current)return Response.json({error:'An active primary affiliation already exists. Nothing restored.'},{status:400});
    }
    const references=record.kind==='person-operator-link'?
      [[data.personId,'person'],[data.operatorId,'operator']]:
      [[data.fromOperatorId,'operator'],[data.toOperatorId,'operator']];
    for(const [reference,kind] of references){
      if(typeof reference!=='string'||!reference)return Response.json({error:'Invalid relationship endpoint. Nothing restored.'},{status:400});
      const included=byId.get(reference);
      if(included&&included.kind!==kind)return Response.json({error:'Relationship endpoint type mismatch. Nothing restored.'},{status:400});
      const existing=await env.DB.prepare('SELECT user_id AS owner,kind,deleted_at AS deletedAt FROM dive_records WHERE id=?').bind(reference).first<{owner:string;kind:string;deletedAt:number|null}>();
      if(existing?(existing.owner!==user.userId||existing.kind!==kind||existing.deletedAt!==null):!included)
        return Response.json({error:'Relationship endpoint is missing or belongs to another account. Nothing restored.'},{status:400});
    }
  }
  let restored = 0, skipped = 0, conflicts = 0;
  for (const record of [...restorable].sort((a,b)=>Number(a.kind==='person-operator-link'||a.kind==='operator-operator-link')-Number(b.kind==='person-operator-link'||b.kind==='operator-operator-link'))) {
    const existing = await env.DB.prepare('SELECT user_id AS owner,kind,data_json AS dataJson FROM dive_records WHERE id=?').bind(record.id).first<{owner:string;kind:string;dataJson:string}>();
    if (existing) {
      if (existing.owner === user.userId && existing.kind === record.kind && existing.dataJson === record.dataJson) skipped++;
      else conflicts++;
      continue;
    }
    const result = await env.DB.prepare('INSERT OR IGNORE INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)').bind(record.id,user.userId,record.kind,record.dataJson,Number(record.createdAt)||Date.now(),Number(record.updatedAt)||Date.now()).run();
    if (result.meta.changes) restored++; else conflicts++;
  }
  return Response.json({ restored, skipped, conflicts });
}
