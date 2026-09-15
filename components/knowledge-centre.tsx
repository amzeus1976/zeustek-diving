'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import { strFromU8, unzipSync } from 'fflate';
import { BookMarked, Download, Upload, X } from 'lucide-react';
import {
  listCertifications,
  listDiveMedia,
  listRecords,
  listTrainingProgress,
  saveRecord,
  type DiveMediaRecord,
  type Stored,
} from '@/lib/offline/dive-planning';
import {
  chooseDiagnosticQuestions,
  chooseQuestions,
  diagnosticCoverage,
  difficultyLabel,
  KNOWLEDGE_TOPICS,
  knowledgeEvidence,
  parseQuestionSet,
  QUESTION_DIFFICULTIES,
  questionSetSchema,
  relevantTopics,
  reviewedQuestions,
  scoreQuestion,
  studyNeeds,
  type Question,
  type QuestionSet,
  type TestAttempt,
} from '@/lib/knowledge-tests';
import {
  listLearningAiCheckpoints,
  listQuestionReviewStates,
  type LearningAiCheckpointRecord,
  type QuestionReviewStateRecord,
} from '@/lib/offline/learning-review';
import { useRecordRefresh } from './record-status';
import { AccessibleDialog } from './accessible-dialog';
import { CollapsibleWorkCard } from './workflow/collapsible-work-card';
import { WorkflowContextStrip } from './workflow/workflow-context-strip';
import { KnowledgeReviewWorkflow } from './knowledge-review-workflow';
import styles from './knowledge-centre.module.css';

function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

const isJsonName = (name: string) =>
  name.toLocaleLowerCase('en-GB').endsWith('.json');
async function questionFiles(file: File) {
  if (file.size > 25_000_000)
    throw new Error(`${file.name} is over the 25 MB archive limit.`);
  if (isJsonName(file.name))
    return [{ name: file.name, text: await file.text() }];
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.name.toLocaleLowerCase('en-GB').endsWith('.zip')) {
    const entries = unzipSync(bytes, {
      filter: (entry) =>
        isJsonName(entry.name) && entry.originalSize <= 2_000_000,
    });
    return Object.entries(entries)
      .slice(0, 100)
      .map(([name, data]) => ({ name, text: strFromU8(data) }));
  }
  if (file.name.toLocaleLowerCase('en-GB').endsWith('.rar')) {
    const [{ createExtractorFromData }, wasm] = await Promise.all([
      import('node-unrar-js/esm/index.esm.js'),
      fetch('/vendor/unrar.wasm').then((response) => {
        if (!response.ok) throw new Error('RAR reader could not load.');
        return response.arrayBuffer();
      }),
    ]);
    const extractor = await createExtractorFromData({
      data: bytes.buffer as ArrayBuffer,
      wasmBinary: wasm,
    });
    return [
      ...extractor.extract({
        files: (header) =>
          !header.flags.directory &&
          isJsonName(header.name) &&
          header.unpSize <= 2_000_000,
      }).files,
    ]
      .slice(0, 100)
      .flatMap((entry) =>
        entry.extraction
          ? [
              {
                name: entry.fileHeader.name,
                text: new TextDecoder().decode(entry.extraction),
              },
            ]
          : [],
      );
  }
  throw new Error(
    'Use a JSON question bank or a ZIP/RAR package containing JSON banks.',
  );
}

function answerRationale(question: Question) {
  const entries =
    question.options
      ?.filter((option) => !question.answers.includes(option))
      .map(
        (option) => [option, question.incorrectExplanations?.[option]] as const,
      )
      .filter((entry): entry is readonly [string, string] =>
        Boolean(entry[1]),
      ) ?? [];
  return entries.length ? (
    <div className="answer-rationales">
      <b>Why the other choices are wrong</b>
      {entries.map(([option, reason]) => (
        <p key={option}>
          <strong>{option}:</strong> {reason}
        </p>
      ))}
    </div>
  ) : null;
}

