'use client';
import {useState} from 'react';
import {AccessibleDialog} from '../accessible-dialog';
import {removeRecord} from '../../lib/offline/dive-planning';
import {PlanningConnections} from './planning-connections';
export function DeletePlanningRecordDialog({record,label,close,deleted}:{record:{entityId:string;name:string};label:'plan'|'event'|'gas plan';close:()=>void;deleted:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function remove(){if(busy)return;setBusy(true);setError('');try{await removeRecord(record.entityId);await deleted();close();}catch(reason){setError(reason instanceof Error?reason.message:'Unable to delete. Your record is retained.');}finally{setBusy(false);}}
 return <AccessibleDialog label={`Delete ${label}`} className="focus-modal" close={()=>{if(!busy)close();}} trackInteractions={false}>
  <h2>Delete {label}?</h2><p><strong>{record.name}</strong></p><p>Remove this {label} from active records. Existing revision history is retained. Linked Dives, Trips, Gas Plans and skill evidence stay intact; any dependent references must be unlinked first.</p>
  <PlanningConnections recordId={record.entityId} changed={deleted}/>{error&&<p role="alert">{error}</p>}<footer style={{display:'flex',flexWrap:'wrap',gap:12}}><button type="button" className="focus-secondary" disabled={busy} onClick={close}>Keep {label}</button><button type="button" className="focus-secondary danger" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':`Delete ${label}`}</button></footer>
 </AccessibleDialog>;
}
