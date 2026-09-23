'use client';
import { useEffect, useState } from 'react';
import {
  listDashboardSettings,
  saveDashboardSettings,
} from '../lib/offline/dive-planning';
import {
  advanceProfessionalGuide,
  professionalGuideSteps,
  type ProfessionalGuideProgress,
} from '../lib/professional-guide';
import styles from './professional-guide.module.css';
export function ProfessionalGuide({
  pathwayId,
  requirementSetId,
  evidenceCount,
  createPathway,
  captureRequirements,
  addEvidence,
}: {
  pathwayId: string;
  requirementSetId: string | null;
  evidenceCount: number;
  createPathway: () => void;
  captureRequirements: () => void;
  addEvidence: () => void;
}) {
  const initial: ProfessionalGuideProgress = { version: 1, pathwayId, step: 0 };
  const [progress, setProgress] = useState(initial);
  const [note, setNote] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void listDashboardSettings()
      .then((records) => {
        if (!active) return;
        const saved = records[0]?.professionalGuides?.[pathwayId];
        if (saved?.version === 1) {
          setProgress(saved);
          setNote(saved.mentorReviewNote ?? '');
        }
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setError('Saved setup progress could not be loaded.');
        }
      });
    return () => {
      active = false;
    };
  }, [pathwayId]);
  const steps = professionalGuideSteps(
    { pathwayId, requirementSetId, evidenceCount },
    progress,
  );
  const step = steps[progress.step] ?? steps[0]!;
  async function persist(next: ProfessionalGuideProgress) {
    setBusy(true);
    setError('');
    try {
      const current = (await listDashboardSettings())[0];
      await saveDashboardSettings({
        ...current,
        selectedAwards: current?.selectedAwards ?? [],
        maxAwards: current?.maxAwards ?? 6,
        professionalGuides: {
          ...current?.professionalGuides,
          [pathwayId]: next,
        },
      });
      setProgress(next);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Setup progress could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function advance() {
    try {
      await persist(advanceProfessionalGuide(progress, steps, note));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Finish the current setup step.',
      );
    }
  }
  return (
    <section className={styles.guide} aria-label="Guided professional setup">
      <header>
        <div>
          <span className="focus-eyebrow">GUIDED SETUP · RESUMABLE</span>
          <h2>
            {steps.every((step) => step.complete)
              ? 'Setup recorded'
              : 'Build your evidence pathway'}
          </h2>
        </div>
        <span>Step {progress.step + 1} of 5</span>
      </header>
      <ol className={styles.steps}>
        {steps.map((item, index) => (
          <li key={item.title}>
            <button
              disabled={!ready || busy}
              aria-current={progress.step === index ? 'step' : undefined}
              onClick={() => void persist({ ...progress, step: index })}
            >
              <span>{item.complete ? '✓' : index + 1}</span>
              {item.title}
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.current}>
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        {progress.step === 0 && (
          <button className="focus-secondary" onClick={createPathway}>
            {pathwayId ? 'Create another pathway' : 'Create your first pathway'}
          </button>
        )}
        {progress.step === 1 && (
          <button
            className="focus-secondary"
            disabled={!pathwayId}
            onClick={captureRequirements}
          >
            Capture requirement version
          </button>
        )}
        {progress.step === 2 && (
          <button
            className="focus-secondary"
            disabled={!pathwayId}
            onClick={addEvidence}
          >
            Add or link experience
          </button>
        )}
        {progress.step === 3 && (
          <p>
            Review the live matrix below, including missing evidence and source
            warnings, before acknowledging this step.
          </p>
        )}
        {progress.step >= 3 && (
          <label>
            Next action / mentor-review plan
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Which gaps need discussion, and with whom?"
            />
          </label>
        )}
        <div className={styles.actions}>
          <button
            className="focus-secondary"
            disabled={busy || !ready || !pathwayId}
            onClick={() =>
              void persist({ ...progress, mentorReviewNote: note })
            }
          >
            Save and resume later
          </button>
          <button
            className="focus-primary"
            disabled={
              busy ||
              !ready ||
              !pathwayId ||
              (progress.step < 3 && !step.complete)
            }
            onClick={() => void advance()}
          >
            {progress.step === 4
              ? 'Complete guided setup'
              : progress.step === 3
                ? 'I reviewed the current gaps'
                : 'Continue'}
          </button>
        </div>
        {error && <p role="alert">{error}</p>}
      </div>
    </section>
  );
}
