'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileArchive, Upload, X } from 'lucide-react';
import { AccessibleDialog } from './accessible-dialog';
import { CollapsibleWorkCard } from './workflow/collapsible-work-card';
import {
  difficultyLabel,
  type Question,
  type QuestionSet,
  type TestAttempt,
} from '../lib/knowledge-tests';
import type { Stored } from '../lib/offline/dive-planning';
import {
  QUESTION_REVIEW_REASONS,
  buildStudyPackZip,
  completeIncrementalAiReviewExport,
  flagQuestion,
  importStudyPackAtomically,
  learningDiagnostics,
  listLearningAiAdvice,
  listLearningAiCheckpoints,
  resolveQuestionReview,
  saveAiAdvice,
  sortedQuestionManagementRows,
  validateStudyPackZip,
  type LearningDiagnosticRow,
  type QuestionReviewReason,
  type QuestionReviewStateRecord,
} from '../lib/offline/learning-review';
import styles from './knowledge-review-workflow.module.css';

type QuestionTarget = {
  set: Stored<QuestionSet>;
  question: Question;
  state: Stored<QuestionReviewStateRecord> | undefined;
};
type Props = {
  sets: Array<Stored<QuestionSet>>;
  attempts: Array<Stored<TestAttempt>>;
  reviewStates: Array<Stored<QuestionReviewStateRecord>>;
  refresh: () => Promise<void> | void;
};

function downloadBytes(bytes: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status: LearningDiagnosticRow['status']) {
  if (status === 'insufficient-evidence') return 'Insufficient evidence';
  return status[0]!.toUpperCase() + status.slice(1);
}

