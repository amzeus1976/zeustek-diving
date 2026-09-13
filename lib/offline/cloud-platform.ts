import { localBackupPayload, restoreLocalPayload } from './local-backup';
import { DIVE_RECORD_KINDS } from '../record-identity';

const encoder = new TextEncoder(); const decoder = new TextDecoder();
const FORMAT = 'zeustek-dive-encrypted-backup';
function toBase64(value: Uint8Array) { let binary = ''; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary); }
function fromBase64(value: string) { const binary = atob(value); return Uint8Array.from(binary, character => character.charCodeAt(0)); }
async function key(passphrase: string, salt: Uint8Array, usage: KeyUsage[]) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:salt.slice().buffer,iterations:250000},material,{name:'AES-GCM',length:256},false,usage);
}
export async function checkDiveCloud() {
  const entries = await Promise.all(['dive','equipment','site','trip','certification'].map(async kind => {
    const response = await fetch(`/api/dive-data?kind=${kind}`, {cache:'no-store'});
    if (!response.ok) throw new Error('Cloud account unavailable');
    const result = await response.json() as {items?:unknown[]}; return [kind,result.items?.length ?? 0] as const;
  }));
  return Object.fromEntries(entries);
}
export async function createDiveBackup(passphrase: string) {
  if (passphrase.length < 8) throw new Error('Use a backup passphrase of at least 8 characters.');
  const snapshot = await localBackupPayload();
  if (navigator.onLine) {
    try {
      const response = await fetch('/api/dive-backup', {cache:'no-store',signal:AbortSignal.timeout(12000)});
      if (!response.ok) throw new Error('Cloud backup unavailable');
      const cloud = await response.json() as {records:Array<{id:string;kind:string;dataJson:string;createdAt:number;updatedAt:number}>};
      const known = new Set(snapshot.entities.map(row => row.entityId));
      for (const row of cloud.records) {
        const entityId = `dive:${snapshot.account}:${row.id}`;
        if (known.has(entityId) || !(DIVE_RECORD_KINDS as readonly string[]).includes(row.kind)) continue;
        snapshot.entities.push({entityId,module:`dive:${snapshot.account}`,entityType:row.kind,schemaVersion:1,record:{...JSON.parse(row.dataJson),entityId:row.id,createdAt:new Date(row.createdAt).toISOString(),modifiedAt:new Date(row.updatedAt).toISOString()},recordHash:'',deleted:0,updatedEventId:'',updatedAt:new Date(row.updatedAt).toISOString()});
      }
      snapshot.coverage = 'Cloud records plus local records, history, pending edits and locally available card/profile images. Cloud-only gallery media is not included.';
    } catch { /* The local snapshot remains a usable offline backup; its coverage text is explicit. */ }
  }
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:iv.slice().buffer},await key(passphrase,salt,['encrypt']),encoder.encode(JSON.stringify(snapshot))));
  return new Blob([JSON.stringify({format:FORMAT,version:2,createdAt:new Date().toISOString(),coverage:snapshot.coverage,salt:toBase64(salt),iv:toBase64(iv),ciphertext:toBase64(ciphertext)})],{type:'application/vnd.zeustek-dive.backup+json'});
}
export async function restoreDiveBackup(file: File, passphrase: string): Promise<{restored:number;skipped:number;conflicts:number}> {
  const envelope = JSON.parse(await file.text()) as {format?:string;version?:number;salt?:string;iv?:string;ciphertext?:string};
  if (envelope.format !== FORMAT || ![1,2].includes(envelope.version ?? 0) || !envelope.salt || !envelope.iv || !envelope.ciphertext) throw new Error('This is not a Zeustek Dive backup.');
  let payload: unknown;
  try {
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(envelope.iv).slice().buffer},await key(passphrase,fromBase64(envelope.salt),['decrypt']),fromBase64(envelope.ciphertext).slice().buffer);
    payload = JSON.parse(decoder.decode(plain));
  } catch { throw new Error('The passphrase is incorrect or the backup is damaged.'); }
  if (envelope.version === 2) return restoreLocalPayload(payload);
  const response = await fetch('/api/dive-backup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const result = await response.json() as {restored:number;skipped:number;conflicts:number;error?:string};
  if (!response.ok) throw new Error(result.error ?? 'Legacy cloud restore failed. Connect to the internet and try again.');
  return result;
}
