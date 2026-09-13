import { env } from 'cloudflare:workers';
import { recordIdentity } from '@/lib/record-identity';
import { getChatGPTUser } from '../../chatgpt-auth';

type UnknownRecord = Record<string, unknown>;

const padiQuery = `query logbook_logs($affiliate_id: Int!) {
  logbook_logs(where: {affiliate_id: {_eq: $affiliate_id}}, order_by: {dive_date: desc, id: desc}) {
    id log_type log_course log_number dive_type dive_title dive_date dive_location memsys_member_number status adventure_dive
    depth_times { max_depth bottom_time time_in time_out }
    skills { dive_skills }
    conditions { water_type body_of_water weather air_temp surface_water_temp bottom_water_temp visibility visibility_distance wave_condition current surge }
    equipment { suit_type weight weight_type additional_equipment cylinder_type cylinder_size gas_mixture oxygen nitrogen helium starting_pressure ending_pressure }
    experiences { feeling notes buddies dive_center }
  }
}`;

async function ensureSchema(){await env.DB.batch([env.DB.prepare('CREATE TABLE IF NOT EXISTS dive_records (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,deleted_at INTEGER)'),env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_dive_records_user_kind ON dive_records(user_id,kind,updated_at DESC)'),env.DB.prepare('CREATE TABLE IF NOT EXISTS padi_sync_settings (user_id TEXT PRIMARY KEY,affiliate_id TEXT NOT NULL,last_synced_at INTEGER,last_count INTEGER NOT NULL DEFAULT 0)')])}
function record(value:unknown):UnknownRecord{return value&&typeof value==='object'&&!Array.isArray(value)?value as UnknownRecord:{}}
function numberOrNull(value:unknown){const parsed=Number(value);return Number.isFinite(parsed)?parsed:null}
function stringOrEmpty(value:unknown){return typeof value==='string'?value.trim():''}
function timeOrEmpty(value:unknown){const raw=stringOrEmpty(value);const match=raw.match(/(?:T|^)(\d{1,2}):(\d{2})/);return match?.[1]&&match[2]?`${match[1].padStart(2,'0')}:${match[2]}`:''}

function findDives(payload:unknown):UnknownRecord[]{
  if(Array.isArray(payload))return payload.filter(item=>item&&typeof item==='object') as UnknownRecord[];
  const root=record(payload);if(Array.isArray(root.dives))return root.dives as UnknownRecord[];
  const data=record(root.data);if(Array.isArray(data.logbook_logs))return data.logbook_logs as UnknownRecord[];
  const log=record(root.log);const entries=Array.isArray(log.entries)?log.entries:[];
  for(const entry of entries){const response=record(record(entry).response);const content=record(response.content);if(typeof content.text!=='string')continue;try{const nested=findDives(JSON.parse(content.text));if(nested.length)return nested}catch{}}
  return [];
}

function firstRecord(value:unknown){return record(Array.isArray(value)?value[0]:value)}
function normalizeDive(dive:UnknownRecord,importedAt:string){
  const depth=firstRecord(dive.depth_times);const equipment=firstRecord(dive.equipment);const experience=firstRecord(dive.experiences);const conditions=firstRecord(dive.conditions);
  const padiId=String(dive.id??'').trim();const date=stringOrEmpty(dive.dive_date).slice(0,10);if(!padiId||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const location=stringOrEmpty(dive.dive_location);const title=stringOrEmpty(dive.dive_title);const gas=stringOrEmpty(equipment.gas_mixture)||((numberOrNull(equipment.oxygen)??21)>21?`Nitrox ${numberOrNull(equipment.oxygen)}`:'Air');
  return {padiId,site:location||title||'PADI dive',title,date,timeIn:timeOrEmpty(depth.time_in),timeOut:timeOrEmpty(depth.time_out),maxDepthM:numberOrNull(depth.max_depth),bottomTimeMin:numberOrNull(depth.bottom_time),gas,notes:stringOrEmpty(experience.notes),buddy:stringOrEmpty(experience.buddies),diveCenter:stringOrEmpty(experience.dive_center),source:'padi' as const,sourceLabel:'PADI web logbook',padi:{logType:dive.log_type??null,logCourse:dive.log_course??null,logNumber:dive.log_number??null,diveType:dive.dive_type??null,status:dive.status??null,adventureDive:dive.adventure_dive??null,depthTimes:depth,conditions,equipment,skills:dive.skills??null,experience},provenance:{kind:'user-authorized-import',source:'padi-web-logbook',padiId,importedAt}};
}

async function renumberUserDives(userId:string){
  const settingsRow=await env.DB.prepare("SELECT data_json AS dataJson FROM dive_records WHERE user_id=? AND kind='dashboard-settings' AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1").bind(userId).first<{dataJson:string}>();
  let startAt=1;
  try{const settings=record(settingsRow?JSON.parse(settingsRow.dataJson):{});startAt=Math.max(1,Number(settings.diveNumberStart)||1)}catch{}
  const result=await env.DB.prepare("SELECT id,data_json AS dataJson FROM dive_records WHERE user_id=? AND kind='dive' AND deleted_at IS NULL").bind(userId).all<{id:string;dataJson:string}>();
  const ordered=result.results.map(row=>({id:row.id,data:record(JSON.parse(row.dataJson))})).sort((a,b)=>{
    const aKey=`${stringOrEmpty(a.data.date)}T${timeOrEmpty(a.data.timeIn)||'23:59'}`;
    const bKey=`${stringOrEmpty(b.data.date)}T${timeOrEmpty(b.data.timeIn)||'23:59'}`;
    return aKey.localeCompare(bKey)||a.id.localeCompare(b.id);
  });
  const now=Date.now();
  const updates=ordered.flatMap((row,index)=>{
    const diveNumber=startAt+index;
    if(Number(row.data.diveNumber)===diveNumber)return [];
    return [env.DB.prepare('UPDATE dive_records SET data_json=?,updated_at=? WHERE id=? AND user_id=?').bind(JSON.stringify({...row.data,diveNumber}),now,row.id,userId)];
  });
  for(let index=0;index<updates.length;index+=75)await env.DB.batch(updates.slice(index,index+75));
}

async function saveDives(userId:string,dives:UnknownRecord[],snapshot:unknown,affiliateId=''){
  await ensureSchema();const importedAt=new Date().toISOString();const normalized=dives.map(dive=>normalizeDive(dive,importedAt)).filter(Boolean) as Array<NonNullable<ReturnType<typeof normalizeDive>>>;if(!normalized.length)throw new Error('No valid PADI dives were found in that data.');
  const current=await env.DB.prepare("SELECT id,data_json AS dataJson FROM dive_records WHERE user_id=? AND kind='dive'").bind(userId).all<{id:string;dataJson:string}>();
  const existing=new Set(current.results.map(row=>row.id));const identities=new Set(current.results.map(row=>recordIdentity('dive',JSON.parse(row.dataJson))));
  const now=Date.now();let added=0;const updated=0;let skipped=0;
  for(const dive of normalized){
    const id=`padi:${userId}:${dive.padiId}`;const identity=recordIdentity('dive',dive);
    if(existing.has(id)||(identity&&identities.has(identity))){skipped++;continue;}
    const result=await env.DB.prepare('INSERT OR IGNORE INTO dive_records (id,user_id,kind,data_json,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,NULL)').bind(id,userId,'dive',JSON.stringify(dive),now,now).run();
    if(result.meta.changes){added++;existing.add(id);if(identity)identities.add(identity);}else skipped++;
  }
  await renumberUserDives(userId);
  const snapshotKey=`padi/${userId}/${Date.now()}-${crypto.randomUUID()}.json`;await env.FILES.put(snapshotKey,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'},customMetadata:{userId,source:'padi-web-logbook',recordCount:String(normalized.length)}});
  if(/^\d+$/.test(affiliateId))await env.DB.prepare('INSERT OR REPLACE INTO padi_sync_settings (user_id,affiliate_id,last_synced_at,last_count) VALUES (?,?,?,?)').bind(userId,affiliateId,now,normalized.length).run();
  return {total:normalized.length,added,updated,skipped};
}

export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});await ensureSchema();const settings=await env.DB.prepare('SELECT affiliate_id AS affiliateId,last_synced_at AS lastSyncedAt,last_count AS lastCount FROM padi_sync_settings WHERE user_id=?').bind(user.userId).first();return Response.json({settings:settings??null})}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:'Authentication required'},{status:401});
  try{
    const contentType=request.headers.get('content-type')??'';let payload:unknown;let affiliateId='';
    if(contentType.includes('multipart/form-data')){const form=await request.formData();const file=form.get('file');if(!(file instanceof File))return Response.json({error:'Choose a PADI JSON or HAR file.'},{status:400});if(file.size>25*1024*1024)return Response.json({error:'Maximum file size is 25 MB.'},{status:413});payload=JSON.parse(await file.text());affiliateId=String(record(payload).affiliateId??'').trim()}
    else {const body=await request.json() as {affiliateId?:string;accessToken?:string};affiliateId=String(body.affiliateId??'').trim();const accessToken=String(body.accessToken??'').replace(/^Bearer\s+/i,'').trim();if(!/^\d+$/.test(affiliateId)||accessToken.length<20)return Response.json({error:'Enter your PADI affiliate ID and a valid temporary access token.'},{status:400});const response=await fetch('https://logbook.global-prod.padi.com/api/Logbook',{method:'POST',headers:{accept:'application/json','affiliate-id':affiliateId,authorization:`Bearer ${accessToken}`,'content-type':'application/json'},body:JSON.stringify({query:padiQuery,variables:{affiliate_id:Number(affiliateId)}}),signal:AbortSignal.timeout(20000)});if(!response.ok)return Response.json({error:response.status===401||response.status===403?'PADI rejected or expired the access token. Get a fresh token and try again.':`PADI sync failed (${response.status}).`},{status:502});payload=await response.json()}
    const dives=findDives(payload);if(!dives.length)return Response.json({error:'This file or response does not contain a recognised PADI logbook.'},{status:422});return Response.json(await saveDives(user.userId,dives,payload,affiliateId));
  }catch(reason){return Response.json({error:reason instanceof SyntaxError?'The selected file is not valid JSON.':reason instanceof Error?reason.message:'PADI import failed.'},{status:400})}
}
