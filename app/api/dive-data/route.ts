import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { householdAreaAccess, householdCanEditGear, readHouseholdAreaUserIds, readHouseholdUserIds, allowedHouseholdUser, registerHouseholdUser } from '@/lib/server/household';

import { DIVE_RECORD_KINDS, recordIdentity } from '@/lib/record-identity';
import { OPERATOR_DELETE_CONSTRAINT, PERSON_DELETE_CONSTRAINT, operatorDeleteBindings, personDeleteBindings } from '@/lib/operators/operator-dependencies';
import {normaliseEntityRelation} from '@/lib/operators/entity-relationships';
import { PROFESSIONAL_EVIDENCE_DELETE_CONSTRAINT, professionalEvidenceDeleteBindings } from '@/lib/professional-development/evidence-dependencies';
const kinds = new Set<string>(DIVE_RECORD_KINDS);
const sortText = (value: unknown) => typeof value === 'string' ? value : '';
async function ensureSchema() {
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)',
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_dive_records_user_kind ON dive_records(user_id,kind,updated_at DESC)',
    ),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_person_entity_primary ON dive_records(user_id,json_extract(data_json,'$.personId')) WHERE kind='person-operator-link' AND deleted_at IS NULL AND json_extract(data_json,'$.active')=1 AND json_extract(data_json,'$.primary')=1"),
  ]);
}

