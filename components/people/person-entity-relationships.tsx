'use client';
import {useState} from 'react';
import {RecordEditorWorkspace} from '../shared/record-editor-workspace';
import {deletePersonEntityLink,savePerson,savePersonEntityLink,type OperatorRecord,type PersonRecord,type Stored} from '@/lib/offline/dive-planning';
import {personLinkWritePhases,planPersonLinkChanges,projectPersonEntityLinks,type PersonEntityLink,type ProjectedPersonEntityLink} from '@/lib/operators/entity-relationships';
import {personDisplayName} from '@/lib/offline/people-profiles';

type DraftLink=ProjectedPersonEntityLink & {draftKey:string};
export function PersonEntityRelationships({person,operators,links,close,onSaved,go}:{
  person:Stored<PersonRecord>;operators:Stored<OperatorRecord>[];links:ReadonlyArray<PersonEntityLink>;
  close:()=>void;onSaved:()=>void|Promise<void>;go:(route:string)=>void;
}){
  const [original]=useState(()=>projectPersonEntityLinks([person],links));
  const [drafts,setDrafts]=useState<DraftLink[]>(()=>original.map((link,index)=>({...link,draftKey:link.entityId??`legacy-${index}`})));
  const [nextKey,setNextKey]=useState(0);
  const update=(key:string,patch:Partial<DraftLink>)=>setDrafts(rows=>rows.map(row=>row.draftKey===key?{...row,...patch}:row));
  const add=()=>{
    if(!operators.length)return;
    const key=`new-${nextKey}`;setNextKey(value=>value+1);
    setDrafts(rows=>[...rows,{draftKey:key,personId:person.entityId,operatorId:operators[0]!.entityId,role:'',active:true,source:'explicit'}]);
  };
  const save=async()=>{
    const next=drafts.map(({draftKey: _draftKey,...link})=>link);
    const plan=planPersonLinkChanges(person,original,next);
    const {prepare,retire,promote}=personLinkWritePhases(plan);
    for(const link of prepare)await savePersonEntityLink(link);
    for(const id of retire)await deletePersonEntityLink(id);
    const {personPatch}=plan;
    if(Object.keys(personPatch).length)await savePerson({...person,...personPatch});
    for(const link of promote)await savePersonEntityLink(link);
    await onSaved();close();
  };
  return <RecordEditorWorkspace label={`Dive Entity relationships for ${personDisplayName(person)}`} close={close} save={save} value={drafts} saveLabel="Save relationships">
    <p>Link this person to existing Dive Centres, Resorts, Boats and other Dive Entities. Create or edit the entity in Dive Centres.</p>
    {!operators.length&&<output>No Dive Entities are available yet. Create one in Dive Centres, then return here.</output>}
    {operators.length>0&&!drafts.length&&<p>Available entities: {operators.map(row=>row.name).join(', ')}.</p>}
    <button type="button" className="focus-secondary" onClick={add} disabled={!operators.length}>Add affiliation</button>
    <div className="record-fields">
      {drafts.map(link=><fieldset key={link.draftKey} className="focus-card">
        <legend>{operators.find(row=>row.entityId===link.operatorId)?.name??'Unavailable legacy Dive Entity'}</legend>
        <label>Dive Entity<select value={link.operatorId} onChange={event=>update(link.draftKey,{operatorId:event.target.value})}>
          {!operators.some(row=>row.entityId===link.operatorId)&&<option value={link.operatorId}>Unavailable legacy entity · {link.operatorId.slice(-8)}</option>}
          {operators.map(row=><option key={row.entityId} value={row.entityId}>{row.name}{row.active===false?' · inactive':''}</option>)}
        </select></label>
        <label>Role at this entity<input value={link.role==='Associated'&&link.source==='legacy'?'':link.role} placeholder="Instructor, Guide, Skipper…" onChange={event=>update(link.draftKey,{role:event.target.value||'Associated'})}/></label>
        <label><input type="checkbox" checked={link.active} onChange={event=>update(link.draftKey,{active:event.target.checked})}/>Active relationship</label>
        <label><input type="checkbox" checked={Boolean(link.primary)} onChange={event=>setDrafts(rows=>rows.map(row=>({...row,primary:row.draftKey===link.draftKey?event.target.checked:false})))} />Primary affiliation</label>
        <label>Start date<input type="date" value={link.startDate??''} onChange={event=>update(link.draftKey,{startDate:event.target.value})}/></label>
        <label>End date<input type="date" value={link.endDate??''} onChange={event=>update(link.draftKey,{endDate:event.target.value})}/></label>
        <label className="record-wide">Relationship notes<textarea value={link.notes??''} onChange={event=>update(link.draftKey,{notes:event.target.value})}/></label>
        <div className="record-actions"><button type="button" className="focus-secondary" onClick={()=>go('Dive Centres&operatorId='+encodeURIComponent(link.operatorId))}>Open entity</button>
          <button type="button" className="focus-secondary danger" onClick={()=>setDrafts(rows=>rows.filter(row=>row.draftKey!==link.draftKey))}>Unlink</button></div>
      </fieldset>)}
    </div>
  </RecordEditorWorkspace>;
}
