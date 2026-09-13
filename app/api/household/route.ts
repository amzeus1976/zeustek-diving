import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { HOUSEHOLD_ID, SHARE_AREAS, registerHouseholdUser } from '@/lib/server/household';

const areaKinds: Record<string, string[]> = {
  dives: ['dive'], training: ['certification','training-progress'], plans: ['trip'],
  'bucket-list': ['bucket-list'], wishlist: ['gear-wishlist'], news: ['news-article','news-preferences','gmail-news'],
  albums: ['album','dive-media'], people: ['person'],
};
const copyableKindArea: Record<string,string> = {
  dive:'dives', trip:'plans', 'bucket-list':'bucket-list', 'gear-wishlist':'wishlist',
  'news-article':'news', person:'people',
};

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  try { await registerHouseholdUser(env, user); } catch { return Response.json({error:'This account is not invited.'},{status:403}); }
  const members = await env.DB.prepare('SELECT user_id AS userId,email,display_name AS displayName,role,joined_at AS joinedAt FROM dive_household_members WHERE household_id=? ORDER BY role DESC').bind(HOUSEHOLD_ID).all();
  const shares = await env.DB.prepare('SELECT area,can_view AS canView,can_edit AS canEdit FROM dive_household_shares WHERE household_id=? AND owner_user_id=?').bind(HOUSEHOLD_ID,user.userId).all();
  const partner = members.results.find((item) => String(item.userId ?? '') !== user.userId) as {userId?:string;email?:string;displayName?:string}|undefined;
  let shared: Array<Record<string,unknown>> = [];
  if (partner?.userId) {
    const permitted = await env.DB.prepare('SELECT area FROM dive_household_shares WHERE household_id=? AND owner_user_id=? AND can_view=1').bind(HOUSEHOLD_ID,partner.userId).all<{area:string}>();
    const kinds = [...new Set(permitted.results.flatMap((row) => areaKinds[row.area] ?? []))];
    if (kinds.length) {
      const placeholders = kinds.map(() => '?').join(',');
      const records = await env.DB.prepare(`SELECT id,kind,data_json AS dataJson,updated_at AS updatedAt FROM dive_records WHERE user_id=? AND kind IN (${placeholders}) AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 500`).bind(partner.userId,...kinds).all<{id:string;kind:string;dataJson:string;updatedAt:number}>();
      shared = records.results.map((row) => ({ id:row.id,kind:row.kind,...JSON.parse(row.dataJson),modifiedAt:new Date(row.updatedAt).toISOString() }));
    }
  }
  return Response.json({ current:{userId:user.userId,email:user.email,displayName:user.email.toLowerCase().includes('gemma')?'Gemma':'Zeus'}, members:members.results, shares:shares.results, shared, partner:partner??null, sharedGearEditable:true });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  try { await registerHouseholdUser(env, user); } catch { return Response.json({error:'This account is not invited.'},{status:403}); }
  const body = await request.json() as { area?:string; canView?:boolean; action?:string; id?:string };
  if (body.action === 'copy-record' || body.action === 'copy-dive') {
    if (!body.id) return Response.json({error:'Record id required'},{status:400});
    const partner = await env.DB.prepare('SELECT user_id AS userId FROM dive_household_members WHERE household_id=? AND user_id IS NOT NULL AND user_id!=? LIMIT 1').bind(HOUSEHOLD_ID,user.userId).first<{userId:string}>();
    if (!partner) return Response.json({error:'Partner has not connected yet'},{status:409});
    const source = await env.DB.prepare("SELECT kind,data_json AS dataJson FROM dive_records WHERE id=? AND user_id=? AND deleted_at IS NULL").bind(body.id,partner.userId).first<{kind:string;dataJson:string}>();
    if (!source) return Response.json({error:'Shared record not found'},{status:404});
    const area=copyableKindArea[source.kind];
    if (!area) return Response.json({error:'Credentials, course completion and private preference records cannot be copied as personal achievements.'},{status:422});
    const allowed = await env.DB.prepare('SELECT 1 AS allowed FROM dive_household_shares WHERE household_id=? AND owner_user_id=? AND area=? AND can_view=1').bind(HOUSEHOLD_ID,partner.userId,area).first();
    if (!allowed) return Response.json({error:'This record is not shared'},{status:403});
    const now=Date.now(); const id=crypto.randomUUID(); const data=JSON.parse(source.dataJson) as Record<string,unknown>;
    delete data.diveNumber; delete data.createdAt; delete data.modifiedAt;
    await env.DB.prepare("INSERT INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)").bind(id,user.userId,source.kind,JSON.stringify({...data,...(source.kind==='dive'?{source:'manual'}:{}),copiedFromHousehold:true,copiedFromRecordId:body.id,copiedAt:new Date(now).toISOString()}),now,now).run();
    return Response.json({copied:true,id},{status:201});
  }
  if (!SHARE_AREAS.includes(body.area as typeof SHARE_AREAS[number])) return Response.json({error:'Unknown sharing area'},{status:400});
  const collaborative = body.area === 'albums';
  await env.DB.prepare('UPDATE dive_household_shares SET can_view=?,can_edit=?,updated_at=? WHERE household_id=? AND owner_user_id=? AND area=?').bind(body.canView?1:0,body.canView&&collaborative?1:0,Date.now(),HOUSEHOLD_ID,user.userId,body.area).run();
  return Response.json({ saved:true });
}
