import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { householdAreaAccess, householdCanEditGear, householdUserIds, registerHouseholdUser } from '@/lib/server/household';

const sharedGearKinds = new Set(['equipment','equipment-set','equipment-set-icon']);

async function albumAccess(user: NonNullable<Awaited<ReturnType<typeof getChatGPTUser>>>, ownerId: string, edit = false) {
  const album=await env.DB.prepare("SELECT user_id AS ownerUserId FROM dive_records WHERE id=? AND kind='album' AND deleted_at IS NULL").bind(ownerId).first<{ownerUserId:string}>();
  return album ? householdAreaAccess(env,user,album.ownerUserId,'albums',edit) : false;
}

async function schema() {
  await env.DB.batch([
    env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS dive_media (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,owner_kind TEXT NOT NULL,owner_id TEXT NOT NULL,file_name TEXT NOT NULL,object_key TEXT NOT NULL,content_type TEXT NOT NULL,caption TEXT NOT NULL,created_at INTEGER NOT NULL)',
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_dive_media_owner ON dive_media(user_id,owner_kind,owner_id,created_at DESC)',
    ),
  ]);
}
export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  await schema();
  await registerHouseholdUser(env,user);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const row = await env.DB.prepare('SELECT user_id AS ownerUserId,owner_kind AS ownerKind,owner_id AS ownerId,object_key AS objectKey,content_type AS contentType FROM dive_media WHERE id=?').bind(id).first<{ownerUserId:string;ownerKind:string;ownerId:string;objectKey:string;contentType:string}>();
    if (!row) return new Response('Not found', { status: 404 });
    if (row.ownerUserId !== user.userId && !(sharedGearKinds.has(row.ownerKind) && await householdCanEditGear(env,user,row.ownerUserId)) && !(row.ownerKind==='album' && await albumAccess(user,row.ownerId))) return new Response('Not found',{status:404});
    const object = await env.FILES.get(row.objectKey);
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(object.body, {
      headers: {
        'content-type': row.contentType,
        'cache-control': 'private, max-age=3600',
      },
    });
  }
  const kind = url.searchParams.get('kind') ?? '';
  const ownerId = url.searchParams.get('ownerId') ?? '';
  if (kind==='album' && !(await albumAccess(user,ownerId))) return Response.json({items:[]});
  const ids = sharedGearKinds.has(kind) || kind==='album' ? await householdUserIds(env,user) : [user.userId];
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(`SELECT id,file_name AS fileName,content_type AS contentType,caption,created_at AS createdAt FROM dive_media WHERE user_id IN (${placeholders}) AND owner_kind=? AND owner_id=? ORDER BY created_at DESC`).bind(...ids,kind,ownerId).all();
  return Response.json({ items: result.results });
}
export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  const form = await request.formData();
  const file = form.get('file');
  const ownerKind = String(form.get('ownerKind') ?? '');
  const ownerId = String(form.get('ownerId') ?? '');
  const caption = String(form.get('caption') ?? '');
  if (!(file instanceof File) || !ownerKind || !ownerId)
    return Response.json(
      { error: 'File and owner are required' },
      { status: 400 },
    );
  const conservationFile = ownerKind === 'conservation_activity' && ['application/pdf','text/plain'].includes(file.type);
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !conservationFile)
    return Response.json(
      { error: 'Choose an image or video' },
      { status: 415 },
    );
  if (file.size > 75 * 1024 * 1024)
    return Response.json(
      { error: 'Media must be under 75 MB' },
      { status: 413 },
    );
  await schema();
  await registerHouseholdUser(env,user);
  if (ownerKind==='album' && !(await albumAccess(user,ownerId,true))) return Response.json({error:'Shared album access denied'},{status:403});
  if (sharedGearKinds.has(ownerKind)) {
    const gear = await env.DB.prepare("SELECT user_id AS ownerUserId FROM dive_records WHERE id=? AND kind IN ('equipment','equipment-set') AND deleted_at IS NULL").bind(ownerId).first<{ownerUserId:string}>();
    if (gear && !(await householdCanEditGear(env,user,gear.ownerUserId))) return Response.json({error:'Shared gear access denied'},{status:403});
  }
  const id = crypto.randomUUID();
  const key = `dive-media/${user.userId}/${id}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await env.FILES.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });
  await env.DB.prepare(
    'INSERT INTO dive_media (id,user_id,owner_kind,owner_id,file_name,object_key,content_type,caption,created_at) VALUES (?,?,?,?,?,?,?,?,?)',
  )
    .bind(
      id,
      user.userId,
      ownerKind,
      ownerId,
      file.name,
      key,
      file.type,
      caption,
      Date.now(),
    )
    .run();
  return Response.json({ id }, { status: 201 });
}
export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  await schema();
  await registerHouseholdUser(env,user);
  const id = new URL(request.url).searchParams.get('id');
  const row = await env.DB.prepare('SELECT user_id AS ownerUserId,owner_kind AS ownerKind,owner_id AS ownerId,object_key AS objectKey FROM dive_media WHERE id=?').bind(id).first<{ownerUserId:string;ownerKind:string;ownerId:string;objectKey:string}>();
  if (!row) return Response.json({ deleted: false }, { status: 404 });
  if (row.ownerUserId !== user.userId && !(sharedGearKinds.has(row.ownerKind) && await householdCanEditGear(env,user,row.ownerUserId)) && !(row.ownerKind==='album' && await albumAccess(user,row.ownerId,true))) return Response.json({deleted:false},{status:404});
  await env.FILES.delete(row.objectKey);
  await env.DB.prepare('DELETE FROM dive_media WHERE id=?').bind(id).run();
  return Response.json({ deleted: true });
}
