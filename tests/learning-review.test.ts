import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { zeustekDb } from '../lib/offline/db';
import {
  configureDiveStore,
  pendingDiveChanges,
  saveLocalRecord,
} from '../lib/offline/dive-store';
import { listRecords } from '../lib/offline/dive-planning';
import {
  chooseQuestions,
  parseQuestionSet,
  type QuestionSet,
  type TestAttempt,
} from '../lib/knowledge-tests';
import {
  buildIncrementalAiReview,
  buildStudyPackZip,
  completeIncrementalAiReviewExport,
  flagQuestion,
  importStudyPackAtomically,
  learningDiagnostics,
  listLearningAiCheckpoints,
  listQuestionReviewStates,
  resolveQuestionReview,
  saveAiAdvice,
  sortedQuestionManagementRows,
  validateStudyPackZip,
} from '../lib/offline/learning-review';

const question = (
  id: string,
  topic = 'Gas',
  difficulty: QuestionSet['questions'][number]['difficulty'] = 'beginner',
) => ({
  id,
  topic,
  exactTopic: `${topic} exact`,
  objective: `Understand ${topic}`,
  type: 'single-choice' as const,
  difficulty,
  prompt: `${topic} question ${id}?`,
  options: ['a', 'b', 'c', 'd'],
  answers: ['a'],
  explanation: 'Because a is correct.',
  provenance: 'T11 test',
});
const bank = (
  setId = 'bank',
  questions = [question('q1'), question('q2'), question('q3')],
): QuestionSet => ({
  format: 'zeustek-question-set',
  schemaVersion: 1,
  setId,
  version: 1,
  title: `${setId} title`,
  createdAt: '2026-09-15T08:00:00.000Z',
  provenance: 'T11 test',
  reviewed: true,
  questions,
});
const attempt = (
  entityId: string,
  completedAt: string,
  questions: QuestionSet['questions'],
  answers: boolean[],
): TestAttempt & { entityId: string } => ({
  entityId,
  startedAt: completedAt,
  completedAt,
  inputs: {
    training: [],
    media: [],
    plan: [],
    focus: questions[0]?.topic ?? 'Gas',
  },
  diagnostic: true,
  correct: answers.filter(Boolean).length,
  total: questions.length,
  questions: questions.map((item, index) => ({
    ...item,
    setId: 'bank',
    setVersion: 1,
    response: [answers[index] ? 'a' : 'b'],
    correct: answers[index] ?? false,
  })),
});

beforeEach(async () => {
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal(
    'CustomEvent',
    class {
      constructor(
        public type: string,
        public init?: unknown,
      ) {}
    },
  );
  configureDiveStore('t11-owner');
  await zeustekDb.open();
  await Promise.all(zeustekDb.tables.map((table) => table.clear()));
});
afterEach(async () => {
  vi.unstubAllGlobals();
  zeustekDb.close();
});

describe('T11 question review and diagnostics', () => {
  it('suppresses only future selection, preserves the historical snapshot, and reverses cleanly', async () => {
    await saveLocalRecord('question-set', {
      ...bank(),
      entityId: 'bank-record',
    });
    const historical = attempt(
      'attempt-1',
      '2026-09-15T09:00:00.000Z',
      [question('q1')],
      [false],
    );
    await saveLocalRecord('test-attempt', historical);
    const before = JSON.stringify(
      (await listRecords<TestAttempt>('test-attempt'))[0],
    );
    await flagQuestion({
      setId: 'bank',
      setVersion: 1,
      questionId: 'q1',
      reason: 'ambiguous',
      note: 'Two plausible answers.',
    });
    const states = await listQuestionReviewStates();
    expect(
      chooseQuestions([bank()], [], 5, () => 0.5, states).map(
        (item) => item.id,
      ),
    ).not.toContain('q1');
    expect(
      JSON.stringify((await listRecords<TestAttempt>('test-attempt'))[0]),
    ).toBe(before);
    await resolveQuestionReview({
      entityId: states[0]!.entityId,
      outcome: 'restored',
    });
    expect(
      chooseQuestions(
        [bank()],
        [],
        5,
        () => 0.5,
        await listQuestionReviewStates(),
      ).map((item) => item.id),
    ).toContain('q1');
    expect(
      JSON.stringify((await listRecords<TestAttempt>('test-attempt'))[0]),
    ).toBe(before);
  });

  it('requires a note for Other and sorts needs-review before topic and difficulty', async () => {
    await expect(
      flagQuestion({
        setId: 'bank',
        setVersion: 1,
        questionId: 'q1',
        reason: 'other',
      }),
    ).rejects.toThrow('Add a note');
    const set = {
      ...bank('bank', [
        question('q1', 'Zulu', 'advanced'),
        question('q2', 'Alpha', 'foundation'),
      ]),
      entityId: 'bank-record',
      modifiedAt: '',
      createdAt: '',
    };
    const state = {
      entityId: 'review-1',
      setId: 'bank',
      setVersion: 1,
      questionId: 'q1',
      usageState: 'suppressed' as const,
      reviewState: 'needs_review' as const,
      reviewReason: 'poor_wording' as const,
      reviewNote: '',
      flaggedAt: '',
      flaggedBy: '',
      reviewedAt: null,
      reviewedBy: null,
      reviewOutcome: null,
      createdAt: '',
      modifiedAt: '',
    };
    expect(
      sortedQuestionManagementRows([set], [state]).map(
        (row) => row.question.id,
      ),
    ).toEqual(['q1', 'q2']);
  });

  it('uses latest per-question evidence, exposes objective provenance, and explains insufficient evidence', () => {
    const questions = [question('q1'), question('q2'), question('q3')];
    const rows = learningDiagnostics(
      [
        attempt('a1', '2026-09-15T09:00:00.000Z', questions, [
          false,
          false,
          false,
        ]),
        attempt('a2', '2026-09-15T10:00:00.000Z', questions, [
          true,
          true,
          true,
        ]),
      ],
      [],
    );
    expect(rows[0]).toMatchObject({
      objective: 'Understand Gas',
      answered: 3,
      historicalAnswers: 6,
      correct: 3,
      percent: 100,
      status: 'strength',
    });
    expect(rows[0]?.statusReason).toContain('latest per-question');
    const thin = learningDiagnostics(
      [attempt('a3', '2026-09-15T11:00:00.000Z', [question('q1')], [true])],
      [],
    )[0]!;
    expect(thin.status).toBe('insufficient-evidence');
    expect(thin.statusReason).toContain('1 of 3');
  });

  it('accepts the additive optional objective in question-set v1', () => {
    expect(parseQuestionSet(bank()).questions[0]?.objective).toBe(
      'Understand Gas',
    );
  });
});

