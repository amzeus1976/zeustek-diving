import { zeustekDb, type AttachmentRow, type DiveImageRow } from './db';
import { currentDiveAccount, flushDiveChanges } from './dive-store';
import { DIVE_RECORD_KINDS } from '../record-identity';
import { recordHash, sha256Hex } from './canonical';
import type { JsonValue } from './types';

const base64 = (bytes: Uint8Array) => {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
};
export async function localBackupPayload() {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in before creating a backup.');
  const module = `dive:${account}`;
  const snapshot = await zeustekDb.transaction('r', [zeustekDb.entities, zeustekDb.events, zeustekDb.attachments, zeustekDb.diveImages, zeustekDb.settings, zeustekDb.entityHeads], async () => {
    const entities = await zeustekDb.entities.where('module').equals(module).toArray();
    return { entities,
      events: await zeustekDb.events.filter(event => event.module === module).toArray(),
      heads: await zeustekDb.entityHeads.where('entityId').anyOf(entities.map(row => row.entityId)).toArray(),
      attachments: await zeustekDb.attachments.filter(row => row.entityId.startsWith(`${module}:`)).toArray(),
      images: await zeustekDb.diveImages.where('account').equals(account).toArray(),
      pending: await zeustekDb.settings.where('key').startsWith(`pending:${module}:`).toArray(),
      reviews: await zeustekDb.settings.filter(row=>row.key.startsWith(`conflict-archive:${module}:`)||row.key.startsWith(`backup-review:${module}:`)).toArray() };
  });
  return { format: 'zeustek-dive-local-data', version: 2, account, exportedAt: new Date().toISOString(),
    coverage: 'Records, history, pending edits, card/profile images and locally staged/imported computer evidence available on this device. Gallery media stored only in the cloud is not included.',
    ...snapshot, images: await Promise.all(snapshot.images.map(async ({ blob, ...image }) => ({ ...image, mimeType: blob.type, bytes: base64(new Uint8Array(await blob.arrayBuffer())) }))) };
}
export async function restoreLocalPayload(value: unknown) {
  const data = value as Awaited<ReturnType<typeof localBackupPayload>>;
  const account = currentDiveAccount(); const module = `dive:${account}`;
  const invalid = () => new Error('The backup contains invalid data. No records have been restored.');
  if (!data || data.format !== 'zeustek-dive-local-data' || data.version !== 2 || data.account !== account) throw new Error('Invalid backup, or it belongs to a different signed-in account.');
  if (![data.entities, data.images, data.events, data.pending, data.heads].every(Array.isArray) || (data.attachments !== undefined && !Array.isArray(data.attachments)) || data.entities.length > 100000) throw invalid();
  const ids = new Set<string>();
  for (const row of data.entities) {
    if (!row || row.module !== module || typeof row.entityId !== 'string' || !row.entityId.startsWith(`${module}:`) || ids.has(row.entityId) || !(DIVE_RECORD_KINDS as readonly string[]).includes(row.entityType) || ![0,1].includes(row.deleted) || (row.record === null ? row.deleted !== 1 : typeof row.record !== 'object' || Array.isArray(row.record))) throw invalid();
    if (row.record && (row.record as Record<string,JsonValue>).entityId !== row.entityId.slice(module.length + 1)) throw invalid();
    ids.add(row.entityId);
  }
  const eventIds = new Set<string>();
  for (const event of data.events) {
    if (!event || event.module !== module || !ids.has(event.entityId) || typeof event.eventId !== 'string' || eventIds.has(event.eventId) || !Array.isArray(event.parents) || !event.parents.every(id => typeof id === 'string') || !Number.isSafeInteger(event.lamport) || event.lamport < 1 || await recordHash(event.record) !== event.recordHash) throw invalid();
    eventIds.add(event.eventId);
  }
  for (const head of data.heads) if (!ids.has(head.entityId) || !eventIds.has(head.eventId)) throw invalid();
  for (const pending of data.pending) if (typeof pending.key !== 'string' || !pending.key.startsWith(`pending:${module}:`) || !ids.has(pending.key.slice(8))) throw invalid();
  if(data.reviews!==undefined&&(!Array.isArray(data.reviews)||data.reviews.some(row=>!row||typeof row.key!=='string'||!(row.key.startsWith(`conflict-archive:${module}:`)||row.key.startsWith(`backup-review:${module}:`)))))throw invalid();
  const images: DiveImageRow[] = [];
  const imageIds = new Set<string>();
  for (const image of data.images) {
    if (!image || typeof image.id !== 'string' || imageIds.has(image.id) || image.account !== account || typeof image.bytes !== 'string' || image.bytes.length > 45_000_000 || !['image/jpeg','image/png','image/webp','application/xml','text/xml','application/json','application/octet-stream'].includes(image.mimeType)) throw invalid();
    let binary: string; try { binary = atob(image.bytes); } catch { throw invalid(); }
    images.push({ id: image.id, account, name: String(image.name), blob: new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))], { type: image.mimeType }), createdAt: String(image.createdAt), ...(image.remoteKey ? {remoteKey:image.remoteKey} : {}) });
    imageIds.add(image.id);
  }
  const attachments: AttachmentRow[] = [];
  const attachmentIds = new Set<string>();
  for (const attachment of data.attachments ?? []) {
    if (!attachment || typeof attachment.attachmentId !== 'string' || attachmentIds.has(attachment.attachmentId) || !imageIds.has(attachment.attachmentId) || typeof attachment.entityId !== 'string' || !attachment.entityId.startsWith(`${module}:`) || typeof attachment.fileName !== 'string' || typeof attachment.mimeType !== 'string' || !Number.isSafeInteger(attachment.byteLength) || attachment.byteLength < 0 || typeof attachment.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(attachment.sha256) || !['pending','acknowledged'].includes(attachment.state)) throw invalid();
    const image = images.find((candidate) => candidate.id === attachment.attachmentId);
    if (!image) throw invalid();
    const bytes = new Uint8Array(await image.blob.arrayBuffer());
    if (bytes.byteLength !== attachment.byteLength || await sha256Hex(bytes) !== attachment.sha256) throw invalid();
    attachments.push(attachment as AttachmentRow); attachmentIds.add(attachment.attachmentId);
  }
  let restored = 0, skipped = 0, conflicts = 0;
  await zeustekDb.transaction('rw', [zeustekDb.entities, zeustekDb.events, zeustekDb.entityHeads, zeustekDb.eventParents, zeustekDb.attachments, zeustekDb.diveImages, zeustekDb.settings, zeustekDb.syncState], async () => {
    for(const review of data.reviews??[]) {
      const existing=await zeustekDb.settings.get(review.key);
      if(!existing)await zeustekDb.settings.add(review);
      else if(JSON.stringify(existing.value)!==JSON.stringify(review.value))await zeustekDb.settings.put({key:`backup-review:${module}:archive:${crypto.randomUUID()}`,value:review.value});
    }
    for (const image of images) {
      const existing = await zeustekDb.diveImages.get(image.id);
      if (existing && existing.account !== account) throw invalid();
      if (!existing) await zeustekDb.diveImages.add(image);
    }
    for (const attachment of attachments) {
      const existing = await zeustekDb.attachments.get(attachment.attachmentId);
      if (existing && JSON.stringify(existing) !== JSON.stringify(attachment)) throw invalid();
      if (!existing) await zeustekDb.attachments.add(attachment);
    }
    const accepted = new Set<string>();
    for (const [index, row] of data.entities.entries()) {
      window.dispatchEvent(new CustomEvent('zeustek-backup-progress', {detail:{processed:index + 1,total:data.entities.length}}));
      const current = await zeustekDb.entities.get(row.entityId);
      if (current) {
        if (JSON.stringify(current.record) === JSON.stringify(row.record)) skipped++;
        else { conflicts++; await zeustekDb.settings.put({key:`backup-review:${row.entityId}:${data.exportedAt}`,value:JSON.parse(JSON.stringify(row))}); }
        continue;
      }
      accepted.add(row.entityId);
      await zeustekDb.entities.add(row); restored++;
      await zeustekDb.settings.put({key:`cached:${module}:${row.entityType}`,value:true});
      const queued = data.pending.find(item => item.key === `pending:${row.entityId}`);
      const record = row.record as Record<string,JsonValue> | null;
      const pending = queued ?? {key:`pending:${row.entityId}`,value:{id:row.entityId.slice(module.length+1),kind:row.entityType,record:row.record,baseModifiedAt:record?.modifiedAt ?? null,token:crypto.randomUUID(),state:'pending'}};
      await zeustekDb.settings.put(pending as {key:string;value:JsonValue});
    }
    for (const event of data.events.filter(event => accepted.has(event.entityId))) {
      const existing = await zeustekDb.events.get(event.eventId);
      if (existing && JSON.stringify(existing) !== JSON.stringify(event)) throw invalid();
      if (!existing) {
        await zeustekDb.events.add(event);
        for (const parentEventId of event.parents) await zeustekDb.eventParents.put({eventId:event.eventId,parentEventId});
      }
    }
    for (const head of data.heads.filter(head => accepted.has(head.entityId))) await zeustekDb.entityHeads.put(head);
    const clock = await zeustekDb.syncState.get('lamport');
    await zeustekDb.syncState.put({key:'lamport',value:data.events.reduce((max,event)=>Math.max(max,event.lamport),Number(clock?.value)||0)});
  });
  window.dispatchEvent(new Event('zeustek-records-updated')); void flushDiveChanges();
  return {restored,skipped,conflicts};
}
