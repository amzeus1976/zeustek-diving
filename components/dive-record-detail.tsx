'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Info, Link2Off, Pencil, Plus, Trash2, X } from 'lucide-react';
import { AccessibleDialog } from './accessible-dialog';
import { MediaGallery } from './media-gallery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DIVE_VIEWS, parseDiveView, saveDivePerspective, type DivePerspectivePatch, type DiveView } from '../lib/offline/dive-perspectives';
import type { DiveDebrief, DiveRecord, DiveStory } from '../lib/offline/dives';
import { CANONICAL_SKILL_GROUPS, CANONICAL_SKILLS_CHANGED_EVENT, SKILL_COMPETENCE_LEVELS, createCanonicalSkill, deleteDiveSkillEvidence, isSkillCompetenceLevel, linkSkillEvidenceToDive, listCanonicalSkills, listSkillEvidence, loadOriginatingPlan, planComparison, resolveCanonicalSkillReference, saveDiveSkillEvidence, skillCompetenceDefinition, skillCompetenceLevelLabel, skillEvidenceDisplayName, skillRecordGroup, skillRecordKey, skillRecordLabel, skillRecordName, unlinkSkillEvidenceFromDive, type CanonicalSkillRecord, type SkillEvidenceRecord } from '../lib/offline/dive-context';
import { refreshDiveRecords } from '../lib/offline/dive-store';
import { listEquipmentSets, listPeople, type DiveTripRecord, type EquipmentSetRecord, type PersonRecord } from '../lib/offline/dive-planning';
import { DiveEditorWrites } from '../lib/offline/dive-editor-writes';
import { ComputerProfileEvidence } from './computer-profile-evidence';

const debriefFields = [
  ['wentWell', 'What went well'], ['improve', 'What could be improved'],
  ['unexpectedEvents', 'Problems / unexpected events'], ['decisionsAndAdaptations', 'Decisions and adaptations'],
  ['lessonsLearned', 'Lessons learned'], ['nextDiveActions', 'Next dive actions'],
] as const;
const humanFactorsFields = [
  ['taskLoading', 'Task loading'], ['communication', 'Communication'], ['teamwork', 'Teamwork'],
  ['situationalAwareness', 'Situational awareness'], ['pressure', 'Pressure'], ['decisionMaking', 'Decision quality'],
  ['stopAbortOutcome', 'Stop / abort decisions'], ['equipmentInteraction', 'Equipment interaction'], ['notes', 'Other human factors observations'],
] as const;
const storyFields = [
  ['narrative', 'What happened'], ['standoutMoment', 'Standout / best moment'], ['challengingMoment', 'Most challenging moment'],
  ['surprises', 'What surprised me'], ['memorableMoments', 'Wildlife, wreck, environment or team moments'], ['personalReflection', 'Personal reflection'],
] as const;

type Stored<T> = T & { entityId: string };

function localDateTime(value: string | undefined, dive: DiveRecord) {
  const candidate = value || `${dive.date}T${dive.timeOut || dive.timeIn || '12:00'}`;
  const parsed = new Date(candidate);
  return Number.isFinite(parsed.getTime()) ? new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : `${dive.date}T12:00`;
}

function evidenceCompetenceText(evidence: SkillEvidenceRecord, skill: CanonicalSkillRecord | undefined) {
  if (isSkillCompetenceLevel(evidence.competenceLevel)) {
    const definition = skillCompetenceDefinition(skill, evidence.competenceLevel);
    return `${skillCompetenceLevelLabel(evidence.competenceLevel)}${definition ? ` — ${definition}` : ''}`;
  }
  return typeof evidence.competenceLevel === 'number' ? `Legacy competence ${evidence.competenceLevel} / 5` : 'Not assessed';
}