describe('T11 incremental AI review', () => {
  it('includes only new attempts/review changes and previous advice continuity', async () => {
    await saveAiAdvice({
      adviceId: 'advice-1',
      summary: 'Practise gas planning.',
      focusAreas: ['Gas'],
    });
    const attempts = [
      attempt('a1', '2026-09-15T09:00:00.000Z', [question('q1')], [false]),
    ];
    const first = await buildIncrementalAiReview(attempts, []);
    expect(first.previousAiAdvice).toMatchObject({
      adviceId: 'advice-1',
      summary: 'Practise gas planning.',
      focusAreas: ['Gas'],
    });
    expect(first.attempts).toHaveLength(1);
    expect(first.checkpointId).toBe(first.exportId);
  });

  it('does not advance the checkpoint when artifact creation fails, then advances after success', async () => {
    const attempts = [
      attempt('a1', '2026-09-15T09:00:00.000Z', [question('q1')], [true]),
    ];
    await expect(
      completeIncrementalAiReviewExport(attempts, [], async () => {
        throw new Error('disk full');
      }),
    ).rejects.toThrow('disk full');
    expect(await listLearningAiCheckpoints()).toHaveLength(0);
    const completed = await completeIncrementalAiReviewExport(
      attempts,
      [],
      async () => undefined,
    );
    expect(await listLearningAiCheckpoints()).toMatchObject([
      {
        lastSuccessfulExportId: completed.exportId,
        checkpointAt: completed.range.toInclusive,
      },
    ]);
  });
});

describe('T11 study packs', () => {
  it('round-trips a manifest/hash validated pack and rejects tampering', async () => {
    const bytes = await buildStudyPackZip({ questionSets: [bank()] });
    expect((await validateStudyPackZip(bytes)).questionSets[0]?.setId).toBe(
      'bank',
    );
    const files = unzipSync(bytes);
    const questionPath = Object.keys(files).find((path) =>
      path.startsWith('questions/'),
    )!;
    files[questionPath] = strToU8(
      strFromU8(files[questionPath]!).replace(
        'Because a is correct.',
        'Tampered text.',
      ),
    );
    await expect(validateStudyPackZip(zipSync(files))).rejects.toThrow(
      'hash mismatch',
    );
  });

  it('rolls back every record/event/outbox/pending row on an injected mid-batch failure', async () => {
    const bytes = await buildStudyPackZip({
      questionSets: [bank('bank-a'), bank('bank-b')],
    });
    await expect(
      importStudyPackAtomically(bytes, { failAfterMutation: 1 }),
    ).rejects.toThrow('Injected atomic mutation failure');
    expect(await zeustekDb.entities.count()).toBe(0);
    expect(await zeustekDb.events.count()).toBe(0);
    expect(await zeustekDb.outbox.count()).toBe(0);
    expect(await pendingDiveChanges()).toHaveLength(0);
  });

  it('commits validated records once and refuses an existing set version without a partial import', async () => {
    const bytes = await buildStudyPackZip({
      questionSets: [bank('bank-a'), bank('bank-b')],
    });
    await importStudyPackAtomically(bytes);
    expect(await listRecords<QuestionSet>('question-set')).toHaveLength(2);
    expect(await zeustekDb.events.count()).toBe(2);
    expect(await zeustekDb.outbox.count()).toBe(2);
    expect(await pendingDiveChanges()).toHaveLength(2);
    const counts = [
      await zeustekDb.entities.count(),
      await zeustekDb.events.count(),
      await zeustekDb.outbox.count(),
    ];
    await expect(importStudyPackAtomically(bytes)).rejects.toThrow(
      'already exists',
    );
    expect([
      await zeustekDb.entities.count(),
      await zeustekDb.events.count(),
      await zeustekDb.outbox.count(),
    ]).toEqual(counts);
  });
});
