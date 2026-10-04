'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {currentDiveAccount} from '../../lib/offline/dive-store';
import {readOwnerDataSnapshot} from '../../lib/data-health/read-owner-snapshot';
import {evaluateDataHealth,createDataHealthReport,dataHealthReportCsv,type DataHealthResult,type HealthFinding} from '../../lib/data-health/health-model';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import {useOwnerDataReviewPermission} from './use-owner-data-review';
import styles from './data-review.module.css';

type Go=((destination:string)=>void)|undefined;
function FindingCard({finding,go}:{finding:HealthFinding;go?:Go}){
 const [page,setPage]=useState(0);const pages=Math.max(1,Math.ceil(finding.destinations.length/25));const safePage=Math.min(page,pages-1);
 return <article className={styles.finding}><header><h3>{finding.checkId.replaceAll('-',' ')} · {finding.severity==='unknown'?'Unknown':finding.severity==='info'?'Recorded evidence':'Needs review'}</h3><strong>{finding.count} affected records</strong></header>
  <p>{finding.explanation}</p><p className={styles.nextStep}>{finding.nextStep}</p>
  {finding.destinations.length>0&&<><ul className={styles.sources}>{finding.destinations.slice(safePage*25,(safePage+1)*25).map((destination,index)=>{const url=workflowDestinationUrl(destination);return <li key={url}><a href={`/${url}`} onClick={go?event=>{event.preventDefault();go(url);}:undefined}>Review source {safePage*25+index+1} · {destination.route}</a></li>;})}</ul>
   {pages>1&&<div className={styles.controls}><button className="focus-secondary" disabled={safePage===0} onClick={()=>setPage(safePage-1)} aria-label={`Previous affected sources for ${finding.reason}`}>Previous</button><output>{safePage*25+1}–{Math.min((safePage+1)*25,finding.destinations.length)} of {finding.destinations.length}</output><button className="focus-secondary" disabled={safePage+1>=pages} onClick={()=>setPage(safePage+1)} aria-label={`Next affected sources for ${finding.reason}`}>Next</button></div>}
  </>}
 </article>;
}
export function DataHealthResults({result,go}:{result:DataHealthResult;go?:Go}){
 const [severity,setSeverity]=useState('all'),[check,setCheck]=useState('all');
 const filtered=useMemo(()=>result.findings.filter(item=>(severity==='all'||item.severity===severity)&&(check==='all'||item.checkId===check)),[result,severity,check]);
 return <section className={styles.results} aria-label="Data-health inspection results"><p className={styles.scope}>Last device snapshot · {result.snapshotAt} · {result.totalChecked} records inspected. This is not a fresh cloud audit and not a safety, qualification or readiness assessment.</p>
  {result.coverageUnknown&&<output>Unknown coverage: {result.unknownKinds.join(', ')}. No provider or cloud refresh was requested.</output>}
  <fieldset className={styles.filters}><legend>Inspection filters</legend><label>Observation<select value={check} onChange={event=>setCheck(event.target.value)}><option value="all">All checks</option>{['coverage','dates','references','imports','images','completeness'].map(value=><option key={value} value={value}>{value}</option>)}</select></label><label>Review state<select value={severity} onChange={event=>setSeverity(event.target.value)}><option value="all">All states</option><option value="warning">Needs review</option><option value="unknown">Unknown</option><option value="info">Recorded evidence</option></select></label></fieldset>
  {filtered.length?filtered.map(item=><FindingCard key={`${result.snapshotAt}:${item.reason}`} finding={item} go={go}/>):<p>No observations in this selection. Unsupported checks remain Unknown; this does not establish diving safety or compliance.</p>}
 </section>;
}
export function DataHealthWorkspace({go}:{go?:Go}){
 const allowed=useOwnerDataReviewPermission(),account=currentDiveAccount();
 const [inspected,setInspected]=useState<{accountId:string;version:number;result:DataHealthResult}|null>(null);
 const [operation,setOperation]=useState<{accountId:string;busy:boolean}|null>(null);
 const [stale,setStale]=useState(false),[message,setMessage]=useState('');
 const sequence=useRef({value:0});
 const result=allowed&&inspected?.accountId===account?inspected.result:null;
 const busy=allowed&&operation?.accountId===account&&operation.busy;
 useEffect(()=>{
  const state=sequence.current;
  const changed=()=>{state.value++;setOperation(null);setStale(true);};
  window.addEventListener('zeustek-records-updated',changed);
  return()=>{state.value++;window.removeEventListener('zeustek-records-updated',changed);};
 },[]);
 useEffect(()=>{if(!allowed)sequence.current.value++;},[allowed]);
 async function inspect(){
  if(!allowed||busy||currentDiveAccount()!==account)return;
  const token=++sequence.current.value;setOperation({accountId:account,busy:true});setStale(true);setMessage('');
  try{
   const snapshot=await readOwnerDataSnapshot(account),review=evaluateDataHealth(snapshot);
   if(token===sequence.current.value&&currentDiveAccount()===account){setInspected({accountId:account,version:token,result:review});setStale(false);}
  }catch{if(token===sequence.current.value)setMessage('Inspection unavailable. Your saved records remain unchanged. Reopen this tool in the current account.');}
  finally{if(token===sequence.current.value)setOperation(null);}
 }
 function download(format:'json'|'csv'){
  if(!allowed||!result||stale||currentDiveAccount()!==inspected?.accountId||sequence.current.value!==inspected.version)return;
  const content=format==='json'?JSON.stringify(createDataHealthReport(result),null,2):dataHealthReportCsv(result);
  const url=URL.createObjectURL(new Blob([content],{type:format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'}));
  try{const anchor=document.createElement('a');anchor.href=url;anchor.download=`zeustek-data-review.${format}`;anchor.click();}
  finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
 }
 if(!allowed)return <p>Evidence and data review is available only to the signed-in owner.</p>;
 return <section className={styles.workspace}><h2>Evidence &amp; data health</h2><p>Inspect recorded dates, links, staged imports, declared images and evidence completeness. Corrections stay in their canonical editors and require your explicit Save. This tool does not repair, merge, delete, fetch providers or synchronise records.</p>
  <div className={styles.controls}><button className="focus-primary" disabled={Boolean(busy)} onClick={()=>void inspect()}>{busy?'Inspecting…':'Inspect device snapshot'}</button>
   {busy&&<button className="focus-secondary" onClick={()=>{sequence.current.value++;setOperation(null);setStale(true);setMessage('Inspection cancelled. No records were changed.');}}>Cancel inspection</button>}
   {result&&<><button className="focus-secondary" disabled={stale} onClick={()=>download('json')}>Download safe JSON report</button><button className="focus-secondary" disabled={stale} onClick={()=>download('csv')}>Download safe CSV report</button></>}
  </div>
  {message&&<output>{message}</output>}{stale&&result&&<output>Records changed after this inspection. Inspect again before downloading a current report.</output>}
  {result&&<DataHealthResults result={result} go={go}/>}
 </section>;
}
