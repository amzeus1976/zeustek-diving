'use client';
import {useState} from 'react';
import {readDiveConflict,resolveDiveConflict} from '@/lib/offline/dive-store';
import {AccessibleDialog} from './accessible-dialog';
export function DiveConflictReview({recordKey}:{recordKey:string}){
  const [data,setData]=useState<Awaited<ReturnType<typeof readDiveConflict>>|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  async function open(){setBusy(true);try{setData(await readDiveConflict(recordKey));setMessage('');}catch(error){setMessage(error instanceof Error?error.message:'Could not load comparison.');}finally{setBusy(false);}}
  async function resolve(choice:'local'|'cloud'){
    if(!data||!confirm(`Use the ${choice==='local'?'local':'cloud'} version? Both versions will be retained in the review archive.`))return;
    setBusy(true);try{await resolveDiveConflict(recordKey,data.pending.token,choice);setData(null);}catch(error){setMessage(error instanceof Error?error.message:'Could not resolve this difference.');}finally{setBusy(false);}
  }
  const display=(value:unknown)=>value==null?'Not recorded':typeof value==='object'?JSON.stringify(value):String(value);
  const keys=[...new Set([...Object.keys(data?.pending.record??{}),...Object.keys(data?.cloud??{})])].filter(key=>!['id','entityId','createdAt','modifiedAt'].includes(key));
  return <><button className="focus-secondary" disabled={busy} onClick={()=>void open()}>Review differences</button>{message&&<p role="alert">{message}</p>}{data&&<AccessibleDialog className="focus-modal conflict-review" label="Review record differences" close={()=>setData(null)}><h2>Review differences</h2><p>Select the version to use. Previous versions remain archived.</p><div className="conflict-table"><table><thead><tr><th>Field</th><th>This device</th><th>Cloud</th></tr></thead><tbody>{keys.map(key=><tr key={key}><th>{key.replace(/([a-z])([A-Z])/g,'$1 $2')}</th><td>{display(data.pending.record?.[key])}</td><td>{display(data.cloud?.[key])}</td></tr>)}</tbody></table></div><footer><button className="focus-secondary" onClick={()=>setData(null)}>Close</button><button className="focus-secondary" disabled={busy} onClick={()=>void resolve('cloud')}>Use cloud version</button><button className="focus-primary" disabled={busy} onClick={()=>void resolve('local')}>Keep local version</button></footer></AccessibleDialog>}</>;
}