export function SkillEvidenceDialog({ dive, skills, people, equipmentSets, evidence, close, saved }: {
  dive: DiveRecord & { entityId: string };
  skills: CanonicalSkillRecord[];
  people: Array<Stored<PersonRecord>>;
  equipmentSets: Array<Stored<EquipmentSetRecord>>;
  evidence: SkillEvidenceRecord | null;
  close: () => void;
  saved: (item: SkillEvidenceRecord, evidenceIds: string[]) => void;
}) {
  const firstActiveSkill = skills.find(skill => !skill.archived);
  const [skillKey, setSkillKey] = useState(evidence?.skillKey || (firstActiveSkill ? skillRecordKey(firstActiveSkill) : ''));
  const [skillSearch, setSkillSearch] = useState('');
  const [createNew, setCreateNew] = useState(!evidence && !skills.length);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillGroup, setNewSkillGroup] = useState('Other');
  const [performedAt, setPerformedAt] = useState(localDateTime(evidence?.performedAt, dive));
  const [environment, setEnvironment] = useState(evidence?.environment || '');
  const [assessment, setAssessment] = useState(evidence?.assessment || '');
  const [competenceLevel, setCompetenceLevel] = useState(evidence?.competenceLevel == null ? '' : String(evidence.competenceLevel));
  const [confidenceLevel, setConfidenceLevel] = useState(evidence?.confidenceLevel == null ? '' : String(evidence.confidenceLevel));
  const [competenceHelpOpen, setCompetenceHelpOpen] = useState(false);
  const competenceSelectId = useId();
  const competenceDescriptionId = useId();
  const [evaluatorPersonId, setEvaluatorPersonId] = useState(evidence?.evaluatorPersonId || '');
  const [equipmentSetId, setEquipmentSetId] = useState(evidence?.equipmentSetId || '');
  const [notes, setNotes] = useState(evidence?.notes || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      let selectedSkillKey = skillKey;
      if (createNew) {
        const skill = await createCanonicalSkill({ name: newSkillName, group: newSkillGroup });
        selectedSkillKey = skillRecordKey(skill);
        window.dispatchEvent(new Event(CANONICAL_SKILLS_CHANGED_EVENT));
      }
      const result = await saveDiveSkillEvidence(dive.entityId, {
        ...(evidence ? { entityId: evidence.entityId } : {}),
        skillKey: selectedSkillKey,
        performedAt: new Date(performedAt).toISOString(),
        planId: evidence?.planId ?? dive.originatingPlanId ?? null,
        environment: environment.trim(),
        assessment: assessment.trim(),
        competenceLevel: competenceLevel === '' ? null : isSkillCompetenceLevel(competenceLevel) ? competenceLevel : evidence?.competenceLevel ?? null,
        confidenceLevel: confidenceLevel === '' ? null : Number(confidenceLevel),
        evaluatorPersonId: evaluatorPersonId || null,
        equipmentSetId: equipmentSetId || null,
        attachmentIds: evidence?.attachmentIds ?? [],
        notes: notes.trim(),
      });
      saved(result.evidence, result.evidenceIds);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Skill evidence could not be saved.'); }
    finally { setBusy(false); }
  }
  const currentSkill = evidence ? resolveCanonicalSkillReference(evidence.skillKey, skills) : undefined;
  const selectedSkill = resolveCanonicalSkillReference(skillKey, skills);
  const selectedCompetence = isSkillCompetenceLevel(competenceLevel) ? competenceLevel : null;
  const selectedDefinition = selectedCompetence ? skillCompetenceDefinition(selectedSkill, selectedCompetence) : '';
  const competenceContext = selectedCompetence ? selectedDefinition || 'No Skill-specific definition has been recorded yet.' : 'Select a competence level to see this Skill-specific definition.';
  const selectableSkills = skills.filter(skill => !skill.archived || skill.entityId === currentSkill?.entityId).filter(skill => {
    const query = skillSearch.trim().toLocaleLowerCase('en-GB');
    return !query || skill.entityId === currentSkill?.entityId || `${skillRecordName(skill)} ${skillRecordGroup(skill)} ${skill.description || ''}`.toLocaleLowerCase('en-GB').includes(query);
  }).sort((a, b) => skillRecordGroup(a).localeCompare(skillRecordGroup(b), 'en-GB') || skillRecordName(a).localeCompare(skillRecordName(b), 'en-GB'));
  return <div className="focus-modal-bg skill-evidence-modal-bg">
    <AccessibleDialog editable label={evidence ? 'Edit skill evidence' : 'Add skill evidence'} className="focus-modal skill-evidence-modal" close={() => { if (!busy) close(); }}>
      <form onSubmit={event => void submit(event)}>
        <header><div><span className="focus-eyebrow">SKILLS PRACTISED</span><h2>{evidence ? 'Edit skill evidence' : 'Add skill'}</h2></div><button type="button" className="focus-icon" disabled={busy} aria-label="Close skill evidence editor" data-dialog-close onClick={close}><X /></button></header>
        <fieldset disabled={busy} className="skill-evidence-fields">
          {!createNew && <><label>Search existing skills<input value={skillSearch} onChange={event => setSkillSearch(event.target.value)} placeholder="Search by Skill group, name or description" /></label><label>Canonical skill<select required value={skillKey} onChange={event => setSkillKey(event.target.value)}><option value="">Choose a saved skill</option>{selectableSkills.map(skill => <option key={skill.entityId} value={skillRecordKey(skill)}>{skillRecordLabel(skill)}{skill.archived ? ' — archived' : ''}</option>)}</select></label>{skillSearch && selectableSkills.length === 0 && <p>No active Skills match that search. Clear the search or create a new canonical Skill.</p>}</>}
          {!evidence && <button type="button" className="focus-secondary skill-create-toggle" data-dialog-dirty aria-pressed={createNew} onClick={() => setCreateNew(value => !value)}>{createNew ? 'Choose a saved skill' : 'Create a new canonical skill'}</button>}
          {createNew && <div className="skill-create-fields"><label>New skill name<input required value={newSkillName} onChange={event => setNewSkillName(event.target.value)} placeholder="e.g. DSMB deployment" /></label><label>Skill group<select value={newSkillGroup} onChange={event => setNewSkillGroup(event.target.value)}>{CANONICAL_SKILL_GROUPS.map(group => <option key={group}>{group}</option>)}</select></label><p>This creates one reusable Skill definition. The evidence below records this occurrence on the current Dive.</p></div>}
          <div className="skill-evidence-grid">
            <label>Practised at<input type="datetime-local" required value={performedAt} onChange={event => setPerformedAt(event.target.value)} /></label>
            <label>Environment<input value={environment} onChange={event => setEnvironment(event.target.value)} placeholder="Open water, quarry, pool…" /></label>
            <div className="skill-competence-choice"><div className="skill-competence-label"><label htmlFor={competenceSelectId}>Competence</label><button type="button" className="skill-competence-help" aria-label="Show Skill-specific competence definitions" aria-expanded={competenceHelpOpen} aria-controls={`${competenceDescriptionId}-all`} data-tooltip={competenceContext} onClick={() => setCompetenceHelpOpen(value => !value)}><Info size={16}/></button></div><select id={competenceSelectId} aria-describedby={competenceDescriptionId} value={competenceLevel} onChange={event => setCompetenceLevel(event.target.value)}><option value="">Not assessed</option>{evidence?.competenceLevel != null && !isSkillCompetenceLevel(evidence.competenceLevel) && <option value={String(evidence.competenceLevel)}>Legacy competence: {evidence.competenceLevel} / 5</option>}{SKILL_COMPETENCE_LEVELS.map(level => <option key={level} value={level}>{skillCompetenceLevelLabel(level)}</option>)}</select><div id={competenceDescriptionId} className={`skill-competence-context${selectedCompetence && !selectedDefinition ? ' definition-missing' : ''}`} role="status" aria-live="polite">{selectedCompetence && <b>{skillCompetenceLevelLabel(selectedCompetence)}</b>}<span>{competenceContext}</span></div>{competenceHelpOpen && <div id={`${competenceDescriptionId}-all`} className="skill-competence-all"><b>Definitions for {selectedSkill ? skillRecordName(selectedSkill) : 'the selected Skill'}</b>{SKILL_COMPETENCE_LEVELS.map(level => <div key={level}><strong>{skillCompetenceLevelLabel(level)}</strong><span>{skillCompetenceDefinition(selectedSkill, level) || 'No Skill-specific definition has been recorded yet.'}</span></div>)}</div>}</div>
            <label>Confidence<select value={confidenceLevel} onChange={event => setConfidenceLevel(event.target.value)}><option value="">Not recorded</option>{[0,1,2,3,4,5].map(level => <option key={level} value={level}>{level} — {['None','Very low','Low','Moderate','High','Very high'][level]}</option>)}</select></label>
            <label>Evaluator<select value={evaluatorPersonId} onChange={event => setEvaluatorPersonId(event.target.value)}><option value="">No evaluator recorded</option>{people.map(person => <option key={person.entityId} value={person.entityId}>{person.name}</option>)}</select></label>
            <label>Equipment configuration<select value={equipmentSetId} onChange={event => setEquipmentSetId(event.target.value)}><option value="">No equipment set recorded</option>{equipmentSets.map(set => <option key={set.entityId} value={set.entityId}>{set.name}</option>)}</select></label>
          </div>
          <label>Assessment<input value={assessment} onChange={event => setAssessment(event.target.value)} placeholder="Observed outcome or assessment" /></label>
          <label>Evidence notes<textarea value={notes} onChange={event => setNotes(event.target.value)} /></label>
          {evidence?.attachmentIds?.length ? <p>{evidence.attachmentIds.length} existing evidence attachment{evidence.attachmentIds.length === 1 ? '' : 's'} retained.</p> : <p>Photos and videos remain attached to the Dive below; evidence records preserve any existing attachment references.</p>}
        </fieldset>
        {error && <p role="alert" className="dive-save-error">{error}</p>}
        <footer><button type="button" className="focus-secondary" disabled={busy} data-dialog-close onClick={close}>Cancel</button><button className="focus-primary" disabled={busy || (!createNew && !skillKey)}>{busy ? 'Saving…' : evidence ? 'Save evidence' : 'Add to Dive'}</button></footer>
      </form>
    </AccessibleDialog>
  </div>;
}

