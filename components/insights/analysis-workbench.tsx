'use client';
import {useMemo,useState} from 'react';
import {BarChart3,Database,Plus,Settings2,X} from 'lucide-react';
import {Bar,BarChart,CartesianGrid,Line,LineChart,Pie,PieChart,ResponsiveContainer,Scatter,ScatterChart,Tooltip,XAxis,YAxis} from 'recharts';
import {AccessibleDialog} from '../accessible-dialog';
import {RecordEditorWorkspace} from '../shared/record-editor-workspace';
import {AnalysisSourceRecords} from './analysis-source-records';
import {buildExperienceAnalyticsProjection,type AnalysisScope,type DiveWithId,type ExperienceAnalyticsProjection} from '../../lib/offline/experience-analytics';
import type {DiveSiteRecord,Stored} from '../../lib/offline/dive-planning';
import type {ReusableLoadoutRecord} from '../../lib/offline/loadouts-gas';
import {ANALYSIS_CARD_REGISTRY,DEFAULT_ANALYSIS_CARDS,buildAnalysisCardData,validateAnalysisCards,type AnalysisCardConfig,type AnalysisCardData,type AnalysisDataRow,type AnalysisMetricKey,type AnalysisVisualization} from '../../lib/insights/analysis-card-registry';
import styles from './analysis-workbench.module.css';
const palette=['#12c8f3','#ff9a40','#39dcab','#ac8eff','#fe748c','#c8ce66','#74bcda'];
const display=(value:number|null|undefined)=>value==null?'Unknown':new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(value);
const visualizationLabels:Record<AnalysisVisualization,string>={kpi:'KPI',bar:'Bar chart',line:'Line chart',scatter:'Scatter plot',donut:'Donut',table:'Table','site-map':'Site view'};
type Props={cards:AnalysisCardConfig[];saveCards:(cards:AnalysisCardConfig[])=>Promise<void>;scope:AnalysisScope;changeScope:(scope:AnalysisScope)=>void;projection:ExperienceAnalyticsProjection;dives:DiveWithId[];sites:Stored<DiveSiteRecord>[];loadouts:Stored<ReusableLoadoutRecord>[];go?:((route:string)=>void)|undefined};
export function AnalysisWorkbench({cards,saveCards,scope,changeScope,projection,dives,sites,loadouts,go}:Props){
  const [configure,setConfigure]=useState(false),[open,setOpen]=useState<{card:AnalysisCardConfig;view:'analysis'|'data'}|null>(null);
  const dataScope=useMemo(()=>buildExperienceAnalyticsProjection(dives,sites,loadouts,{...scope,excludedDiveIds:[]}),[dives,sites,loadouts,scope]);
  const navigate=(route:string)=>{setOpen(null);go?.(route);};
  if(configure)return <WorkbenchEditor cards={cards} close={()=>setConfigure(false)} save={async next=>{await saveCards(next);setConfigure(false);}}/>;
  const openData=open?buildAnalysisCardData(open.card.metric,projection,dives,sites):null;
  const allSourceIds=open?new Set(buildAnalysisCardData(open.card.metric,dataScope,dives,sites).rows.flatMap(row=>row.diveIds)):new Set<string>();
  const changeEnvironment=(key:string)=>changeScope({...scope,environmentFocus:scope.environmentFocus===key?null:key});
  return <section className={styles.workbench} aria-label="Analysis workbench">
    <header className={styles.heading}><div><h2>Analysis workbench</h2><p>{cards.length} of 9 cards · titles enlarge analysis; Data opens its records.</p></div><button className="focus-secondary" onClick={()=>setConfigure(true)}><Settings2 size={16}/>Configure cards</button></header>
    <div className={styles.grid}>{cards.map(card=>{
      const data=buildAnalysisCardData(card.metric,projection,dives,sites),title=card.title||ANALYSIS_CARD_REGISTRY[card.metric].label;
      return <article className={styles.card} key={card.id} data-span={card.span??1}><header><button className={styles.title} onClick={()=>setOpen({card,view:'analysis'})} aria-label={'Enlarge '+title}>{title}</button><button className="focus-secondary" onClick={()=>setOpen({card,view:'data'})} aria-label={'Source data for '+title}><Database size={14}/>Data</button></header>
        <AnalysisVisual card={card} data={data} environmentFocus={scope.environmentFocus??null} changeEnvironment={changeEnvironment} go={go}/>
        <small>{new Set(data.rows.flatMap(row=>row.diveIds)).size} source Dives{data.missingCount?' · '+data.missingCount+' missing measurements':''}</small>
      </article>;
    })}</div>
    {!cards.length&&<p className={styles.empty}>No cards selected. Configure the workbench to add a metric.</p>}
    {open&&openData&&<AccessibleDialog label={(open.view==='data'?'Source data: ':'Enlarged analysis: ')+(open.card.title||ANALYSIS_CARD_REGISTRY[open.card.metric].label)} className={'focus-modal '+styles.dialog} close={()=>setOpen(null)}>
      <header><div><span className="focus-eyebrow">{open.view==='data'?'CANONICAL SOURCE RECORDS':'ANALYSIS WORKBENCH'}</span><h2>{open.card.title||ANALYSIS_CARD_REGISTRY[open.card.metric].label}</h2></div><button className="focus-icon" aria-label="Close workbench detail" onClick={()=>setOpen(null)}><X/></button></header>
      <p>{ANALYSIS_CARD_REGISTRY[open.card.metric].description}</p>
      {open.view==='analysis'?<div className={styles.enlarged}><AnalysisVisual card={open.card} data={openData} environmentFocus={scope.environmentFocus??null} changeEnvironment={changeEnvironment} go={go}/><button className="focus-secondary" onClick={()=>setOpen({...open,view:'data'})}><Database size={14}/>View source records</button></div>:
        <><div className={styles.panelActions}>{buildAnalysisCardData(open.card.metric,dataScope,dives,sites).rows.filter(row=>row.siteId||row.equipmentSetId).map(row=><a key={row.id} className="focus-secondary" href={'/?section='+encodeURIComponent(row.siteId?'Sites':'Loadouts & Gas')+'&'+(row.siteId?'siteId':'loadoutId')+'='+encodeURIComponent(row.siteId??row.equipmentSetId!)} onClick={go?event=>{event.preventDefault();navigate((row.siteId?'Sites&siteId=':'Loadouts & Gas&loadoutId=')+encodeURIComponent(row.siteId??row.equipmentSetId!));}:undefined}>{row.label} ↗</a>)}</div>
          <AnalysisSourceRecords dives={dives.filter(dive=>allSourceIds.has(dive.entityId))} excludedIds={scope.excludedDiveIds} changeExcluded={excludedDiveIds=>changeScope({...scope,excludedDiveIds})} go={go?navigate:undefined}/></>}
      <footer><button className="focus-secondary" onClick={()=>setOpen(null)}>Close</button></footer>
    </AccessibleDialog>}
  </section>;
}
function AnalysisVisual({card,data,environmentFocus,changeEnvironment,go}:{card:AnalysisCardConfig;data:AnalysisCardData;environmentFocus:string|null;changeEnvironment:(key:string)=>void;go?:((route:string)=>void)|undefined}){
  const rows=data.rows,environment=card.metric==='environment',numericX=card.metric==='depth-v-duration';
  if(card.visualization==='kpi')return <div className={styles.kpi}><strong>{display(data.value)}</strong><span>{data.unit}</span><small>{rows.length} supporting records</small></div>;
  if(!rows.length)return <p className={styles.empty}>No qualifying measurements in this scope. Show all data or review the source records.</p>;
  const table=<div className={styles.dataTable}><table><thead><tr><th scope="col">Record / group</th>{numericX&&<th scope="col">Duration (min)</th>}<th scope="col">{data.unit}</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th scope="row">{environment?<button className="focus-secondary" aria-pressed={environmentFocus===row.id} onClick={()=>changeEnvironment(row.id)}>{row.label}</button>:row.label}</th>{numericX&&<td>{display(row.x)}</td>}<td>{display(row.value)}</td></tr>)}</tbody></table></div>;
  if(card.visualization==='table')return table;
  if(card.visualization==='site-map')return <SiteView rows={rows} go={go}/>;
  const tooltip=<Tooltip contentStyle={{background:'#071923',border:'1px solid #28728b',color:'#ecfaff'}}/>;
  const axes=<><CartesianGrid stroke="#294651" strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fill:'#abcbd9',fontSize:10}} hide={rows.length>12}/><YAxis tick={{fill:'#abcbd9',fontSize:10}} width={44}/>{tooltip}</>;
  const plot=card.visualization==='bar'?<BarChart data={rows} margin={{top:10,right:10,bottom:10,left:0}}>{axes}<Bar dataKey="value" name={data.unit} fill="#15c7ec" radius={[4,4,0,0]}/></BarChart>:
    card.visualization==='line'?<LineChart data={rows} margin={{top:10,right:10,bottom:10,left:0}}>{axes}<Line type="linear" dataKey="value" name={data.unit} stroke="#15c7ec" strokeWidth={2} dot={{r:3}} connectNulls={false}/></LineChart>:
      card.visualization==='donut'?<PieChart><Pie data={rows.map((row,index)=>({...row,fill:palette[index%palette.length]!}))} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="75%"/>{tooltip}</PieChart>:
        <ScatterChart margin={{top:10,right:15,bottom:20,left:5}}><CartesianGrid stroke="#294651"/><XAxis type="number" dataKey="x" domain={['dataMin','dataMax']} name={numericX?'Duration':'Date'} unit={numericX?' min':''} tick={{fill:'#abcbd9',fontSize:10}} tickFormatter={numericX?value=>String(value):value=>new Date(Number(value)).toISOString().slice(5,10)}/><YAxis type="number" dataKey="value" name={data.unit} tick={{fill:'#abcbd9',fontSize:10}}/>{tooltip}<Scatter data={rows.filter(row=>Number.isFinite(row.x))} fill="#ffab50"/></ScatterChart>;
  return <><div className={styles.chart} aria-hidden="true"><ResponsiveContainer width="100%" height="100%">{plot}</ResponsiveContainer></div>
    {environment&&<ul className={styles.legend}>{rows.map(row=><li key={row.id}><button aria-pressed={environmentFocus===row.id} onClick={()=>changeEnvironment(row.id)}>{row.label} · {row.value}</button></li>)}</ul>}
    <details><summary>Accessible data table</summary>{table}</details></>;
}
function SiteView({rows,go}:{rows:AnalysisDataRow[];go?:((route:string)=>void)|undefined}){
  const located=rows.filter((row):row is AnalysisDataRow&{latitude:number;longitude:number}=>row.latitude!=null&&row.longitude!=null);
  const longitude=located.map(row=>row.longitude),latitude=located.map(row=>row.latitude),minX=Math.min(...longitude),maxX=Math.max(...longitude),minY=Math.min(...latitude),maxY=Math.max(...latitude);
  return <><p>Recorded Site coordinates · relative location view</p>
    {located.length>0?<svg className={styles.sitePlot} viewBox="0 0 440 260" aria-label="Scoped dive sites plotted by recorded longitude and latitude"><title>Scoped dive sites plotted by recorded longitude and latitude</title><path d="M30 15V230H420" fill="none" stroke="#417083"/>{located.map(row=>{
      const x=35+(row.longitude-minX)/Math.max(.01,maxX-minX)*375,y=220-(row.latitude-minY)/Math.max(.01,maxY-minY)*190;
      return <g key={row.id}><title>{row.label} · {row.value} Dives · {row.latitude}, {row.longitude}</title><circle cx={x} cy={y} r={Math.min(12,4+Math.sqrt(row.value))}/><text x={x+7} y={y-6}>{row.label.slice(0,24)}</text></g>;
    })}</svg>:<p>No recorded coordinates for this scope.</p>}
    <ul className={styles.legend}>{rows.map(row=><li key={row.id}>{row.siteId?<a className="focus-secondary" href={'/?section=Sites&siteId='+encodeURIComponent(row.siteId)} onClick={go?event=>{event.preventDefault();go('Sites&siteId='+encodeURIComponent(row.siteId!));}:undefined}>{row.label} · {row.value} Dives ↗</a>:<span>{row.label} · legacy name reference</span>}</li>)}</ul>
    {rows.length>located.length&&<p>{rows.length-located.length} Site groups have no recorded coordinates and remain listed.</p>}</>;
}
function WorkbenchEditor({cards,close,save}:{cards:AnalysisCardConfig[];close:()=>void;save:(cards:AnalysisCardConfig[])=>Promise<void>}){
  const [draft,setDraft]=useState(()=>structuredClone(cards));
  const errors=validateAnalysisCards(draft);
  const update=(index:number,patch:Partial<AnalysisCardConfig>)=>setDraft(current=>current.map((card,i)=>i===index?{...card,...patch}:card));
  return <RecordEditorWorkspace label="Configure analysis workbench" close={close} value={draft} save={()=>save(draft)} saveDisabled={errors.length>0} saveLabel="Save layout">
    <p className={styles.safety}>Choose up to nine cards. This layout is separate from the award strip and the current analysis scope.</p>
    <div className={styles.panelActions}><button className="focus-secondary" disabled={draft.length>=9} onClick={()=>setDraft([...draft,{id:crypto.randomUUID(),metric:'total-dives',visualization:'kpi'}])}><Plus size={16}/>Add card</button><button className="focus-secondary" onClick={()=>setDraft(structuredClone(DEFAULT_ANALYSIS_CARDS))}>Restore six default cards</button><span>{draft.length} of 9 cards</span></div>
    <div className={styles.cardEditor}>{draft.map((card,index)=><fieldset key={card.id}><legend><BarChart3 size={15}/>Card {index+1}</legend>
      <label>Metric<select value={card.metric} onChange={event=>{const metric=event.target.value as AnalysisMetricKey;update(index,{metric,visualization:ANALYSIS_CARD_REGISTRY[metric].defaultVisualization});}}>{Object.entries(ANALYSIS_CARD_REGISTRY).map(([key,entry])=><option key={key} value={key}>{entry.label}</option>)}</select></label>
      <label>Visualisation<select value={card.visualization} onChange={event=>update(index,{visualization:event.target.value as AnalysisVisualization})}>{ANALYSIS_CARD_REGISTRY[card.metric].allowed.map(value=><option key={value} value={value}>{visualizationLabels[value]}</option>)}</select></label>
      <label>Custom title (optional)<input maxLength={100} value={card.title??''} placeholder={ANALYSIS_CARD_REGISTRY[card.metric].label} onChange={event=>update(index,{title:event.target.value})}/></label>
      <label>Card width<select value={card.span??1} onChange={event=>update(index,{span:Number(event.target.value) as 1|2})}><option value={1}>One column</option><option value={2}>Two columns</option></select></label>
      <div className={styles.panelActions}><button className="focus-secondary" disabled={!index} onClick={()=>setDraft(current=>{const next=[...current];[next[index-1],next[index]]=[next[index]!,next[index-1]!];return next;})}>Move earlier</button><button className="focus-secondary" onClick={()=>setDraft(draft.filter((_,i)=>i!==index))}>Remove card</button></div>
    </fieldset>)}</div>{errors.length>0&&<p role="alert" className={styles.error}>{errors.join(' ')}</p>}
  </RecordEditorWorkspace>;
}