async function renumberUserDives(userId: string, startAt: number) {
  const result = await env.DB.prepare(
    "SELECT id,data_json AS dataJson FROM dive_records WHERE user_id=? AND kind='dive' AND deleted_at IS NULL",
  ).bind(userId).all<{ id: string; dataJson: string }>();
  const dives = result.results.map((row) => ({
    id: row.id,
    data: JSON.parse(row.dataJson) as Record<string, unknown>,
  })).sort((a, b) => {
    const aKey = `${sortText(a.data.date)}T${sortText(a.data.timeIn) || '23:59'}`;
    const bKey = `${sortText(b.data.date)}T${sortText(b.data.timeIn) || '23:59'}`;
    return aKey.localeCompare(bKey) || a.id.localeCompare(b.id);
  });
  const now = Date.now();
  const updates = dives.flatMap((dive, index) => {
    const diveNumber = Math.max(1, startAt) + index;
    if (Number(dive.data.diveNumber) === diveNumber) return [];
    return [env.DB.prepare(
      'UPDATE dive_records SET data_json=?,updated_at=? WHERE id=? AND user_id=?',
    ).bind(JSON.stringify({ ...dive.data, diveNumber }), now, dive.id, userId)];
  });
  for (let index = 0; index < updates.length; index += 75)
    await env.DB.batch(updates.slice(index, index + 75));
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!allowedHouseholdUser(user)) return Response.json({ error: 'This account is not invited.' }, { status: 403 });
  const kind = new URL(request.url).searchParams.get('kind') ?? '';
  if (!kinds.has(kind))
    return Response.json({ error: 'Unsupported record type' }, { status: 400 });
  const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dive_records'").first<{ name: string }>();
  if (!table) return Response.json({ items: [] });
  const sharedGear = kind === 'equipment' || kind === 'equipment-set' || kind === 'equipment-event';
  const collaborativeAlbums = kind === 'album' || kind === 'dive-media';
  const householdIds = sharedGear ? await readHouseholdUserIds(env, user) : collaborativeAlbums ? await readHouseholdAreaUserIds(env,user,'albums') : [user.userId];
  const placeholders = householdIds.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT id,user_id AS ownerUserId,data_json AS dataJson,created_at AS createdAt,updated_at AS updatedAt FROM dive_records WHERE user_id IN (${placeholders}) AND kind=? AND deleted_at IS NULL ORDER BY updated_at DESC`,
  ).bind(...householdIds, kind).all();
  let items: Array<Record<string, unknown> & { id: string; createdAt: string; modifiedAt: string }> = result.results.map((row) => ({
    id: String(row.id),
    ...(JSON.parse(String(row.dataJson)) as Record<string, unknown>),
    ...(sharedGear || collaborativeAlbums ? { householdOwnerId: String(row.ownerUserId), householdOwnedByMe: String(row.ownerUserId) === user.userId } : {}),
    createdAt: new Date(Number(row.createdAt)).toISOString(),
    modifiedAt: new Date(Number(row.updatedAt)).toISOString(),
  }));
  if (kind === 'dive') {
    const settingsRow = await env.DB.prepare(
      "SELECT data_json AS dataJson FROM dive_records WHERE user_id=? AND kind='dashboard-settings' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1",
    ).bind(user.userId).first<{ dataJson: string }>();
    let startAt = 1;
    try {
      const settings = settingsRow ? JSON.parse(settingsRow.dataJson) as { diveNumberStart?: number } : {};
      startAt = Math.max(1, Number(settings.diveNumberStart) || 1);
    } catch {}
    const numbers = new Map(
      [...items].sort((a, b) => {
        const aKey = `${sortText(a.date)}T${sortText(a.timeIn) || '23:59'}`;
        const bKey = `${sortText(b.date)}T${sortText(b.timeIn) || '23:59'}`;
        return aKey.localeCompare(bKey) || String(a.id).localeCompare(String(b.id));
      }).map((item, index) => [item.id, startAt + index]),
    );
    items = items.map((item) => ({ ...item, diveNumber: numbers.get(item.id) }));
  }
  return Response.json({
    items,
  });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  const body = (await request.json()) as {
    id?: string;
    kind?: string;
    data?: unknown;
    localMutation?: boolean;
    baseModifiedAt?: string | null;
  };
  const kind = body.kind ?? '';
  if (!kinds.has(kind) || (body.data === null ? !body.localMutation : !body.data || typeof body.data !== 'object' || Array.isArray(body.data)))
    return Response.json({ error: 'Invalid dive record' }, { status: 400 });
  let id = body.id || crypto.randomUUID();
  let now = Date.now();
  const dataJson = JSON.stringify(body.data);
  if (dataJson.length > 200000)
    return Response.json({ error: 'Record is too large' }, { status: 413 });
  await ensureSchema();
  await registerHouseholdUser(env, user);
  const sharedGear = kind === 'equipment' || kind === 'equipment-set' || kind === 'equipment-event';
  const collaborativeAlbums = kind === 'album' || kind === 'dive-media';
  const existing = await env.DB.prepare(
    sharedGear || collaborativeAlbums ? 'SELECT id,user_id AS ownerUserId,created_at AS createdAt,updated_at AS updatedAt,deleted_at AS deletedAt,kind,data_json AS dataJson FROM dive_records WHERE id=?' : 'SELECT id,user_id AS ownerUserId,created_at AS createdAt,updated_at AS updatedAt,deleted_at AS deletedAt,kind,data_json AS dataJson FROM dive_records WHERE id=? AND user_id=?',
  ).bind(...(sharedGear || collaborativeAlbums ? [id] : [id,user.userId])).first<{ id: string; ownerUserId:string; createdAt: number;updatedAt:number;deletedAt:number|null;kind:string;dataJson:string }>();
  if (body.id && !existing && !body.localMutation)
    return Response.json({ error: 'Record not found' }, { status: 404 });
  if (existing && sharedGear && !(await householdCanEditGear(env,user,existing.ownerUserId))) return Response.json({error:'Shared gear access denied'},{status:403});
  if (existing && collaborativeAlbums && !(await householdAreaAccess(env,user,existing.ownerUserId,'albums',true))) return Response.json({error:'Shared album access denied'},{status:403});
  const ownerUserId = existing?.ownerUserId ?? user.userId;
  if(existing && existing.kind!==kind)return Response.json({error:'Record type cannot be changed.'},{status:400});
  if ((kind === 'person-operator-link' || kind === 'operator-operator-link') && body.data) {
    const relation=body.data as Record<string,unknown>;
    let identity:string;
    try{
      identity=recordIdentity(kind,relation);
      if(typeof relation.active!=='boolean'||(relation.startDate&&typeof relation.startDate!=='string')||(relation.endDate&&typeof relation.endDate!=='string')||(typeof relation.startDate==='string'&&typeof relation.endDate==='string'&&relation.endDate<relation.startDate))throw new Error('Invalid relationship status or dates.');
      if(kind==='operator-operator-link'){
        const canonical=normaliseEntityRelation(relation as unknown as Parameters<typeof normaliseEntityRelation>[0]);
        if(canonical.fromOperatorId!==relation.fromOperatorId||canonical.toOperatorId!==relation.toOperatorId||canonical.relationType!==relation.relationType)throw new Error('Use the canonical relationship direction.');
      }
    }catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid relationship.'},{status:400});}
    if(body.id&&body.id!==identity)return Response.json({error:'Relationship identity cannot be changed. Unlink and create the new association.'},{status:409});
    if(!body.id)id=identity;
    const references=kind==='person-operator-link'?
      [[relation.personId,'person'],[relation.operatorId,'operator']]:
      [[relation.fromOperatorId,'operator'],[relation.toOperatorId,'operator']];
    for(const [reference,expected] of references){
      if(typeof reference!=='string'||!reference)return Response.json({error:'Select valid relationship endpoints.'},{status:400});
      const parent=await env.DB.prepare('SELECT kind FROM dive_records WHERE id=? AND user_id=? AND deleted_at IS NULL').bind(reference,user.userId).first<{kind:string}>();
      if(parent?.kind!==expected)return Response.json({error:'A linked Person or Dive Entity is unavailable to this owner.'},{status:409});
    }
    if(kind==='person-operator-link'&&relation.active===true&&relation.primary===true){
      const primary=await env.DB.prepare("SELECT id FROM dive_records WHERE user_id=? AND kind='person-operator-link' AND deleted_at IS NULL AND id!=? AND json_extract(data_json,'$.personId')=? AND json_extract(data_json,'$.active')=1 AND json_extract(data_json,'$.primary')=1 LIMIT 1").bind(user.userId,id,relation.personId).first<{id:string}>();
      if(primary)return Response.json({error:'Unmark the existing primary affiliation before selecting another.'},{status:409});
    }
  }
  if (kind === 'equipment-event' && body.data) {
    const eventData = body.data as Record<string, unknown>;
    if (typeof eventData.equipmentId !== 'string' || !eventData.equipmentId)
      return Response.json({error:'Equipment event requires its canonical Equipment reference.'},{status:400});
    if (existing && JSON.parse(existing.dataJson).equipmentId !== eventData.equipmentId)
      return Response.json({error:'Equipment event association cannot be changed.'},{status:400});
    const parent = await env.DB.prepare("SELECT user_id AS ownerUserId FROM dive_records WHERE id=? AND kind='equipment' AND deleted_at IS NULL")
      .bind(eventData.equipmentId).first<{ownerUserId:string}>();
    if (!parent || !(await householdCanEditGear(env,user,parent.ownerUserId)))
      return Response.json({error:'Shared equipment access required for this history.'},{status:403});
  }
  now=Math.max(now,(existing?.updatedAt??0)+1);
  if (!existing && body.data) {
    const identity = recordIdentity(kind, body.data as Record<string, unknown>);
    if (identity) {
      const candidates = await env.DB.prepare('SELECT id,data_json AS dataJson FROM dive_records WHERE user_id=? AND kind=? AND deleted_at IS NULL').bind(user.userId,kind).all<{id:string;dataJson:string}>();
      const duplicate = candidates.results.find(row => recordIdentity(kind,JSON.parse(row.dataJson)) === identity);
      if (duplicate) return Response.json({error:'A matching record already exists. Review the existing record before merging.',duplicateId:duplicate.id},{status:409});
    }
  }
  if (body.localMutation) {
    if(existing && (body.data===null ? existing.deletedAt!==null : existing.deletedAt===null && existing.dataJson===dataJson))return Response.json({id,updatedAt:existing.updatedAt});
    const base = body.baseModifiedAt == null ? null : Date.parse(body.baseModifiedAt);
    if (base !== null && !Number.isFinite(base)) return Response.json({error:'Invalid base revision.'},{status:400});
    if (existing) {
      if (base === null) return Response.json({error:'This record already exists. Both versions are retained for review.'},{status:409});
      const updated = await env.DB.prepare(body.data === null
        ? 'UPDATE dive_records SET deleted_at=?,updated_at=? WHERE id=? AND user_id=? AND updated_at=?'+(kind==='operator'?OPERATOR_DELETE_CONSTRAINT:kind==='person'?PERSON_DELETE_CONSTRAINT:kind==='professional-evidence'?PROFESSIONAL_EVIDENCE_DELETE_CONSTRAINT:'')
        : 'UPDATE dive_records SET data_json=?,updated_at=?,deleted_at=NULL WHERE id=? AND user_id=? AND updated_at=?')
        .bind(body.data === null ? now : dataJson,now,id,ownerUserId,base,...(body.data===null?(kind==='operator'?operatorDeleteBindings(ownerUserId,id):kind==='person'?personDeleteBindings(ownerUserId,id):kind==='professional-evidence'?professionalEvidenceDeleteBindings(ownerUserId,id):[]):[])).run();
      if (!updated.meta.changes) return Response.json({error:body.data===null&&(kind==='operator'||kind==='person'||kind==='professional-evidence')?'This record changed or has linked records. Refresh, then unlink its dependencies before deleting. Your local change is retained for review.':'The cloud record changed on another device. Your local version is retained; review both before replacing either.'},{status:409});
    } else {
      if (base !== null) return Response.json({error:'The original cloud record is no longer accessible. Your local version is retained.'},{status:409});
      if (body.data !== null) {
        const inserted=await env.DB.prepare('INSERT OR IGNORE INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)').bind(id,user.userId,kind,dataJson,now,now).run();
        if (!inserted.meta.changes) return Response.json({error:'Record identity conflict. Local data is retained.'},{status:409});
      }
    }
    return Response.json({id,updatedAt:now});
  }

  await env.DB.prepare(
    'INSERT OR REPLACE INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)',
  )
    .bind(id, ownerUserId, kind, dataJson, existing?.createdAt ?? now, now)
    .run();
  if (kind === 'dashboard-settings') {
    const settings = body.data as { diveNumberStart?: number };
    await renumberUserDives(user.userId, Number(settings.diveNumberStart) || 1);
  }
  return Response.json(
    { id, createdAt: existing?.createdAt ?? now, updatedAt: now },
    { status: existing ? 200 : 201 },
  );
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id)
    return Response.json({ error: 'Record id required' }, { status: 400 });
  await ensureSchema();
  await registerHouseholdUser(env,user);
  const record = await env.DB.prepare('SELECT user_id AS ownerUserId,kind FROM dive_records WHERE id=?').bind(id).first<{ownerUserId:string;kind:string}>();
  const sharedGear = record?.kind === 'equipment' || record?.kind === 'equipment-set' || record?.kind === 'equipment-event';
  const collaborativeAlbums = record?.kind === 'album' || record?.kind === 'dive-media';
  if (!record || (record.ownerUserId !== user.userId && !(sharedGear && await householdCanEditGear(env,user,record.ownerUserId)) && !(collaborativeAlbums && await householdAreaAccess(env,user,record.ownerUserId,'albums',true)))) return Response.json({deleted:false},{status:404});
  const result = await env.DB.prepare('UPDATE dive_records SET deleted_at=?,updated_at=? WHERE id=?'+(record.kind==='operator'?OPERATOR_DELETE_CONSTRAINT:record.kind==='person'?PERSON_DELETE_CONSTRAINT:record.kind==='professional-evidence'?PROFESSIONAL_EVIDENCE_DELETE_CONSTRAINT:'')).bind(Date.now(),Date.now(),id,...(record.kind==='operator'?operatorDeleteBindings(record.ownerUserId,id):record.kind==='person'?personDeleteBindings(record.ownerUserId,id):record.kind==='professional-evidence'?professionalEvidenceDeleteBindings(record.ownerUserId,id):[])).run();
  if((record.kind==='operator'||record.kind==='person'||record.kind==='professional-evidence')&&!result.meta.changes)return Response.json({error:'Unlink dependent records before deleting this record.'},{status:409});
  return Response.json({ deleted: result.meta.changes > 0 });
}

