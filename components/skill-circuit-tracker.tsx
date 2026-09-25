import type { SkillCircuitRubric, projectSkillCircuit } from '../lib/professional-development/skill-circuit';
import styles from './professional-development.module.css';

export function SkillCircuitTracker({ rubric, progress, openAttempt, addAttempt }: {
  rubric: SkillCircuitRubric;
  progress: ReturnType<typeof projectSkillCircuit>;
  openAttempt: (id: string) => void;
  addAttempt: (key: string) => void;
}) {
  return <section className={`focus-card ${styles.waterWorkspace}`} aria-label="24-skill circuit progress">
    <div className={styles.sectionHead}>
      <div><span className="focus-eyebrow">DIVE SKILLS WORKSHOP</span><h2>24-skill circuit</h2>
        <p>{rubric.source}. This is a progress tracker; instructor confirmation pending.</p></div>
      <strong>{progress.complete ? `${progress.total} / 120` : `${progress.total} / 120 partial`}</strong>
    </div>
    <p>{progress.progressTargetMet ? 'Recorded progress conditions reached' : 'Recorded progress conditions not yet reached'}: all 24 formal demonstrations, at least 3 each, 82 total points and one underwater 5.</p>
    <p>{progress.complete ? `${progress.pointsAboveTarget} point(s) above the 82-point progress target.` :
      `${24 - progress.contributingIds.length} skill(s) still need evaluator-backed formal evidence. Practice does not count toward the formal total.`}</p>
    <progress max={120} value={progress.total} aria-label="Recorded formal circuit points out of 120" />
    <div className={styles.waterRows}>
      {progress.items.map((row, index) => <details key={row.key}>
        <summary><b>{index + 1}. {row.label}</b><span>{row.formal ? `${row.formal.score} / 5 formal` : 'No signed formal score'}</span></summary>
        <p>{row.underwater ? 'Underwater skill' : 'Surface / equipment skill'} · Latest: {row.latest?.score ?? 'Unassessed'} · Personal best: {row.best?.score ?? '—'}
          {row.formal && row.formal.score! < rubric.individualMinimum ? ' · Below 3-point minimum' : ''}
          {row.underwater && row.formal?.score === 5 ? ' · Underwater 5 recorded' : ''}</p>
        {row.attempts.map(attempt => <button type="button" className="focus-link" key={attempt.id}
          aria-label={`Open recorded attempt for ${row.label} on ${new Date(attempt.attempt.occurredAt).toLocaleDateString('en-GB')}`}
          onClick={() => openAttempt(attempt.id)}>
          {new Date(attempt.attempt.occurredAt).toLocaleDateString('en-GB')} · {attempt.attempt.mode} · {attempt.score ?? 'Incomplete'}
          {attempt.reasons.length ? ` · ${attempt.reasons.join('; ')}` : ''}
        </button>)}
        <button type="button" className="focus-secondary" aria-label={`Record attempt for ${row.label}`}
          onClick={() => addAttempt(row.key)}>Record {row.label} attempt</button>
      </details>)}
    </div>
    <small>Instructor review and current controlling course materials are separate. This is not a PADI pass or certification claim.</small>
  </section>;
}
