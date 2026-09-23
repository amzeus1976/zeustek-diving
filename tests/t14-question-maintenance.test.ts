import 'fake-indexeddb/auto';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, saveLocalRecord } from '../lib/offline/dive-store';
import { listRecords } from '../lib/offline/dive-planning';
import {
  flagQuestion,
  listQuestionReviewStates,
} from '../lib/offline/learning-review';
import {
  maintainQuestion,
  questionQualityRequest,
  validateQuestionAdvice,
} from '../lib/offline/question-maintenance';
import { reviewedQuestions, type QuestionSet } from '../lib/knowledge-tests';
const question = {
  id: 'q1',
  topic: 'Equipment',
  difficulty: 'beginner' as const,
  type: 'single-choice' as const,
  prompt: 'Which action is appropriate?',
  options: ['a', 'b', 'c', 'd'],
  answers: ['a'],
  explanation: 'Because a.',
  provenance: 'Fixture',
};
const bank: QuestionSet = {
  format: 'zeustek-question-set',
  schemaVersion: 1,
  setId: 'fixture-bank',
  version: 1,
  title: 'Fixture bank',
  createdAt: '2026-09-23T12:00:00Z',
  provenance: 'Fixture',
  reviewed: true,
  questions: [question, { ...question, id: 'q2' }],
};
beforeEach(async () => {
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('navigator', { onLine: false });
  configureDiveStore('t14-questions');
  await zeustekDb.open();
  await Promise.all(zeustekDb.tables.map((t) => t.clear()));
  await saveLocalRecord('question-set', { ...bank, entityId: 'bank-v1' });
});
afterEach(() => {
  zeustekDb.close();
  vi.unstubAllGlobals();
});
describe('T14 versioned single-question maintenance', () => {
  it('allows only one concurrent author change to create the next version', async () => {
    const input = {
      setId: bank.setId,
      setVersion: 1,
      questionId: 'q1',
      action: 'edit' as const,
      question,
      reason: 'Concurrent fixture edit',
      approved: true,
    };
    const results = await Promise.allSettled([
      maintainQuestion(input),
      maintainQuestion(input),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      (await listRecords<QuestionSet>('question-set')).filter(
        (set) => set.version === 2,
      ),
    ).toHaveLength(1);
  });
  it('creates a new version and preserves bank and historical snapshots', async () => {
    await saveLocalRecord('test-attempt', {
      entityId: 'attempt',
      questions: [
        { ...question, setId: bank.setId, setVersion: 1, response: 'b' },
      ],
      total: 1,
      correct: 0,
    });
    const attempts = await listRecords('test-attempt');
    const original = (await listRecords<QuestionSet>('question-set'))[0];
    await flagQuestion({
      setId: bank.setId,
      setVersion: 1,
      questionId: 'q2',
      reason: 'ambiguous',
    });
    await maintainQuestion({
      setId: bank.setId,
      setVersion: 1,
      questionId: 'q1',
      action: 'edit',
      question: { ...question, prompt: 'Improved context?' },
      reason: 'Clarify context',
      approved: true,
    });
    const sets = await listRecords<QuestionSet>('question-set');
    expect(sets).toHaveLength(2);
    expect(sets.find((s) => s.version === 1)).toEqual(original);
    expect(await listRecords('test-attempt')).toEqual(attempts);
    const pool = reviewedQuestions(sets, await listQuestionReviewStates());
    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({
      id: 'q1',
      setVersion: 2,
      prompt: 'Improved context?',
    });
  });
  it('removes a question from the next version while preserving referenced history', async () => {
    await maintainQuestion({
      setId: bank.setId,
      setVersion: 1,
      questionId: 'q1',
      action: 'remove',
      reason: 'Duplicate',
      approved: true,
    });
    const sets = await listRecords<QuestionSet>('question-set');
    expect(sets.find((s) => s.version === 1)?.questions).toHaveLength(2);
    expect(reviewedQuestions(sets).map((q) => q.id)).toEqual(['q2']);
    await expect(
      maintainQuestion({
        setId: bank.setId,
        setVersion: 1,
        questionId: 'q2',
        action: 'remove',
        reason: 'Stale editor',
        approved: true,
      }),
    ).rejects.toThrow(/latest/);
  });
  it('requires author approval, valid choices and reason, and rolls back an interrupted batch', async () => {
    const input = {
      setId: bank.setId,
      setVersion: 1,
      questionId: 'q1',
      action: 'edit' as const,
      question,
      reason: 'Clarify context',
      approved: true,
    };
    await expect(
      maintainQuestion({ ...input, approved: false }),
    ).rejects.toThrow(/approve/i);
    await expect(maintainQuestion({ ...input, reason: '' })).rejects.toThrow(
      /reason/i,
    );
    await expect(
      maintainQuestion({
        ...input,
        question: { ...question, answers: ['missing'] },
      }),
    ).rejects.toThrow(/matching answer/);
    await expect(
      maintainQuestion(input, { failAfterMutation: 1 }),
    ).rejects.toThrow();
    expect(await listRecords<QuestionSet>('question-set')).toHaveLength(1);
    expect(await listQuestionReviewStates()).toHaveLength(0);
  });
  it('never falls back to a superseded version while the newest bank awaits review', () => {
    expect(
      reviewedQuestions([bank, { ...bank, version: 2, reviewed: false }]),
    ).toHaveLength(0);
  });
  it('binds advisory AI review to exact question content and never applies suggestions', async () => {
    const request = await questionQualityRequest(bank, question);
    expect(request.criteria).toEqual([
      'missing-context',
      'ambiguity',
      'answer-leakage',
      'distractors',
      'readability',
    ]);
    const advice = {
      format: 'zeustek-question-quality-advice',
      version: 1,
      target: request.target,
      summary: 'Review context',
      findings: [
        { criterion: 'missing-context', detail: 'Name the water conditions.' },
      ],
    };
    expect(validateQuestionAdvice(advice, request.target)).toMatchObject({
      summary: 'Review context',
    });
    expect(() =>
      validateQuestionAdvice(
        { ...advice, target: { ...request.target, questionHash: 'other' } },
        request.target,
      ),
    ).toThrow(/match/);
    expect(
      (await listRecords<QuestionSet>('question-set'))[0]?.questions[0],
    ).toEqual(question);
  });
});
