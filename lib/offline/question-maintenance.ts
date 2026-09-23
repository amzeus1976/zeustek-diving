import {
  parseQuestionSet,
  type Question,
  type QuestionSet,
} from '../knowledge-tests';
import { sha256Hex } from './canonical';
import { currentDiveAccount, flushDiveChanges } from './dive-store';
import { listRecords } from './dive-planning';
import {
  listQuestionReviewStates,
  type QuestionReviewStateRecord,
} from './learning-review';
import {
  mutateEntitiesAtomically,
  type AtomicMutationOptions,
} from './batch-mutations';
import type { JsonValue } from './types';
const criteria = [
  'missing-context',
  'ambiguity',
  'answer-leakage',
  'distractors',
  'readability',
] as const;
type Target = {
  setId: string;
  setVersion: number;
  questionId: string;
  questionHash: string;
};
export type QuestionAdvice = {
  format: 'zeustek-question-quality-advice';
  version: 1;
  target: Target;
  summary: string;
  findings: Array<{ criterion: (typeof criteria)[number]; detail: string }>;
};
export async function questionQualityRequest(
  set: QuestionSet,
  question: Question,
) {
  const target: Target = {
    setId: set.setId,
    setVersion: set.version,
    questionId: question.id,
    questionHash: await sha256Hex(
      new TextEncoder().encode(JSON.stringify(question)),
    ),
  };
  return {
    format: 'zeustek-question-quality-request',
    version: 1,
    target,
    question,
    criteria,
    instructions:
      'Review this one question for each criterion. Advice only: do not rewrite a bank or claim certification. Return the response format with the unchanged target, a summary and findings. The author must explicitly accept or reject each finding.',
    responseFormat: {
      format: 'zeustek-question-quality-advice',
      version: 1,
      target,
      summary: 'Short advisory summary',
      findings: [
        { criterion: 'missing-context', detail: 'Specific finding, if any' },
      ],
    },
  };
}
export function validateQuestionAdvice(
  value: unknown,
  target: Target,
): QuestionAdvice {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid question-quality advice.');
  const input = value as Partial<QuestionAdvice>;
  if (
    input.format !== 'zeustek-question-quality-advice' ||
    input.version !== 1 ||
    !input.target ||
    Object.keys(target).some(
      (key) =>
        input.target![key as keyof Target] !== target[key as keyof Target],
    )
  )
    throw new Error('Advice does not match this exact question version.');
  if (
    typeof input.summary !== 'string' ||
    input.summary.length > 3000 ||
    !Array.isArray(input.findings) ||
    input.findings.length > 30 ||
    input.findings.some(
      (f) =>
        !f ||
        !criteria.includes(f.criterion) ||
        typeof f.detail !== 'string' ||
        !f.detail.trim() ||
        f.detail.length > 2000,
    )
  )
    throw new Error('Advice has invalid or oversized findings.');
  return {
    format: 'zeustek-question-quality-advice',
    version: 1,
    target: { ...target },
    summary: input.summary,
    findings: input.findings.map((f) => ({
      criterion: f.criterion,
      detail: f.detail,
    })),
  };
}
export async function maintainQuestion(
  input: {
    setId: string;
    setVersion: number;
    questionId: string;
    action: 'edit' | 'replace' | 'remove';
    question?: Question;
    reason: string;
    approved: boolean;
    advice?: QuestionAdvice;
    decisions?: Array<'accept' | 'reject'>;
  },
  options: AtomicMutationOptions = {},
) {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in before maintaining a question.');
  if (!input.approved)
    throw new Error('Approve the final question change before saving.');
  if (!input.reason.trim()) throw new Error('A review reason is required.');
  const sets = (await listRecords<QuestionSet>('question-set'))
    .filter((s) => s.setId === input.setId)
    .sort((a, b) => b.version - a.version);
  const current = sets[0];
  if (!current || current.version !== input.setVersion)
    throw new Error('Open the latest bank version before editing.');
  const original = current.questions.find((q) => q.id === input.questionId);
  if (!original) throw new Error('Question no longer exists in this bank.');
  const now = new Date().toISOString();
  const version = current.version + 1;
  const revised =
    input.action === 'remove'
      ? null
      : ({
          ...input.question,
          id: input.action === 'replace' ? crypto.randomUUID() : original.id,
        } as Question);
  if (input.action !== 'remove' && !input.question)
    throw new Error('The replacement question is required.');
  const questions = current.questions.flatMap((q) =>
    q.id === original.id ? (revised ? [revised] : []) : [{ ...q }],
  );
  if (!questions.length)
    throw new Error(
      'Suppress the last question instead of creating an empty bank.',
    );
  const parsed = parseQuestionSet({
    format: current.format,
    schemaVersion: current.schemaVersion,
    setId: current.setId,
    version,
    title: current.title,
    createdAt: now,
    provenance: current.provenance,
    reviewed: false,
    questions,
  });
  const states = await listQuestionReviewStates();
  const moduleKey = `dive:${account}`;
  const id = `question-version-${(await sha256Hex(new TextEncoder().encode(`${current.setId}:${version}`))).slice(0, 40)}`;
  const audit = `${input.action} ${original.id}: ${input.reason.trim()}`;
  const next = {
    ...parsed,
    reviewed: true,
    provenance: `${current.provenance}\nAuthor review v${version}: ${audit}`,
    entityId: id,
    modifiedAt: now,
  };
  const recordMutation = (
    entityId: string,
    kind: string,
    record: object,
    existing = false,
  ) => ({
    entityId: `${moduleKey}:${entityId}`,
    module: moduleKey,
    entityType: kind,
    schemaVersion: 1,
    operation: existing ? ('update' as const) : ('create' as const),
    record: record as JsonValue,
    pendingSync: {
      key: `pending:${moduleKey}:${entityId}`,
      value: {
        id: entityId,
        kind,
        record,
        baseModifiedAt: null,
        token: crypto.randomUUID(),
        state: 'pending',
      } as unknown as JsonValue,
    },
  });
  const mutations = [recordMutation(id, 'question-set', next)];
  for (const state of states.filter(
    (s) =>
      s.setId === current.setId &&
      s.setVersion === current.version &&
      s.questionId !== original.id,
  )) {
    const reviewId = crypto.randomUUID();
    mutations.push(
      recordMutation(reviewId, 'question-review-state', {
        ...state,
        entityId: reviewId,
        setVersion: version,
        createdAt: now,
        modifiedAt: now,
      }),
    );
  }
  const reviewId = crypto.randomUUID();
  const auditState: QuestionReviewStateRecord = {
    setId: current.setId,
    setVersion: version,
    questionId: revised?.id ?? original.id,
    usageState: revised ? 'active' : 'suppressed',
    reviewState: 'reviewed',
    reviewReason: 'other',
    reviewNote: audit,
    flaggedAt: now,
    flaggedBy: account,
    reviewedAt: now,
    reviewedBy: account,
    reviewOutcome: input.action === 'edit' ? 'corrected' : 'superseded',
    createdAt: now,
    modifiedAt: now,
  };
  mutations.push(
    recordMutation(reviewId, 'question-review-state', {
      ...auditState,
      entityId: reviewId,
    }),
  );
  if (input.advice) {
    const target = (await questionQualityRequest(current, original)).target;
    const advice = validateQuestionAdvice(input.advice, target);
    if (
      input.decisions?.length !== advice.findings.length ||
      input.decisions.some((d) => d !== 'accept' && d !== 'reject')
    )
      throw new Error('Accept or reject every advisory finding before saving.');
    const adviceId = crypto.randomUUID();
    mutations.push(
      recordMutation(adviceId, 'learning-ai-advice', {
        entityId: adviceId,
        adviceId,
        summary: advice.summary,
        focusAreas: [],
        questionQuality: {
          ...advice,
          decisions: input.decisions,
          reviewedBy: account,
          resultVersion: version,
        },
        createdAt: now,
        modifiedAt: now,
      }),
    );
  }
  await mutateEntitiesAtomically(mutations, {
    ...options,
    expectedAbsentEntityIds: [`${moduleKey}:${id}`],
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zeustek-records-updated'));
    void flushDiveChanges();
  }
  return next;
}
