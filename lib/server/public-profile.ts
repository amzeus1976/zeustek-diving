import {resolvePersonDisplayAwards} from '../people/certification-evidence';
import type {CertificationRecord,PersonRecord} from '../offline/dive-planning';
import {PUBLIC_INSIGHTS,validatePublicationSnapshot,type PublicationInput,type PublicationSnapshot} from '../sharing/public-profile';
import {tableExists,sha256} from './sharing-access';
export type PublicationEnv={DB:D1Database;FILES:R2Bucket};
type PublicationRow={owner_user_id:string;enabled:number;snapshot_json:string;photo_id:string|null;updated_at:number};
export async function ensurePublicationSchema(db:D1Database){await db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS dive_publications (slot TEXT PRIMARY KEY,owner_user_id TEXT NOT NULL,public_id TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,snapshot_json TEXT NOT NULL,photo_id TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS dive_publication_photos (id TEXT PRIMARY KEY,owner_user_id TEXT NOT NULL,object_key TEXT NOT NULL,content_type TEXT NOT NULL,created_at INTEGER NOT NULL)'),
]);}
export async function publicationRow(db:D1Database,slot='landing'){if(!await tableExists(db,'dive_publications'))return null;return db.prepare('SELECT owner_user_id,enabled,snapshot_json,photo_id,updated_at FROM dive_publications WHERE slot=?').bind(slot).first<PublicationRow>();}
export async function visitorSnapshot(db:D1Database){const row=await publicationRow(db);if(!row?.enabled)return null;return validatePublicationSnapshot(JSON.parse(row.snapshot_json));}
export async function ownedPhoto(db:D1Database,owner:string,id:string){if(!await tableExists(db,'dive_publication_photos'))return null;return db.prepare('SELECT id,object_key,content_type FROM dive_publication_photos WHERE id=? AND owner_user_id=?').bind(id,owner).first<{id:string;object_key:string;content_type:string}>();}
function parsed(value:string){if(value.length>1024*1024)throw new Error('Evidence unavailable.');const object=JSON.parse(value);if(!object||typeof object!=='object'||Array.isArray(object))throw new Error('Evidence unavailable.');return object as Record<string,unknown>;}
function metric(value:unknown){return typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;}
export async function publicationPreview(db:D1Database,owner:string,input:PublicationInput,asOf=new Date().toISOString()){
  const snapshot:PublicationSnapshot={version:1,...(input.displayName!==undefined?{displayName:input.displayName}:{}),...(input.biography!==undefined?{biography:input.biography}:{}),asOf,source:'Owner-selected canonical evidence',insights:[]};
  if(input.photoId){if(!await ownedPhoto(db,owner,input.photoId))throw new Error('Photo unavailable.');snapshot.photoUrl=`/api/public-profile/photo?id=${input.photoId}`;}
  let dives:Record<string,unknown>[]=[],award='';
  if(input.insights.some(key=>key!=='highestRecreationalAward')){const result=await db.prepare("SELECT data_json FROM dive_records WHERE user_id=? AND kind='dive' AND deleted_at IS NULL ORDER BY id LIMIT 20001").bind(owner).all<{data_json:string}>();if(result.results.length>20000)throw new Error('Evidence too large.');dives=result.results.map(row=>parsed(row.data_json)).filter(row=>!row.suppressedFromUse);if(dives.some(dive=>typeof dive.site!=='string'))throw new Error('Evidence unavailable.');}
  if(input.insights.includes('highestRecreationalAward')){const result=await db.prepare("SELECT id,kind,data_json FROM dive_records WHERE user_id=? AND kind IN ('person','certification') AND deleted_at IS NULL ORDER BY id LIMIT 2001").bind(owner).all<{id:string;kind:string;data_json:string}>();if(result.results.length>2000)throw new Error('Evidence too large.');const records=result.results.map(row=>({...parsed(row.data_json),entityId:row.id,kind:row.kind})).filter(row=>!(row as Record<string,unknown>).suppressedFromUse);const people=records.filter(row=>row.kind==='person'&&(row as unknown as PersonRecord).roles?.ownerProfile);if(people.length>1)throw new Error('Owner evidence ambiguous.');if(people[0]){const evidence=records.filter(row=>row.kind==='certification') as unknown as CertificationRecord[];const resolved=resolvePersonDisplayAwards(people[0] as unknown as PersonRecord&{entityId:string},evidence).rec;award=resolved.record?resolved.title:'Not recorded';}else award='Not recorded';}
  const times=dives.map(dive=>metric(dive.totalElapsedMin??dive.bottomTimeMin)).filter((value):value is number=>value!==null),depths=dives.map(dive=>metric(dive.maxDepthM)).filter((value):value is number=>value!==null);
  const values={totalDives:dives.length,totalMinutes:times.length?times.reduce((sum,value)=>sum+value,0):dives.length?'Not recorded':0,maxDepth:depths.length?depths.reduce((deepest,value)=>Math.max(deepest,value),0):'Not recorded',highestRecreationalAward:award};
  snapshot.insights=input.insights.map(key=>{const definition=PUBLIC_INSIGHTS.find(item=>item[0]===key)!;return {key,label:definition[1],unit:definition[2],value:values[key]};});
  validatePublicationSnapshot(snapshot);return {snapshot,previewHash:await sha256(JSON.stringify(snapshot))};
}
