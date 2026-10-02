'use client';
import {useState} from 'react';
import {RecordEditorWorkspace} from '../shared/record-editor-workspace';
import {saveReviewedCylinderNumber} from '../../lib/cylinders/cylinder-number-persistence';
import type {CylinderNumberIdentity} from '../../lib/cylinders/cylinder-number-review';

export function CylinderNumberReviewEditor({item,close,saved}:{item:CylinderNumberIdentity&{name:string;serialNumber?:string};close:()=>void;saved:()=>Promise<void>}){
 const [number,setNumber]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(){setBusy(true);setMessage('');try{
  if(!confirmed)throw new Error('Confirm this specific physical cylinder first.');
  await saveReviewedCylinderNumber({entityId:item.entityId,recordStorageKind:item.recordStorageKind,expectedNumber:item.cylinderNumber??null,expectedModifiedAt:item.modifiedAt,requestedNumber:number});
  await saved();close();
 }catch{setMessage('The number could not be changed. Refresh and review this cylinder’s revision and any number already in use. Your records remain available.');}finally{setBusy(false);}}
 return <RecordEditorWorkspace label={`Review cylinder number · ${item.name}`} close={close} save={save} saveLabel="Save reviewed number" saveDisabled={!confirmed||!number.trim()} busy={busy} value={{number,confirmed}} trackInteractions={false}>
  <p>Match this record to the physical tank before selecting a new display number. This changes one label; canonical identity and linked fills, analyses and plans remain unchanged.</p>
  <dl><dt>Cylinder</dt><dd>{item.name}</dd><dt>Serial number</dt><dd>{item.serialNumber||'Not recorded — verify identity carefully'}</dd><dt>Canonical record</dt><dd style={{overflowWrap:'anywhere'}}>{item.entityId}</dd><dt>Current display number</dt><dd>{typeof item.cylinderNumber==='string'?item.cylinderNumber:'Not recorded'}</dd></dl>
  <label>New display number (01–99)<input inputMode="numeric" maxLength={2} value={number} onChange={event=>setNumber(event.target.value)} /></label>
  <label><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>I have checked the physical tank and this exact record.</label>
  <p>The edit is retained locally if cloud synchronisation fails. Review any reported cloud conflict before relying on the corrected number.</p>
  {message&&<p role="alert">{message}</p>}
 </RecordEditorWorkspace>;
}
