import { DIVE_RECORD_KINDS } from '../record-identity';

const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const sensitiveKey = (key: string) => /token|secret|password|authorization|cookie|credential|privatekey|apikey/i.test(key.replace(/[^a-z]/gi, ''));
const kinds: Record<string, string> = { dive:'Dive', equipment:'Equipment', 'equipment-event':'Equipment history', 'equipment-set':'Loadout', cylinder:'Cylinder', 'cylinder-fill':'Cylinder fill', 'gas-analysis':'Gas analysis', 'gas-plan':'Gas Plan', person:'Person', operator:'Dive Entity', certification:'Award', trip:'Dive Plan', 'dive-trip':'Trip', site:'Site', 'skill_evidence':'Skill evidence', skill:'Skill' };

/** Owner-only review/export data, never raw pending metadata or connection credentials. */
export function reviewRecordSnapshot(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (!object(value)) throw new Error('This record cannot be displayed safely.');
  let nodes = 0;
  const copy = (item: unknown, depth = 0): unknown => {
    if (++nodes > 50_000 || depth > 30) throw new Error('This record exceeds the supported review size. Its original data are retained.');
    if (Array.isArray(item)) return item.map(value => copy(value, depth + 1));
    if (object(item)) return Object.fromEntries(Object.keys(item).sort((a,b)=>a.localeCompare(b)).filter(key=>!sensitiveKey(key)).map(key=>[key,copy(item[key],depth+1)]));
    return item;
  };
  return copy(value) as Record<string, unknown>;
}
export function conflictExportPayload(value: unknown) {
  if (!object(value) || typeof value.kind !== 'string' || !(DIVE_RECORD_KINDS as readonly string[]).includes(value.kind)) throw new Error('Connection metadata and unsupported records cannot be exported here.');
  const result = { format:'zeustek-local-record-review', version:1, kind:value.kind, record:reviewRecordSnapshot(value.record) };
  if (JSON.stringify(result).length > 8_000_000) throw new Error('This record exceeds the supported review download size. Its original data are retained.');
  return result;
}
export function syncReviewSummary(value: unknown) {
  const row=object(value)?value:{}, record=object(row.record)?row.record:null;
  const kind=typeof row.kind==='string'?kinds[row.kind] ?? 'Saved record':'Saved record';
  const title=record ? [record.title,record.name,record.site,record.certification].find(value=>typeof value==='string'&&value.trim()) : null;
  const message=row.error==='Record is too large'||row.error==='Saved conditions exceed the supported size or contain invalid packed data. The original device record is retained.'
    ? 'This record exceeds the supported cloud upload limit. Your complete device copy is retained. Download it for review, then open and save the record again after reviewing its large fields. Other records can continue syncing.'
    : row.error==='Equipment for this history is unavailable. Review its Equipment record before syncing.'
    ? 'The Equipment reference is unavailable. Review differences. If the saved fields match, Use cloud version clears this pending copy without changing the cloud record. Otherwise review or restore the Equipment reference first. Your device copy is retained in the review archive.'
    : row.error==='Shared equipment access required for this history.'
    ? 'Shared equipment access is required for changes to this history. Review differences first: if the saved fields match, Use cloud version clears this pending copy without changing the cloud record. Otherwise check Equipment sharing permissions. Your device copy is retained.'
    : 'This change needs review before it can sync. Your device copy is retained.';
  return { kind, title:record ? typeof title==='string'?title.slice(0,200):`Untitled ${kind} record` : 'Pending deletion', message };
}
