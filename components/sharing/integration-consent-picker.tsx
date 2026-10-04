'use client';
import {useEffect,useRef,useState} from 'react';
import {API_FIELDS,API_LABELS,API_RESOURCES,type ApiConsent,type ApiResource} from '@/lib/sharing/readonly-api';
import {collectMatchingRecordIds,type ApiChoicePage,type ApiRecordChoice} from '@/lib/sharing/api-record-selection';
const fieldLabels:Record<string,string>={depth:'Depth (m)',duration:'Duration (min)',rmv:'RMV (litres/min)',supplies:'Saved supply inputs',itinerary:'Redacted itinerary',start:'Start date/time',end:'End date/time',track:'Display award track'};
type Consent=NonNullable<ApiConsent[ApiResource]>;
async function readChoices(resource:ApiResource,search:string,after:string,signal:AbortSignal):Promise<ApiChoicePage>{
  const query=new URLSearchParams({resource,q:search,after});
  const response=await fetch(`/api/integration-keys/records?${query}`,{cache:'no-store',signal});
  if(!response.ok)throw new Error('Record choices unavailable. Your selection is unchanged.');
  return response.json() as Promise<ApiChoicePage>;
}
function RecordChoices({resource,selected,change,onCollecting}:{resource:ApiResource;selected:string[];change:(ids:string[])=>void;onCollecting:(busy:boolean)=>void}){
  const [items,setItems]=useState<ApiRecordChoice[]>([]),[search,setSearch]=useState(''),[after,setAfter]=useState(''),[history,setHistory]=useState<string[]>([]),[next,setNext]=useState<string|null>(null),[message,setMessage]=useState('Loading saved cloud records…'),[collecting,setCollecting]=useState(false),[loading,setLoading]=useState(true);
  const allController=useRef<AbortController|null>(null);
  useEffect(()=>()=>allController.current?.abort(),[]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>{setLoading(true);void readChoices(resource,search,after,controller.signal).then(result=>{if(controller.signal.aborted)return;setItems(result.items);setNext(result.nextAfter);setMessage('Saved owner cloud records only.');}).catch(()=>{if(!controller.signal.aborted){setItems([]);setNext(null);setMessage('Record choices unavailable. Save/sync new records, then reopen this section.');}}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[resource,after,search]);
  async function selectAll(){
    const controller=new AbortController();allController.current=controller;setCollecting(true);onCollecting(true);setMessage('Reading all matching saved records…');
    try {const ids=await collectMatchingRecordIds(selected,controller.signal,(cursor,signal)=>readChoices(resource,search,cursor,signal));if(controller.signal.aborted)return;change(ids);setMessage(`${ids.length} records selected. Review the count and permitted fields before issuing a key.`);}
    catch(error){if(!controller.signal.aborted)setMessage(error instanceof Error?error.message:'Selection unavailable; previous choices retained.');else setMessage('Selection cancelled. Previous choices retained.');}
    finally {allController.current=null;setCollecting(false);onCollecting(false);}
  }
  return <div className="integration-record-choices">
    <label>Find {API_LABELS[resource]}<input type="search" maxLength={100} value={search} disabled={collecting} onChange={event=>{setSearch(event.target.value);setAfter('');setHistory([]);setLoading(true);}}/></label>
    <output aria-live="polite">{selected.length} selected · {message}</output>
    <div className="record-actions"><button type="button" className="focus-secondary" disabled={collecting||loading||!items.length} onClick={()=>void selectAll()}>Select all matching {API_LABELS[resource]}</button><button type="button" className="focus-secondary" disabled={collecting||!selected.length} onClick={()=>change([])}>Clear {API_LABELS[resource]} selection</button>{collecting&&<button type="button" className="focus-secondary" onClick={()=>allController.current?.abort()}>Cancel selection</button>}</div>
    <p className="integration-selection-help">Adds only currently saved matching records, up to1000. New records are never added automatically.</p>
    <fieldset className="sharing-options integration-choice-list"><legend>Choose {API_LABELS[resource]} records</legend>
      {items.map(item=><label key={item.id}><input type="checkbox" checked={selected.includes(item.id)} disabled={collecting||!selected.includes(item.id)&&selected.length>=1000} onChange={event=>change(event.target.checked?[...selected,item.id]:selected.filter(id=>id!==item.id))}/>{item.label}</label>)}
      {!items.length&&!loading&&<p>No matching saved records.</p>}
    </fieldset>
    <div className="record-actions"><button type="button" className="focus-secondary" disabled={collecting||!history.length} onClick={()=>{setAfter(history[history.length-1]??'');setHistory(history.slice(0,-1));}}>Previous {API_LABELS[resource]} records</button><button type="button" className="focus-secondary" disabled={collecting||!next} onClick={()=>{if(next){setHistory([...history,after]);setAfter(next);}}}>Next {API_LABELS[resource]} records</button></div>
  </div>;
}
export function IntegrationConsentPicker({selection,change,onCollecting}:{selection:ApiConsent;change:(resource:ApiResource,consent:Consent|null)=>void;onCollecting:(resource:ApiResource,busy:boolean)=>void}){
  const [expanded,setExpanded]=useState<ApiResource[]>([]),[collecting,setCollecting]=useState<ApiResource[]>([]);
  function toggle(resource:ApiResource){setExpanded(value=>value.includes(resource)?value.filter(item=>item!==resource):[...value,resource]);}
  function collectingChanged(resource:ApiResource,busy:boolean){setCollecting(value=>busy?[...new Set([...value,resource])]:value.filter(item=>item!==resource));onCollecting(resource,busy);}
  return <div className="integration-consent-picker">
    <div className="record-actions"><button type="button" className="focus-secondary" disabled={!Object.keys(selection).length} onClick={()=>setExpanded(API_RESOURCES.filter(resource=>selection[resource]))}>Maximise selected sections</button><button type="button" className="focus-secondary" disabled={!expanded.length} onClick={()=>setExpanded([])}>Minimise all sections</button></div>
    {API_RESOURCES.map(resource=>{
      const consent=selection[resource],open=Boolean(consent)&&expanded.includes(resource),busy=collecting.includes(resource),panelId=`api-selection-${resource}`;
      return <section className="sharing-resource" key={resource} aria-label={`${API_LABELS[resource]} access`}>
        <div className="integration-resource-header"><label><input type="checkbox" checked={Boolean(consent)} disabled={busy} onChange={event=>{change(resource,event.target.checked?{ids:[],fields:[]}:null);if(event.target.checked)setExpanded(value=>[...new Set([...value,resource])]);}}/>Allow {API_LABELS[resource]}</label><span>{consent?`${consent.ids.length} records · ${consent.fields.length} fields`:'Not allowed'}</span><button type="button" className="focus-secondary" disabled={!consent} aria-expanded={open} aria-controls={panelId} onClick={()=>toggle(resource)}>{open?'Minimise':'Maximise'} {API_LABELS[resource]}</button></div>
        {consent&&<div id={panelId} className="integration-resource-body" hidden={!open}>
          {!!API_FIELDS[resource].length&&<><div className="record-actions"><button type="button" className="focus-secondary" disabled={busy||consent.fields.length===API_FIELDS[resource].length} onClick={()=>change(resource,{...consent,fields:[...API_FIELDS[resource]]})}>Select all {API_LABELS[resource]} fields</button><button type="button" className="focus-secondary" disabled={busy||!consent.fields.length} onClick={()=>change(resource,{...consent,fields:[]})}>Clear {API_LABELS[resource]} fields</button></div><div className="sharing-options integration-field-options" aria-label={`${API_LABELS[resource]} permitted fields`}>{API_FIELDS[resource].map(field=><label key={field}><input type="checkbox" checked={consent.fields.includes(field)} disabled={busy} onChange={event=>change(resource,{ids:consent.ids,fields:event.target.checked?[...consent.fields,field]:consent.fields.filter(item=>item!==field)})}/>{fieldLabels[field]??field}</label>)}</div></>}
          <RecordChoices resource={resource} selected={consent.ids} change={ids=>change(resource,{ids,fields:consent.fields})} onCollecting={value=>collectingChanged(resource,value)}/>
        </div>}
      </section>;
    })}
  </div>;
}
