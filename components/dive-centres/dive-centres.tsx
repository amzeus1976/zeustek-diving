'use client';
import {useCallback,useState} from 'react';
import {Building2,ExternalLink,MapPin,Pencil,Plus,Search,Star,Trash2,Users} from 'lucide-react';
import {listOperators,saveOperator,deleteOperator,listPeople,type OperatorRecord,type PersonRecord,type Stored} from '../../lib/offline/dive-planning';
import {filterDiveCentres,linkedOperatorPeople,normaliseOperatorDraft,OPERATOR_SERVICES,OPERATOR_TYPES,safeOperatorUrl,type OperatorDraft} from '../../lib/operators/dive-centres';
import {personDisplayName} from '../../lib/offline/people-profiles';
import {useRecordRefresh} from '../record-status';
import {RecordEditorWorkspace} from '../shared/record-editor-workspace';
import {ZeusTekAssetIcon} from '../brand/zeustek-asset-icon';
import {AccessibleDialog} from '../accessible-dialog';
import {ProfilePicture} from '../profile-picture';
import {CardImageView} from '../certification-images';
import styles from './dive-centres.module.css';

const emptyCentre=():OperatorDraft=>({name:'',location:'',website:'',notes:'',operatorType:'dive-centre',active:true,agencies:[],services:{}});
const typeLabel=(row:OperatorRecord)=>OPERATOR_TYPES.find(([key])=>key===row.operatorType)?.[1]??'Organisation';
export function DiveCentres({go}:{go:(route:string)=>void}){
  const [centres,setCentres]=useState<Stored<OperatorRecord>[]>([]);
  const [people,setPeople]=useState<Stored<PersonRecord>[]>([]);
  const [selectedId,setSelectedId]=useState('');
  const [query,setQuery]=useState(''),[type,setType]=useState('all'),[status,setStatus]=useState('all'),[service,setService]=useState('all');
  const [favourites,setFavourites]=useState(false);
  const [editing,setEditing]=useState<OperatorDraft|null>(null);
  const [removing,setRemoving]=useState<Stored<OperatorRecord>|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const refresh=useCallback(async()=>{
    try{
      const [operators,persons]=await Promise.all([listOperators(),listPeople()]);
      setCentres(operators);setPeople(persons);
      const query=new URLSearchParams(window.location.search),requested=query.get('operatorId')??query.get('recordId');
      setSelectedId(current=>current||requested||'');
    }catch(reason){setError(reason instanceof Error?reason.message:'Could not load Dive Centres.');}
  },[]);
  useRecordRefresh(refresh);
  const visible=filterDiveCentres(centres,{query,type,status,service,favourites});
  const selected=centres.find(row=>row.entityId===selectedId)??null;
  const linked=selected?linkedOperatorPeople(selected.entityId,people):[];
  async function remove(){
    if(!removing||busy)return;setBusy(true);setError('');
    try{await deleteOperator(removing.entityId);setRemoving(null);setSelectedId('');await refresh();}
    catch(reason){setError(reason instanceof Error?reason.message:'Unable to delete this Dive Centre.');}
    finally{setBusy(false);}
  }
  if(editing)return <CentreEditor initial={editing} close={()=>setEditing(null)} save={async draft=>{
    const result=await saveOperator(normaliseOperatorDraft(draft));setSelectedId(result.id);setEditing(null);await refresh();
  }}/>;
  return <main className={styles.page}>
    <header className={styles.hero}><ZeusTekAssetIcon name="dive-centres" label="Dive Centres" size={64} fallback={<Building2/>}/>
      <div><span className="focus-eyebrow">DIVE DATA</span><h1>Dive Centres</h1><p>Your centres, clubs, charters and gas providers — with their linked people.</p></div>
      <button className="focus-primary" onClick={()=>setEditing(emptyCentre())}><Plus size={18}/>Add Dive Centre</button></header>
    {error&&<p role="alert" className="focus-notice danger">{error}</p>}
    <div className={styles.workspace}>
      <aside className={styles.filters} aria-label="Dive Centre filters">
        <h2><Search size={18}/>Find a centre</h2>
        <label>Search<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Name, location, agency or contact"/></label>
        <label>Organisation type<select value={type} onChange={event=>setType(event.target.value)}><option value="all">All types</option>{OPERATOR_TYPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Service<select value={service} onChange={event=>setService(event.target.value)}><option value="all">All services</option>{OPERATOR_SERVICES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Status<select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">All centres</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <label className={styles.check}><input type="checkbox" checked={favourites} onChange={event=>setFavourites(event.target.checked)}/>Favourites only</label>
        <button className="focus-secondary" onClick={()=>{setQuery('');setType('all');setStatus('all');setService('all');setFavourites(false);}}>Clear filters</button>
        <small>{visible.length} of {centres.length} centres</small>
      </aside>
      <section className={styles.list} aria-label="Dive Centres list">
        {!visible.length&&<div className={styles.empty}><Building2/><h2>{centres.length?'No matching centres':'Build your diving network'}</h2><p>{centres.length?'Clear a filter or try a different search.':'Add your first Dive Centre, then link instructors and contacts from People.'}</p></div>}
        {visible.map(row=><button className={styles.centre} data-selected={selectedId===row.entityId} aria-pressed={selectedId===row.entityId} key={row.entityId} onClick={()=>setSelectedId(row.entityId)}>
          <ZeusTekAssetIcon name="dive-centres" decorative size={44} fallback={<Building2/>}/>
          <span><strong>{row.name}</strong><small>{typeLabel(row)} · {row.location||row.town||'Location not recorded'}</small><small>{(row.agencies??[]).join(' · ')||'Agency not recorded'}</small></span>
          {row.favourite&&<Star size={16} aria-label="Favourite"/>}{row.active===false&&<small>Inactive</small>}
        </button>)}
      </section>
      <section className={styles.detail} aria-label="Selected Dive Centre">
        {selected?<><header>{selected.profileImage&&<CardImageView image={selected.profileImage} label={selected.name}/>}<span className="focus-eyebrow">{typeLabel(selected)}</span><h2>{selected.name}</h2>{selected.tradingName&&<p>Trading as {selected.tradingName}</p>}
          <div className={styles.actions}><button className="focus-secondary" onClick={()=>setEditing({...selected})}><Pencil size={16}/>Edit centre</button>
            <button className="focus-secondary" onClick={()=>{setError('');setRemoving(selected);}}><Trash2 size={16}/>Delete</button></div></header>
          <div className={styles.detailSection}><h3><MapPin size={18}/>Location & contact</h3>
            <p>{[selected.streetAddress,selected.town,selected.region,selected.country,selected.postcode].filter(Boolean).join(', ')||selected.location||'Location not recorded'}</p>
            {selected.location&&<p>{selected.location}</p>}
            {selected.latitude!=null&&selected.longitude!=null&&<p>{selected.latitude}, {selected.longitude}</p>}
            {selected.phone&&<p>Phone: <a href={'tel:'+selected.phone}>{selected.phone}</a></p>}
            {selected.email&&<p>Email: <a href={'mailto:'+selected.email}>{selected.email}</a></p>}
            {selected.emergencyPhone&&<p>Emergency contact: {selected.emergencyPhone}</p>}
            <div className={styles.actions}>{safeOperatorUrl(selected.website)&&<a className="focus-secondary" href={safeOperatorUrl(selected.website)!} target="_blank" rel="noopener noreferrer">Website <ExternalLink size={14}/></a>}
              {safeOperatorUrl(selected.bookingUrl)&&<a className="focus-secondary" href={safeOperatorUrl(selected.bookingUrl)!} target="_blank" rel="noopener noreferrer">Booking <ExternalLink size={14}/></a>}</div>
          </div>
          <div className={styles.detailSection}><h3>Agencies & services</h3><div className={styles.pills}>{(selected.agencies??[]).map(agency=><span key={agency}>{agency}</span>)}</div>
            <ul>{OPERATOR_SERVICES.filter(([key])=>selected.services?.[key]).map(([key,label])=><li key={key}>{label}</li>)}</ul>
            {!OPERATOR_SERVICES.some(([key])=>selected.services?.[key])&&<p>No services recorded.</p>}</div>
          <div className={styles.detailSection}><h3><Users size={18}/>People & instructors</h3>
            {linked.length?<ul className={styles.people}>{linked.map(person=><li key={person.entityId}><button className="focus-secondary" onClick={()=>go('People&personId='+encodeURIComponent(person.entityId))}>{personDisplayName(person)}{person.roles?.instructor||person.role==='instructor'||person.role==='both'?' · Instructor':''}</button></li>)}</ul>:<p>No linked people yet.</p>}
            <p>Choose the current or associated Dive Centre in a Person’s profile.</p><button className="focus-secondary" onClick={()=>go('People')}>Open People</button></div>
          <div className={styles.detailSection}><h3>Notes</h3><p className={styles.notes}>{selected.notes||'No notes recorded.'}</p></div>
        </>:<div className={styles.empty}><Building2/><h2>{selectedId?'Centre unavailable':'Select a Dive Centre'}</h2><p>{selectedId?'The linked record may be unavailable on this device. Choose a centre from the list.':'Choose a centre to view services, contact details and people.'}</p></div>}
      </section>
    </div>
    {removing&&<AccessibleDialog label="Delete Dive Centre" className="focus-modal" close={()=>{if(!busy)setRemoving(null);}} editable>
      <h2>Delete {removing.name}?</h2>
      {linkedOperatorPeople(removing.entityId,people).length?<><p>Reassign or unlink these People before deleting:</p><ul>{linkedOperatorPeople(removing.entityId,people).map(person=><li key={person.entityId}>{personDisplayName(person)}</li>)}</ul></>:<p>This removes the centre record. People and Dive records are preserved.</p>}
      {error&&<p role="alert">{error}</p>}
      <footer><button className="focus-secondary" onClick={()=>setRemoving(null)} disabled={busy}>Cancel</button><button className="focus-primary" disabled={busy||linkedOperatorPeople(removing.entityId,people).length>0} onClick={()=>void remove()}>{busy?'Deleting…':'Delete centre'}</button></footer>
    </AccessibleDialog>}
  </main>;
}

function CentreEditor({initial,close,save}:{initial:OperatorDraft;close:()=>void;save:(draft:OperatorDraft)=>Promise<void>}){
  const [draft,setDraft]=useState(initial);
  const update=(patch:Partial<OperatorDraft>)=>setDraft(current=>({...current,...patch}));
  return <RecordEditorWorkspace label={draft.entityId?'Edit Dive Centre':'New Dive Centre'} close={close} value={draft} save={()=>save(draft)} saveLabel="Save centre">
    <div className={styles.form}>
      <fieldset><legend>Organisation</legend>
        <ProfilePicture value={draft.profileImage??null} legacyId="" removeLegacy={()=>{}} recordLabel="centre" change={profileImage=>update({profileImage})}/>
        <label>Name<input value={draft.name} onChange={event=>update({name:event.target.value})} required/></label>
        <label>Trading name<input value={draft.tradingName??''} onChange={event=>update({tradingName:event.target.value})}/></label>
        <label>Organisation type<select value={draft.operatorType??'other'} onChange={event=>update({operatorType:event.target.value as NonNullable<OperatorRecord['operatorType']>})}>{OPERATOR_TYPES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className={styles.check}><input type="checkbox" checked={draft.active!==false} onChange={event=>update({active:event.target.checked})}/>Active</label>
        <label className={styles.check}><input type="checkbox" checked={Boolean(draft.favourite)} onChange={event=>update({favourite:event.target.checked})}/>Favourite</label>
      </fieldset>
      <fieldset><legend>Contact & booking</legend>
        {([['phone','Phone'],['email','Email'],['emergencyPhone','Emergency phone'],['website','Website'],['bookingUrl','Booking URL']] as const).map(([key,label])=><label key={key}>{label}<input type={key==='email'?'email':key.toLowerCase().includes('phone')?'tel':'text'} value={draft[key]??''} onChange={event=>update({[key]:event.target.value})}/></label>)}
      </fieldset>
      <fieldset><legend>Location</legend>
        {([['location','Location summary'],['streetAddress','Street address'],['town','Town / city'],['region','Region'],['country','Country'],['postcode','Postcode']] as const).map(([key,label])=><label key={key}>{label}<input value={draft[key]??''} onChange={event=>update({[key]:event.target.value})}/></label>)}
        <label>Latitude<input type="number" step="any" min="-90" max="90" value={draft.latitude??''} onChange={event=>update({latitude:event.target.value?Number(event.target.value):null})}/></label>
        <label>Longitude<input type="number" step="any" min="-180" max="180" value={draft.longitude??''} onChange={event=>update({longitude:event.target.value?Number(event.target.value):null})}/></label>
      </fieldset>
      <fieldset><legend>Agencies & services</legend><label>Agencies (one per line)<textarea value={(draft.agencies??[]).join('\n')} onChange={event=>update({agencies:event.target.value.split('\n')})}/></label>
        <div className={styles.checks}>{OPERATOR_SERVICES.map(([key,label])=><label className={styles.check} key={key}><input type="checkbox" checked={Boolean(draft.services?.[key])} onChange={event=>update({services:{...draft.services,[key]:event.target.checked}})}/>{label}</label>)}</div>
      </fieldset>
      <fieldset className={styles.wide}><legend>Notes</legend><label>Centre notes<textarea value={draft.notes} onChange={event=>update({notes:event.target.value})}/></label><p>People remain linked through their own profiles. Saving this centre does not rewrite those records.</p></fieldset>
    </div>
  </RecordEditorWorkspace>;
}