export function KnowledgeReviewWorkflow({
  sets,
  attempts,
  reviewStates,
  refresh,
}: Props) {
  const [reviewMode, setReviewMode] = useState<
    'questions' | 'topics' | 'attempts'
  >('questions');
  const [questionTarget, setQuestionTarget] = useState<QuestionTarget | null>(
    null,
  );
  const [diagnosticTarget, setDiagnosticTarget] =
    useState<LearningDiagnosticRow | null>(null);
  const [attemptTarget, setAttemptTarget] =
    useState<Stored<TestAttempt> | null>(null);
  const [studyDialog, setStudyDialog] = useState(false);
  const [aiDialog, setAiDialog] = useState(false);
  const [selectedSetIds, setSelectedSetIds] = useState<string[]>([]);
  const [validatedPack, setValidatedPack] = useState<{
    name: string;
    bytes: Uint8Array;
    bankCount: number;
    hasAdvice: boolean;
  } | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = useMemo(
    () => sortedQuestionManagementRows(sets, reviewStates),
    [sets, reviewStates],
  );
  const diagnostics = useMemo(
    () => learningDiagnostics(attempts, reviewStates),
    [attempts, reviewStates],
  );
  const orderedAttempts = useMemo(
    () =>
      [...attempts].sort((left, right) =>
        right.completedAt.localeCompare(left.completedAt),
      ),
    [attempts],
  );
  const needsReview = reviewStates.filter(
    (row) => row.reviewState === 'needs_review',
  ).length;

  async function exportAiReview() {
    setBusy(true);
    setMessage('');
    try {
      const envelope = await completeIncrementalAiReviewExport(
        attempts,
        reviewStates,
        async (artifact) => {
          downloadBytes(
            JSON.stringify(artifact, null, 2),
            'application/json',
            `zeustek-ai-learning-review-${new Date().toISOString().slice(0, 10)}.json`,
          );
        },
      );
      setMessage(
        `AI review exported through ${new Date(envelope.range.toInclusive).toLocaleString()}. The checkpoint advanced after the artifact was created.`,
      );
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'AI export failed. The previous checkpoint is unchanged.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function importAdvice(file: File) {
    setBusy(true);
    setMessage('');
    try {
      const value = JSON.parse(await file.text()) as {
        adviceId?: string;
        summary?: string;
        focusAreas?: string[];
        studyMediaReferences?: Array<{
          title: string;
          url?: string;
          notes?: string;
        }>;
        sourceExportId?: string | null;
      };
      if (!value.summary?.trim()) throw new Error('AI advice needs a summary.');
      await saveAiAdvice({
        ...(value.adviceId ? { adviceId: value.adviceId } : {}),
        summary: value.summary,
        focusAreas: value.focusAreas ?? [],
        studyMediaReferences: value.studyMediaReferences ?? [],
        sourceExportId: value.sourceExportId ?? null,
      });
      setMessage('AI advice saved as versioned advisory context.');
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Advice import failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportStudyPack() {
    const chosen = sets.filter((set) => selectedSetIds.includes(set.entityId));
    if (!chosen.length) {
      setMessage('Select at least one question bank for the study pack.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const advice = (await listLearningAiAdvice()).sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )[0];
      const bytes = await buildStudyPackZip({
        questionSets: chosen,
        ...(advice
          ? { advice, mediaReferences: advice.studyMediaReferences }
          : {}),
      });
      downloadBytes(
        bytes,
        'application/zip',
        `zeustek-study-pack-${new Date().toISOString().slice(0, 10)}.zip`,
      );
      setMessage(
        `Study pack created with ${chosen.length} question-bank version${chosen.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Study pack export failed.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function previewStudyPack(file: File) {
    setBusy(true);
    setMessage('');
    setValidatedPack(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const validated = await validateStudyPackZip(bytes);
      setValidatedPack({
        name: file.name,
        bytes,
        bankCount: validated.questionSets.length,
        hasAdvice: Boolean(validated.advice?.summary),
      });
      setMessage(
        'Study pack manifest and every content hash passed. Review the summary before importing.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Study pack validation failed. Nothing was imported.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function commitStudyPack() {
    if (!validatedPack) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await importStudyPackAtomically(validatedPack.bytes);
      setMessage(
        `Study pack committed atomically: ${result.questionSets.length} question-bank version${result.questionSets.length === 1 ? '' : 's'}.`,
      );
      setValidatedPack(null);
      setStudyDialog(false);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Study pack import failed with no intended partial import.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className={styles.workflow}
      aria-label="Dive Knowledge review and study tools"
    >
      {message && (
        <output className={`focus-notice ${styles.status}`}>{message}</output>
      )}
      <CollapsibleWorkCard
        id="knowledge-review-diagnostics"
        title="Review & Diagnostics"
        eyebrow="QUESTION QUALITY"
        status={`${needsReview} need review · ${diagnostics.length} topic/objective groups`}
        rowCount={
          reviewMode === 'questions'
            ? rows.length
            : reviewMode === 'topics'
              ? diagnostics.length
              : orderedAttempts.length
        }
      >
        {({ expanded, previewLimit }) => (
          <>
            <fieldset
              className={styles.modeTabs}
              aria-label="Review and diagnostics view"
            >
              <button
                type="button"
                data-active={reviewMode === 'questions'}
                onClick={() => setReviewMode('questions')}
              >
                Questions
              </button>
              <button
                type="button"
                data-active={reviewMode === 'topics'}
                onClick={() => setReviewMode('topics')}
              >
                Topics & objectives
              </button>
              <button
                type="button"
                data-active={reviewMode === 'attempts'}
                onClick={() => setReviewMode('attempts')}
              >
                Attempts
              </button>
            </fieldset>
            <div className={styles.list}>
              {reviewMode === 'questions' &&
                (expanded ? rows : rows.slice(0, previewLimit)).map(
                  ({ set, question, state }) => (
                    <button
                      type="button"
                      className={styles.row}
                      data-review={state?.reviewState ?? 'normal'}
                      key={`${set.setId}:${set.version}:${question.id}`}
                      onClick={() =>
                        setQuestionTarget({ set, question, state })
                      }
                    >
                      <span>
                        <b>{question.prompt}</b>
                        <small>
                          {question.topic} ·{' '}
                          {question.exactTopic || question.topic} ·{' '}
                          {question.objective || 'Objective not recorded'} ·{' '}
                          {difficultyLabel(question.difficulty)}
                        </small>
                      </span>
                      <em>
                        {state?.reviewState === 'needs_review'
                          ? 'Needs review · suppressed'
                          : state?.reviewState === 'reviewed'
                            ? `Reviewed · ${state.usageState}`
                            : 'Normal · active'}
                      </em>
                    </button>
                  ),
                )}
              {reviewMode === 'topics' &&
                (expanded
                  ? diagnostics
                  : diagnostics.slice(0, previewLimit)
                ).map((row) => (
                  <button
                    type="button"
                    className={styles.row}
                    data-status={row.status}
                    key={row.key}
                    onClick={() => setDiagnosticTarget(row)}
                  >
                    <span>
                      <b>{row.subtopic}</b>
                      <small>
                        {row.topic} · {row.objective} · latest-per-question
                        denominator {row.answered}
                      </small>
                    </span>
                    <em>
                      {statusLabel(row.status)} ·{' '}
                      {row.percent == null ? '—' : `${row.percent}%`}
                    </em>
                  </button>
                ))}
              {reviewMode === 'attempts' &&
                (expanded
                  ? orderedAttempts
                  : orderedAttempts.slice(0, previewLimit)
                ).map((attempt) => (
                  <button
                    type="button"
                    className={styles.row}
                    key={attempt.entityId}
                    onClick={() => setAttemptTarget(attempt)}
                  >
                    <span>
                      <b>{attempt.inputs.focus || 'Knowledge assessment'}</b>
                      <small>
                        {new Date(attempt.completedAt).toLocaleString()} ·{' '}
                        {attempt.questions.length} preserved question snapshots
                      </small>
                    </span>
                    <em>
                      {attempt.correct}/{attempt.total}
                    </em>
                  </button>
                ))}
              {reviewMode === 'questions' && !rows.length && (
                <p className={styles.empty}>
                  No question banks are installed yet.
                </p>
              )}
              {reviewMode === 'topics' && !diagnostics.length && (
                <p className={styles.empty}>
                  Complete a test to create topic, subtopic and objective
                  evidence.
                </p>
              )}
              {reviewMode === 'attempts' && !orderedAttempts.length && (
                <p className={styles.empty}>
                  No historical test attempts are recorded.
                </p>
              )}
            </div>
          </>
        )}
      </CollapsibleWorkCard>
      <CollapsibleWorkCard
        id="knowledge-study-packs"
        title="Study Packs"
        eyebrow="PORTABLE STUDY"
        status="Manifest + SHA-256 validation · atomic import"
        onOpenDetail={() => setStudyDialog(true)}
      >
        <p className={styles.cardCopy}>
          Build a targeted ZIP from selected question-bank versions, advice and
          study references. Imports validate every file before committing any
          record.
        </p>
      </CollapsibleWorkCard>
      <CollapsibleWorkCard
        id="knowledge-ai-review"
        title="AI Review Export"
        eyebrow="INCREMENTAL REVIEW"
        status="Only new attempts and review changes since the last successful checkpoint"
        onOpenDetail={() => setAiDialog(true)}
      >
        <p className={styles.cardCopy}>
          Create a derived review file with denominators, source IDs and
          previous advice continuity. The checkpoint advances only after
          artifact creation succeeds.
        </p>
      </CollapsibleWorkCard>
      {questionTarget && (
        <QuestionReviewDialog
          target={questionTarget}
          close={() => setQuestionTarget(null)}
          saved={async () => {
            setQuestionTarget(null);
            await refresh();
          }}
        />
      )}
      {diagnosticTarget && (
        <DiagnosticDialog
          row={diagnosticTarget}
          close={() => setDiagnosticTarget(null)}
        />
      )}
      {attemptTarget && (
        <AttemptDialog
          attempt={attemptTarget}
          review={(question) => {
            const set = sets.find(
              (item) =>
                item.setId === question.setId &&
                item.version === question.setVersion,
            );
            const state = reviewStates.find(
              (item) =>
                item.setId === question.setId &&
                item.setVersion === question.setVersion &&
                item.questionId === question.id,
            );
            if (set) setQuestionTarget({ set, question, state });
          }}
          close={() => setAttemptTarget(null)}
        />
      )}
      {studyDialog && (
        <StudyPackDialog
          sets={sets}
          selected={selectedSetIds}
          setSelected={setSelectedSetIds}
          validated={validatedPack}
          busy={busy}
          preview={previewStudyPack}
          exportPack={exportStudyPack}
          commit={commitStudyPack}
          close={() => {
            if (!busy) {
              setStudyDialog(false);
              setValidatedPack(null);
            }
          }}
        />
      )}
      {aiDialog && (
        <AiReviewDialog
          busy={busy}
          exportReview={exportAiReview}
          importAdvice={importAdvice}
          close={() => {
            if (!busy) setAiDialog(false);
          }}
        />
      )}
    </section>
  );
}

function QuestionReviewDialog({
  target,
  close,
  saved,
}: {
  target: QuestionTarget;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [reason, setReason] = useState<QuestionReviewReason>(
    target.state?.reviewReason ?? 'poor_wording',
  );
  const [note, setNote] = useState(target.state?.reviewNote ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (action: 'flag' | 'restore' | 'suppress') => {
    setBusy(true);
    setError('');
    try {
      if (action === 'flag')
        await flagQuestion({
          setId: target.set.setId,
          setVersion: target.set.version,
          questionId: target.question.id,
          reason,
          note,
        });
      else if (target.state)
        await resolveQuestionReview({
          entityId: target.state.entityId,
          outcome: action === 'restore' ? 'restored' : 'remain_suppressed',
          note,
        });
      await saved();
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : 'Question review could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        editable
        containDismiss
        label="Review or suppress question"
        close={close}
        className={`focus-modal ${styles.dialog}`}
      >
        <header>
          <div>
            <span className="focus-eyebrow">QUESTION QUALITY</span>
            <h2>Review or suppress question</h2>
          </div>
          <button
            type="button"
            className="focus-icon"
            data-dialog-close
            aria-label="Close question review"
            disabled={busy}
            onClick={close}
          >
            <X />
          </button>
        </header>
        <h3>{target.question.prompt}</h3>
        <div className={styles.questionFacts}>
          <div>
            <small>Bank version</small>
            <b>
              {target.set.title} · v{target.set.version}
            </b>
          </div>
          <div>
            <small>Stable question ID</small>
            <b>{target.question.id}</b>
          </div>
          <div>
            <small>Topic / subtopic</small>
            <b>
              {target.question.topic} /{' '}
              {target.question.exactTopic || target.question.topic}
            </b>
          </div>
          <div>
            <small>Objective / difficulty</small>
            <b>
              {target.question.objective || 'Not recorded'} /{' '}
              {difficultyLabel(target.question.difficulty)}
            </b>
          </div>
        </div>
        <p>
          <b>Expected answer:</b> {target.question.answers.join(' / ')}
        </p>
        <p>{target.question.explanation}</p>
        <label>
          Reason
          <select
            value={reason}
            onChange={(event) =>
              setReason(event.target.value as QuestionReviewReason)
            }
          >
            {QUESTION_REVIEW_REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Required when the reason is Other"
          />
        </label>
        <p className={styles.warning}>
          <AlertTriangle />
          Suppression affects new tests only. Historical attempt snapshots,
          scores and question wording remain unchanged and auditable.
        </p>
        {error && <p role="alert">{error}</p>}
        <footer className={styles.detailActions}>
          <button
            type="button"
            className="focus-secondary"
            data-dialog-close
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          {target.state && (
            <button
              type="button"
              className="focus-secondary"
              disabled={busy}
              onClick={() => void act('suppress')}
            >
              Reviewed · keep suppressed
            </button>
          )}
          {target.state && (
            <button
              type="button"
              className="focus-secondary"
              disabled={busy}
              onClick={() => void act('restore')}
            >
              Restore to future tests
            </button>
          )}
          <button
            type="button"
            className="focus-primary"
            disabled={busy || (reason === 'other' && !note.trim())}
            onClick={() => void act('flag')}
          >
            Mark needs review
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}

function DiagnosticDialog({
  row,
  close,
}: {
  row: LearningDiagnosticRow;
  close: () => void;
}) {
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        containDismiss
        label={`${row.subtopic} diagnostic evidence`}
        close={close}
        className={`focus-modal ${styles.dialog}`}
      >
        <header>
          <div>
            <span className="focus-eyebrow">{row.topic}</span>
            <h2>{row.subtopic}</h2>
            <p>{row.objective}</p>
          </div>
          <button
            type="button"
            className="focus-icon"
            data-dialog-close
            aria-label="Close diagnostic detail"
            onClick={close}
          >
            <X />
          </button>
        </header>
        <div className={styles.diagnosticFacts}>
          <div>
            <small>Assessment</small>
            <b>{statusLabel(row.status)}</b>
          </div>
          <div>
            <small>Latest-answer score</small>
            <b>{row.percent == null ? 'Unknown' : `${row.percent}%`}</b>
          </div>
          <div>
            <small>Denominator</small>
            <b>{row.answered} latest per-question results</b>
          </div>
          <div>
            <small>Historical answers</small>
            <b>{row.historicalAnswers}</b>
          </div>
          <div>
            <small>Suppressed excluded</small>
            <b>{row.suppressedExcluded}</b>
          </div>
          <div>
            <small>Last practised</small>
            <b>
              {row.lastPractised
                ? new Date(row.lastPractised).toLocaleString()
                : 'Not recorded'}
            </b>
          </div>
        </div>
        <p>{row.statusReason}</p>
        <p className="focus-copy">
          The latest answer for each stable question version is used for the
          current status. Older answers remain listed as historical evidence. At
          least three current question results are required before Strength,
          Developing or Weakness is assigned.
        </p>
        <ul className={styles.evidenceList}>
          {row.latestEvidence.map((evidence) => (
            <li key={`${evidence.attemptId}:${evidence.questionId}`}>
              <b>{evidence.correct ? 'Correct' : 'Review'}</b>
              <span>
                {evidence.prompt}
                <small>
                  Question {evidence.questionId} · Attempt {evidence.attemptId}{' '}
                  · {new Date(evidence.completedAt).toLocaleString()}
                </small>
              </span>
            </li>
          ))}
        </ul>
        <footer>
          <button
            type="button"
            className="focus-secondary"
            data-dialog-close
            onClick={close}
          >
            Close
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}

function AttemptDialog({
  attempt,
  review,
  close,
}: {
  attempt: Stored<TestAttempt>;
  review: (question: TestAttempt['questions'][number]) => void;
  close: () => void;
}) {
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        containDismiss
        label="Historical knowledge attempt"
        close={close}
        className={`focus-modal ${styles.dialog}`}
      >
        <header>
          <div>
            <span className="focus-eyebrow">HISTORICAL ATTEMPT</span>
            <h2>{attempt.inputs.focus || 'Knowledge assessment'}</h2>
            <p>
              {new Date(attempt.completedAt).toLocaleString()} ·{' '}
              {attempt.correct}/{attempt.total}
            </p>
          </div>
          <button
            type="button"
            className="focus-icon"
            data-dialog-close
            aria-label="Close attempt detail"
            onClick={close}
          >
            <X />
          </button>
        </header>
        <p className="focus-notice">
          This attempt keeps its original question snapshots and score even when
          a question is later suppressed.
        </p>
        <div className={styles.attemptQuestions}>
          {attempt.questions.map((question, index) => (
            <article
              className={styles.attemptQuestion}
              key={`${question.setId}:${question.setVersion}:${question.id}:${index}`}
            >
              <header>
                <h3>
                  {index + 1}. {question.prompt}
                </h3>
                <button
                  type="button"
                  className="focus-secondary"
                  aria-label={`Review or suppress question ${index + 1}`}
                  onClick={() => review(question)}
                >
                  <AlertTriangle size={15} />
                  Review / suppress
                </button>
              </header>
              <p>
                <b>Your answer:</b>{' '}
                {(Array.isArray(question.response)
                  ? question.response.join(' / ')
                  : question.response) || 'Unanswered'}
              </p>
              <p>
                <b>Expected:</b> {question.answers.join(' / ')}
              </p>
              <p>{question.explanation}</p>
              <small>
                Set {question.setId} v{question.setVersion} · Question{' '}
                {question.id} · {question.provenance}
              </small>
            </article>
          ))}
        </div>
        <footer>
          <button
            type="button"
            className="focus-secondary"
            data-dialog-close
            onClick={close}
          >
            Close
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}

function StudyPackDialog({
  sets,
  selected,
  setSelected,
  validated,
  busy,
  preview,
  exportPack,
  commit,
  close,
}: {
  sets: Array<Stored<QuestionSet>>;
  selected: string[];
  setSelected: (value: string[]) => void;
  validated: { name: string; bankCount: number; hasAdvice: boolean } | null;
  busy: boolean;
  preview: (file: File) => Promise<void>;
  exportPack: () => Promise<void>;
  commit: () => Promise<void>;
  close: () => void;
}) {
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        containDismiss
        label="Study pack import and export"
        close={close}
        className={`focus-modal ${styles.dialog}`}
      >
        <header>
          <div>
            <span className="focus-eyebrow">VALIDATED PORTABLE STUDY</span>
            <h2>Study Packs</h2>
            <p>
              Question banks, advice and study references with a manifest and
              SHA-256 hashes.
            </p>
          </div>
          <button
            type="button"
            className="focus-icon"
            data-dialog-close
            aria-label="Close study packs"
            disabled={busy}
            onClick={close}
          >
            <X />
          </button>
        </header>
        <section>
          <h3>Export a pack</h3>
          <p>
            Select the bank versions to include. Nothing is selected by default.
          </p>
          <div className={styles.packList}>
            {sets.map((set) => (
              <label key={set.entityId}>
                <input
                  type="checkbox"
                  checked={selected.includes(set.entityId)}
                  onChange={() =>
                    setSelected(
                      selected.includes(set.entityId)
                        ? selected.filter((id) => id !== set.entityId)
                        : [...selected, set.entityId],
                    )
                  }
                />
                <span>
                  {set.title} · v{set.version} · {set.questions.length}{' '}
                  questions
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="focus-primary"
            disabled={busy || !selected.length}
            onClick={() => void exportPack()}
          >
            <Download size={15} />
            Export selected study pack
          </button>
        </section>
        <section>
          <h3>Validate before import</h3>
          <p>
            The selected ZIP is fully checked first. No record is written until
            you explicitly import the validated pack.
          </p>
          <label className={`focus-secondary file-action ${styles.fileAction}`}>
            <Upload size={15} />
            Choose study-pack ZIP
            <input
              type="file"
              accept="application/zip,.zip"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void preview(file);
                event.target.value = '';
              }}
            />
          </label>
          {validated && (
            <div className={styles.packPreview}>
              <b>{validated.name}</b>
              <p>
                {validated.bankCount} question-bank version
                {validated.bankCount === 1 ? '' : 's'} ·{' '}
                {validated.hasAdvice ? 'Includes advice' : 'No advice file'}
              </p>
              <button
                type="button"
                className="focus-primary"
                disabled={busy}
                onClick={() => void commit()}
              >
                <FileArchive size={15} />
                Import validated pack
              </button>
            </div>
          )}
        </section>
        <footer>
          <button
            type="button"
            className="focus-secondary"
            data-dialog-close
            disabled={busy}
            onClick={close}
          >
            Close
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}

function AiReviewDialog({
  busy,
  exportReview,
  importAdvice,
  close,
}: {
  busy: boolean;
  exportReview: () => Promise<void>;
  importAdvice: (file: File) => Promise<void>;
  close: () => void;
}) {
  const [checkpoint, setCheckpoint] = useState('Loading…');
  const [continuity, setContinuity] = useState(
    'No previous AI advice has been recorded.',
  );
  useEffect(() => {
    let active = true;
    void Promise.all([
      listLearningAiCheckpoints(),
      listLearningAiAdvice(),
    ]).then(([checkpoints, advice]) => {
      if (!active) return;
      const latestCheckpoint = checkpoints.sort((left, right) =>
        (right.checkpointAt ?? '').localeCompare(left.checkpointAt ?? ''),
      )[0];
      const latestAdvice = advice.sort((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )[0];
      setCheckpoint(
        latestCheckpoint?.checkpointAt
          ? `Last successful export: ${new Date(latestCheckpoint.checkpointAt).toLocaleString()}`
          : 'No successful export checkpoint yet.',
      );
      if (latestAdvice)
        setContinuity(
          `${latestAdvice.summary}${latestAdvice.focusAreas.length ? ` Focus: ${latestAdvice.focusAreas.join(', ')}.` : ''}`,
        );
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        containDismiss
        label="AI review export"
        close={close}
        className={`focus-modal ${styles.dialog}`}
      >
        <header>
          <div>
            <span className="focus-eyebrow">INCREMENTAL LEARNING REVIEW</span>
            <h2>AI Review Export</h2>
            <p>{checkpoint}</p>
          </div>
          <button
            type="button"
            className="focus-icon"
            data-dialog-close
            aria-label="Close AI review export"
            disabled={busy}
            onClick={close}
          >
            <X />
          </button>
        </header>
        <div className={styles.continuity}>
          <h3>Previous advice continuity</h3>
          <p>{continuity}</p>
        </div>
        <p>
          The derived JSON includes only attempts and question-review changes
          since the previous successful checkpoint, plus current strengths,
          weaknesses, denominators and source IDs.
        </p>
        <div className={styles.detailActions}>
          <button
            type="button"
            className="focus-primary"
            disabled={busy}
            onClick={() => void exportReview()}
          >
            <Download size={15} />
            Export incremental review
          </button>
          <label className={`focus-secondary file-action ${styles.fileAction}`}>
            <Upload size={15} />
            Import AI advice JSON
            <input
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importAdvice(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        <footer>
          <button
            type="button"
            className="focus-secondary"
            data-dialog-close
            disabled={busy}
            onClick={close}
          >
            Close
          </button>
        </footer>
      </AccessibleDialog>
    </div>
  );
}
