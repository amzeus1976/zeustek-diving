'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Leaf, Plus, Recycle, X } from 'lucide-react';
import { AccessibleDialog } from './accessible-dialog';
import { ZeusTekIcon } from './zeustek-icon';
import { MediaGallery } from './media-gallery';
import { useRecordRefresh } from './record-status';
import { listLocalDiveRecords } from '../lib/offline/dive-store';
import { loadMediaMetadata } from '../lib/offline/media-metadata';
import type { DiveRecord } from '../lib/offline/dives';
import type { DiveSiteRecord, PersonRecord, CertificationRecord } from '../lib/offline/dive-planning';
import { TRAINING_COURSES, certificationMatches } from '../lib/training-course-maps';
import {
  ACTIVITY_TYPES, CONSERVATION_KIND, captureProgramme, conservationLink, conservationSummary,
  listConservation, listProgrammes, programmeProgress, removeConservation, saveConservation,
  type ActivityType, type ConservationActivity, type ProgrammeReference, type VerificationState,
} from '../lib/offline/conservation';

type Linked = { dives: Array<DiveRecord & {entityId:string}>; sites: Array<DiveSiteRecord & {entityId:string}>; people: Array<PersonRecord & {entityId:string}> };
const labelOf=(type:string)=>ACTIVITY_TYPES.find(([key])=>key===type)?.[1]??type;
const dateText=(date:string)=>Number.isFinite(Date.parse(date))?new Date(date).toLocaleString('en-GB'):date;
const split=(text:string)=>[...new Set(text.split(',').map(s=>s.trim()).filter(Boolean))];
const diveMoment=(dive:DiveRecord)=>`${dive.date || ''}T${dive.timeIn || '23:59:59'}`;
export const sortConservationDives=<T extends DiveRecord & {entityId:string}>(dives:T[])=>[...dives].sort((a,b)=>diveMoment(a).localeCompare(diveMoment(b))||a.entityId.localeCompare(b.entityId));
export function conservationDiveLabel(dive:DiveRecord & {entityId:string}) {
  const date=Number.isFinite(Date.parse(`${dive.date}T00:00:00`))?new Date(`${dive.date}T00:00:00`).toLocaleDateString('en-GB'):dive.date;
  const details=[dive.timeIn,dive.diveNumber!=null?`Dive #${dive.diveNumber}`:null,dive.maxDepthM!=null?`${dive.maxDepthM} m`:null].filter(Boolean).join(' · ');
  return `${date} · ${dive.site || 'Site not recorded'}${details?` · ${details}`:''}`;
}
function FieldHelp({label,children}:{label:string;children:React.ReactNode}) {
  return <details className="field-help"><summary aria-label={`Information about ${label}`}>ⓘ</summary><span className="field-help-copy">{children}</span></details>;
}
function FieldLabel({label,help}:{label:string;help:string}) {
  return <span className="conservation-field-label"><span>{label}</span><FieldHelp label={label}>{help}</FieldHelp></span>;
}
function SiteReferenceSearch({sites,value,onChange}:{sites:Linked['sites'];value:string|null|undefined;onChange:(id:string|null)=>void}) {
  const selected=sites.find(site=>site.entityId===value);
  const [query,setQuery]=useState(()=>selected?.name??'');
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(selected)setQuery(selected.name);else if(value)setQuery('');},[selected,value]);
  const matches=sites.filter(site=>site.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)||a.entityId.localeCompare(b.entityId)).slice(0,8);
  const listId='conservation-site-suggestions';
  return <div className="conservation-site-field">
    <FieldLabel label="Existing Site" help="Search for and select the existing ZeusTek Site where the observation occurred. Example: St Abbs Harbour – East."/>
    <div className="site-reference-input">
      <input type="search" role="combobox" aria-label="Search existing Sites" aria-autocomplete="list" aria-controls={listId} aria-expanded={open&&Boolean(query.trim())} autoComplete="off" placeholder="Search saved Sites" value={query} onFocus={()=>setOpen(true)} onBlur={()=>setOpen(false)} onChange={event=>{const next=event.target.value;setQuery(next);setOpen(true);if(!selected||next!==selected.name)onChange(null);}}/>
      {(value||query)&&<button type="button" className="focus-secondary" aria-label="Clear linked Site" onClick={()=>{setQuery('');onChange(null);setOpen(false);}}>Clear</button>}
      {open&&query.trim()&&<div id={listId} role="listbox" aria-label="Matching existing Sites" className="site-reference-suggestions">{matches.length?matches.map(site=><button type="button" role="option" aria-selected={site.entityId===value} key={site.entityId} onPointerDown={event=>event.preventDefault()} onClick={()=>{onChange(site.entityId);setQuery(site.name);setOpen(false);}}><b>{site.name}</b>{site.location||site.region?<small>{[site.location,site.region].filter(Boolean).join(' · ')}</small>:null}</button>):<p>No matching saved Sites.</p>}</div>}
    </div>
    {selected&&<small className="site-reference-status">Linked to saved Site: {selected.name}</small>}
    {value&&!selected&&<small className="site-reference-status warning">Previously saved Site reference is unavailable. Clear it to choose another.</small>}
  </div>;
}
function RecordLink({section,id,name}:{section:'Logbook'|'Sites'|'People';id?:string|null|undefined;name?:string|undefined}) {
  return id ? <a className="focus-link" href={conservationLink(section,id)}>{name||`Unavailable ${section==='Logbook'?'Dive':section==='Sites'?'Site':'Person'} reference`}</a> : null;
}
export function ConservationPage({go}:{go:(section:string)=>void}) {
  const [items,setItems]=useState<ConservationActivity[]>([]);
  const [programmes,setProgrammes]=useState<ProgrammeReference[]>([]);
  const [linked,setLinked]=useState<Linked>({dives:[],sites:[],people:[]});
  const [certs,setCerts]=useState<CertificationRecord[]>([]);
  const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [filter,setFilter]=useState('all'); const [search,setSearch]=useState('');
  const [viewing,setViewing]=useState<ConservationActivity|null>(null);
  const [editing,setEditing]=useState<ConservationActivity|null>(null);
  const [adding,setAdding]=useState<ActivityType|null>(null);
  const [referenceForm,setReferenceForm]=useState(false);
  const [actionBusy,setActionBusy]=useState(false);
  const refresh=useCallback(async()=>{
    try {
      const [activities,refs,dives,sites,people,certifications]=await Promise.all([
        listConservation(),listProgrammes(),listLocalDiveRecords<DiveRecord>('dive'),
        listLocalDiveRecords<DiveSiteRecord>('site'),listLocalDiveRecords<PersonRecord>('person'),
        listLocalDiveRecords<CertificationRecord>('certification')]);
      setItems(activities);setProgrammes(refs);setLinked({dives,sites,people});setCerts(certifications);setError('');
      setViewing(old=>old?activities.find(a=>a.entityId===old.entityId)??null:null);
    } catch(e) {setError(e instanceof Error?e.message:'Activities could not be loaded.');}
    finally {setLoading(false);}
  },[]);
  useRecordRefresh(refresh);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get('activityId');
    if(id&&items.length)setViewing(items.find(a=>a.entityId===id)??null);
  },[items]);
  const summary=useMemo(()=>conservationSummary(items,linked.dives.length),[items,linked.dives.length]);
  const visible=useMemo(()=>items.filter(a=>(filter==='all'||filter==='media'?(filter!=='media'||Boolean(a.attachmentIds?.length)):filter==='observations'?['marine-life','habitat','citizen-science'].includes(a.activityType):a.activityType===filter)&&
    (!search.trim()||[a.speciesOrSubject,a.notes,...(a.tags??[]),labelOf(a.activityType)].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)),[items,filter,search]);
  const sites=linked.sites.filter(s=>items.some(a=>a.siteId===s.entityId));
  const awareCourses=TRAINING_COURSES.filter(c=>/aware|conservation|dive against debris/i.test(c.title));
  const openAdd=(type:ActivityType)=>{setEditing(null);setAdding(type);};
  async function remove(item:ConservationActivity) {
    if(!confirm('Delete this activity? Its immutable history and linked Dive, Site, people and original media are retained.'))return;
    setActionBusy(true);
    try {await removeConservation(item.entityId);setViewing(null);await refresh();}
    catch(e){setError(e instanceof Error?e.message:'Activity could not be deleted.');}
    finally{setActionBusy(false);}
  }
  return <section className="conservation-page">
    <header className="focus-heading"><div className="focus-heading-title"><ZeusTekIcon id="project-aware-specialist" size="heading"/><div><span>OCEAN STEWARDSHIP</span><h1>Conservation & AWARE</h1><p>Record observations, debris actions and conservation learning linked to your dives and sites.</p></div></div><button className="focus-primary" onClick={()=>openAdd('marine-life')}><Plus size={16}/> Log activity</button></header>
    {error&&<p role="alert">{error} <button className="focus-secondary" onClick={()=>void refresh()}>Retry activities</button></p>}
    {loading&&<p role="status">Loading local activities…</p>}
    <div className="conservation-summary" aria-label="Calculated conservation totals">
      <button className="focus-card" onClick={()=>setFilter('all')}><Leaf/><span>Total activities</span><strong>{summary.activities}</strong><small>Calculated from saved records</small></button>
      <button className="focus-card" onClick={()=>setFilter('observations')}><span>Observation-linked dives</span><strong>{summary.observationDives}</strong><small>{summary.totalDives? `${summary.observationDives} of ${summary.totalDives} saved Dives`:'No saved Dives'} · unique linked IDs</small></button>
      <button className="focus-card" onClick={()=>setFilter('debris')}><Recycle/><span>Debris removed</span><strong>{summary.removedMassKg.toLocaleString('en-GB')} kg</strong><small>{summary.removedItems} recorded items{summary.unknownMass>0?` · ${summary.unknownMass} removal(s) without mass`:''}; surveys excluded</small></button>
      <button className="focus-card" onClick={()=>setFilter('learning')}><span>Learning evidence</span><strong>{items.filter(a=>a.activityType==='learning').length}</strong><small>Evidence count, not certification</small></button>
    </div>
    <div className="conservation-grid">
      <section className="focus-card conservation-programmes"><div className="focus-card-head"><h2>AWARE learning & programme progress</h2><button className="focus-secondary" onClick={()=>setReferenceForm(true)}>Capture reference version</button></div>
        <p>Activity progress is calculated against the captured version. It does not certify completion or confirm an external submission.</p>
        {!programmes.length&&<p>No programme requirements captured. Record the source and version before comparing evidence.</p>}
        {programmes.map(p=><details key={p.entityId} open><summary>{p.pathwayKey} · {p.agency} · {p.versionLabel}</summary><p>Source: {p.sourceCitation}</p>{programmeProgress(p,items).map((r,i)=><p key={i}>{r.label}: {r.count} / {r.target} · {r.state==='satisfied'?'Recorded target met':r.state==='unknown'?'Unknown requirement':'Not yet met'}</p>)}</details>)}
        <details><summary>Existing conservation course references</summary><p>These links reuse the current Course Map catalogue. Confirm current agency standards with the official source.</p>{awareCourses.map(c=><p key={c.id}>{c.title} · {certs.some(cert=>certificationMatches(cert,c))?'Completed certification recorded':'No completed certification recorded'} <a className="focus-link" href={c.sourceUrl} target="_blank" rel="noreferrer">Official reference</a></p>)}<button className="focus-secondary" onClick={()=>go('Course Map')}>Open Course Map</button><button className="focus-secondary" onClick={()=>openAdd('learning')}>Log learning evidence</button></details>
      </section>
      <section className="focus-card"><h2>Marine-life & habitat observations</h2><p>{summary.observations} observations · {summary.subjects} distinct recorded subjects</p><div className="record-actions"><button className="focus-secondary" onClick={()=>setFilter('marine-life')}>View marine-life observations</button><button className="focus-secondary" onClick={()=>openAdd('habitat')}>Log habitat observation</button></div>
        {items.filter(a=>['marine-life','habitat','citizen-science'].includes(a.activityType)).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,3).map(a=><p key={a.entityId}><button className="focus-secondary" onClick={()=>setViewing(a)}>{a.speciesOrSubject||labelOf(a.activityType)}</button> · {dateText(a.occurredAt)}</p>)}
      </section>
      <section className="focus-card"><h2>Debris collection & surveys</h2><p>Keep surveyed debris separate from debris actually removed.</p><div className="record-actions"><button className="focus-secondary" onClick={()=>openAdd('debris')}>Log debris activity</button><button className="focus-secondary" onClick={()=>setFilter('debris')}>View debris records</button></div></section>
      <section className="focus-card conservation-activities"><h2>Recent conservation activity</h2><div className="conservation-filters"><label>Search activities<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Activity type<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All activities</option><option value="observations">All observations</option>{ACTIVITY_TYPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}<option value="media">With linked media</option></select></label></div>
        {!loading&&!visible.length&&<p>{items.length?'No activities match these filters.':'No activities yet. Log your first observation or action.'}</p>}
        {visible.map(a=><article key={a.entityId} className="conservation-activity"><div><button className="focus-secondary" onClick={()=>setViewing(a)}>{a.speciesOrSubject||labelOf(a.activityType)}</button><p>{labelOf(a.activityType)} · {dateText(a.occurredAt)} · Recorded · {a.verificationState||'recorded'}</p><RecordLink section="Sites" id={a.siteId} name={linked.sites.find(s=>s.entityId===a.siteId)?.name}/>{' '}<RecordLink section="Logbook" id={a.diveId} name={linked.dives.find(d=>d.entityId===a.diveId)?.site}/></div><span>{a.tags?.join(' · ')}</span></article>)}
      </section>
      <section className="focus-card"><h2>Linked sites</h2>{!sites.length&&<p>No sites linked yet.</p>}{sites.map(s=><p key={s.entityId}><RecordLink section="Sites" id={s.entityId} name={s.name}/> · {items.filter(a=>a.siteId===s.entityId).length} activities</p>)}</section>
      <section className="focus-card"><h2>Media & evidence</h2><p>Attachment references stay linked to their original records.</p><button className="focus-secondary" onClick={()=>setFilter('media')}>View activities with media</button>{items.filter(a=>a.attachmentIds?.length).slice(0,3).map(a=><p key={a.entityId}><button className="focus-secondary" onClick={()=>setViewing(a)}>{a.speciesOrSubject||labelOf(a.activityType)} · {a.attachmentIds?.length} linked</button></p>)}</section>
    </div>
    {adding&&<ActivityForm item={editing} initialType={adding} linked={linked} programmes={programmes} close={()=>{setAdding(null);setEditing(null);}} saved={async()=>{await refresh();}}/>}
    {referenceForm&&<ProgrammeForm close={()=>setReferenceForm(false)} saved={refresh}/>}
    {viewing&&<div className="focus-modal-bg"><AccessibleDialog label="Conservation activity detail" className="focus-modal record-detail conservation-detail" close={()=>setViewing(null)}>
      <header><div><span className="focus-eyebrow">RECORDED · {viewing.verificationState||'recorded'}</span><h2>{viewing.speciesOrSubject||labelOf(viewing.activityType)}</h2></div><button className="focus-icon" aria-label="Close activity detail" onClick={()=>setViewing(null)}><X/></button></header>
      <p>{labelOf(viewing.activityType)} · {dateText(viewing.occurredAt)}</p><p>{viewing.notes||'No notes recorded.'}</p><p>{viewing.tags?.join(' · ')}</p>
      <RecordLink section="Sites" id={viewing.siteId} name={linked.sites.find(s=>s.entityId===viewing.siteId)?.name}/>{' '}<RecordLink section="Logbook" id={viewing.diveId} name={linked.dives.find(d=>d.entityId===viewing.diveId)?.site}/>
      {viewing.participantPersonIds?.map(id=><p key={id}><RecordLink section="People" id={id} name={linked.people.find(p=>p.entityId===id)?.name}/></p>)}
      {viewing.debris&&<p>{viewing.debris.operation==='removal'?'Removed':'Surveyed'}: {viewing.debris.count??'Unknown'} items · {viewing.debris.massKg??'Unknown'} kg · {viewing.debris.categories?.join(', ')}</p>}
      {viewing.programmeVersionId&&<p>Programme version: {programmes.find(p=>p.entityId===viewing.programmeVersionId)?.versionLabel||'Unavailable reference retained'}</p>}
      {viewing.externalReference&&<p>External submission reference: {viewing.externalReference}. Remote submission is not confirmed by ZeusTek.</p>}
      <p>{viewing.attachmentIds?.length??0} existing attachment references retained.</p>
      <button className="focus-secondary" disabled={actionBusy} onClick={async()=>{
        setActionBusy(true);
        try{
          const media=await loadMediaMetadata(CONSERVATION_KIND,viewing.entityId);
          const current=(await listConservation()).find(a=>a.entityId===viewing.entityId);
          if(!current)throw new Error('Activity unavailable.');
          await saveConservation({...current,attachmentIds:[...new Set([...(current.attachmentIds??[]),...media.items.map(a=>a.id)])]});
          await refresh();
        }catch(e){setError(e instanceof Error?e.message:'Media references could not be linked.');}
        finally{setActionBusy(false);}
      }}>Link uploaded media to activity</button>
      {viewing.attachmentIds?.map(id=><p key={id}><a className="focus-link" href={`/api/media?id=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer">Open linked media / file ({id})</a></p>)}
      <MediaGallery ownerKind={CONSERVATION_KIND} ownerId={viewing.entityId} retainOfflineMetadata acceptFiles onUploaded={async ids=>{
        const current=(await listConservation()).find(a=>a.entityId===viewing.entityId);
        if(!current)throw new Error('Activity unavailable.');
        await saveConservation({...current,attachmentIds:[...new Set([...(current.attachmentIds??[]),...ids])]});
        await refresh();
      }}/>
      <footer><button disabled={actionBusy} className="focus-secondary danger" onClick={()=>void remove(viewing)}>Delete activity</button><button className="focus-primary" onClick={()=>{setEditing(viewing);setAdding(viewing.activityType);setViewing(null);}}>Edit activity</button></footer>
    </AccessibleDialog></div>}
  </section>;
}
export function ActivityForm({item,initialType,linked,programmes,close,saved}:{item:ConservationActivity|null;initialType:ActivityType;linked:Linked;programmes:ProgrammeReference[];close:()=>void;saved:()=>Promise<void>}) {
  const [draft,setDraft]=useState<Partial<ConservationActivity>>(()=>item?{...item}:{
    activityType:initialType,occurredAt:new Date().toISOString(),siteId:null,diveId:null,participantPersonIds:[],tags:[],notes:'',speciesOrSubject:'',attachmentIds:[],externalReference:'',verificationState:'recorded',programmeVersionId:null});
  const [localDate,setLocalDate]=useState(()=>{const d=new Date(draft.occurredAt!);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
  const [tagsText,setTagsText]=useState(item?.tags?.join(', ')??'');
  const [categoriesText,setCategoriesText]=useState(item?.debris?.categories?.join(', ')??'');
  const [attachmentText,setAttachmentText]=useState(item?.attachmentIds?.join(', ')??'');
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const field=<K extends keyof ConservationActivity>(key:K,value:ConservationActivity[K])=>setDraft(old=>({...old,[key]:value}));
  const number=(value:string)=>value===''?null:Number(value);
  const debris=draft.debris??{operation:'survey' as const,count:null,massKg:null,categories:[]};
  const updateDebris=(patch:Partial<NonNullable<ConservationActivity['debris']>>)=>field('debris',{...debris,...patch});
  async function submit(e:React.FormEvent) {
    e.preventDefault();setBusy(true);setError('');
    try {
      const occurredAt=new Date(localDate).toISOString();
      await saveConservation({...draft,tags:split(tagsText),attachmentIds:split(attachmentText),debris:draft.debris?{...draft.debris,categories:split(categoriesText)}:draft.debris??null,activityType:draft.activityType!,occurredAt});
      await saved();close();
    }catch(e){setError(e instanceof Error?e.message:'Local save failed; your input is retained.');}
    finally{setBusy(false);}
  }
  const orderedDives=sortConservationDives(linked.dives);
  return <div className="focus-modal-bg"><AccessibleDialog editable label={item?'Edit conservation activity':'Log conservation activity'} className="focus-modal conservation-form" close={()=>{if(!busy)close();}}>
    <form onSubmit={e=>void submit(e)}><header><h2>{item?'Edit conservation activity':'Log conservation activity'}</h2><button type="button" className="focus-icon" disabled={busy} aria-label="Close activity editor" data-dialog-close onClick={close}><X/></button></header>
      <fieldset disabled={busy} className="record-fields conservation-fields"><label className="conservation-half"><FieldLabel label="Activity type" help="Choose what is being recorded. Example: Marine-life observation for a grey seal sighting, or Debris survey / removal for recovered fishing line."/><select value={draft.activityType} onChange={e=>field('activityType',e.target.value as ActivityType)}>{ACTIVITY_TYPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="conservation-half">Date and time<input type="datetime-local" required value={localDate} onChange={e=>setLocalDate(e.target.value)}/></label>
      <div className="conservation-reference"><SiteReferenceSearch sites={linked.sites} value={draft.siteId} onChange={value=>field('siteId',value)}/></div>
      <label className="conservation-reference"><FieldLabel label="Existing Dive" help="Optionally link this activity to one existing Dive Log record. Example: 05/09/2026 · St Abbs Harbour – East · Dive #64."/><select aria-label="Linked Dive" value={draft.diveId??''} onChange={e=>field('diveId',e.target.value||null)}><option value="">No linked Dive</option>{draft.diveId&&!linked.dives.some(d=>d.entityId===draft.diveId)&&<option value={draft.diveId}>Unavailable reference retained</option>}{orderedDives.map(d=><option key={d.entityId} value={d.entityId}>{conservationDiveLabel(d)}</option>)}</select></label>
      <label><FieldLabel label={draft.activityType==='learning'?'Course / learning subject':'Species / subject'} help="Animal, plant, habitat or environmental subject being recorded. Example: Grey seal, dead man's fingers, discarded fishing line."/><input value={draft.speciesOrSubject??''} onChange={e=>field('speciesOrSubject',e.target.value)}/></label>
      <label><FieldLabel label="Observation tags" help="Short searchable descriptors separated by commas. Example: seal, healthy, juvenile, kelp."/><input aria-label="Observation tags, comma separated" value={tagsText} onChange={e=>setTagsText(e.target.value)}/></label>
      <label><FieldLabel label="Verification state" help="Records whether the observation is only logged, needs review, or has subsequently been independently verified."/><select value={draft.verificationState??'recorded'} onChange={e=>field('verificationState',e.target.value as VerificationState)}><option value="recorded">Recorded, not independently verified</option><option value="verified">Verified evidence recorded</option><option value="needs-review">Needs review</option></select></label>
      {draft.activityType==='debris'&&<section className="record-wide conservation-debris-fields"><h3>Debris details</h3><label>Action<select value={debris.operation} onChange={e=>updateDebris({operation:e.target.value as 'survey'|'removal'})}><option value="survey">Survey only</option><option value="removal">Debris removed</option></select></label><label>Item count<input type="number" min="0" step="1" value={debris.count??''} onChange={e=>updateDebris({count:number(e.target.value)})}/></label><label>Mass (kg)<input type="number" min="0" step="any" value={debris.massKg??''} onChange={e=>updateDebris({massKg:number(e.target.value)})}/></label><label>Categories (comma separated)<input value={categoriesText} onChange={e=>setCategoriesText(e.target.value)}/></label></section>}
      <label className="conservation-half"><FieldLabel label="Captured programme version" help="Links this record to the conservation/AWARE programme and captured version being followed, when applicable."/><select value={draft.programmeVersionId??''} onChange={e=>field('programmeVersionId',e.target.value||null)}><option value="">Not assigned</option>{draft.programmeVersionId&&!programmes.some(p=>p.entityId===draft.programmeVersionId)&&<option value={draft.programmeVersionId}>Unavailable reference retained</option>}{programmes.map(p=><option key={p.entityId} value={p.entityId}>{p.pathwayKey} · {p.versionLabel}</option>)}</select></label>
      <div className="conservation-half conservation-related"><FieldLabel label="Participants / external reference / media" help="Add existing people involved, a reference supplied by an external programme, or IDs of already stored private media. Example external reference: AWARE-2026-184."/><details><summary>Participants, external reference and media links</summary>{linked.people.map(p=><label key={p.entityId}><input type="checkbox" checked={draft.participantPersonIds?.includes(p.entityId)??false} onChange={e=>field('participantPersonIds',e.target.checked?[...new Set([...(draft.participantPersonIds??[]),p.entityId])]:(draft.participantPersonIds??[]).filter(id=>id!==p.entityId))}/>{p.name}</label>)}{draft.participantPersonIds?.filter(id=>!linked.people.some(p=>p.entityId===id)).map(id=><p key={id}>Unavailable participant reference retained: {id}</p>)}<label>External submission reference<input value={draft.externalReference??''} onChange={e=>field('externalReference',e.target.value)}/><small>Metadata only. This does not submit anything remotely.</small></label><label>Existing attachment IDs (comma separated)<input value={attachmentText} onChange={e=>setAttachmentText(e.target.value)}/><small>References only; originals are not copied. New media can be added after saving.</small></label></details></div>
      <label className="conservation-full"><FieldLabel label="Notes" help="Record useful observational context, conditions, behaviour, actions taken, or uncertainty. Do not use notes as a substitute for selecting an existing Site or Dive."/><textarea value={draft.notes??''} onChange={e=>field('notes',e.target.value)}/></label></fieldset>
      {error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={busy} className="focus-secondary" data-dialog-close onClick={close}>Cancel</button><button type="submit" disabled={busy} className="focus-primary">{busy?'Saving locally…':'Save activity'}</button></footer>
    </form></AccessibleDialog></div>;
}
function ProgrammeForm({close,saved}:{close:()=>void;saved:()=>Promise<void>}) {
  const [draft,setDraft]=useState({agency:'',pathwayKey:'',versionLabel:'',sourceCitation:'',label:'',type:'all',target:'1'});
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);try{await captureProgramme({...draft,effectiveFrom:null,requirements:[{key:'recorded-activity-count',label:draft.label,kind:'count',rule:{activityType:draft.type as ActivityType|'all',target:Number(draft.target)}}]});await saved();close();}catch(e){setError(e instanceof Error?e.message:'Reference capture failed.');}finally{setBusy(false);}}
  return <div className="focus-modal-bg"><AccessibleDialog editable label="Capture programme reference version" className="focus-modal conservation-form" close={()=>{if(!busy)close();}}><form onSubmit={e=>void submit(e)}><header><h2>Capture programme reference version</h2></header><p>Capture a sourced activity-count requirement. Every save creates a new version; existing activity references remain unchanged. Agency completion still requires independent review.</p><fieldset disabled={busy} className="record-fields">{(['agency','pathwayKey','versionLabel','sourceCitation','label'] as const).map((key,i)=><label key={key}>{['Agency / organisation','Programme name','Version label','Source citation','Requirement label'][i]}<input required value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}<label>Activity requirement<select value={draft.type} onChange={e=>setDraft({...draft,type:e.target.value})}><option value="all">All activities</option><option value="observations">All observations</option>{ACTIVITY_TYPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Required recorded activities<input type="number" min="1" step="1" required value={draft.target} onChange={e=>setDraft({...draft,target:e.target.value})}/></label></fieldset>{error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={busy} className="focus-secondary" data-dialog-close onClick={close}>Cancel</button><button disabled={busy} className="focus-primary">Capture new version</button></footer></form></AccessibleDialog></div>;
}
