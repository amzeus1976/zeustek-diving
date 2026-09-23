'use client';
import {useState} from 'react';
import {Plus,RotateCcw,X} from 'lucide-react';
import {RecordEditorWorkspace} from '../shared/record-editor-workspace';
import {DEFAULT_ANALYSIS_SCOPE,type AnalysisScope} from '../../lib/offline/experience-analytics';
import type {DiveSiteRecord,Stored} from '../../lib/offline/dive-planning';
import type {ReusableLoadoutRecord} from '../../lib/offline/loadouts-gas';
import {ANALYSIS_FILTER_FIELDS,comparatorOptions,validateAnalysisFilter,type AnalysisFilterComparator,type AnalysisFilterField,type AnalysisFilterGroup,type AnalysisFilterNode} from '../../lib/insights/analysis-filter-expression';
import styles from './analysis-workbench.module.css';

type Reference={entityId:string;name:string};
const inclusionFields=[['includePool','Pool'],['includeTraining','Training'],['includeShore','Shore'],['includeBoat','Boat'],['includeNight','Night'],['includeUnknownOther','Unknown / other']] as const;
const modeChoices=['recreational','recreational-training','technical','technical-training'] as const;
const waterChoices=['Saltwater','Freshwater','Brackish','Other'] as const;
const toggle=<T extends string>(values:T[],value:T)=>values.includes(value)?values.filter(item=>item!==value):[...values,value];
export function AnalysisScopeChips({value,change,sites,loadouts}:{value:AnalysisScope;change:(scope:AnalysisScope)=>void;sites:Reference[];loadouts:Reference[]}){
  const chips:Array<{key:string;label:string;remove:()=>void}>=[];
  for(const [key,label] of inclusionFields)if(!value[key])chips.push({key,label:label+' excluded',remove:()=>change({...value,[key]:true})});
  for(const [key,label] of [['dateFrom','From'],['dateTo','To'],['minDepthM','Minimum depth'],['maxDepthM','Maximum depth'],['minTimeMin','Minimum duration'],['maxTimeMin','Maximum duration']] as const)
    if(value[key]!=null)chips.push({key,label:label+': '+value[key],remove:()=>change({...value,[key]:null})});
  for(const [key,items] of [['waterTypes',value.waterTypes],['diveModes',value.diveModes],['siteIds',value.siteIds],['equipmentSetIds',value.equipmentSetIds]] as const)
    for(const id of items){const reference=key==='siteIds'?sites.find(r=>r.entityId===id):key==='equipmentSetIds'?loadouts.find(r=>r.entityId===id):null;
      chips.push({key:key+id,label:reference?.name??(key==='siteIds'||key==='equipmentSetIds'?'Unavailable reference · '+id.slice(-8):id.replaceAll('-',' ')),remove:()=>change({...value,[key]:items.filter(item=>item!==id)})});}
  if(value.advancedFilter)chips.push({key:'advanced',label:'Advanced AND / OR / NOT',remove:()=>change({...value,advancedFilter:null})});
  if(value.environmentFocus)chips.push({key:'environment',label:'Environment: '+value.environmentFocus.replaceAll('-',' '),remove:()=>change({...value,environmentFocus:null})});
  if(value.excludedDiveIds.length)chips.push({key:'exclusions',label:value.excludedDiveIds.length+' source Dives excluded',remove:()=>change({...value,excludedDiveIds:[]})});
  return <div className={styles.chips} aria-label="Active analysis filters">{chips.length?chips.map(chip=><button type="button" key={chip.key} onClick={chip.remove} aria-label={'Remove '+chip.label}>{chip.label}<X size={13}/></button>):<span>All recorded Dives · no exclusions</span>}</div>;
}
export function AnalysisScopePanel({value,apply,close,sites,loadouts}:{value:AnalysisScope;apply:(scope:AnalysisScope)=>void;close:()=>void;sites:Stored<DiveSiteRecord>[];loadouts:Stored<ReusableLoadoutRecord>[]}){
  const [draft,setDraft]=useState(value);
  const errors=validateAnalysisFilter(draft.advancedFilter);
  for(const [min,max,label] of [['minDepthM','maxDepthM','depth'],['minTimeMin','maxTimeMin','duration']] as const){
    if([draft[min],draft[max]].some(value=>value!=null&&(!Number.isFinite(value)||value<0)))errors.push('Enter non-negative '+label+' bounds.');
    if(draft[min]!=null&&draft[max]!=null&&draft[min]!>draft[max]!)errors.push('Minimum '+label+' must not exceed maximum '+label+'.');
  }
  if(draft.dateFrom&&draft.dateTo&&draft.dateFrom>draft.dateTo)errors.push('From date must not follow To date.');
  const reset=()=>setDraft(structuredClone(DEFAULT_ANALYSIS_SCOPE));
  return <RecordEditorWorkspace label="Analysis Scope" value={draft} close={close} save={()=>apply(draft)} saveLabel="Apply filters" saveDisabled={errors.length>0}>
    <p className={styles.safety}>Filters change this analysis only. Canonical Dive records are never edited.</p>
    <div className={styles.panelActions}><AnalysisScopeChips value={draft} change={setDraft} sites={sites} loadouts={loadouts}/><button className="focus-secondary" onClick={reset}>Clear all</button><button className="focus-secondary" onClick={reset}><RotateCcw size={15}/>Reset</button></div>
    <div className={styles.scopeGrid}>
      <section className={styles.panel}><h2>Quick filters</h2><p>Choose which activities to include.</p><div className={styles.toggles}>{inclusionFields.map(([key,label])=><button type="button" key={key} aria-label={'Include '+label.toLowerCase()+' dives'} aria-pressed={draft[key]} onClick={()=>setDraft({...draft,[key]:!draft[key]})}>{label}</button>)}</div>
        <h3>Water type</h3><div className={styles.toggles}><button aria-pressed={!draft.waterTypes.length} onClick={()=>setDraft({...draft,waterTypes:[]})}>All water</button>{waterChoices.map(water=><button key={water} aria-pressed={draft.waterTypes.includes(water)} onClick={()=>setDraft({...draft,waterTypes:toggle(draft.waterTypes,water)})}>{water}</button>)}</div>
        <h3>Dive mode</h3><div className={styles.toggles}><button aria-pressed={!draft.diveModes.length} onClick={()=>setDraft({...draft,diveModes:[]})}>All modes</button>{modeChoices.map(mode=><button key={mode} aria-pressed={draft.diveModes.includes(mode)} onClick={()=>setDraft({...draft,diveModes:toggle(draft.diveModes,mode)})}>{mode.replaceAll('-',' ')}</button>)}</div>
      </section>
      <section className={styles.panel}><h2>Ranges</h2><div className={styles.ranges}>
        {([['dateFrom','From date'],['dateTo','To date']] as const).map(([key,label])=><label key={key}>{label}<input type="date" value={draft[key]??''} onChange={event=>setDraft({...draft,[key]:event.target.value||null})}/></label>)}
        {([['minDepthM','Minimum depth (m)'],['maxDepthM','Maximum depth (m)'],['minTimeMin','Minimum duration (min)'],['maxTimeMin','Maximum duration (min)']] as const).map(([key,label])=><label key={key}>{label}<input type="number" min="0" value={draft[key]??''} onChange={event=>setDraft({...draft,[key]:event.target.value===''?null:Number(event.target.value)})}/></label>)}
      </div></section>
      <ReferencePicker label="Sites" rows={sites} selected={draft.siteIds} change={siteIds=>setDraft({...draft,siteIds})}/>
      <ReferencePicker label="Equipment sets" rows={loadouts} selected={draft.equipmentSetIds} change={equipmentSetIds=>setDraft({...draft,equipmentSetIds})}/>
    </div>
    <section className={styles.panel}><details open={Boolean(draft.advancedFilter)}><summary>Advanced AND / OR / NOT builder</summary>
      <p>Rules use canonical Dive fields. Missing measurements remain unknown; use “is missing” to select missing evidence.</p>
      {draft.advancedFilter?<><FilterNodeEditor node={draft.advancedFilter} depth={0} change={advancedFilter=>setDraft({...draft,advancedFilter})} remove={()=>setDraft({...draft,advancedFilter:null})} sites={sites} loadouts={loadouts}/></>:<button className="focus-secondary" onClick={()=>setDraft({...draft,advancedFilter:newGroup()})}><Plus size={15}/>Add rule group</button>}
    </details></section>
    {errors.length>0&&<div role="alert" className={styles.error}><strong>Resolve these filters before applying</strong><ul>{errors.map(error=><li key={error}>{error}</li>)}</ul></div>}
  </RecordEditorWorkspace>;
}
function ReferencePicker({label,rows,selected,change}:{label:string;rows:Reference[];selected:string[];change:(ids:string[])=>void}){
  const [query,setQuery]=useState(''),[page,setPage]=useState(0);
  const matches=rows.filter(row=>(row.name+' '+row.entityId).toLocaleLowerCase('en-GB').includes(query.toLocaleLowerCase('en-GB')));
  const last=Math.max(0,Math.ceil(matches.length/30)-1),current=Math.min(last,page);
  return <section className={styles.panel}><h2>{label} · one, many or all</h2>
    <div className={styles.panelActions}><label>Search {label}<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label><button className="focus-secondary" onClick={()=>change([])} aria-pressed={!selected.length}>All {label.toLowerCase()}</button></div>
    <div className={styles.chips}>{selected.map(id=><button key={id} onClick={()=>change(selected.filter(value=>value!==id))}>{rows.find(row=>row.entityId===id)?.name??'Unavailable · '+id.slice(-8)}<X size={13}/></button>)}</div>
    <div className={styles.referenceChoices}>{matches.slice(current*30,current*30+30).map(row=><label key={row.entityId}><input type="checkbox" checked={selected.includes(row.entityId)} onChange={()=>change(toggle(selected,row.entityId))}/><span>{row.name}<small> · {row.entityId.slice(-8)}</small></span></label>)}</div>
    <div className={styles.panelActions}><button className="focus-secondary" disabled={!current} onClick={()=>setPage(current-1)}>Previous</button><small>{matches.length} matches · page {current+1} of {last+1}</small><button className="focus-secondary" disabled={current===last} onClick={()=>setPage(current+1)}>Next</button></div>
  </section>;
}
const newPredicate=():AnalysisFilterNode=>({kind:'predicate',id:crypto.randomUUID(),field:'maxDepthM',comparator:'gte',value:0});
const newGroup=():AnalysisFilterGroup=>({kind:'group',id:crypto.randomUUID(),operator:'and',children:[newPredicate()]});
const comparatorLabel:Record<AnalysisFilterComparator,string>={equals:'equals','not-equals':'does not equal',contains:'contains',in:'is one of',gte:'at least / on or after',lte:'at most / on or before',between:'between',exists:'is recorded',missing:'is missing'};
function FilterNodeEditor({node,depth,change,remove,sites,loadouts}:{node:AnalysisFilterNode;depth:number;change:(node:AnalysisFilterNode)=>void;remove:()=>void;sites:Reference[];loadouts:Reference[]}){
  if(node.kind==='group')return <fieldset className={styles.filterGroup}><legend>Rule group</legend><div className={styles.panelActions}>
    <label>Combine<select value={node.operator} onChange={event=>change({...node,operator:event.target.value as 'and'|'or'})}><option value="and">AND · all rules</option><option value="or">OR · any rule</option></select></label>
    <label className={styles.check}><input type="checkbox" checked={Boolean(node.negated)} onChange={event=>change({...node,negated:event.target.checked})}/>NOT · invert known result</label>
    <button className="focus-secondary" onClick={remove}>Remove group</button></div>
    {node.children.map((child,index)=><FilterNodeEditor key={child.id} node={child} depth={depth+1} change={next=>change({...node,children:node.children.map((value,i)=>i===index?next:value)})} remove={()=>change({...node,children:node.children.filter((_,i)=>i!==index)})} sites={sites} loadouts={loadouts}/>)}
    <div className={styles.panelActions}><button className="focus-secondary" onClick={()=>change({...node,children:[...node.children,newPredicate()]})}>Add rule</button><button className="focus-secondary" disabled={depth>=5} onClick={()=>change({...node,children:[...node.children,newGroup()]})}>Add nested group</button></div>
  </fieldset>;
  const kind=ANALYSIS_FILTER_FIELDS[node.field].kind;
  const values=Array.isArray(node.value)?node.value:[node.value??''];
  const references=node.field==='siteId'?sites:node.field==='equipmentSetId'?loadouts:null;
  const choices=node.field==='waterType'?waterChoices:node.field==='diveMode'?modeChoices:null;
  const setValue=(raw:string,index=0)=>{
    const value=kind==='number'?(raw===''?'':Number(raw)):raw;
    if(node.comparator==='between'){const next=[...values];next[index]=value;change({...node,value:next as Array<string|number>});}
    else change({...node,value:node.comparator==='in'?raw.split(',').map(v=>v.trim()).filter(Boolean):value});
  };
  return <div className={styles.rule}><label>Field<select value={node.field} onChange={event=>{const field=event.target.value as AnalysisFilterField;change({...node,field,comparator:'equals',value:ANALYSIS_FILTER_FIELDS[field].kind==='number'?0:''});}}>{Object.entries(ANALYSIS_FILTER_FIELDS).map(([key,field])=><option key={key} value={key}>{field.label}</option>)}</select></label>
    <label>Comparison<select value={node.comparator} onChange={event=>{const comparator=event.target.value as AnalysisFilterComparator;change({...node,comparator,value:comparator==='between'?[values[0]??'',values[0]??'']:values[0]??''});}}>{comparatorOptions(node.field).map(key=><option key={key} value={key}>{comparatorLabel[key]}</option>)}</select></label>
    {!['exists','missing'].includes(node.comparator)&&
      (node.comparator==='between'?<><label>Lower bound<input type={kind==='date'?'date':'number'} value={values[0]??''} onChange={event=>setValue(event.target.value,0)}/></label><label>Upper bound<input type={kind==='date'?'date':'number'} value={values[1]??''} onChange={event=>setValue(event.target.value,1)}/></label></>:
        (references||choices)&&node.comparator!=='in'?<label>Value<select value={String(values[0]??'')} onChange={event=>setValue(event.target.value)}><option value="">Choose a value</option>{references?references.map(row=><option key={row.entityId} value={row.entityId}>{row.name} · {row.entityId.slice(-8)}</option>):choices?.map(value=><option key={value} value={value}>{value}</option>)}</select></label>:
          <label>{node.comparator==='in'?'Values (comma separated)':'Value'}<input type={kind==='number'?'number':kind==='date'?'date':'text'} value={node.comparator==='in'?values.join(', '):values[0]??''} onChange={event=>setValue(event.target.value)}/></label>)}
    <button className="focus-secondary" onClick={remove} aria-label={'Remove '+ANALYSIS_FILTER_FIELDS[node.field].label+' rule'}><X size={15}/></button>
  </div>;
}
