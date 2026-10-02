'use client';
import {useEffect,useRef,useState} from 'react';
import {CalendarExport} from './calendar-export';
import {useOwnerDataReviewPermission} from '../admin/use-owner-data-review';
import {currentDiveAccount} from '../../lib/offline/dive-store';
import {readOwnerDataSnapshot,type OwnerDataSnapshot} from '../../lib/data-health/read-owner-snapshot';
import {readCalendarDelivery,saveCalendarDelivery} from '../../lib/calendar/calendar-delivery';
import type {CalendarRevisionManifest} from '../../lib/calendar/calendar-revisions';
import styles from '../admin/data-review.module.css';
export function CalendarDownloadWorkspace({go}:{go?:((destination:string)=>void)|undefined}){
 const allowed=useOwnerDataReviewPermission(),account=currentDiveAccount();const [snapshot,setSnapshot]=useState<OwnerDataSnapshot|null>(null),[history,setHistory]=useState<CalendarRevisionManifest|undefined>(),[operation,setOperation]=useState<{accountId:string;busy:boolean}|null>(null),[message,setMessage]=useState('');const version=useRef({value:0});
 const busy=allowed&&operation?.accountId===account&&operation.busy;
 const source=snapshot?.accountId===account?snapshot:null;
 useEffect(()=>{const state=version.current;const invalidate=()=>{state.value++;setSnapshot(null);setOperation(null);setMessage('Records changed. Inspect again before downloading a calendar.');};window.addEventListener('zeustek-records-updated',invalidate);return()=>{state.value++;window.removeEventListener('zeustek-records-updated',invalidate);};},[]);
 useEffect(()=>{if(!allowed)version.current.value++;},[allowed]);
 async function inspect(){if(!allowed||busy||currentDiveAccount()!==account)return;const token=++version.current.value;setOperation({accountId:account,busy:true});setMessage('');try{const [source,manifest]=await Promise.all([readOwnerDataSnapshot(account),readCalendarDelivery(account)]);if(token===version.current.value){setSnapshot(source);setHistory(manifest);}}catch{if(token===version.current.value){setSnapshot(null);setMessage('Calendar inspection unavailable. Source records and existing download history remain unchanged. Reopen the tool in the current account.');}}finally{if(token===version.current.value)setOperation(null);}}
 async function downloaded(manifest:CalendarRevisionManifest){if(!allowed||!snapshot||!history||currentDiveAccount()!==snapshot.accountId)throw new Error('Inspect the current calendar before downloading.');await saveCalendarDelivery(snapshot.accountId,manifest,history);setHistory(manifest);}
 if(!allowed)return null;
 return <section className={styles.workspace} aria-label="Calendar download"><div className={styles.controls}><button className="focus-secondary" disabled={Boolean(busy)} onClick={()=>void inspect()}>{busy?'Inspecting calendar…':source?'Refresh calendar preview':'Choose calendar download'}</button>{source&&<button className="focus-secondary" onClick={()=>{version.current.value++;setSnapshot(null);setOperation(null);}}>Close calendar preview</button>}</div>{message&&<output>{message}</output>}{source&&history&&<CalendarExport snapshot={source} revisionManifest={history} onDownloadManifest={downloaded} go={go}/>}</section>;
}
