'use client';
import { useCallback, useEffect, useState } from 'react';
import { flushDiveChanges, pendingDiveChanges } from '@/lib/offline/dive-store';
import { useRecordRefresh } from './record-status';
import { DiveConflictReview } from './dive-conflict-review';
import type { JsonValue } from '@/lib/offline/types';

export function DiveSyncStatus() {
  const [pending,setPending]=useState<Array<{key:string;value:JsonValue}>>([]);
  const refresh=useCallback(()=>{void pendingDiveChanges().then(setPending);},[]);useRecordRefresh(refresh);
  useEffect(()=>{void flushDiveChanges();const online=()=>{void flushDiveChanges();};window.addEventListener('online',online);const timer=setInterval(online,30_000);return()=>{window.removeEventListener('online',online);clearInterval(timer);};},[]);
  const conflicts=pending.filter(row=>(row.value as {state?:string})?.state==='conflict');
  if (!pending.length) return <span className="dive-sync-state" title="Cross-device cloud sync is enabled. No edits on this device are waiting to upload. Other devices refresh when opened.">Cloud sync enabled</span>;
  return <details className="dive-sync-state"><summary>{pending.length} cloud changes pending{conflicts.length ? ` · ${conflicts.length} need review`:''}</summary><p>Your edits are saved on this device.</p><button className="focus-secondary" onClick={()=>void flushDiveChanges()}>Retry sync</button>{conflicts.map(row=><div key={row.key}><DiveConflictReview recordKey={row.key}/><p>{String((row.value as {error?:string}).error ?? 'Review conflicting changes')}</p><button className="focus-secondary" onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(row.value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='zeustek-local-conflict.json';a.click();URL.revokeObjectURL(url);}}>Export local version for review</button></div>)}</details>;
}

