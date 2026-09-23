'use client';
import {useState} from 'react';
import {RecordEditorWorkspace} from '../shared/record-editor-workspace';
import {AccessibleDialog} from '../accessible-dialog';
import {saveBuddyLinks} from '../../lib/people/save-buddy-links';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import {personDisplayName,type StoredPerson} from '../../lib/offline/people-profiles';
import type {DiveRecord} from '../../lib/offline/dives';
import styles from './buddy-dive-workspace.module.css';
type Dive=DiveRecord&{entityId:string};
export const hasDivePerson=(dive:Dive,id:string)=>[...(dive.buddyIds??[]),...(dive.diveTeamIds??[]),dive.diveLeaderId].includes(id);
export function BuddyDiveWorkspace({person,dives,close,saved,go}:{person:StoredPerson;dives:Dive[];close:()=>void;saved:()=>void;go?:((route:string)=>void)|undefined}){
  const [selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(''),[page,setPage]=useState(0),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [mode,setMode]=useState<'shared'|'available'>('shared');
  const shared=dives.filter(dive=>person.roles?.ownerProfile||hasDivePerson(dive,person.entityId));
  const source=mode==='shared'?shared:dives.filter(dive=>!(dive.buddyIds??[]).includes(person.entityId));
  const matches=source.filter(dive=>(dive.date+' '+dive.site+' '+(dive.diveNumber??'')).toLowerCase().includes(query.toLowerCase())),current=Math.min(page,Math.max(0,Math.ceil(matches.length/30)-1));
  async function confirm(){
    setBusy(true);setError('');
    try{await saveBuddyLinks(person.entityId,selected,dives);setSelected([]);setReview(false);setMode('shared');saved();}
    catch(reason){setError(reason instanceof Error?reason.message:'Links could not be saved.');}
    finally{setBusy(false);}
  }
  return <RecordEditorWorkspace label={'Dives with '+personDisplayName(person)} value={selected} trackInteractions={false} busy={busy} close={close} save={()=>setReview(true)} saveLabel="Review selected links" saveDisabled={!selected.length||busy}>
    <p>{shared.length} linked Dive records. Linking adds this Person to the selected Dives’ buddies and team; other facts and existing people are preserved.</p>
    <div className={styles.actions}><button className="focus-secondary" aria-pressed={mode==='shared'} onClick={()=>{setMode('shared');setPage(0);}}>Dives together</button>{!person.roles?.ownerProfile&&<button className="focus-secondary" aria-pressed={mode==='available'} onClick={()=>{setMode('available');setPage(0);}}>Link historical Dives</button>}
      <label>Search Dives<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label><strong>{selected.length} selected</strong>{selected.length>0&&<button className="focus-secondary" onClick={()=>setSelected([])}>Clear selection</button>}</div>
    <div className={styles.rows}>{matches.slice(current*30,current*30+30).map(dive=>{
      const label=[dive.diveNumber?'#'+dive.diveNumber:'Dive',dive.date,dive.site].join(' · '),destination=workflowDestinationUrl({route:'Logbook',recordId:dive.entityId});
      return <div className={styles.row} key={dive.entityId}>{mode==='available'&&<label><input type="checkbox" aria-label={'Link '+label} checked={selected.includes(dive.entityId)} disabled={!selected.includes(dive.entityId)&&selected.length>=200} onChange={event=>setSelected(current=>event.target.checked?[...current,dive.entityId]:current.filter(id=>id!==dive.entityId))}/></label>}
        <a href={'/'+destination} onClick={go?event=>{event.preventDefault();go(destination);}:undefined}>{label}</a><span>{dive.maxDepthM??'Unknown'} m</span></div>;
    })}</div>{!matches.length&&<p>No Dives match this view.</p>}
    <div className={styles.actions}><button className="focus-secondary" disabled={!current} onClick={()=>setPage(current-1)}>Previous Dives</button><span>{matches.length} Dives · page {current+1} of {Math.max(1,Math.ceil(matches.length/30))}</span><button className="focus-secondary" disabled={(current+1)*30>=matches.length} onClick={()=>setPage(current+1)}>Next Dives</button></div>
    {review&&<AccessibleDialog label="Confirm historical buddy links" className="focus-modal" close={()=>{if(!busy)setReview(false);}}>
      <h2>Link {selected.length} Dives to {personDisplayName(person)}?</h2><p>All selected links save together. If any record changed, none are saved.</p>
      <ul>{dives.filter(dive=>selected.includes(dive.entityId)).map(dive=><li key={dive.entityId}>{dive.date} · {dive.site}</li>)}</ul>
      {error&&<p role="alert">{error}</p>}<footer><button className="focus-secondary" disabled={busy} onClick={()=>setReview(false)}>Keep reviewing</button><button className="focus-primary" disabled={busy} onClick={()=>void confirm()}>{busy?'Linking…':'Confirm links'}</button></footer>
    </AccessibleDialog>}
  </RecordEditorWorkspace>;
}