export function SkillEvidenceCard({ item, skill, people, busy = false, edit, unlink, remove }: {
  item: SkillEvidenceRecord;
  skill: CanonicalSkillRecord | undefined;
  people: Array<Stored<PersonRecord>>;
  busy?: boolean;
  edit: () => void;
  unlink: () => void;
  remove: () => void;
}) {
  return <article className="dive-evidence-item">
    <div className="dive-evidence-summary"><div><b>{skill ? skillRecordName(skill) : 'Unknown / unavailable Skill'}</b><span>{item.performedAt ? new Date(item.performedAt).toLocaleString() : 'Date not recorded'}</span></div><div className="dive-evidence-actions"><button type="button" className="focus-icon" title="Edit evidence" data-tooltip="Edit evidence" aria-label="Edit evidence" disabled={busy} onClick={edit}><Pencil size={17}/></button><button type="button" className="focus-icon" title="Unlink evidence" data-tooltip="Unlink evidence" aria-label="Unlink evidence" disabled={busy} onClick={unlink}><Link2Off size={17}/></button><button type="button" className="focus-icon danger" title="Delete evidence" data-tooltip="Delete evidence" aria-label="Delete evidence" disabled={busy} onClick={remove}><Trash2 size={17}/></button></div></div>
    <details><summary>Evidence details</summary><p><b>Competence:</b> {evidenceCompetenceText(item, skill)}</p><p><b>Environment:</b> {item.environment || 'Not recorded'} · <b>Confidence:</b> {item.confidenceLevel ?? 'not recorded'} / 5</p>{item.assessment && <p><b>Assessment:</b> {item.assessment}</p>}{item.notes && <p><b>Notes:</b> {item.notes}</p>}{item.evaluatorPersonId && <p>Evaluator: {people.find(person => person.entityId === item.evaluatorPersonId)?.name || 'Saved person reference'}</p>}<p>{item.attachmentIds?.length ?? 0} linked attachments. This is recorded evidence, not an automatic agency sign-off.</p>{!skill && <p>Saved Skill reference: <code>{item.skillKey}</code></p>}</details>
  </article>;
}

