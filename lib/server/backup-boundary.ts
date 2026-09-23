import { DIVE_RECORD_KINDS } from '../record-identity';
const allowed=new Set<string>(DIVE_RECORD_KINDS);
/** Server connection secrets and future service metadata are never backup records. */
export function exportableCloudRows<T extends {kind:unknown}>(rows:readonly T[]):T[]{return rows.filter(row=>typeof row.kind==='string'&&allowed.has(row.kind));}
