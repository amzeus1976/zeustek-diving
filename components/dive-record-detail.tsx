'use client';
import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { AccessibleDialog } from './accessible-dialog';
import { MediaGallery } from './media-gallery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { DIVE_VIEWS, parseDiveView, saveDivePerspective, type DivePerspectivePatch, type DiveView } from '../lib/offline/dive-perspectives';
import type { DiveDebrief, DiveRecord, DiveStory } from '../lib/offline/dives';
import { listSkillEvidence, loadOriginatingPlan, planComparison, type SkillEvidenceRecord } from '../lib/offline/dive-context';
import { refreshDiveRecords } from '../lib/offline/dive-store';
import type { DiveTripRecord } from '../lib/offline/dive-planning';
import { DiveEditorWrites } from '../lib/offline/dive-editor-writes';

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
  const [plan, setPlan] = useState<DiveTripRecord | null>(null);
  const [contextError, setContextError] = useState('');
  useEffect(() => {
    let active = true;
    void Promise.all([listSkillEvidence(), loadOriginatingPlan(dive)]).then(([items, original]) => {
      if (active) { setEvidence(items); setPlan(original); }
    }).catch(() => { if (active) setContextError('Linked evidence is unavailable on this device. Existing references are retained.'); });
    void refreshDiveRecords('skill_evidence').then(listSkillEvidence).then(items => { if (active) setEvidence(items); }).catch(() => {});
    return () => { active = false; };
  }, [dive]);

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
  return <div className="focus-modal-bg" data-dive-id={dive.entityId}>
    <AccessibleDialog label={title} close={() => void leave(close)} className="focus-modal record-detail dive-multiview">
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
          <section className="dive-reflection-summary"><h3>Skills & evidence</h3><p>{evidenceIds.length} linked skill evidence · {story.featuredAttachmentIds?.length ?? 0} featured media.</p>{linkedEvidence.map((item, index) => <p key={evidenceIds[index]}>{item ? `${item.skillKey} · ${item.performedAt || 'Date not recorded'}${item.assessment ? ` · ${item.assessment}` : ''}` : `Saved evidence ${evidenceIds[index]} — not available on this device`}</p>)}<button className="focus-link" onClick={() => void leave(() => setView('debrief'))}>Review linked skill evidence</button></section>
          {debrief.wentWell && <section className="dive-reflection-summary"><h3>Debrief</h3><p>{debrief.wentWell}</p>{debrief.humanFactorsOutcome?.notes && <p>{debrief.humanFactorsOutcome.notes}</p>}<button className="focus-link" onClick={() => void leave(() => setView('debrief'))}>Open Debrief</button></section>}
          {debrief.lessonsLearned && <section className="dive-reflection-summary"><h3>Lessons learned</h3><p>{debrief.lessonsLearned}</p><button className="focus-link" onClick={() => void leave(() => setView('debrief'))}>Open Debrief</button></section>}
          {story.narrative && <section className="dive-reflection-summary"><h3>Story</h3><p>{story.narrative}</p><button className="focus-link" onClick={() => void leave(() => setView('story'))}>Open Story</button></section>}
        </TabsContent>
        <TabsContent value="debrief" className="dive-view-body">
          <h3>Post-dive debrief</h3><p className="dive-view-help">Optional reflections. Dive facts above remain unchanged.</p>
          {debriefFields.map(([field, label]) => <label key={field}>{label}<textarea value={debrief[field] ?? ''} onChange={event => changeDebrief({ [field]: event.target.value })} /></label>)}
          <section className="dive-skill-evidence"><h3>Skills practised</h3><p>Link saved skill evidence. This does not copy a skill or create a new assessment.</p>{contextError && <p role="status">{contextError}</p>}{availableEvidence.map(item => <div key={item.entityId}><label className="dive-evidence-check"><input type="checkbox" checked={evidenceIds.includes(item.entityId)} onChange={event => changeDebrief({ skillEvidenceIds: event.target.checked ? [...new Set([...evidenceIds, item.entityId])] : evidenceIds.filter(id => id !== item.entityId) })} />{item.skillKey} · {item.performedAt || 'Date not recorded'}</label><details><summary>View saved evidence</summary><p>{item.assessment || 'Assessment not recorded'}</p>{item.environment && <p>{item.environment}</p>}{item.notes && <p>{item.notes}</p>}{item.evaluatorPersonId && <p>Evaluator reference: {item.evaluatorPersonId}</p>}<p>{item.attachmentIds?.length ?? 0} linked attachments. This is recorded evidence, not an automatic agency sign-off.</p></details></div>)}{!availableEvidence.length && <p>No saved skill evidence is available on this device.</p>}{evidenceIds.filter(id => !evidence.some(item => item.entityId === id)).map(id => <p key={id}>Saved evidence {id} — unavailable. <button className="focus-secondary" onClick={() => changeDebrief({ skillEvidenceIds: evidenceIds.filter(value => value !== id) })}>Unlink evidence</button></p>)}</section>
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
  </div>;
}
