'use client';
import {useCallback,useState} from 'react';
import {RecordEditorWorkspace} from '../shared/record-editor-workspace';
import {AccessibleDialog} from '../accessible-dialog';
import {listDives,type DiveRecord} from '../../lib/offline/dives';
import {useRecordRefresh} from '../record-status';
import {linkLoggedDiveToPlan} from '../../lib/planning/dive-plan-workflow';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import type {StoredEnrichedDivePlan} from '../../lib/offline/dive-planning-centre';
import styles from '../people/buddy-dive-workspace.module.css';

export function LinkLoggedDive({plan,close,saved}:{plan:StoredEnrichedDivePlan;close:()=>void;saved:()=>void|Promise<void>}){
 const [dives,setDives]=useState<Array<DiveRecord&{entityId:string}>>([]);
 const [selected,setSelected]=useState<DiveRecord&{entityId:string}|null>(null);
 const [query,setQuery]=useState('');const [page,setPage]=useState(0);const [review,setReview]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const refresh=useCallback(async()=>setDives(await listDives()),[]);useRecordRefresh(refresh);
 const visible=dives.filter(dive=>!dive.originatingPlanId&&`${dive.site} ${dive.date} ${dive.diveNumber??''}`.toLowerCase().includes(query.toLowerCase()));
 async function link(){if(!selected)return;setBusy(true);setError('');try{await linkLoggedDiveToPlan(plan.entityId,selected.entityId,selected.modifiedAt);await saved();}catch(reason){setReview(false);setError(reason instanceof Error?reason.message:'Unable to link. Review and retry.');}finally{setBusy(false);}}
 return <RecordEditorWorkspace label={`Link logged Dive to ${plan.name}`} close={close} value={selected?.entityId??''} trackInteractions={false} busy={busy} saveDisabled={!selected} saveLabel="Review link" save={()=>setReview(true)}>
  <p>Select one existing log. Its recorded depth, time, Site and notes are preserved. The Plan revision is saved with the Dive; the Plan lifecycle remains unchanged.</p>
  <label>Search logged Dives<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
  <div className={styles.rows}>{visible.slice(page*25,(page+1)*25).map(dive=><label className={styles.row} key={dive.entityId}><input type="radio" name="linked-dive" checked={selected?.entityId===dive.entityId} onChange={()=>setSelected(dive)}/><span>{dive.date} · {dive.site} · {dive.maxDepthM??'Unknown'} m</span><a href={'/'+workflowDestinationUrl({route:'Logbook',recordId:dive.entityId})}>View log</a></label>)}</div>
  {!visible.length&&<p>No unlinked Dives match.</p>}<div><button type="button" disabled={page===0} onClick={()=>setPage(page-1)}>Previous Dives</button><span> Page {page+1} · {visible.length} Dives </span><button type="button" disabled={(page+1)*25>=visible.length} onClick={()=>setPage(page+1)}>Next Dives</button></div>
  {error&&<p role="alert">{error}</p>}{review&&selected&&<AccessibleDialog label="Confirm Plan link" close={()=>{if(!busy)setReview(false);}} className="focus-modal" containDismiss><h2>Link {selected.date} · {selected.site}?</h2><p>Save its connection to {plan.name} and this immutable Plan revision.</p><footer><button disabled={busy} onClick={()=>setReview(false)}>Keep reviewing</button><button disabled={busy} onClick={()=>void link()}>{busy?'Linking…':'Confirm link'}</button></footer></AccessibleDialog>}
 </RecordEditorWorkspace>;
}
