import { cacheCloudRecords } from './cache-cloud-records';
import { zeustekDb } from './db';
import { mutateEntity } from './mutations';
import type { JsonValue } from './types';
import { recordIdentity } from '../record-identity';
import { prepareCardImages } from './dive-images';
import { flushComputerEvidenceAttachments } from './evidence-attachments';

let account = '';
const inflight = new Map<string, Promise<void>>();
const checked = new Map<string, number>();
export function configureDiveStore(userId: string) { account = userId; }
export function currentDiveAccount() { return account; }
const moduleName = () => { if (!account) throw new Error('Sign in to access local dive records.'); return `dive:${account}`; };
function changed() { window.dispatchEvent(new Event('zeustek-records-updated')); }
async function diagnostic(code: string, started: number) {
  await zeustekDb.diagnostics.put({ id: code, code, createdAt: new Date().toISOString(), detail: { durationMs: Math.round(performance.now() - started) } }).catch(() => {});
}
export async function refreshDiveRecords(kind: string, force = false) {
  const module = moduleName();
  const key = `${module}:${kind}`;
  if (inflight.has(key)) return inflight.get(key);
  if (!navigator.onLine || (!force && Date.now() - (checked.get(key) ?? 0) < 30_000)) return;
  checked.set(key, Date.now());
  const work = (async () => {
    const started = performance.now();
    const snapshotStartedAt = new Date().toISOString();
    const response = await fetch(`/api/dive-data?kind=${encodeURIComponent(kind)}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to refresh cloud records.' : 'Cloud refresh unavailable; local records remain available.');
    const { items } = await response.json() as { items: Array<Record<string, JsonValue> & { id: string }> };
    if (!Array.isArray(items)) throw new Error('Invalid cloud response.');
    // Cache is account-scoped. It never replaces the immutable mutation history.
    const rows = items.map(({ id, ...record }) => ({ entityId: `${module}:${id}`, module, entityType: kind, schemaVersion: 1, record: { ...record, entityId: id }, recordHash: '', deleted: 0 as const, updatedEventId: '', updatedAt: String(record.modifiedAt ?? '') }));
    await cacheCloudRecords(module, kind, rows, snapshotStartedAt);
    await zeustekDb.settings.put({ key: `cached:${key}`, value: true });
    await diagnostic(`DIVE_NETWORK_${kind}`, started);
    changed();
  })().catch((error) => {
    window.dispatchEvent(new CustomEvent('zeustek-operation', { detail: { state: 'error', message: /bulkPut|UnknownError|transaction/i.test(String(error)) ? 'Cloud download could not be saved on this device. Your existing records and unsent edits are retained. Reopen the app to retry.' : error instanceof Error ? error.message : 'Cloud refresh failed.' } }));
  }).finally(() => inflight.delete(key));
  inflight.set(key, work);
  return work;
}
export async function listLocalDiveRecords<T>(kind: string): Promise<Array<T & { entityId: string }>> {
  const started = performance.now();
  const module = moduleName();
  const rows = await zeustekDb.entities.where('[module+entityType]').equals([module, kind]).toArray();
  void diagnostic(`DIVE_LOCAL_${kind}`, started);
  void refreshDiveRecords(kind);
  return rows.filter(row => !row.deleted && row.record).map(row => row.record as unknown as T & { entityId: string });
}
export async function hasCloudSnapshot(kind:string){return Boolean((await zeustekDb.settings.get(`cached:${moduleName()}:${kind}`))?.value);}
const operations = new Map<string, Promise<unknown>>();
export async function diveOperation<T>(key: string, message: string, action: () => Promise<T>): Promise<T> {
  const existing = operations.get(key); if (existing) return existing as Promise<T>;
  const report = (state: string, text: string) => window.dispatchEvent(new CustomEvent('zeustek-operation', { detail: { state, message: text } }));
  report('working', message);
  const work = action().then(result => { report('success', `${message.replace(/…$/, '')} complete.`); return result; }).catch(error => { report('error', error instanceof Error ? error.message : 'Operation failed.'); throw error; }).finally(() => operations.delete(key));
  operations.set(key, work); return work;
}
export async function cacheSavedRecord(kind: string, id: string, data: Record<string, unknown>) {
  const module = moduleName();
  const now = new Date().toISOString();
  const old = await zeustekDb.entities.get(`${module}:${id}`);
  const prior = old?.record as Record<string, JsonValue> | undefined;
  await mutateEntity({ entityId: `${module}:${id}`, module, entityType: kind, schemaVersion: 1, operation: old ? 'update' : 'create', record: JSON.parse(JSON.stringify({ ...prior, ...data, entityId: id, createdAt: prior?.createdAt ?? now, modifiedAt: now })) });
  checked.set(`${module}:${kind}`, Date.now());
  changed();
}
export async function cacheDeletedRecord(id: string) {
  const module = moduleName(); const old = await zeustekDb.entities.get(`${module}:${id}`);
  if (old) await mutateEntity({ entityId: old.entityId, module, entityType: old.entityType, schemaVersion: 1, operation: 'delete', record: null });
  changed();
}

type Pending = { id: string; kind: string; record: Record<string, JsonValue> | null; baseModifiedAt: string | null; token: string; state: string };
let flushing: Promise<void> | null = null;
const localWrites=new Map<string,Promise<unknown>>();
async function sequentialWrite<T>(key:string,action:()=>Promise<T>):Promise<T>{
  const prior=localWrites.get(key);const work=(prior??Promise.resolve()).catch(()=>{}).then(action);
  localWrites.set(key,work);try{return await work;}finally{if(localWrites.get(key)===work)localWrites.delete(key);}
}
export async function saveLocalRecord(kind: string, input: Record<string, unknown> & {entityId?: string}) {
  const key=`${moduleName()}:${input.entityId??`${kind}:${recordIdentity(kind,input)||JSON.stringify(input)}`}`;
  return sequentialWrite(key,()=>saveLocalRecordInternal(kind,input));
}
async function saveLocalRecordInternal(kind: string, input: Record<string, unknown> & {entityId?: string}) {
  const module = moduleName();
  const {entityId, ...data} = input;
  const existing = await listLocalDiveRecords<Record<string, unknown>>(kind);
  const identity = recordIdentity(kind, data);
  const duplicate = !entityId && identity ? existing.find(row => recordIdentity(kind, row) === identity) : null;
  if (duplicate) throw new Error('A matching record already exists. Open it to review or edit instead of creating a duplicate.');
  const id = entityId || crypto.randomUUID();
  const localId = `${module}:${id}`;
  const old = await zeustekDb.entities.get(localId);
  const prior = old?.record as Record<string, JsonValue> | undefined;
  const queued = (await zeustekDb.settings.get(`pending:${localId}`))?.value as Pending | undefined;
  const now = new Date().toISOString();
  const record = JSON.parse(JSON.stringify({...prior, ...data, entityId:id, createdAt:prior?.createdAt ?? now, modifiedAt:now}));
  const pending: Pending = {id,kind,record,baseModifiedAt:queued ? queued.baseModifiedAt : typeof prior?.modifiedAt === 'string' ? prior.modifiedAt : null,token:crypto.randomUUID(),state:'pending'};
  await mutateEntity({entityId:localId,module,entityType:kind,schemaVersion:1,operation:old ? 'update':'create',record,pendingSync:{key:`pending:${localId}`,value:pending as unknown as JsonValue}});
  changed(); void flushDiveChanges(); return {id};
}
export async function deleteLocalRecord(id: string) {
  return sequentialWrite(`${moduleName()}:${id}`,()=>deleteLocalRecordInternal(id));
}
async function deleteLocalRecordInternal(id:string){
  const module=moduleName();const localId=`${module}:${id}`;const old=await zeustekDb.entities.get(localId);
  if (!old) throw new Error('Load this record before deleting it.');
  const prior=old.record as Record<string,JsonValue>;
  const queued=(await zeustekDb.settings.get(`pending:${localId}`))?.value as Pending|undefined;
  const pending:Pending={id,kind:old.entityType,record:null,baseModifiedAt:queued ? queued.baseModifiedAt : String(prior.modifiedAt),token:crypto.randomUUID(),state:'pending'};
  await mutateEntity({entityId:localId,module,entityType:old.entityType,schemaVersion:1,operation:'delete',record:null,pendingSync:{key:`pending:${localId}`,value:pending as unknown as JsonValue}});
  changed();void flushDiveChanges();return {deleted:true};
}
export async function pendingDiveChanges() { return zeustekDb.settings.where('key').startsWith(`pending:${moduleName()}:`).toArray(); }
export async function readDiveConflict(key:string){
  if(!key.startsWith(`pending:${moduleName()}:`))throw new Error('This change belongs to another account.');
  const row=await zeustekDb.settings.get(key);const pending=row?.value as unknown as Pending|undefined;
  if(!pending||pending.state!=='conflict')throw new Error('This conflict has already changed.');
  const response=await fetch(`/api/dive-data?kind=${encodeURIComponent(pending.kind)}`,{cache:'no-store'});
  if(!response.ok)throw new Error('Connect and sign in to review the cloud version.');
  const result=await response.json() as {items:Array<Record<string,JsonValue>&{id:string}>};
  return {pending,cloud:result.items.find(item=>item.id===pending.id)??null};
}
export async function resolveDiveConflict(key:string,token:string,choice:'local'|'cloud'){
  const {pending,cloud}=await readDiveConflict(key);
  if(pending.token!==token)throw new Error('The local record changed during review. Reopen the comparison.');
  await zeustekDb.transaction('rw',zeustekDb.settings,zeustekDb.entities,async()=>{
    const latest=(await zeustekDb.settings.get(key))?.value as unknown as Pending|undefined;
    if(latest?.token!==token)throw new Error('The local record changed during review.');
    await zeustekDb.settings.put({key:`conflict-archive:${moduleName()}:${pending.id}:${token}`,value:JSON.parse(JSON.stringify({pending,cloud,choice,resolvedAt:new Date().toISOString()}))});
    if(choice==='local')await zeustekDb.settings.put({key,value:{...pending,state:'pending',baseModifiedAt:cloud?.modifiedAt??null,token:crypto.randomUUID()} as unknown as JsonValue});
    else{
      await zeustekDb.settings.delete(key);
      const entityId=`${moduleName()}:${pending.id}`;
      if(cloud){const {id,...record}=cloud;await zeustekDb.entities.update(entityId,{record:{...record,entityId:id},deleted:0,updatedAt:String(cloud.modifiedAt)});}
      else await zeustekDb.entities.update(entityId,{deleted:1});
    }
  });
  changed();void flushDiveChanges();
}
export async function flushDiveChanges() {
  if (flushing || !navigator.onLine) return flushing;
  const module = moduleName();
  flushing=(async () => {
    const changes=await pendingDiveChanges();
    for (const change of changes) {
      if (moduleName() !== module) break;
      const pending=change.value as unknown as Pending;
      if (pending.state === 'conflict') continue;
      const prepared=pending.record?await prepareCardImages(pending.record,account):null;
      const response=await fetch('/api/dive-data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:pending.id,kind:pending.kind,data:prepared,localMutation:true,baseModifiedAt:pending.baseModifiedAt}),signal:AbortSignal.timeout(20_000)});
      if (!response.ok) {
        const result=await response.json() as {error?:string};
        if (response.status===409 || response.status===403) {
          await zeustekDb.transaction('rw',zeustekDb.settings,async()=>{
            const latest=await zeustekDb.settings.get(change.key);
            if(!latest)return;
            // A newer local edit may have arrived during this request. Retain it.
            await zeustekDb.settings.put({...latest,value:{...(latest.value as unknown as Pending),state:'conflict',error:result.error ?? 'Cloud record changed; both versions are preserved.'} as unknown as JsonValue});
          });
          changed(); continue;
        }
        throw new Error(result.error ?? 'Changes are saved on this device. Cloud sync will retry.');
      }
      const result=await response.json() as {updatedAt:number};
      await zeustekDb.transaction('rw',zeustekDb.settings,zeustekDb.entities,async () => {
        const latest=await zeustekDb.settings.get(change.key);const next=latest?.value as unknown as Pending|undefined;
        if (next?.token===pending.token) {
          await zeustekDb.settings.delete(change.key);
          const entity=await zeustekDb.entities.get(`${module}:${pending.id}`);
          if (entity?.record) await zeustekDb.entities.update(entity.entityId,{record:JSON.parse(JSON.stringify({...prepared,modifiedAt:new Date(result.updatedAt).toISOString()}))});
        } else if(next) await zeustekDb.settings.put({...latest!,value:{...next,baseModifiedAt:new Date(result.updatedAt).toISOString()} as unknown as JsonValue});
      });
    }
    await flushComputerEvidenceAttachments(account);
    changed();
  })().catch(error => { window.dispatchEvent(new CustomEvent('zeustek-operation',{detail:{state:'error',message:error instanceof Error ? error.message : 'Cloud sync pending.'}})); }).finally(()=>{flushing=null;});
  return flushing;
}
