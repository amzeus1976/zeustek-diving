'use client';
import {useState} from 'react';
import {RecordEditorWorkspace} from '../shared/record-editor-workspace';
import {deleteEntityRelation,saveEntityRelation,type OperatorRecord,type Stored} from '@/lib/offline/dive-planning';
import {ENTITY_RELATION_TYPES,entityRelationForEditor,entityRelationIdentity,normaliseEntityRelation,type EntityRelation} from '@/lib/operators/entity-relationships';

type Draft=EntityRelation & {draftKey:string};
const choices=[...ENTITY_RELATION_TYPES,'operated-by','owned-by','hosts','contains','used-by','boat-provided-by','has-resort-dive-centre','charters'];
export function EntityRelationships({entity,operators,links,close,onSaved,go}:{
  entity:Stored<OperatorRecord>;operators:Stored<OperatorRecord>[];links:ReadonlyArray<EntityRelation>;
  close:()=>void;onSaved:()=>void|Promise<void>;go:(route:string)=>void;
}){
  const [original]=useState(()=>links.filter(link=>link.fromOperatorId===entity.entityId||link.toOperatorId===entity.entityId));
  const [drafts,setDrafts]=useState<Draft[]>(()=>original.map((link,index)=>({...entityRelationForEditor(link,entity.entityId),draftKey:link.entityId??`existing-${index}`})));
  const [nextKey,setNextKey]=useState(0);
  const others=operators.filter(row=>row.entityId!==entity.entityId);
  const update=(key:string,patch:Partial<Draft>)=>setDrafts(rows=>rows.map(row=>row.draftKey===key?{...row,...patch}:row));
  const save=async()=>{
    const next=drafts.map(({draftKey: _draftKey,...row})=>normaliseEntityRelation(row));
    const identities=next.map(entityRelationIdentity);
    if(new Set(identities).size!==identities.length)throw new Error('The same entity relationship is listed twice.');
    const oldById=new Map(original.filter(row=>row.entityId).map(row=>[row.entityId!,row]));
    const retained=new Set(next.filter(row=>row.entityId&&oldById.has(row.entityId)&&entityRelationIdentity(oldById.get(row.entityId)!)===entityRelationIdentity(row)).map(row=>row.entityId));
    const deletions=original.filter(row=>row.entityId&&!retained.has(row.entityId)).map(row=>row.entityId!);
    for(const row of next){
      const previous=row.entityId?oldById.get(row.entityId):undefined;
      if(previous&&JSON.stringify(previous)===JSON.stringify(row))continue;
      if(previous&&entityRelationIdentity(previous)!==entityRelationIdentity(row)){
        const {entityId: _entityId,...replacement}=row;await saveEntityRelation(replacement);
      }else await saveEntityRelation(row);
    }
    for(const id of deletions)await deleteEntityRelation(id);
    await onSaved();close();
  };
  return <RecordEditorWorkspace label={`Dive Entity relationships for ${entity.name}`} close={close} save={save} value={drafts} saveLabel="Save relationships">
    <p>Associate this Dive Entity with other existing centres, resorts, vessels or organisations. Each direction is shown from the other record automatically.</p>
    {!others.length?<p>No other Dive Entities are available yet.</p>:<p>Available entities: {others.map(row=>row.name).join(', ')}.</p>}
    <button type="button" className="focus-secondary" disabled={!others.length} onClick={()=>{const key=`new-${nextKey}`;setNextKey(value=>value+1);setDrafts(rows=>[...rows,{draftKey:key,fromOperatorId:entity.entityId,toOperatorId:others[0]!.entityId,relationType:'associated-with',active:true}]);}}>Add entity relationship</button>
    <div className="record-fields">{drafts.map(row=><fieldset key={row.draftKey} className="focus-card"><legend>{operators.find(item=>item.entityId===row.toOperatorId)?.name??'Unavailable entity'}</legend>
      <p>From {entity.name}</p>
      <label>Relationship<select value={row.relationType} onChange={event=>update(row.draftKey,{relationType:event.target.value})}>{choices.map(type=><option key={type} value={type}>{type.replaceAll('-',' ')}</option>)}</select></label>
      <label>Other Dive Entity<select value={row.toOperatorId} onChange={event=>update(row.draftKey,{toOperatorId:event.target.value})}>{others.map(item=><option key={item.entityId} value={item.entityId}>{item.name}</option>)}</select></label>
      {row.relationType==='other'&&<><label>Forward label<input value={row.forwardLabel??''} onChange={event=>update(row.draftKey,{forwardLabel:event.target.value})}/></label><label>Reverse label<input value={row.reverseLabel??''} onChange={event=>update(row.draftKey,{reverseLabel:event.target.value})}/></label></>}
      <label><input type="checkbox" checked={row.active} onChange={event=>update(row.draftKey,{active:event.target.checked})}/>Active relationship</label>
      <label>Start date<input type="date" value={row.startDate??''} onChange={event=>update(row.draftKey,{startDate:event.target.value})}/></label>
      <label>End date<input type="date" value={row.endDate??''} onChange={event=>update(row.draftKey,{endDate:event.target.value})}/></label>
      <label className="record-wide">Notes<textarea value={row.notes??''} onChange={event=>update(row.draftKey,{notes:event.target.value})}/></label>
      <div className="record-actions"><button type="button" className="focus-secondary" onClick={()=>go('Dive Centres&operatorId='+encodeURIComponent(row.toOperatorId))}>Open linked entity</button>
        <button type="button" className="focus-secondary danger" onClick={()=>setDrafts(rows=>rows.filter(item=>item.draftKey!==row.draftKey))}>Unlink</button></div>
    </fieldset>)}</div>
  </RecordEditorWorkspace>;
}
