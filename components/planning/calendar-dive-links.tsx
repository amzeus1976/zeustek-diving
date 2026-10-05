'use client';
import {useState} from 'react';
import {AccessibleDialog} from '../accessible-dialog';
import {normaliseCalendarDiveIds,saveCalendarDiveLinks,type CalendarBooking} from '../../lib/planning/calendar-booking-workflow';
import type {DiveRecord} from '../../lib/offline/dives';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import styles from './planning-pages.module.css';
type LoggedDive=DiveRecord&{entityId:string};
function diveLabel(dive:LoggedDive){return `#${dive.diveNumber??'—'} · ${dive.date}${dive.timeIn?` ${dive.timeIn}`:''} · ${dive.site||'Dive'}`;}
export function CalendarDiveLinks({item,dives,refresh,go}:{item:CalendarBooking;dives:LoggedDive[];refresh:()=>Promise<void>;go?:((route:string)=>void)|undefined}){
 const [editing,setEditing]=useState<CalendarBooking|null>(null);
 const linked=normaliseCalendarDiveIds(item.linkedDiveIds??[]);
 return <section className={styles.eventDives}><h3>Dives on this event ({linked.length})</h3>
 {linked.length?<ul>{linked.map(id=>{const dive=dives.find(row=>row.entityId===id);const destination=workflowDestinationUrl({route:'Logbook',recordId:id,params:{diveId:id}});return <li key={id}>{dive?<a className="focus-link" href={`/${destination}`} onClick={go?e=>{e.preventDefault();go(destination);}:undefined}>{diveLabel(dive)}</a>:<span>Linked Dive unavailable on this device</span>}</li>;})}</ul>:<p>No logged Dives linked yet.</p>}
 <button type="button" className="focus-secondary" onClick={()=>setEditing(item)}>Link / manage Dives</button>
 {editing&&<CalendarDiveLinkEditor item={editing} dives={dives} close={()=>setEditing(null)} saved={async()=>{setEditing(null);await refresh();}}/>}</section>;
}
export function CalendarDiveLinkEditor({item,dives,close,saved}:{item:CalendarBooking;dives:LoggedDive[];close:()=>void;saved:()=>Promise<void>}){
 const initial=normaliseCalendarDiveIds(item.linkedDiveIds??[]);const [selected,setSelected]=useState(initial),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const missing=initial.filter(id=>!dives.some(dive=>dive.entityId===id));const visible=dives.filter(dive=>diveLabel(dive).toLocaleLowerCase('en-GB').includes(query.trim().toLocaleLowerCase('en-GB')));
 function toggle(id:string,checked:boolean){setSelected(current=>checked?normaliseCalendarDiveIds([...current,id]):current.filter(value=>value!==id));}
 async function save(){if(busy)return;setBusy(true);setError('');try{await saveCalendarDiveLinks(item,selected);await saved();}catch(reason){setError(reason instanceof Error?reason.message:'Dive links could not be saved. Your selection is retained.');}finally{setBusy(false);}}
 return <AccessibleDialog label={`Link Dives to ${item.name}`} className={styles.calendarLinkDialog!} close={close} editable dirty={JSON.stringify(selected)!==JSON.stringify(initial)} trackInteractions={false}>
 <h2>Link logged Dives</h2><p>{item.name}</p><p>Choose all Dives belonging to this event. Removing a link keeps the Dive in your Logbook.</p>
 <label>Search logged Dives<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Dive number, date or Site"/></label>
 <p>{selected.length} selected · {visible.length} matching Dives</p><div className={styles.calendarDiveChoices}>
 {visible.map(dive=><label key={dive.entityId}><input type="checkbox" checked={selected.includes(dive.entityId)} onChange={e=>toggle(dive.entityId,e.target.checked)}/><span>{diveLabel(dive)}</span></label>)}
 {missing.map(id=><label key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>toggle(id,e.target.checked)}/><span>Previously linked Dive unavailable — retain or explicitly unlink</span></label>)}
 {!visible.length&&!missing.length&&<p>No matching logged Dives.</p>}</div>
 {error&&<p role="alert">{error}</p>}<footer className={styles.calendarLinkActions}><button type="button" className="focus-secondary" data-dialog-close disabled={busy} onClick={close}>Cancel</button><button type="button" className="focus-primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving links…':'Save Dive links'}</button></footer>
 </AccessibleDialog>;
}
