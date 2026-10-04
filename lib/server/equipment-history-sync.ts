import canonicalize from 'canonicalize';

const serverMetadata=new Set(['createdAt','modifiedAt','householdOwnerId','householdOwnedByMe','entityId']);
/** A retry may acknowledge already-saved evidence, but cannot revise it or restore a parent. */
export function unchangedEquipmentHistory(id:string,existing:Record<string,unknown>,incoming:Record<string,unknown>) {
  if ([existing,incoming].some(record=>record.entityId!==undefined&&record.entityId!==id)) return false;
  const content=(record:Record<string,unknown>)=>Object.fromEntries(Object.entries(record).filter(([key])=>!serverMetadata.has(key)));
  return canonicalize(content(existing))===canonicalize(content(incoming));
}

/** Explicit archival retains every historical field; revision and record-access checks still apply. */
export function archivesEquipmentHistoryOnly(id:string,existing:Record<string,unknown>,incoming:Record<string,unknown>) {
  if(incoming.archived!==true||incoming.suppressedFromUse!==true||typeof incoming.archivedAt!=='string'||!Number.isFinite(Date.parse(incoming.archivedAt)))return false;
  const archiveFields=new Set(['archived','suppressedFromUse','archivedAt']);
  const evidence=(record:Record<string,unknown>)=>Object.fromEntries(Object.entries(record).filter(([key])=>!archiveFields.has(key)));
  return unchangedEquipmentHistory(id,evidence(existing),evidence(incoming));
}
