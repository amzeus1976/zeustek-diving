'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {readPlanningConnections,unlinkPlanningConnection,type PlanningConnection} from '../../lib/offline/planning-connections';
import styles from './planning-connections.module.css';
export function PlanningConnections({recordId,changed}:{recordId:string;changed:()=>void|Promise<void>}){
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [panel,setPanel]=useState<Awaited<ReturnType<typeof readPlanningConnections>>|null>(null),[review,setReview]=useState<PlanningConnection|null>(null);const generation=useRef(0);
 const refresh=useCallback(async()=>{const request=++generation.current;setLoading(true);setError('');setReview(null);try{const next=await readPlanningConnections(recordId,true);if(request===generation.current)setPanel(next);}catch(reason){if(request===generation.current)setError(reason instanceof Error?reason.message:'Links could not be loaded.');}finally{if(request===generation.current)setLoading(false);}},[recordId]);
 useEffect(()=>{const invalidate=()=>{generation.current++;};const frame=open?requestAnimationFrame(()=>void refresh()):null;return()=>{if(frame!==null)cancelAnimationFrame(frame);invalidate();};},[open,refresh]);
 async function unlink(){if(!review||busy)return;setBusy(true);setError('');try{await unlinkPlanningConnection(review);setNotice('Link removed on this device. Both records are retained. Wait for cloud sync before deleting.');await changed();await refresh();}catch(reason){setError(reason instanceof Error?reason.message:'The link could not be removed. Your records are retained.');}finally{setBusy(false);}}
 return <section className={styles.panel} aria-label="Planning connections"><button type="button" className="focus-secondary" aria-expanded={open} disabled={busy} onClick={()=>setOpen(value=>!value)}>{open?'Minimise linked records':'Manage / unlink linked records'}</button>{open&&<div className={styles.content}>
 <h3>Linked records</h3><p>Unlink a connection before deleting either record. Unlinking keeps their details and evidence.</p>
 <button type="button" className="focus-secondary" disabled={busy||loading} onClick={()=>void refresh()}>Refresh links</button>{loading&&<output>Loading links…</output>}
 {!loading&&panel&&!panel.connections.length&&<p>No planning connections found. You can now use Delete; cloud dependency checks still apply.</p>}
 {!loading&&panel&&<ul className={styles.list}>{panel.connections.map(link=><li key={link.key}><div>{link.other.available?<a className="focus-link" href={link.other.href}>{link.other.name}</a>:<strong>{link.other.name}</strong>}<small>{link.other.available?'Both records stay intact.':'Historical reference: remove this link only if intended.'}</small></div><button type="button" className="focus-secondary" disabled={busy} onClick={()=>{setReview(link);setError('');setNotice('');}}>Unlink {link.other.name}</button></li>)}</ul>}
 {review&&<fieldset className={styles.review} aria-label="Review unlink"><legend>Unlink these records?</legend><p><strong>{panel?.target.name}</strong> ↔ <strong>{review.other.name}</strong></p><p>Remove this association from both records wherever it is stored. Keep every record, note, itinerary item and attachment.</p><div className={styles.actions}><button type="button" className="focus-secondary" disabled={busy} onClick={()=>setReview(null)}>Keep link</button><button type="button" className="focus-primary" disabled={busy} onClick={()=>void unlink()}>{busy?'Unlinking…':'Confirm unlink'}</button></div></fieldset>}
 {notice&&<output>{notice}</output>}{error&&<p role="alert">{error}</p>}
 </div>}</section>;
}