export function DiveRecordDetail({ dive, title, eyebrow, rows, close, edit, remove, initialView = 'overview' }: {
  dive: DiveRecord & { entityId: string };
  title: string;
  eyebrow: string;
  ownerKind: string;
  ownerId: string;
  rows: Array<[string, string | number | null | undefined]>;
  close: () => void;
  edit: () => void;
  remove: () => void;
  initialView?: DiveView;
}) {
  const [view, setView] = useState(initialView);
  const [debrief, setDebrief] = useState<DiveDebrief>(dive.debrief ?? {});
  const [story, setStory] = useState<DiveStory>(dive.story ?? {});
  const draft = useRef<DivePerspectivePatch>({ debrief: dive.debrief ?? {}, story: dive.story ?? {} });
  const queue = useRef(new DiveEditorWrites());
  const revision = useRef(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [evidence, setEvidence] = useState<SkillEvidenceRecord[]>([]);
  const [skills, setSkills] = useState<CanonicalSkillRecord[]>([]);
  const [people, setPeople] = useState<Array<Stored<PersonRecord>>>([]);
  const [equipmentSets, setEquipmentSets] = useState<Array<Stored<EquipmentSetRecord>>>([]);
  const [skillEditor, setSkillEditor] = useState<SkillEvidenceRecord | null | undefined>(undefined);
  const [skillBusy, setSkillBusy] = useState('');
  const [plan, setPlan] = useState<DiveTripRecord | null>(null);
  const [contextError, setContextError] = useState('');
  const refreshContext = useCallback(async () => {
    const [items, definitions, evaluators, sets, original] = await Promise.all([listSkillEvidence(), listCanonicalSkills(), listPeople(), listEquipmentSets(), loadOriginatingPlan(dive)]);
    setEvidence(items); setSkills(definitions); setPeople(evaluators); setEquipmentSets(sets); setPlan(original); setContextError('');
  }, [dive]);
  useEffect(() => {
    let active = true;
    const skillsChanged = () => { if (active) void refreshContext(); };
    void refreshContext().catch(() => { if (active) setContextError('Linked evidence is unavailable on this device. Existing references are retained.'); });
    void Promise.all([refreshDiveRecords('skill_evidence'), refreshDiveRecords('skill')]).then(() => { if (active) return refreshContext(); }).catch(() => {});
    window.addEventListener(CANONICAL_SKILLS_CHANGED_EVENT, skillsChanged);
    return () => { active = false; window.removeEventListener(CANONICAL_SKILLS_CHANGED_EVENT, skillsChanged); };
  }, [refreshContext]);

  function enqueue(patch: DivePerspectivePatch, retrying = false) {
    const currentRevision = ++revision.current;
    setStatus('Saving on this device…');
    const save = () => saveDivePerspective(dive.entityId, patch);
    const work = retrying ? queue.current.retry(save) : queue.current.enqueue(save);
    void work.then(() => {
      if (revision.current === currentRevision) { setStatus('Saved on this device.'); setError(''); }
    }).catch(reason => {
      setStatus('Not saved yet. Your text is still here.');
      setError(reason instanceof Error ? reason.message : 'Local save failed.');
    });
  }
  function changeDebrief(patch: Partial<DiveDebrief>) {
    const next = { ...draft.current.debrief, ...patch };
    draft.current.debrief = next; setDebrief(next); enqueue({ debrief: patch });
  }
  function changeStory(patch: Partial<DiveStory>) {
    const next = { ...draft.current.story, ...patch };
    draft.current.story = next; setStory(next); enqueue({ story: patch });
  }
  async function leave(action: () => void) {
    if (leaving) return;
    setLeaving(true);
    try { await queue.current.afterSaved(action); } catch { /* Keep this mounted until a retry succeeds. */ }
    finally { setLeaving(false); }
  }
  function retry() {
    enqueue(draft.current, true);
  }
  const factualRows = rows.filter(([, value]) => value !== '' && value != null);
  const evidenceIds = debrief.skillEvidenceIds ?? [];
  const availableEvidence = evidence.filter(item => !item.diveId || item.diveId === dive.entityId || evidenceIds.includes(item.entityId));
  const linkedEvidence = evidenceIds.map(id => evidence.find(item => item.entityId === id));
  const unlinkedEvidence = availableEvidence.filter(item => !evidenceIds.includes(item.entityId));
  const skillForEvidence = (item: SkillEvidenceRecord) => resolveCanonicalSkillReference(item.skillKey, skills);
  const skillNameForEvidence = (item: SkillEvidenceRecord) => skillEvidenceDisplayName(item, skills);
  function applyEvidenceIds(ids: string[]) {
    const next = { ...draft.current.debrief, skillEvidenceIds: ids };
    draft.current.debrief = next; setDebrief(next); setStatus('Saved on this device.'); setError('');
  }
  async function linkEvidence(id: string) {
    setSkillBusy(id); setContextError('');
    try { const result = await linkSkillEvidenceToDive(dive.entityId, id); applyEvidenceIds(result.evidenceIds); await refreshContext(); }
    catch (reason) { setContextError(reason instanceof Error ? reason.message : 'Evidence could not be linked.'); }
    finally { setSkillBusy(''); }
  }
  async function unlinkEvidence(id: string) {
    setSkillBusy(id); setContextError('');
    try { applyEvidenceIds(await unlinkSkillEvidenceFromDive(dive.entityId, id)); await refreshContext(); }
    catch (reason) { setContextError(reason instanceof Error ? reason.message : 'Evidence could not be unlinked.'); }
    finally { setSkillBusy(''); }
  }
  async function deleteEvidence(id: string) {
    if (!window.confirm('Delete this evidence occurrence? The canonical Skill definition will be kept.')) return;
    setSkillBusy(id); setContextError('');
    try { applyEvidenceIds(await deleteDiveSkillEvidence(dive.entityId, id)); await refreshContext(); }
    catch (reason) { setContextError(reason instanceof Error ? reason.message : 'Evidence could not be deleted.'); }
    finally { setSkillBusy(''); }
  }
  return <div className="focus-modal-bg" data-dive-id={dive.entityId}>
    <AccessibleDialog editable label={title} close={() => void leave(close)} className="focus-modal record-detail dive-multiview">
      <header>
        <div><span className="focus-eyebrow">{eyebrow}</span><h2>{title}</h2><p className="dive-shared-date">{dive.date} · {[dive.timeIn, dive.timeOut].filter(Boolean).join(' – ') || 'Time not recorded'}</p></div>
        <button className="focus-icon" disabled={leaving} aria-label="Close Dive detail" onClick={() => void leave(close)}><X /></button>
      </header>
      <div className="dive-shared-stats"><span>#{dive.diveNumber ?? '—'}</span><span>{dive.maxDepthM ?? '—'} m maximum</span><span>{dive.totalElapsedMin ?? dive.bottomTimeMin ?? '—'} min</span><span>{dive.gas || 'Gas not recorded'}</span></div>
      {dive.originatingPlanId && <p className="dive-plan-link"><a className="focus-link" href={`/?section=Dive%20Plans&planId=${encodeURIComponent(dive.originatingPlanId)}`} onClick={event => { event.preventDefault(); const url = event.currentTarget.href; void leave(() => window.location.assign(url)); }}>Originating Dive Plan</a></p>}
      <div className="record-actions dive-shared-actions">
        <button className="focus-secondary" disabled={leaving} onClick={() => void leave(edit)}><Pencil size={16} /> Edit Dive facts</button>
        <button className="focus-secondary danger" disabled={leaving} onClick={() => void leave(remove)}><Trash2 size={16} /> Delete Dive</button>
      </div>
      <Tabs className="dive-view-tabs" value={view} onValueChange={value => void leave(() => setView(parseDiveView(String(value))))}>
        <TabsList className="dive-view-selector" aria-label="Dive view" activateOnFocus={false}>
          {DIVE_VIEWS.map(name => <TabsTrigger key={name} className="dive-view-pill" value={name} disabled={leaving}>{name[0]?.toUpperCase()}{name.slice(1)}</TabsTrigger>)}
        </TabsList>
        <TabsContent value="overview" className="dive-view-body">
          <div className="detail-grid">{factualRows.slice(0, 12).map(([label, value]) => <div key={label}><small>{label}</small><span>{String(value)}</span></div>)}</div>
          <details className="dive-more-facts"><summary>Conditions, equipment, gases and other recorded details</summary><div className="detail-grid">{factualRows.slice(12).map(([label, value]) => <div key={label}><small>{label}</small><span>{String(value)}</span></div>)}</div></details>
          {dive.originatingPlanId && <section className="dive-plan-comparison"><h3>Plan versus actual</h3>{plan ? <><p>Original Plan revision · {plan.modifiedAt}. Later Plan edits do not change this comparison.</p><div className="dive-comparison-grid"><b>Fact</b><b>Planned</b><b>Actual</b>{planComparison(plan, dive).map(([label, planned, actual]) => <div className="dive-comparison-row" key={label}><b>{label}</b><span>{planned}</span><span>{actual}</span></div>)}</div>{plan.notes && <details><summary>Original Plan notes</summary><p>{plan.notes}</p></details>}</> : <p>Original Plan revision is not available on this device. The Plan link is retained; a later revision is not substituted.</p>}{debrief.decisionsAndAdaptations && <p>Decisions and adaptations: {debrief.decisionsAndAdaptations}</p>}</section>}
          <ComputerProfileEvidence diveId={dive.entityId}/>
          <section className="dive-reflection-summary"><h3>Skills & evidence</h3><p>{evidenceIds.length} linked skill evidence · {story.featuredAttachmentIds?.length ?? 0} featured media.</p>{linkedEvidence.map((item, index) => item ? <p key={item.entityId}><b>{skillNameForEvidence(item)}</b> · {item.performedAt ? new Date(item.performedAt).toLocaleString() : 'Date not recorded'}{item.assessment ? ` · ${item.assessment}` : ''}</p> : <p key={evidenceIds[index]}>Saved evidence {evidenceIds[index]} — not available on this device</p>)}<button className="focus-link" onClick={() => void leave(() => setView('debrief'))}>Review linked skill evidence</button></section>
          {debrief.wentWell && <section className="dive-reflection-summary"><h3>Debrief</h3><p>{debrief.wentWell}</p>{debrief.humanFactorsOutcome?.notes && <p>{debrief.humanFactorsOutcome.notes}</p>}<button className="focus-link" onClick={() => void leave(() => setView('debrief'))}>Open Debrief</button></section>}
          {debrief.lessonsLearned && <section className="dive-reflection-summary"><h3>Lessons learned</h3><p>{debrief.lessonsLearned}</p><button className="focus-link" onClick={() => void leave(() => setView('debrief'))}>Open Debrief</button></section>}
          {story.narrative && <section className="dive-reflection-summary"><h3>Story</h3><p>{story.narrative}</p><button className="focus-link" onClick={() => void leave(() => setView('story'))}>Open Story</button></section>}
        </TabsContent>
        <TabsContent value="debrief" className="dive-view-body">
          <h3>Post-dive debrief</h3><p className="dive-view-help">Optional reflections. Dive facts above remain unchanged.</p>
          {debriefFields.map(([field, label]) => <label key={field}>{label}<textarea value={debrief[field] ?? ''} onChange={event => changeDebrief({ [field]: event.target.value })} /></label>)}
          <section className="dive-skill-evidence">
            <div className="dive-skill-head"><div><h3>Skills practised</h3><p>Reusable Skills and their evidence stay shared with future Skills &amp; Currency views.</p></div><button className="focus-primary" onClick={() => setSkillEditor(null)}><Plus size={16}/> Add skill</button></div>
            {contextError && <p role="status">{contextError}</p>}
            {linkedEvidence.map((item, index) => item ? <SkillEvidenceCard key={item.entityId} item={item} skill={skillForEvidence(item)} people={people} busy={skillBusy === item.entityId} edit={() => setSkillEditor(item)} unlink={() => void unlinkEvidence(item.entityId)} remove={() => void deleteEvidence(item.entityId)} /> : <p key={evidenceIds[index]}>Saved evidence {evidenceIds[index]} — unavailable. <button className="focus-secondary" onClick={() => void unlinkEvidence(evidenceIds[index]!)}>Unlink evidence</button></p>)}
            {!evidenceIds.length && <div className="dive-skill-empty"><p>No skills recorded for this dive yet.</p><button className="focus-secondary" onClick={() => setSkillEditor(null)}><Plus size={16}/> Add skill</button></div>}
            {unlinkedEvidence.length > 0 && <details className="dive-existing-evidence"><summary>Link existing evidence ({unlinkedEvidence.length})</summary>{unlinkedEvidence.map(item => <div key={item.entityId}><span><b>{skillNameForEvidence(item)}</b><small>{item.performedAt || 'Date not recorded'}</small></span><button className="focus-secondary" disabled={skillBusy === item.entityId} onClick={() => void linkEvidence(item.entityId)}>Link to this Dive</button></div>)}</details>}
          </section>
          <details className="dive-human-factors"><summary>Human factors outcome</summary>{humanFactorsFields.map(([field, label]) => <label key={field}>{label}<textarea value={debrief.humanFactorsOutcome?.[field] ?? ''} onChange={event => changeDebrief({ humanFactorsOutcome: { ...draft.current.debrief?.humanFactorsOutcome, [field]: event.target.value } })} /></label>)}</details>
          <label>Confidence / comfort<select value={debrief.confidenceLevel ?? ''} onChange={event => changeDebrief({ confidenceLevel: event.target.value === '' ? null : Number(event.target.value) })}><option value="">Not rated</option><option value="1">1 — Very uncomfortable</option><option value="2">2 — Uncomfortable</option><option value="3">3 — Mixed / neutral</option><option value="4">4 — Comfortable</option><option value="5">5 — Very comfortable</option></select></label>
        </TabsContent>
        <TabsContent value="story" className="dive-view-body dive-story-body">
          <h3>Your Dive story</h3><p className="dive-view-help">Optional, user-authored memories of this same Dive.</p>
          {storyFields.map(([field, label]) => <label key={field}>{label}<textarea value={story[field] ?? ''} onChange={event => changeStory({ [field]: event.target.value })} /></label>)}
          {debrief.decisionsAndAdaptations && <section className="dive-reflection-summary"><h3>What changed and why</h3><p>{debrief.decisionsAndAdaptations}</p><button className="focus-link" onClick={() => void leave(() => setView('debrief'))}>Edit in Debrief</button></section>}
          <section><h3>Timeline notes</h3>{(story.timelineNotes ?? []).map((note, index) => <div className="dive-timeline-note" key={index}>
            <label>Minutes into Dive<input type="number" min="0" value={note.timeOffsetMin ?? ''} onChange={event => changeStory({ timelineNotes: (draft.current.story?.timelineNotes ?? []).map((row, i) => i === index ? { ...row, timeOffsetMin: event.target.value === '' ? null : Number(event.target.value) } : row) })} /></label>
            <label>Depth (m)<input type="number" min="0" value={note.depthM ?? ''} onChange={event => changeStory({ timelineNotes: (draft.current.story?.timelineNotes ?? []).map((row, i) => i === index ? { ...row, depthM: event.target.value === '' ? null : Number(event.target.value) } : row) })} /></label>
            <label className="dive-timeline-text">What happened<textarea value={note.text} onChange={event => changeStory({ timelineNotes: (draft.current.story?.timelineNotes ?? []).map((row, i) => i === index ? { ...row, text: event.target.value } : row) })} /></label>
            <button className="focus-secondary" onClick={() => changeStory({ timelineNotes: (draft.current.story?.timelineNotes ?? []).filter((_, i) => i !== index) })}>Remove timeline note</button>
          </div>)}<button className="focus-secondary" onClick={() => changeStory({ timelineNotes: [...(draft.current.story?.timelineNotes ?? []), { text: '' }] })}>Add timeline note</button></section>
        </TabsContent>
      </Tabs>
      <p role="status" className="dive-local-save">{status}</p>
      {error && <div role="alert" className="dive-save-error"><p>{error}</p><button className="focus-secondary" onClick={retry}>Retry local save</button></div>}
      <MediaGallery ownerKind="dive" ownerId={dive.entityId} retainOfflineMetadata {...(view === 'story' ? { featuredIds: story.featuredAttachmentIds ?? [], onFeaturedChange: (ids: string[]) => changeStory({ featuredAttachmentIds: ids }) } : {})} />
      <footer><button className="focus-secondary" disabled={leaving} onClick={() => void leave(close)}>Close</button></footer>
    </AccessibleDialog>
    {skillEditor !== undefined && <SkillEvidenceDialog dive={dive} skills={skills} people={people} equipmentSets={equipmentSets} evidence={skillEditor} close={() => setSkillEditor(undefined)} saved={(item, ids) => { setEvidence(current => [...current.filter(value => value.entityId !== item.entityId), item]); applyEvidenceIds(ids); setSkillEditor(undefined); void refreshContext(); }} />}
  </div>;
}
