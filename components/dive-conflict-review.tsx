'use client';
import {useState} from 'react';
import {readDiveConflict,resolveDiveConflict} from '@/lib/offline/dive-store';
import {AccessibleDialog} from './accessible-dialog';
import {reviewRecordSnapshot,syncReviewSummary} from '@/lib/offline/sync-review';

type ComparisonProps={local:Record<string,unknown>|null;cloud:Record<string,unknown>|null;busy:boolean;resolve:(choice:'local'|'cloud')=>void;close:()=>void;showUnchanged:boolean;changeShowUnchanged:(value:boolean)=>void};
const fieldLabel=(key:string)=>{const label=key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ');return label.charAt(0).toUpperCase()+label.slice(1);};
function RecordedValue({value,depth=0}:{value:unknown;depth?:number}){
  if(value==null||value==='')return <>Not recorded</>;
  if(typeof value==='boolean')return <>{value?'Yes':'No'}</>;
  if(typeof value==='string'||typeof value==='number')return <>{String(value)}</>;
  if(depth>=8)return <em>Further nested values are available in the device review download.</em>;
  if(Array.isArray(value))return value.length?<><ol>{value.slice(0,300).map((item,index)=><li key={`recorded-${index}`}><RecordedValue value={item} depth={depth+1}/></li>)}</ol>{value.length>300&&<p>Showing 300 of {value.length} entries. Download the device version for the remaining entries.</p>}</>:<>No entries</>;
  if(typeof value==='object'){const entries=Object.entries(value);return entries.length?<><dl>{entries.slice(0,300).map(([key,item])=><div key={key}><dt>{fieldLabel(key)}</dt><dd><RecordedValue value={item} depth={depth+1}/></dd></div>)}</dl>{entries.length>300&&<p>Further fields are available in the device review download.</p>}</>:<>No recorded fields</>;}
  return <>Not recorded</>;
}
export function ConflictComparison({local,cloud,busy,resolve,close,showUnchanged,changeShowUnchanged}:ComparisonProps){
  const keys=[...new Set([...Object.keys(local??{}),...Object.keys(cloud??{})])].filter(key=>!['id','entityId','createdAt','modifiedAt'].includes(key));
  const changed=keys.filter(key=>JSON.stringify(local?.[key])!==JSON.stringify(cloud?.[key]));
  const visible=showUnchanged?keys:changed;
  return <>
    <p className="conflict-field-count">{changed.length ? `${changed.length} ${changed.length===1?'field differs.':'fields differ.'}` : 'The recorded field values match.'} Previous versions remain archived.</p>
    {!changed.length&&<p>Sync permissions or the saved revision may still need review. Matching values do not prove that the cloud accepted this edit.</p>}
    <label className="conflict-show-all"><input type="checkbox" checked={showUnchanged} onChange={event=>changeShowUnchanged(event.target.checked)}/> Show unchanged fields</label>
    <div className="conflict-versions">
      <section className="conflict-version" data-version="local" aria-label="This device version">
        <h3>This device</h3>{local===null?<p>Deletion on this device</p>:<dl>{visible.map(key=><div key={key}><dt>{fieldLabel(key)}</dt><dd><RecordedValue value={local[key]}/></dd></div>)}</dl>}
        <button type="button" className="focus-primary" disabled={busy} onClick={()=>resolve('local')}>Keep this device version</button>
      </section>
      <section className="conflict-version" data-version="cloud" aria-label="Cloud version">
        <h3>Cloud</h3>{cloud===null?<p>The cloud record is unavailable. Refresh or check access before choosing a cloud version.</p>:<dl>{visible.map(key=><div key={key}><dt>{fieldLabel(key)}</dt><dd><RecordedValue value={cloud[key]}/></dd></div>)}</dl>}
        <button type="button" className="focus-secondary" disabled={busy||cloud===null} onClick={()=>resolve('cloud')}>Use cloud version</button>
      </section>
    </div>
    <footer className="conflict-close"><button type="button" className="focus-secondary" disabled={busy} onClick={close}>Close</button></footer>
  </>;
}
export function DiveConflictReview({recordKey,label='Review differences'}:{recordKey:string;label?:string}){
  const [data,setData]=useState<Awaited<ReturnType<typeof readDiveConflict>>|null>(null);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const [showUnchanged,setShowUnchanged]=useState(false);
  async function open(){if(busy)return;setBusy(true);try{const result=await readDiveConflict(recordKey);reviewRecordSnapshot(result.pending.record);reviewRecordSnapshot(result.cloud);setData(result);setShowUnchanged(false);setMessage('');}catch{setMessage('The cloud comparison could not be loaded. Connect, sign in and check access; your device copy is retained.');}finally{setBusy(false);}}
  async function resolve(choice:'local'|'cloud'){
    if(!data||!confirm(`Use the ${choice==='local'?'local':'cloud'} version? Both versions will be retained in the review archive.`))return;
    setBusy(true);try{await resolveDiveConflict(recordKey,data.pending.token,choice,data.cloud);setData(null);}catch{setMessage('The selected version could not be applied. Reopen the comparison and check access. Both saved versions are retained.');}finally{setBusy(false);}
  }
  const summary=data?syncReviewSummary(data.pending):null;
  return <><button type="button" className="focus-secondary" aria-disabled={busy} onClick={()=>void open()}>{label}</button>{message&&!data&&<p role="alert">{message}</p>}{data&&<AccessibleDialog className="focus-modal conflict-review" label="Review record differences" close={()=>{if(!busy)setData(null);}} containDismiss><h2>Review differences</h2><p className="conflict-record-name"><b>{summary?.kind}</b> · {summary?.title}</p><p>Select the version for this record. No other records will be changed by this choice.</p>{message&&<p role="alert">{message}</p>}<ConflictComparison local={reviewRecordSnapshot(data.pending.record)} cloud={reviewRecordSnapshot(data.cloud)} busy={busy} resolve={choice=>void resolve(choice)} close={()=>setData(null)} showUnchanged={showUnchanged} changeShowUnchanged={setShowUnchanged}/></AccessibleDialog>}</>;
}
