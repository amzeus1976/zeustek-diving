'use client';
import {X} from 'lucide-react';
import {AccessibleDialog} from '../accessible-dialog';
import {AnalysisSourceRecords} from './analysis-source-records';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import {resolveInsightHeadline,type HeadlineContext} from '../../lib/insights/headline-evidence';
import type {AnalysisScope} from '../../lib/offline/experience-analytics';
export function HeadlineAnalysis({id,context,sourceContext,scope,changeScope,close,go}:{id:string;context:HeadlineContext;sourceContext:HeadlineContext;scope:AnalysisScope;changeScope:(value:AnalysisScope)=>void;close:()=>void;go?:((route:string)=>void)|undefined}){
 const headline=resolveInsightHeadline(id,context), evidence=resolveInsightHeadline(id,sourceContext);
 if(!headline||!evidence)return null;
 const sourceDives=headline.personId?sourceContext.dives.filter(dive=>(dive.buddyIds??[]).includes(headline.personId!)):sourceContext.dives.filter(dive=>evidence.sourceIds.includes(dive.entityId));
 const person=context.people?.find(row=>row.entityId===headline.personId);
 const personUrl=headline.personId?workflowDestinationUrl({route:'People',recordId:headline.personId}):null;
 return <div className="focus-modal-bg"><AccessibleDialog label={headline.label+' analysis'} close={close} className="focus-modal"><header><div><span className="focus-eyebrow">ANALYSIS EVIDENCE</span><h2>{headline.label}</h2><p>{headline.value}</p><p>{headline.sourceLabel}</p></div><button className="focus-icon" aria-label="Close analysis" onClick={close}><X/></button></header><p>{headline.explanation}</p>
 {personUrl&&<p><a href={'/'+personUrl} onClick={go?event=>{event.preventDefault();close();go(personUrl);}:undefined}>Open {person?.displayName||person?.name||'linked Person'} in People</a></p>}
 {headline.sourceKind==='dive'?<AnalysisSourceRecords dives={sourceDives} excludedIds={scope.excludedDiveIds} changeExcluded={excludedDiveIds=>changeScope({...scope,excludedDiveIds})} go={go}/>:<section aria-label="Canonical award evidence">{headline.sourceIds.map(recordId=>{
   const cert=context.certifications.find(item=>item.entityId===recordId);
   const route=headline.sourceKind==='person'?'People':'Training';
   const url=workflowDestinationUrl({route,recordId});
   return <p key={recordId}><a href={'/'+url} onClick={go?event=>{event.preventDefault();close();go(url);}:undefined}>{cert?[cert.agency,cert.certification,cert.issuedAt].filter(Boolean).join(' · '):'Open owner Person profile'}</a></p>;
 })}{!headline.sourceIds.length&&<p>No canonical source record is available. No Dive-count substitution is made.</p>}</section>}
 </AccessibleDialog></div>;
}
