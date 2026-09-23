'use client';
import {useState} from 'react';
import type {DiveWithId} from '../../lib/offline/experience-analytics';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import styles from './analysis-workbench.module.css';
export function AnalysisSourceRecords({dives,excludedIds,changeExcluded,go}:{dives:DiveWithId[];excludedIds:string[];changeExcluded:(ids:string[])=>void;go?:((route:string)=>void)|undefined}){
  const [query,setQuery]=useState(''),[page,setPage]=useState(0);
  const matches=dives.filter(dive=>(dive.date+' '+dive.site+' '+(dive.diveNumber??'')).toLocaleLowerCase('en-GB').includes(query.toLocaleLowerCase('en-GB')));
  const current=Math.min(page,Math.max(0,Math.ceil(matches.length/25)-1));
  const setIncluded=(ids:string[],included:boolean)=>changeExcluded(included?excludedIds.filter(id=>!ids.includes(id)):[...new Set([...excludedIds,...ids])]);
  return <section aria-label="Source Dive records"><div className={styles.panelActions}>
    <label>Search source records<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label>
    <button className="focus-secondary" onClick={()=>setIncluded(matches.map(d=>d.entityId),true)}>Include all matching records</button>
    <button className="focus-secondary" onClick={()=>setIncluded(matches.map(d=>d.entityId),false)}>Exclude all matching records</button></div>
    <p>{dives.filter(d=>!excludedIds.includes(d.entityId)).length} of {dives.length} source Dives included. Changes affect this analysis only.</p>
    <div className={styles.sourceRows}>{matches.slice(current*25,current*25+25).map(dive=>{
      const label=[dive.diveNumber?'Dive '+dive.diveNumber:'Dive',dive.date,dive.site].join(' · ');
      const url=workflowDestinationUrl({route:'Logbook',recordId:dive.entityId});
      return <div className={styles.sourceRow} key={dive.entityId}>
        <label><input type="checkbox" aria-label={'Include '+label} checked={!excludedIds.includes(dive.entityId)} onChange={event=>setIncluded([dive.entityId],event.target.checked)}/></label>
        <div><a href={'/'+url} onClick={go?event=>{event.preventDefault();go(url);}:undefined}>{label}</a>
          {dive.siteId&&<a href={'/'+workflowDestinationUrl({route:'Sites',recordId:dive.siteId})} onClick={go?event=>{event.preventDefault();go(workflowDestinationUrl({route:'Sites',recordId:dive.siteId!}));}:undefined}>Open Site</a>}
          <small>{excludedIds.includes(dive.entityId)?'Excluded from analysis':'Included'} · record {dive.entityId.slice(-8)}</small></div>
        <small>{dive.maxDepthM??'Unknown'} m · {dive.totalElapsedMin??dive.bottomTimeMin??'Unknown'} min</small>
      </div>;
    })}</div>
    {!matches.length&&<p>No source records match this search.</p>}
    <div className={styles.panelActions}><button className="focus-secondary" disabled={!current} onClick={()=>setPage(current-1)}>Previous records</button><span>{matches.length} records · page {current+1} of {Math.max(1,Math.ceil(matches.length/25))}</span><button className="focus-secondary" disabled={(current+1)*25>=matches.length} onClick={()=>setPage(current+1)}>Next records</button></div>
  </section>;
}
