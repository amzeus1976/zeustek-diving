'use client';
import {useId,useMemo,useRef,useState} from 'react';
import {workflowDestinationUrl} from '../../lib/workflow/workflow-destination';
import {buildTopicProjection,TOPIC_FAMILIES,type TopicFamily,type TopicItem,type TopicSettings,type TopicSnapshot} from '../../lib/insights/topic-explorer';
import styles from './analysis-workbench.module.css';

export const TOPIC_FAMILY_LABELS:Record<TopicFamily,string>={knowledge:'Knowledge',bibliography:'Bibliography',news:'News',skills:'Skills',training:'Training & awards',dives:'Related Dives',sites:'Related Sites'};
export function topicRecordDestination(item:TopicItem){
 const routes:Record<string,string>={dive:'Logbook',site:'Sites',skill:'Skills & Currency',skill_evidence:'Skills & Currency',certification:'Training'};
 const route=routes[item.kind];if(!route||!item.recordId)return null;
 return workflowDestinationUrl(item.kind==='skill_evidence'?{route,params:{evidenceId:item.recordId}}:{route,recordId:item.recordId});
}
export function topicFamilyPage(items:readonly TopicItem[],family:TopicFamily,page:number){
 const matches=items.filter(item=>item.family===family),pages=Math.max(1,Math.ceil(matches.length/25));
 const current=Math.min(pages-1,Math.max(0,Number.isSafeInteger(page)?page:0));
 return {rows:matches.slice(current*25,current*25+25),count:matches.length,pages,current};
}
export function TopicRecordedSource({item,close,go}:{item:TopicItem;close:()=>void;go?:((route:string)=>void)|undefined}){
 const destination=topicRecordDestination(item);
 return <section className={styles.topicSource} aria-label="Exact recorded topic source">
  <header><h3>{item.title}</h3><button type="button" className="focus-secondary" onClick={close}>Close record view</button></header>
  <p>{item.status} · {item.matchClass}</p><p>{item.reason}</p>
  {item.setVersion!==undefined&&<p>{item.kind==='test-attempt'?'Historical':'Recorded'} version {item.setVersion} · question {item.questionId} · bank {item.setId}</p>}
  <dl>{item.details.map(detail=><div key={detail.label}><dt>{detail.label}</dt><dd>{detail.value}</dd></div>)}</dl>
  <div className={styles.panelActions}>{destination&&<a className="focus-secondary" href={'/'+destination} onClick={go?event=>{event.preventDefault();go(destination);}:undefined}>Open canonical record</a>}
   {item.url&&<a className="focus-secondary" href={item.url} target="_blank" rel="noopener noreferrer nofollow">Open recorded external source</a>}</div>
 </section>;
}
function TopicSourceGroups({items,go}:{items:TopicItem[];go?:((route:string)=>void)|undefined}){
 const [pages,setPages]=useState<Partial<Record<TopicFamily,number>>>({}),[selected,setSelected]=useState<string|null>(null);
 const triggers=useRef(new Map<string,HTMLButtonElement>());
 return <><div className={styles.topicGroups}>{TOPIC_FAMILIES.map(family=>{
  const result=topicFamilyPage(items,family,pages[family]??0);if(!result.count)return null;
  return <section key={family} aria-label={TOPIC_FAMILY_LABELS[family]}><h3>{TOPIC_FAMILY_LABELS[family]} <small>({result.count})</small></h3>
   <ul>{result.rows.map(item=><li key={item.id}><button type="button" ref={node=>{if(node)triggers.current.set(item.id,node);else triggers.current.delete(item.id);}} className={styles.topicRecord} aria-expanded={selected===item.id} onClick={()=>setSelected(current=>current===item.id?null:item.id)}><strong>{item.title}</strong><span>{item.status} · {item.matchClass}</span><small>{item.reason}</small></button>{selected===item.id&&<TopicRecordedSource item={item} close={()=>{setSelected(null);triggers.current.get(item.id)?.focus();}} go={go}/>}</li>)}</ul>
   <div className={styles.panelActions}><button type="button" className="focus-secondary" aria-label={'Previous '+TOPIC_FAMILY_LABELS[family]+' records'} disabled={!result.current} onClick={()=>setPages(current=>({...current,[family]:result.current-1}))}>Previous</button>
    <span>Page {result.current+1} of {result.pages} · {result.count} records</span><button type="button" className="focus-secondary" aria-label={'Next '+TOPIC_FAMILY_LABELS[family]+' records'} disabled={result.current+1>=result.pages} onClick={()=>setPages(current=>({...current,[family]:result.current+1}))}>Next</button></div>
  </section>;
 })}</div></>;
}
export function TopicExplorerView({snapshot,settings,includedDiveIds,onQuery,expanded=false,explore,go}:{snapshot:TopicSnapshot|null;settings:TopicSettings;includedDiveIds:string[];onQuery:(query:string)=>void;expanded?:boolean;explore?:()=>void;go?:((route:string)=>void)|undefined}){
 const optionsId=useId();
 const result=useMemo(()=>snapshot?buildTopicProjection(snapshot,{...settings,includedDiveIds}):null,[snapshot,settings,includedDiveIds]);
 return <div className={styles.topicExplorer}><label className={styles.topicQuery}>Topic or phrase<input aria-label="Topic or phrase" maxLength={160} value={settings.query} list={optionsId} onChange={event=>onQuery(event.target.value)} placeholder="Choose a recorded topic or enter a phrase"/></label>
  <datalist id={optionsId}>{result?.topics.map(label=><option key={label} value={label}>{label}</option>)}</datalist>
  <p className={styles.topicScope}>Library material uses recorded topics and text; related Dives and Sites follow the current Analysis Scope. No records are changed.</p>
  {result&&<><p>{result.items.length} matching source records · {settings.mode==='explicit-only'?'Explicit topics only':'Explicit topics and recorded text'}</p>
   {result.partial&&<p className={styles.topicNotice}>Some cached sources are unavailable or incomplete. Open their workspace to load records, then refresh cached evidence here.</p>}
   {result.unavailableReferences>0&&<p>{result.unavailableReferences} saved references could not be resolved. No substitute records were used.</p>}
   {result.truncated&&<p>Showing a bounded subset. Narrow the phrase or source selection.</p>}
   {!settings.query.trim()?<p>Choose a topic to explore your recorded material.</p>:!result.items.length?<p>No recorded sources match this topic and source selection.</p>:expanded?<TopicSourceGroups key={settings.query+'-'+settings.mode+'-'+settings.sources.join(',')} items={result.items} go={go}/>:<>
    <ul className={styles.topicCounts}>{TOPIC_FAMILIES.filter(family=>result.items.some(item=>item.family===family)).map(family=><li key={family}>{TOPIC_FAMILY_LABELS[family]} <strong>{result.items.filter(item=>item.family===family).length}</strong></li>)}</ul>
    <button type="button" className="focus-secondary" onClick={explore}>Explore topic and source records</button></>}
  </>}
 </div>;
}
