'use client';
import { useCallback, useEffect, useState } from 'react';
import { currentDiveAccount, flushDiveChanges, pendingDiveChanges } from '@/lib/offline/dive-store';
import { useRecordRefresh } from './record-status';
import { DiveConflictReview } from './dive-conflict-review';
import type { JsonValue } from '@/lib/offline/types';
import { conflictExportPayload,syncReviewSummary } from '@/lib/offline/sync-review';

export function DiveSyncStatus() {
  const [pending,setPending]=useState<Array<{key:string;value:JsonValue}>>([]);
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [visible,setVisible]=useState(20);
  const refresh=useCallback(()=>{const owner=currentDiveAccount();void pendingDiveChanges().then(rows=>{if(currentDiveAccount()===owner){setPending(rows);setError('');}}).catch(()=>setError('Cloud sync status could not be read on this device. Your saved records are retained.'));},[]);useRecordRefresh(refresh);
  useEffect(()=>{void flushDiveChanges();const online=()=>{void flushDiveChanges();};window.addEventListener('online',online);const timer=setInterval(online,30_000);return()=>{window.removeEventListener('online',online);clearInterval(timer);};},[]);
  const accountPending=pending.filter(row=>row.key.startsWith(`pending:dive:${currentDiveAccount()}:`));
  const conflicts=accountPending.filter(row=>(row.value as {state?:string})?.state==='conflict');
  async function retry(){if(busy)return;setBusy(true);try{await flushDiveChanges();refresh();}finally{setBusy(false);}}
  function download(value:JsonValue){
    try{const payload=conflictExportPayload(value);const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='zeustek-local-record-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch{setError('This review download could not be created safely. Your original device record is retained.');}
  }
  if (!accountPending.length) return <span className="dive-sync-state" title="No edits on this device are waiting to upload. Other devices refresh when opened.">{error||'Cloud sync enabled'}</span>;
  return <details className="dive-sync-panel">
    <summary>{accountPending.length} cloud change{accountPending.length===1?'':'s'} pending{conflicts.length ? ` · ${conflicts.length} ${conflicts.length===1?'needs':'need'} review`:''}</summary>
    <div className="dive-sync-panel-body">
      <div className="dive-sync-panel-heading"><p>Your edits are saved on this device. Review each record separately.</p><button type="button" className="focus-secondary" disabled={busy} onClick={()=>void retry()}>{busy?'Syncing…':'Retry sync'}</button></div>
      {error&&<p role="alert">{error}</p>}
      <div className="dive-sync-review-list">{conflicts.slice(0,visible).map(row=>{const summary=syncReviewSummary(row.value);return <article className="dive-sync-review-record" key={row.key}>
        <div><small>{summary.kind}</small><h3>{summary.title}</h3><p>{summary.message}</p></div>
        <div className="dive-sync-review-actions"><DiveConflictReview recordKey={row.key} label={`Review differences for ${summary.title}`}/><button type="button" className="focus-secondary" onClick={()=>download(row.value)}>Download this device version</button></div>
      </article>;})}</div>
      {conflicts.length>visible&&<button type="button" className="focus-secondary" onClick={()=>setVisible(count=>count+20)}>Show more records ({conflicts.length-visible} remaining)</button>}
    </div>
  </details>;
}