export function KnowledgeCentre({ go }: { go: (route: string) => void }) {
  const [sets, setSets] = useState<Array<Stored<QuestionSet>>>([]);
  const [attempts, setAttempts] = useState<Array<Stored<TestAttempt>>>([]);
  const [reviewStates, setReviewStates] = useState<
    Array<Stored<QuestionReviewStateRecord>>
  >([]);
  const [checkpoints, setCheckpoints] = useState<
    Array<Stored<LearningAiCheckpointRecord>>
  >([]);
  const [media, setMedia] = useState<Array<Stored<DiveMediaRecord>>>([]);
  const [inputs, setInputs] = useState<TestAttempt['inputs']>({
    training: [],
    media: [],
    plan: [],
    focus: '',
  });
  const [focus, setFocus] = useState('');
  const [exportTopics, setExportTopics] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [reviewBank, setReviewBank] = useState<Stored<QuestionSet> | null>(
    null,
  );
  const [active, setActive] = useState<{
    startedAt: string;
    questions: ReturnType<typeof chooseQuestions>;
    inputs: TestAttempt['inputs'];
    diagnostic: boolean;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [
      nextSets,
      nextAttempts,
      nextReviewStates,
      nextCheckpoints,
      training,
      nextMedia,
      plan,
    ] = await Promise.all([
      listRecords<QuestionSet>('question-set'),
      listRecords<TestAttempt>('test-attempt'),
      listQuestionReviewStates(),
      listLearningAiCheckpoints(),
      listCertifications(),
      listDiveMedia(),
      listTrainingProgress(),
    ]);
    setSets(nextSets);
    setAttempts(nextAttempts);
    setReviewStates(nextReviewStates);
    setCheckpoints(nextCheckpoints);
    setMedia(nextMedia);
    setInputs({
      training: training.map((item) => item.certification),
      media: nextMedia
        .filter((item) => item.status === 'consumed')
        .flatMap((item) => item.topics),
      plan: plan
        .filter(
          (item) => item.status === 'planned' || item.status === 'in-progress',
        )
        .sort(
          (left, right) => (left.planOrder ?? 999) - (right.planOrder ?? 999),
        )
        .map((item) => item.courseTitle),
      focus: '',
    });
  }, []);
  useRecordRefresh(refresh);

  const topics = useMemo(
    () => [
      ...new Set([
        ...KNOWLEDGE_TOPICS,
        ...sets.flatMap((set) =>
          set.questions.map((question) => question.topic),
        ),
      ]),
    ],
    [sets],
  );
  const reviewedTopics = useMemo(
    () => [
      ...new Set(
        sets
          .filter((set) => set.reviewed)
          .flatMap((set) => set.questions.map((question) => question.topic)),
      ),
    ],
    [sets],
  );
  const evidence = useMemo(
    () => knowledgeEvidence(attempts, topics),
    [attempts, topics],
  );
  const coverage = useMemo(
    () => diagnosticCoverage(attempts, KNOWLEDGE_TOPICS),
    [attempts],
  );
  const needs = useMemo(() => studyNeeds(attempts), [attempts]);
  const weak = useMemo(
    () =>
      evidence
        .filter(
          (item) => item.count && item.percent !== null && item.percent < 70,
        )
        .sort((left, right) => (left.percent ?? 0) - (right.percent ?? 0)),
    [evidence],
  );
  const suggested = coverage.complete
    ? (weak[0]?.topic ??
      relevantTopics(inputs.plan, topics)[0] ??
      relevantTopics(inputs.training, topics)[0] ??
      '')
    : '';
  const recommendations = coverage.complete
    ? media
        .filter((item) =>
          item.topics.some((topic) =>
            weak.some(
              (area) =>
                area.topic.toLocaleLowerCase('en-GB') ===
                topic.toLocaleLowerCase('en-GB'),
            ),
          ),
        )
        .sort(
          (left, right) =>
            Number(left.status === 'consumed') -
            Number(right.status === 'consumed'),
        )
    : [];
  const activeQuestions = reviewedQuestions(sets, reviewStates).length;
  const attemptTotal = attempts.reduce(
    (total, attempt) => total + attempt.total,
    0,
  );
  const averageScore = attemptTotal
    ? Math.round(
        (attempts.reduce((total, attempt) => total + attempt.correct, 0) /
          attemptTotal) *
          100,
      )
    : null;
  const latestCheckpoint = [...checkpoints].sort((left, right) =>
    (right.checkpointAt ?? '').localeCompare(left.checkpointAt ?? ''),
  )[0];

  async function importSets(files: FileList) {
    setBusy(true);
    setMessage('Validating question package…');
    try {
      const known = new Set(
        sets.map((item) => `${item.setId}:${item.version}`),
      );
      let imported = 0;
      let skipped = 0;
      for (const file of files)
        for (const entry of await questionFiles(file)) {
          if (entry.text.length > 2_000_000)
            throw new Error(`${entry.name} is over the 2 MB bank limit.`);
          const set = parseQuestionSet(JSON.parse(entry.text));
          const key = `${set.setId}:${set.version}`;
          if (known.has(key)) {
            skipped += 1;
            continue;
          }
          known.add(key);
          await saveRecord('question-set', set);
          imported += 1;
        }
      if (!imported && !skipped)
        throw new Error(
          'No JSON question banks were found in the selected package.',
        );
      setMessage(
        `${imported} question bank${imported === 1 ? '' : 's'} imported for review${skipped ? `; ${skipped} existing version${skipped === 1 ? '' : 's'} skipped` : ''}.`,
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  function start() {
    const diagnostic = !focus;
    const questions = diagnostic
      ? chooseDiagnosticQuestions(sets, attempts, 18, reviewStates)
      : chooseQuestions(sets, [focus], 12, undefined, reviewStates);
    if (!questions.length) {
      setMessage(
        'No active reviewed questions match this area. Restore a suppressed question, review a bank, or choose another topic.',
      );
      return;
    }
    setActive({
      startedAt: new Date().toISOString(),
      questions,
      inputs: { ...inputs, focus: focus || 'Full diagnostic' },
      diagnostic,
    });
    setAnswers({});
    setMessage('');
  }

  async function finish() {
    if (!active) return;
    setBusy(true);
    try {
      const questions = active.questions.map((question) => {
        const response =
          answers[`${question.setId}:${question.setVersion}:${question.id}`] ??
          [];
        return {
          ...question,
          response,
          correct: scoreQuestion(question, response),
        };
      });
      const attempt: TestAttempt = {
        startedAt: active.startedAt,
        completedAt: new Date().toISOString(),
        inputs: active.inputs,
        questions,
        correct: questions.filter((question) => question.correct).length,
        total: questions.length,
        diagnostic: active.diagnostic,
      };
      await saveRecord('test-attempt', attempt);
      setMessage(
        `${attempt.correct} / ${attempt.total} correct. The attempt and its original question snapshots were saved.`,
      );
      setActive(null);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Could not save result.',
      );
    } finally {
      setBusy(false);
    }
  }

  const requestTopics = exportTopics.length
    ? exportTopics
    : [focus || suggested || 'General scuba theory'];
  const request = {
    format: 'zeustek-question-request',
    version: 2,
    topics: requestTopics,
    questionTypes: [
      { type: 'single-choice', options: 4, answers: 1 },
      { type: 'multiple-response', options: 6, answers: 'one-or-more' },
      { type: 'missing-word', options: 4, answers: 1 },
      { type: 'diagram-labels', options: 4, answers: 1 },
      { type: 'scenario-response', options: 4, answers: 1 },
    ],
    difficultyOrder: QUESTION_DIFFICULTIES,
    countPerTopic: 12,
    requiredQuestionFields: [
      'difficulty',
      'topic',
      'exactTopic',
      'objective',
      'explanation',
      'incorrectExplanations',
      'studySources',
      'provenance',
    ],
    instructions:
      'Create original multiple-choice practice questions in ascending difficulty. Use precise exactTopic and learning objective labels. Explain why the correct answer is right, why every distractor is wrong, and where the learner can read more. Do not reproduce proprietary assessment banks. Mark reviewed false and return JSON conforming to the enclosed schema.',
    schema: questionSetSchema,
  };

  if (active)
    return (
      <section className={`knowledge-centre ${styles.page}`}>
        <div className="focus-card-head">
          <div>
            <span className="focus-eyebrow">
              {active.diagnostic ? 'FULL DIAGNOSTIC' : 'FOCUSED PRACTICE'}
            </span>
            <h1>
              {active.diagnostic ? 'Diagnostic assessment' : 'Practice test'}
            </h1>
          </div>
          <button
            type="button"
            className="focus-secondary"
            onClick={() => {
              if (confirm('Discard this unfinished attempt?')) setActive(null);
            }}
          >
            Back to Dive Knowledge
          </button>
        </div>
        <p>
          Questions progress from foundation knowledge to more demanding
          judgement.
        </p>
        {active.questions.map((question, index) => {
          const id = `${question.setId}:${question.setVersion}:${question.id}`;
          const multiple = question.type === 'multiple-response';
          const selected = answers[id] ?? [];
          return (
            <fieldset className="focus-card question-card" key={id}>
              <legend>
                {index + 1}. {question.prompt}
              </legend>
              <small>
                {question.topic} · {question.exactTopic || question.topic} ·{' '}
                {question.objective || 'Objective not recorded'} ·{' '}
                {difficultyLabel(question.difficulty)}
              </small>
              {question.diagramImage && (
                <Image
                  className="question-diagram"
                  src={question.diagramImage}
                  alt="Question diagram"
                  width={720}
                  height={480}
                  unoptimized
                />
              )}
              {question.options?.map((option) => (
                <label className="question-option" key={option}>
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={id}
                    value={option}
                    checked={selected.includes(option)}
                    onChange={() =>
                      setAnswers((current) => ({
                        ...current,
                        [id]: multiple
                          ? selected.includes(option)
                            ? selected.filter((value) => value !== option)
                            : [...selected, option]
                          : [option],
                      }))
                    }
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          );
        })}
        <div className="record-actions">
          <button
            type="button"
            className="focus-primary"
            disabled={busy}
            onClick={() => void finish()}
          >
            {busy ? 'Saving result…' : 'Finish and save result'}
          </button>
        </div>
      </section>
    );

  return (
    <section className={`knowledge-centre ${styles.page}`}>
      <header className="focus-heading">
        <div>
          <span>DIVE KNOWLEDGE</span>
          <h1>Dive Knowledge</h1>
          <p>
            Review question quality, understand the evidence behind strengths
            and weaknesses, and carry focused study forward without rewriting
            test history.
          </p>
        </div>
        <button
          type="button"
          className="focus-primary"
          disabled={!sets.some((set) => set.reviewed)}
          onClick={start}
        >
          {focus ? 'Start focused test' : 'Take a diagnostic'}
        </button>
      </header>
      {message && <output className="focus-notice">{message}</output>}
      <section className={styles.snapshot} aria-label="Dive Knowledge snapshot">
        <div>
          <b>{sets.length}</b>
          <span>Question banks</span>
        </div>
        <div>
          <b>{activeQuestions}</b>
          <span>Active questions</span>
        </div>
        <div>
          <b>{averageScore == null ? '—' : `${averageScore}%`}</b>
          <span>Average score</span>
        </div>
        <div>
          <b>
            {
              reviewStates.filter((row) => row.reviewState === 'needs_review')
                .length
            }
          </b>
          <span>Need review</span>
        </div>
        <div>
          <b>
            {latestCheckpoint?.checkpointAt
              ? new Date(latestCheckpoint.checkpointAt).toLocaleDateString()
              : 'Not yet'}
          </b>
          <span>Last AI export</span>
        </div>
      </section>
      <WorkflowContextStrip
        from={[
          { label: 'Dive Bibliography', route: 'Dive Media' },
          { label: 'Dive Skills', route: 'Skills & Currency' },
        ]}
        current="Dive Knowledge"
        next={[
          { label: 'Study Pack', unavailable: 'Use Study Packs below' },
          { label: 'Planned Training', route: 'Course Map' },
        ]}
        go={go}
      />
      <CollapsibleWorkCard
        id="knowledge-question-banks"
        title="Question Banks"
        eyebrow="MANAGE SOURCES"
        status={`${sets.filter((set) => set.reviewed).length} reviewed · ${sets.length} total`}
        rowCount={sets.length}
      >
        {({ expanded, previewLimit }) => (
          <>
            <div className={styles.bankList}>
              {(expanded ? sets : sets.slice(0, previewLimit)).map((set) => (
                <button
                  type="button"
                  className={styles.bankRow}
                  key={set.entityId}
                  onClick={() => setReviewBank(set)}
                >
                  <span>
                    <b>{set.title}</b>
                    <small>
                      Version {set.version} · {set.questions.length} questions ·{' '}
                      {set.provenance}
                    </small>
                  </span>
                  <em>{set.reviewed ? 'Reviewed' : 'Needs bank review'}</em>
                </button>
              ))}
            </div>
            {!sets.length && (
              <p>
                No question bank is installed. Import a bank or export a request
                for original practice questions.
              </p>
            )}
            <details className="question-tools">
              <summary>Question-bank import and request export</summary>
              <p>Select one or more topics for a combined request.</p>
              <div className="question-topic-picker">
                {topics.map((topic) => (
                  <label key={topic}>
                    <input
                      type="checkbox"
                      checked={exportTopics.includes(topic)}
                      onChange={() =>
                        setExportTopics((current) =>
                          current.includes(topic)
                            ? current.filter((value) => value !== topic)
                            : [...current, topic],
                        )
                      }
                    />
                    {topic}
                  </label>
                ))}
              </div>
              <div className="record-actions">
                <button
                  type="button"
                  className="focus-secondary"
                  onClick={() =>
                    downloadJson(request, 'zeustek-question-request.json')
                  }
                >
                  <Download size={15} />
                  Export question request
                </button>
                <label className="focus-secondary file-action">
                  <Upload size={15} />
                  Import JSON / ZIP / RAR
                  <input
                    type="file"
                    multiple
                    accept="application/json,.json,application/zip,.zip,application/vnd.rar,application/x-rar-compressed,.rar"
                    disabled={busy}
                    onChange={(event) => {
                      if (event.target.files?.length)
                        void importSets(event.target.files);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
            </details>
          </>
        )}
      </CollapsibleWorkCard>
      <CollapsibleWorkCard
        id="knowledge-take-test"
        title="Take Test"
        eyebrow="PRACTISE & MEASURE"
        status={`${coverage.tested.length} of ${KNOWLEDGE_TOPICS.length} core areas tested`}
      >
        <div className={styles.testGrid}>
          <label>
            Focus area
            <select
              value={focus}
              onChange={(event) => setFocus(event.target.value)}
            >
              <option value="">Full diagnostic across every area</option>
              {topics.map((topic) => (
                <option key={topic}>{topic}</option>
              ))}
            </select>
          </label>
          <div>
            <p>
              {coverage.complete
                ? 'Core diagnostic coverage is complete. Study guidance uses current exact-topic evidence.'
                : `Complete a diagnostic in every core area before full study guidance is applied. ${coverage.tested.length}/${KNOWLEDGE_TOPICS.length} areas tested.`}
            </p>
            <button
              type="button"
              className="focus-primary"
              disabled={!sets.some((set) => set.reviewed)}
              onClick={start}
            >
              {focus ? 'Start focused test' : 'Continue full diagnostic'}
            </button>
          </div>
        </div>
        {coverage.missing.length > 0 && (
          <p className="focus-copy">
            Still to test: {coverage.missing.join(', ')}.
          </p>
        )}
        {KNOWLEDGE_TOPICS.filter((topic) => !reviewedTopics.includes(topic))
          .length > 0 && (
          <p className="focus-copy">
            Question banks are still needed for:{' '}
            {KNOWLEDGE_TOPICS.filter(
              (topic) => !reviewedTopics.includes(topic),
            ).join(', ')}
            .
          </p>
        )}
        {coverage.complete && needs.length > 0 && (
          <details>
            <summary>Current study recommendations</summary>
            <p>
              Only the latest answer for each exact topic is used; historical
              answers remain in the attempt record.
            </p>
            {needs.slice(0, 5).map((question, index) => (
              <p key={`${question.topic}:${question.exactTopic}:${index}`}>
                <b>
                  {question.topic} · {question.exactTopic || question.topic}:
                </b>{' '}
                {question.explanation}
              </p>
            ))}
            <div className="record-actions">
              <button
                type="button"
                className="focus-secondary"
                onClick={() => go('Skills & Currency')}
              >
                Dive Skills
              </button>
              <button
                type="button"
                className="focus-secondary"
                onClick={() => go('Course Map')}
              >
                Planned Training
              </button>
              {recommendations.length > 0 && (
                <button
                  type="button"
                  className="focus-secondary"
                  onClick={() => go('Dive Media')}
                >
                  <BookMarked size={15} />
                  Dive Bibliography ({recommendations.length})
                </button>
              )}
            </div>
          </details>
        )}
      </CollapsibleWorkCard>
      <KnowledgeReviewWorkflow
        sets={sets}
        attempts={attempts}
        reviewStates={reviewStates}
        refresh={refresh}
      />
      {reviewBank && (
        <BankReviewDialog
          bank={reviewBank}
          close={() => setReviewBank(null)}
          enable={async () => {
            await saveRecord('question-set', {
              ...reviewBank,
              entityId: reviewBank.entityId,
              reviewed: true,
            });
            setReviewBank(null);
            await refresh();
          }}
        />
      )}
    </section>
  );
}

function BankReviewDialog({
  bank,
  close,
  enable,
}: {
  bank: Stored<QuestionSet>;
  close: () => void;
  enable: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="focus-modal-bg">
      <AccessibleDialog
        containDismiss
        label={`Review ${bank.title}`}
        close={close}
        className={`focus-modal ${styles.bankDialog}`}
      >
        <header>
          <div>
            <span className="focus-eyebrow">QUESTION BANK REVIEW</span>
            <h2>{bank.title}</h2>
            <p>
              Version {bank.version} · {bank.questions.length} questions ·{' '}
              {bank.provenance}
            </p>
          </div>
          <button
            type="button"
            className="focus-icon"
            data-dialog-close
            aria-label="Close question-bank review"
            disabled={busy}
            onClick={close}
          >
            <X />
          </button>
        </header>
        <p>
          Review source, answers, explanations and objectives before enabling
          this immutable bank version for new tests.
        </p>
        <div className={styles.bankQuestions}>
          {bank.questions.map((question) => (
            <details key={question.id}>
              <summary>{question.prompt}</summary>
              <p>
                {question.topic} · {question.exactTopic || question.topic} ·{' '}
                {question.objective || 'Objective not recorded'} ·{' '}
                {difficultyLabel(question.difficulty)}
              </p>
              <p>
                <b>Answer:</b> {question.answers.join(' / ')}
              </p>
              <p>{question.explanation}</p>
              {answerRationale(question)}
              {question.studySources?.length ? (
                <p>
                  <b>Study sources:</b> {question.studySources.join(' · ')}
                </p>
              ) : null}
              <small>
                Stable question ID {question.id} · {question.provenance}
              </small>
            </details>
          ))}
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
          {!bank.reviewed && (
            <button
              type="button"
              className="focus-primary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void enable().finally(() => setBusy(false));
              }}
            >
              Enable reviewed bank
            </button>
          )}
        </footer>
      </AccessibleDialog>
    </div>
  );
}
