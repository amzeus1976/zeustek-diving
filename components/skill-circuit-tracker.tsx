'use client';

import { useState } from 'react';
import type { SkillCircuitRubric, projectSkillCircuit } from '../lib/professional-development/skill-circuit';
import styles from './professional-development.module.css';

type View = 'formal' | 'best' | 'latest';
const views: Array<{ key: View; label: string }> = [
  { key: 'formal', label: 'Current formal' }, { key: 'best', label: 'Personal best' },
  { key: 'latest', label: 'Latest attempt' },
];
const statusLabels: Record<string, string> = {
  not_started: 'Not started', in_progress: 'In progress',
  all_skills_attempted: 'All skills attempted — awaiting evaluator-backed formal scores',
  needs_improvement: 'Needs improvement', needs_underwater_five: 'Needs an underwater score of 5',
  minimum_progress_recorded: 'Minimum progress conditions recorded', above_minimum: 'Above minimum — improving',
};
const scoreText = (score: number | null | undefined) => score == null ? '—' : `${score} / 5`;
const recordedDate = (value: string) => Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleDateString('en-GB') : 'Date unavailable';

export function SkillCircuitTracker({ rubric, progress, openAttempt, addAttempt }: {
  rubric: SkillCircuitRubric;
  progress: ReturnType<typeof projectSkillCircuit>;
  openAttempt: (id: string) => void;
  addAttempt: (key: string) => void;
}) {
  const [view, setView] = useState<View>('formal');
  return <section className={`focus-card ${styles.waterWorkspace}`} aria-label="24-skill circuit progress">
    <div className={styles.sectionHead}>
      <div><span className="focus-eyebrow">DIVE SKILLS WORKSHOP</span><h2>24-skill circuit</h2>
        <p>{rubric.source}. This is a progress tracker; instructor confirmation pending.</p></div>
      <strong>{progress.complete ? `${progress.total} / ${progress.maximum}` : `${progress.total} / ${progress.maximum} partial`}</strong>
    </div>
    <output className={styles.circuitStatus}><b>{statusLabels[progress.status]}</b>. {progress.progressTargetMet
      ? 'Recorded progress conditions reached; instructor sign-off remains separate.'
      : `Recorded progress conditions not yet reached: all 24 formal demonstrations, at least ${rubric.individualMinimum} each, ${rubric.totalTarget} total points and one underwater 5.`}</output>
    <dl className={styles.circuitMetrics}>
      <div><dt>Current formal total</dt><dd>{progress.total} / {progress.maximum}</dd></div>
      <div><dt>Points below 82</dt><dd>{progress.pointsBelowTarget}</dd></div>
      <div><dt>Points above 82</dt><dd>{progress.pointsAboveTarget}</dd></div>
      <div><dt>Skills below 3</dt><dd>{progress.skillsBelowMinimum}</dd></div>
      <div><dt>Formal skills recorded</dt><dd>{progress.contributingIds.length} / 24</dd></div>
      <div><dt>Underwater skill scored 5</dt><dd>{progress.underwaterFive ? 'Yes' : 'No'}</dd></div>
    </dl>
    <p>{progress.complete ? `${progress.pointsAboveTarget} point(s) above the 82-point progress target.` :
      `${24 - progress.contributingIds.length} skill(s) still need evaluator-backed formal evidence. Practice does not count toward the formal total.`}</p>
    <progress max={progress.maximum} value={progress.total} aria-label={`Recorded formal circuit points out of ${progress.maximum}`} />
    <fieldset className={styles.circuitViews}><legend>Circuit score view</legend>
      {views.map(option => <button key={option.key} type="button" className="focus-secondary"
        aria-pressed={view === option.key} onClick={() => setView(option.key)}>{option.label}</button>)}
    </fieldset>
    <details className={styles.circuitScale}><summary>How circuit scores are interpreted</summary>
      {rubric.scoringScale ? <ol>{rubric.scoringScale.map(level => <li key={level.score}><b>{level.score}:</b> {level.description}</li>)}</ol>
        : <p>This historical captured rubric records scores from 1 to 5. Consult its cited source for the detailed scale.</p>}
    </details>
    <div className={styles.waterRows}>
      {progress.items.map((row, index) => {
        const selected = view === 'formal' ? row.formal : view === 'best' ? row.best : row.latest;
        const minimum = row.formal?.score != null && row.formal.score >= rubric.individualMinimum;
        return <details key={row.key}>
          <summary><b>{index + 1}. {row.label}</b>
            <span className={styles.circuitScore}>{views.find(option => option.key === view)?.label}: {scoreText(selected?.score)}</span>
            <small>Attempt count: {row.attempts.length} · {row.formal ? minimum ? 'Formal minimum recorded' : 'Below 3-point minimum' : 'No signed formal score'}</small>
          </summary>
          <p>{row.underwater ? 'Underwater skill' : 'Surface / equipment skill'} · Latest: {row.latest?.score ?? 'Unassessed'} · Personal best: {row.best?.score ?? '—'}
            {row.formal && row.formal.score! < rubric.individualMinimum ? ' · Below 3-point minimum' : ''}
            {row.underwater && row.formal?.score === 5 ? ' · Underwater 5 recorded' : ''}</p>
          <dl className={styles.circuitFacts}>
            <div><dt>Current formal</dt><dd>{scoreText(row.formal?.score)}</dd></div>
            <div><dt>Personal best</dt><dd>{scoreText(row.best?.score)}</dd></div>
            <div><dt>Latest attempt</dt><dd>{scoreText(row.latest?.score)}</dd></div>
            <div><dt>Latest practice</dt><dd>{scoreText(row.latestPractice?.score)}</dd></div>
          </dl>
          {row.scoringNotes?.map(note => <p key={note}>{note}</p>)}
          <div className={styles.circuitAttempts}>
            {row.attempts.map(result => <article key={result.id}>
              <b>{recordedDate(result.attempt.occurredAt)} · {result.attempt.mode} · {scoreText(result.score)}</b>
              <p>Evaluator: {result.attempt.evaluatorName || (result.attempt.evaluatorPersonId ? 'Saved evaluator' : 'Not recorded')}</p>
              <p>Site/pool: {[result.attempt.siteName, result.attempt.conditions].filter(Boolean).join(' · ') || 'Not recorded'}</p>
              <p>Current contribution: {row.formal?.id === result.id ? 'Yes — formal total' : 'No'}</p>
              {result.attempt.observedPerformance && <p>Observation: {result.attempt.observedPerformance}</p>}
              {result.attempt.notes && <p>Notes: {result.attempt.notes}</p>}
              {result.attempt.neutralBuoyancyObserved === true && <p>Neutral buoyancy observed</p>}
              {result.attempt.relatedSkillEvidence?.map(link => <a key={link.id} className="focus-link"
                href={`/?${new URLSearchParams({ section: 'Skills & Currency', evidenceId: link.id })}`}>
                Skill Evidence: {link.label}</a>)}
              {result.reasons.length > 0 && <p>Not contributing: {result.reasons.join('; ')}</p>}
              <button type="button" className="focus-link"
                aria-label={`Open recorded attempt for ${row.label} on ${recordedDate(result.attempt.occurredAt)}`}
                onClick={() => openAttempt(result.id)}>Open recorded attempt</button>
            </article>)}
          </div>
          <button type="button" className="focus-secondary" aria-label={`Record attempt for ${row.label}`}
            onClick={() => addAttempt(row.key)}>Record {row.label} attempt</button>
        </details>;
      })}
    </div>
    <small>Instructor review and current controlling course materials are separate. This is not a PADI pass or certification claim.</small>
  </section>;
}
