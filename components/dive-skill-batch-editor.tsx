'use client';
import { useState } from 'react';
import { RecordEditorWorkspace } from './shared/record-editor-workspace';
import { SkillEvidenceChoice } from './skill-evidence-choice';
import { availableDiveSkills, diveSkillEnvironment, SKILL_ASSESSMENTS, SKILL_ENVIRONMENTS } from '../lib/logbook/skill-practice';
import { canonicalSkillGroups, isSkillCompetenceLevel, saveDiveSkillBatch, SKILL_COMPETENCE_LEVELS, skillCompetenceDefinition, skillCompetenceLevelLabel, skillRecordGroup, skillRecordKey, skillRecordName, type CanonicalSkillRecord, type SkillEvidenceRecord } from '../lib/offline/dive-context';
import type { DiveRecord } from '../lib/offline/dives';
import type { PersonRecord, EquipmentSetRecord } from '../lib/offline/dive-planning';

interface PracticeDraft { entityId:string;skillId:string;competence:string;confidence:string;notes:string }
const PAGE_SIZE=12;
export function DiveSkillBatchEditor({dive,skills,evidence,people=[],equipmentSets=[],close,saved,progress}:{
  dive:DiveRecord & {entityId:string};skills:CanonicalSkillRecord[];evidence:SkillEvidenceRecord[];
  people?:Array<PersonRecord & {entityId:string}>;equipmentSets?:Array<EquipmentSetRecord & {entityId:string}>;
  close:()=>void;saved:(items:SkillEvidenceRecord[],evidenceIds:string[])=>void;progress:(evidenceIds:string[])=>void;
}) {
  const [selected,setSelected]=useState<PracticeDraft[]>([]);
  const [query,setQuery]=useState(''),[group,setGroup]=useState(''),[page,setPage]=useState(0);
  const [environment,setEnvironment]=useState(()=>diveSkillEnvironment(dive));
  const [assessment,setAssessment]=useState('Self assessed');
  const [performedAt,setPerformedAt]=useState(`${dive.date}T${dive.timeOut||dive.timeIn||'12:00'}`);
  const [evaluator,setEvaluator]=useState(''),[equipment,setEquipment]=useState('');
  const [defaultCompetence,setDefaultCompetence]=useState(''),[defaultConfidence,setDefaultConfidence]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const available=availableDiveSkills(dive,skills,evidence);
  const filtered=available.filter(skill=>(!group||skillRecordGroup(skill)===group)&&`${skillRecordName(skill)} ${skillRecordGroup(skill)} ${skill.description||''}`.toLocaleLowerCase('en-GB').includes(query.trim().toLocaleLowerCase('en-GB')));
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)),currentPage=Math.min(page,pages-1),visible=filtered.slice(currentPage*PAGE_SIZE,(currentPage+1)*PAGE_SIZE);
  function toggle(skill:CanonicalSkillRecord){setSelected(current=>current.some(row=>row.skillId===skill.entityId)?current.filter(row=>row.skillId!==skill.entityId):current.length>=100?current:[...current,{entityId:crypto.randomUUID(),skillId:skill.entityId,competence:defaultCompetence,confidence:defaultConfidence,notes:''}]);}
  function update(id:string,patch:Partial<PracticeDraft>){setSelected(current=>current.map(row=>row.entityId===id?{...row,...patch}:row));}
  async function submit(){
    if(busy||!selected.length)return;
    setBusy(true);setError('');
    try{
      const result=await saveDiveSkillBatch(dive.entityId,selected.map(row=>({entityId:row.entityId,skillKey:skillRecordKey(skills.find(skill=>skill.entityId===row.skillId)!),performedAt:new Date(performedAt).toISOString(),environment,assessment,competenceLevel:isSkillCompetenceLevel(row.competence)?row.competence:null,confidenceLevel:row.confidence===''?null:Number(row.confidence),notes:row.notes.trim(),evaluatorPersonId:evaluator||null,equipmentSetId:equipment||null,planId:dive.originatingPlanId??null})));
      progress(result.evidenceIds);
      if(result.failed.length){
        const failed=new Set(result.failed.map(row=>row.entityId));setSelected(current=>current.filter(row=>failed.has(row.entityId)));
        setError(`${result.saved.length} saved; ${result.skipped.length} already recorded; ${result.failed.length} need attention. Saved Skills are retained. ${result.failed.map(row=>row.message).join(' ')} Retry saves only the retained drafts.`);
      }else saved(result.saved,result.evidenceIds);
    }catch(reason){setError(reason instanceof Error?reason.message:'Skills could not be saved. Your selections are retained.');}
    finally{setBusy(false);}
  }
  return <RecordEditorWorkspace label="Record multiple skills" close={close} save={submit} busy={busy} saveDisabled={!selected.length||!performedAt} saveLabel={`Save ${selected.length} ${selected.length===1?'skill':'skills'}`} value={{selected,environment,assessment,performedAt,evaluator,equipment}} trackInteractions={false} contentClassName="skill-batch-workspace">
    <p>Choose the Skills practised on this Dive, then rate each one. Already-recorded Skills are omitted; edit their notes for multiple attempts.</p>
    <fieldset disabled={busy} className="skill-batch-common"><legend>Practice details for this batch</legend><div className="skill-evidence-grid">
      <label><span>Practised at</span><input type="datetime-local" required value={performedAt} onChange={event=>setPerformedAt(event.target.value)}/></label>
      <SkillEvidenceChoice label="Environment" value={environment} options={SKILL_ENVIRONMENTS} onChange={setEnvironment}/>
      <SkillEvidenceChoice label="Assessment" value={assessment} options={SKILL_ASSESSMENTS} onChange={setAssessment}/>
      <label><span>Evaluator</span><select value={evaluator} onChange={event=>setEvaluator(event.target.value)}><option value="">No evaluator recorded</option>{people.map(person=><option key={person.entityId} value={person.entityId}>{person.name}</option>)}</select></label>
      <label><span>Equipment configuration</span><select value={equipment} onChange={event=>setEquipment(event.target.value)}><option value="">No equipment set recorded</option>{equipmentSets.map(set=><option key={set.entityId} value={set.entityId}>{set.name}</option>)}</select></label>
    </div>{diveSkillEnvironment(dive)&&<p>Environment is prefilled from this logged Dive. You can choose a different environment for this practice.</p>}<p>Recording practice is not an automatic agency sign-off.</p></fieldset>
    <div className="skill-batch-layout">
      <section className="skill-batch-picker" aria-label="Choose Skills"><h2>Choose Skills</h2><label><span>Search Skills</span><input value={query} onChange={event=>{setQuery(event.target.value);setPage(0);}}/></label><label><span>Skill group</span><select value={group} onChange={event=>{setGroup(event.target.value);setPage(0);}}><option value="">All groups</option>{canonicalSkillGroups(available).map(name=><option key={name}>{name}</option>)}</select></label>
        <output aria-live="polite">{filtered.length} available · {selected.length} selected</output>
        <div className="skill-batch-catalogue">{visible.map(skill=><label key={skill.entityId} className="skill-batch-option"><input type="checkbox" aria-label={`Select ${skillRecordName(skill)}`} checked={selected.some(row=>row.skillId===skill.entityId)} disabled={busy||(!selected.some(row=>row.skillId===skill.entityId)&&selected.length>=100)} onChange={()=>toggle(skill)}/><span><b>{skillRecordName(skill)}</b><small>{skillRecordGroup(skill)}</small></span></label>)}</div>
        {!filtered.length&&<p>No unrecorded Skills match. Use the recorded Skill notes for repeat attempts.</p>}
        <nav className="skill-batch-paging" aria-label="Skill selection pages"><button type="button" className="focus-secondary" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><span>Page {currentPage+1} of {pages}</span><button type="button" className="focus-secondary" disabled={currentPage+1>=pages} onClick={()=>setPage(currentPage+1)}>Next</button></nav>
        <button type="button" className="focus-secondary" disabled={busy||!visible.length} onClick={()=>setSelected(current=>[...current,...visible.filter(skill=>!current.some(row=>row.skillId===skill.entityId)).slice(0,100-current.length).map(skill=>({entityId:crypto.randomUUID(),skillId:skill.entityId,competence:defaultCompetence,confidence:defaultConfidence,notes:''}))])}>Select this page</button>
      </section>
      <section className="skill-batch-ratings" aria-label="Selected Skill ratings"><h2>Rate selected Skills</h2><details className="skill-batch-defaults"><summary>Set ratings together</summary><div className="skill-evidence-grid"><label><span>Shared competence</span><select value={defaultCompetence} onChange={event=>setDefaultCompetence(event.target.value)}><option value="">Not assessed</option>{SKILL_COMPETENCE_LEVELS.map(level=><option key={level} value={level}>{skillCompetenceLevelLabel(level)}</option>)}</select></label><label><span>Shared confidence</span><select value={defaultConfidence} onChange={event=>setDefaultConfidence(event.target.value)}><option value="">Not recorded</option>{[0,1,2,3,4,5].map(level=><option key={level} value={level}>{level} / 5</option>)}</select></label></div><button type="button" className="focus-secondary" disabled={busy||!selected.length} onClick={()=>setSelected(current=>current.map(row=>({...row,competence:defaultCompetence,confidence:defaultConfidence})))}>Apply to selected Skills</button><p>You can adjust individual ratings below. New selections use these shared ratings.</p></details>
        {!selected.length&&<p>Select one or more Skills to give each its own competence, confidence and notes.</p>}
        {selected.map(row=>{const skill=skills.find(item=>item.entityId===row.skillId)!;const definition=isSkillCompetenceLevel(row.competence)?skillCompetenceDefinition(skill,row.competence):'';return <fieldset key={row.entityId} disabled={busy} className="skill-batch-row"><legend>{skillRecordName(skill)}</legend><div className="skill-evidence-grid"><label><span>Competence for {skillRecordName(skill)}</span><select value={row.competence} onChange={event=>update(row.entityId,{competence:event.target.value})}><option value="">Not assessed</option>{SKILL_COMPETENCE_LEVELS.map(level=><option key={level} value={level}>{skillCompetenceLevelLabel(level)}</option>)}</select></label><label><span>Confidence for {skillRecordName(skill)}</span><select value={row.confidence} onChange={event=>update(row.entityId,{confidence:event.target.value})}><option value="">Not recorded</option>{[0,1,2,3,4,5].map(level=><option key={level} value={level}>{level} — {['None','Very low','Low','Moderate','High','Very high'][level]}</option>)}</select></label></div>{row.competence&&<p>{definition||'No Skill-specific definition has been recorded yet.'}</p>}<label><span>Notes for {skillRecordName(skill)}</span><textarea rows={3} placeholder="Attempts, what improved, observations…" value={row.notes} onChange={event=>update(row.entityId,{notes:event.target.value})}/></label><button type="button" className="focus-secondary" onClick={()=>setSelected(current=>current.filter(item=>item.entityId!==row.entityId))}>Remove {skillRecordName(skill)} from selection</button></fieldset>;})}
      </section>
    </div>{error&&<p role="alert" className="dive-save-error">{error}</p>}
  </RecordEditorWorkspace>;
}
