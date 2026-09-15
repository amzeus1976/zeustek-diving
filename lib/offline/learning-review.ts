import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { sha256Hex } from './canonical';
import { currentDiveAccount, flushDiveChanges } from './dive-store';
import { listRecords, saveRecord, type Stored } from './dive-planning';
import {
  mutateEntitiesAtomically,
  type AtomicMutationOptions,
} from './batch-mutations';
import {
  difficultyIndex,
  parseQuestionSet,
  type AttemptQuestion,
  type QuestionSet,
  type TestAttempt,
} from '../knowledge-tests';
import type { JsonValue } from './types';

export const QUESTION_REVIEW_REASONS = [
  ['incorrect_answer', 'Incorrect answer / answer key'],
  ['poor_wording', 'Poor wording'],
  ['missing_media', 'Missing diagram / media'],
  ['ambiguous', 'Ambiguous'],
  ['duplicate', 'Duplicate'],
  ['wrong_topic', 'Wrong topic'],
  ['obsolete', 'Obsolete'],
  ['bad_explanation', 'Bad explanation'],
  ['technical_issue', 'Technical issue'],
  ['other', 'Other'],
] as const;

export type QuestionReviewReason = (typeof QUESTION_REVIEW_REASONS)[number][0];
export type QuestionReviewOutcome =
  | 'restored'
  | 'remain_suppressed'
  | 'corrected'
  | 'superseded';

export interface QuestionReviewStateRecord {
  setId: string;
  setVersion: number;
  questionId: string;
  usageState: 'active' | 'suppressed';
  reviewState: 'needs_review' | 'reviewed';
  reviewReason: QuestionReviewReason;
  reviewNote: string;
  flaggedAt: string;
  flaggedBy: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewOutcome: QuestionReviewOutcome | null;
  createdAt: string;
  modifiedAt: string;
}

export interface LearningAiCheckpointRecord {
  checkpointKey: 'learning-review';
  lastSuccessfulExportId: string | null;
  checkpointAt: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface LearningAiAdviceRecord {
  adviceId: string;
  createdAt: string;
  summary: string;
  focusAreas: string[];
  studyMediaReferences?: Array<{ title: string; url?: string; notes?: string }>;
  sourceExportId?: string | null;
  modifiedAt: string;
}

export const listQuestionReviewStates = () =>
  listRecords<QuestionReviewStateRecord>('question-review-state');
export const listLearningAiCheckpoints = () =>
  listRecords<LearningAiCheckpointRecord>('learning-ai-checkpoint');
export const listLearningAiAdvice = () =>
  listRecords<LearningAiAdviceRecord>('learning-ai-advice');
export const reviewIdentity = (
  setId: string,
  setVersion: number,
  questionId: string,
) => `${setId}|${setVersion}|${questionId}`;

export async function flagQuestion(input: {
  setId: string;
  setVersion: number;
  questionId: string;
  reason: QuestionReviewReason;
  note?: string;
}) {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to review questions.');
  if (input.reason === 'other' && !input.note?.trim())
    throw new Error('Add a note when the review reason is Other.');
  const identity = reviewIdentity(
    input.setId,
    input.setVersion,
    input.questionId,
  );
  const existing = (await listQuestionReviewStates()).find(
    (row) =>
      reviewIdentity(row.setId, row.setVersion, row.questionId) === identity,
  );
  const now = new Date().toISOString();
  return saveRecord('question-review-state', {
    ...(existing ? { entityId: existing.entityId } : {}),
    setId: input.setId,
    setVersion: input.setVersion,
    questionId: input.questionId,
    usageState: 'suppressed' as const,
    reviewState: 'needs_review' as const,
    reviewReason: input.reason,
    reviewNote: input.note?.trim() ?? '',
    flaggedAt: existing?.flaggedAt ?? now,
    flaggedBy: existing?.flaggedBy ?? account,
    reviewedAt: null,
    reviewedBy: null,
    reviewOutcome: null,
  });
}

export async function resolveQuestionReview(input: {
  entityId: string;
  outcome: QuestionReviewOutcome;
  note?: string;
}) {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to resolve question review.');
  const current = (await listQuestionReviewStates()).find(
    (row) => row.entityId === input.entityId,
  );
  if (!current) throw new Error('This review state is no longer available.');
  const active = ['restored', 'corrected', 'superseded'].includes(
    input.outcome,
  );
  return saveRecord('question-review-state', {
    ...current,
    entityId: current.entityId,
    usageState: active ? ('active' as const) : ('suppressed' as const),
    reviewState: 'reviewed' as const,
    reviewNote: input.note?.trim() || current.reviewNote,
    reviewedAt: new Date().toISOString(),
    reviewedBy: account,
    reviewOutcome: input.outcome,
  });
}

const reviewPriority = (row: QuestionReviewStateRecord | undefined) =>
  row?.reviewState === 'needs_review' ? 0 : 1;

export function sortedQuestionManagementRows(
  sets: Array<Stored<QuestionSet>>,
  states: Array<Stored<QuestionReviewStateRecord>>,
) {
  const byId = new Map(
    states.map((row) => [
      reviewIdentity(row.setId, row.setVersion, row.questionId),
      row,
    ]),
  );
  return sets
    .flatMap((set) =>
      set.questions.map((question) => ({
        set,
        question,
        state: byId.get(reviewIdentity(set.setId, set.version, question.id)),
      })),
    )
    .sort(
      (left, right) =>
        reviewPriority(left.state) - reviewPriority(right.state) ||
        left.question.topic.localeCompare(right.question.topic, 'en-GB') ||
        difficultyIndex(left.question.difficulty) -
          difficultyIndex(right.question.difficulty) ||
        left.question.id.localeCompare(right.question.id, 'en-GB'),
    );
}

export type LearningEvidenceStatus =
  | 'strength'
  | 'weakness'
  | 'developing'
  | 'insufficient-evidence';
export interface LearningDiagnosticEvidence {
  questionId: string;
  attemptId: string;
  completedAt: string;
  correct: boolean;
  prompt: string;
}
export interface LearningDiagnosticRow {
  key: string;
  topic: string;
  subtopic: string;
  objective: string;
  answered: number;
  historicalAnswers: number;
  correct: number;
  incorrect: number;
  percent: number | null;
  status: LearningEvidenceStatus;
  statusReason: string;
  lastPractised: string | null;
  suppressedExcluded: number;
  questionIds: string[];
  attemptIds: string[];
  latestEvidence: LearningDiagnosticEvidence[];
}

export function learningDiagnostics(
  attempts: Array<Stored<TestAttempt>>,
  states: Array<Stored<QuestionReviewStateRecord>>,
  minimumEvidence = 3,
): LearningDiagnosticRow[] {
  const suppressed = new Set(
    states
      .filter((row) => row.usageState === 'suppressed')
      .map((row) => reviewIdentity(row.setId, row.setVersion, row.questionId)),
  );
  const groups = new Map<
    string,
    {
      topic: string;
      subtopic: string;
      objective: string;
      rows: Array<{ attempt: Stored<TestAttempt>; question: AttemptQuestion }>;
      excluded: number;
    }
  >();
  for (const attempt of attempts) {
    for (const question of attempt.questions) {
      const subtopic = question.exactTopic || question.topic;
      const objective = question.objective?.trim() || 'Not recorded';
      const key = `${question.topic}\u0000${subtopic}\u0000${objective}`;
      const group = groups.get(key) ?? {
        topic: question.topic,
        subtopic,
        objective,
        rows: [],
        excluded: 0,
      };
      if (
        suppressed.has(
          reviewIdentity(question.setId, question.setVersion, question.id),
        )
      )
        group.excluded += 1;
      else group.rows.push({ attempt, question });
      groups.set(key, group);
    }
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const latestByQuestion = new Map<
        string,
        { attempt: Stored<TestAttempt>; question: AttemptQuestion }
      >();
      for (const row of [...group.rows].sort((left, right) =>
        left.attempt.completedAt.localeCompare(right.attempt.completedAt),
      )) {
        latestByQuestion.set(
          reviewIdentity(
            row.question.setId,
            row.question.setVersion,
            row.question.id,
          ),
          row,
        );
      }
      const latest = [...latestByQuestion.values()];
      const answered = latest.length;
      const correct = latest.filter((row) => row.question.correct).length;
      const incorrect = answered - correct;
      const percent = answered ? Math.round((correct / answered) * 100) : null;
      const status: LearningEvidenceStatus =
        answered < minimumEvidence
          ? 'insufficient-evidence'
          : (percent ?? 0) >= 75
            ? 'strength'
            : (percent ?? 100) < 60
              ? 'weakness'
              : 'developing';
      const statusReason =
        answered < minimumEvidence
          ? `${answered} of ${minimumEvidence} required current question results are available.`
          : `${correct} of ${answered} latest per-question results are correct (${percent}%). Strength begins at 75%; weakness is below 60%.`;
      return {
        key,
        topic: group.topic,
        subtopic: group.subtopic,
        objective: group.objective,
        answered,
        historicalAnswers: group.rows.length,
        correct,
        incorrect,
        percent,
        status,
        statusReason,
        lastPractised:
          latest
            .map((row) => row.attempt.completedAt)
            .sort()
            .at(-1) ?? null,
        suppressedExcluded: group.excluded,
        questionIds: [...new Set(latest.map((row) => row.question.id))],
        attemptIds: [...new Set(group.rows.map((row) => row.attempt.entityId))],
        latestEvidence: latest
          .sort((left, right) =>
            right.attempt.completedAt.localeCompare(left.attempt.completedAt),
          )
          .map((row) => ({
            questionId: row.question.id,
            attemptId: row.attempt.entityId,
            completedAt: row.attempt.completedAt,
            correct: row.question.correct,
            prompt: row.question.prompt,
          })),
      };
    })
    .sort(
      (left, right) =>
        left.topic.localeCompare(right.topic, 'en-GB') ||
        left.subtopic.localeCompare(right.subtopic, 'en-GB') ||
        left.objective.localeCompare(right.objective, 'en-GB'),
    );
}

export async function buildIncrementalAiReview(
  attempts: Array<Stored<TestAttempt>>,
  states: Array<Stored<QuestionReviewStateRecord>>,
) {
  const checkpoint = (await listLearningAiCheckpoints()).sort((left, right) =>
    (right.checkpointAt ?? '').localeCompare(left.checkpointAt ?? ''),
  )[0];
  const advice = (await listLearningAiAdvice()).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  )[0];
  const selected = attempts
    .filter(
      (attempt) =>
        !checkpoint?.checkpointAt ||
        attempt.completedAt > checkpoint.checkpointAt,
    )
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  const reviewChanges = states
    .filter(
      (state) =>
        !checkpoint?.checkpointAt || state.modifiedAt > checkpoint.checkpointAt,
    )
    .sort((left, right) => left.modifiedAt.localeCompare(right.modifiedAt));
  const diagnostics = learningDiagnostics(selected, states);
  const exportId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const toInclusive = [
    selected.at(-1)?.completedAt,
    reviewChanges.at(-1)?.modifiedAt,
    createdAt,
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)!;
  return {
    format: 'zeustek-ai-learning-review',
    schemaVersion: 1,
    exportId,
    checkpointId: exportId,
    createdAt,
    range: {
      previousSuccessfulExportId: checkpoint?.lastSuccessfulExportId ?? null,
      previousCheckpointAt: checkpoint?.checkpointAt ?? null,
      fromExclusive: checkpoint?.checkpointAt ?? null,
      toInclusive,
    },
    previousAiAdvice: {
      adviceId: advice?.adviceId ?? null,
      createdAt: advice?.createdAt ?? null,
      summary: advice?.summary ?? '',
      focusAreas: advice?.focusAreas ?? [],
    },
    attempts: selected,
    reviewChanges,
    topicSummary: diagnostics,
    strengths: diagnostics.filter((row) => row.status === 'strength'),
    weaknesses: diagnostics.filter((row) => row.status === 'weakness'),
    dataQuality: {
      suppressedQuestionCount: states.filter(
        (row) => row.usageState === 'suppressed',
      ).length,
      notes: [
        'Suppressed questions remain in historical attempts but are excluded from new test selection and current diagnostic scoring.',
      ],
    },
  };
}

export async function markAiReviewExportSuccessful(
  exportId: string,
  checkpointAt: string,
) {
  const current = (await listLearningAiCheckpoints())[0];
  return saveRecord('learning-ai-checkpoint', {
    ...(current ? { entityId: current.entityId } : {}),
    checkpointKey: 'learning-review' as const,
    lastSuccessfulExportId: exportId,
    checkpointAt,
  });
}

export async function completeIncrementalAiReviewExport(
  attempts: Array<Stored<TestAttempt>>,
  states: Array<Stored<QuestionReviewStateRecord>>,
  createArtifact: (
    envelope: Awaited<ReturnType<typeof buildIncrementalAiReview>>,
  ) => Promise<void> | void,
) {
  const envelope = await buildIncrementalAiReview(attempts, states);
  await createArtifact(envelope);
  await markAiReviewExportSuccessful(
    envelope.exportId,
    envelope.range.toInclusive,
  );
  return envelope;
}

export async function saveAiAdvice(input: {
  adviceId?: string;
  summary: string;
  focusAreas: string[];
  studyMediaReferences?: Array<{ title: string; url?: string; notes?: string }>;
  sourceExportId?: string | null;
}) {
  if (!input.summary.trim()) throw new Error('AI advice needs a summary.');
  return saveRecord('learning-ai-advice', {
    adviceId: input.adviceId || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    summary: input.summary.trim(),
    focusAreas: [
      ...new Set(input.focusAreas.map((value) => value.trim()).filter(Boolean)),
    ],
    studyMediaReferences: input.studyMediaReferences ?? [],
    sourceExportId: input.sourceExportId ?? null,
  });
}

export interface StudyPackManifest {
  format: 'zeustek-study-pack';
  schemaVersion: 1;
  createdAt: string;
  adviceFile?: string;
  mediaFile?: string;
  questionFiles: string[];
  files: Array<{ path: string; sha256: string }>;
}

const safeFilePart = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'question-bank';
const digest = (bytes: Uint8Array) => sha256Hex(bytes);

function portableQuestionSet(set: QuestionSet): QuestionSet {
  return {
    format: 'zeustek-question-set',
    schemaVersion: 1,
    setId: set.setId,
    version: set.version,
    title: set.title,
    createdAt: set.createdAt,
    provenance: set.provenance,
    reviewed: set.reviewed,
    questions: set.questions,
  };
}

export async function buildStudyPackZip(input: {
  questionSets: QuestionSet[];
  advice?: Partial<LearningAiAdviceRecord>;
  mediaReferences?: Array<{ title: string; url?: string; notes?: string }>;
}) {
  if (!input.questionSets.length)
    throw new Error('Select at least one question bank for the study pack.');
  const files: Record<string, Uint8Array> = {};
  input.questionSets.forEach((source, index) => {
    const set = portableQuestionSet(source);
    const path = `questions/${String(index + 1).padStart(2, '0')}-${safeFilePart(set.setId)}-v${set.version}.json`;
    files[path] = strToU8(JSON.stringify(set, null, 2));
  });
  if (input.advice?.summary?.trim())
    files['study-advice.json'] = strToU8(
      JSON.stringify(
        {
          adviceId: input.advice.adviceId,
          createdAt: input.advice.createdAt,
          summary: input.advice.summary,
          focusAreas: input.advice.focusAreas ?? [],
          sourceExportId: input.advice.sourceExportId ?? null,
        },
        null,
        2,
      ),
    );
  if (input.mediaReferences?.length)
    files['media-references.json'] = strToU8(
      JSON.stringify(input.mediaReferences, null, 2),
    );
  const hashes: Array<{ path: string; sha256: string }> = [];
  for (const [path, bytes] of Object.entries(files))
    hashes.push({ path, sha256: await digest(bytes) });
  const manifest: StudyPackManifest = {
    format: 'zeustek-study-pack',
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    ...(files['study-advice.json'] ? { adviceFile: 'study-advice.json' } : {}),
    ...(files['media-references.json']
      ? { mediaFile: 'media-references.json' }
      : {}),
    questionFiles: Object.keys(files).filter((path) =>
      path.startsWith('questions/'),
    ),
    files: hashes,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  return zipSync(files, { level: 6 });
}

function validateManifest(value: unknown): StudyPackManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Study pack manifest is invalid.');
  const manifest = value as Partial<StudyPackManifest>;
  if (manifest.format !== 'zeustek-study-pack' || manifest.schemaVersion !== 1)
    throw new Error('Unsupported study pack format.');
  if (!Number.isFinite(Date.parse(manifest.createdAt ?? '')))
    throw new Error('Study pack creation date is invalid.');
  if (
    !Array.isArray(manifest.questionFiles) ||
    !manifest.questionFiles.length ||
    !Array.isArray(manifest.files)
  )
    throw new Error('Study pack manifest does not list its question files.');
  const paths = manifest.files.map((entry) => entry?.path);
  if (
    paths.some(
      (path) =>
        typeof path !== 'string' ||
        path.includes('..') ||
        path.startsWith('/') ||
        path.includes('\\'),
    )
  )
    throw new Error('Study pack contains an unsafe file path.');
  if (new Set(paths).size !== paths.length)
    throw new Error('Study pack manifest contains duplicate file paths.');
  if (
    manifest.files.some((entry) => !/^[a-f0-9]{64}$/i.test(entry?.sha256 ?? ''))
  )
    throw new Error('Study pack manifest contains an invalid content hash.');
  return manifest as StudyPackManifest;
}

function validateMediaReferences(value: unknown) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 500)
    throw new Error('Study pack media references are invalid.');
  return value.map((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as { title?: unknown }).title !== 'string'
    )
      throw new Error('Study pack media reference is invalid.');
    const row = item as { title: string; url?: unknown; notes?: unknown };
    return {
      title: row.title.slice(0, 500),
      ...(typeof row.url === 'string' ? { url: row.url.slice(0, 2000) } : {}),
      ...(typeof row.notes === 'string'
        ? { notes: row.notes.slice(0, 3000) }
        : {}),
    };
  });
}

export async function validateStudyPackZip(bytes: Uint8Array) {
  if (bytes.byteLength > 50_000_000)
    throw new Error('Study pack is over the 50 MB compressed limit.');
  let expandedBytes = 0;
  let entryCount = 0;
  const files = unzipSync(bytes, {
    filter: (entry) => {
      entryCount += 1;
      expandedBytes += entry.originalSize;
      if (
        entryCount > 200 ||
        expandedBytes > 100_000_000 ||
        entry.originalSize > 5_000_000
      )
        throw new Error('Study pack expands beyond the safe import limit.');
      return true;
    },
  });
  const raw = files['manifest.json'];
  if (!raw) throw new Error('Study pack manifest.json is missing.');
  const manifest = validateManifest(JSON.parse(strFromU8(raw)));
  const declared = new Set(manifest.files.map((entry) => entry.path));
  const actual = Object.keys(files).filter((path) => path !== 'manifest.json');
  if (
    actual.some((path) => !declared.has(path)) ||
    declared.size !== actual.length
  )
    throw new Error('Study pack file list does not match its manifest.');
  for (const entry of manifest.files) {
    const file = files[entry.path];
    if (!file) throw new Error(`Study pack file missing: ${entry.path}`);
    if ((await digest(file)) !== entry.sha256)
      throw new Error(`Study pack hash mismatch: ${entry.path}`);
  }
  if (
    manifest.questionFiles.some(
      (path) => !declared.has(path) || !path.startsWith('questions/'),
    )
  )
    throw new Error('Study pack question file list is invalid.');
  const questionSets = manifest.questionFiles.map((path) =>
    parseQuestionSet(JSON.parse(strFromU8(files[path]!))),
  );
  const setVersions = questionSets.map((set) => `${set.setId}:${set.version}`);
  if (new Set(setVersions).size !== setVersions.length)
    throw new Error('Study pack contains a duplicate question-set version.');
  const adviceRaw = manifest.adviceFile
    ? files[manifest.adviceFile]
    : undefined;
  const advice = adviceRaw
    ? (JSON.parse(strFromU8(adviceRaw)) as Partial<LearningAiAdviceRecord>)
    : null;
  if (advice && typeof advice.summary !== 'string')
    throw new Error('Study pack advice is invalid.');
  const mediaRaw = manifest.mediaFile ? files[manifest.mediaFile] : undefined;
  const mediaReferences = validateMediaReferences(
    mediaRaw ? JSON.parse(strFromU8(mediaRaw)) : [],
  );
  return { manifest, questionSets, advice, mediaReferences };
}

export async function importStudyPackAtomically(
  bytes: Uint8Array,
  options: AtomicMutationOptions = {},
) {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in before importing a study pack.');
  const validated = await validateStudyPackZip(bytes);
  const existing = new Set(
    (await listRecords<QuestionSet>('question-set')).map(
      (set) => `${set.setId}:${set.version}`,
    ),
  );
  for (const set of validated.questionSets)
    if (existing.has(`${set.setId}:${set.version}`))
      throw new Error(
        `Question set already exists: ${set.setId} v${set.version}. Import cancelled with no changes.`,
      );
  const now = new Date().toISOString();
  const moduleKey = `dive:${account}`;
  const pending = (
    id: string,
    kind: string,
    record: Record<string, unknown>,
  ) => ({
    key: `pending:${moduleKey}:${id}`,
    value: {
      id,
      kind,
      record,
      baseModifiedAt: null,
      token: crypto.randomUUID(),
      state: 'pending',
    } as unknown as JsonValue,
  });
  const mutations = validated.questionSets.map((set) => {
    const id = crypto.randomUUID();
    const record = {
      ...set,
      entityId: id,
      createdAt: set.createdAt || now,
      modifiedAt: now,
    };
    return {
      entityId: `${moduleKey}:${id}`,
      module: moduleKey,
      entityType: 'question-set',
      schemaVersion: 1,
      operation: 'create' as const,
      record: record as unknown as JsonValue,
      pendingSync: pending(id, 'question-set', record),
    };
  });
  if (validated.advice?.summary?.trim()) {
    const id = crypto.randomUUID();
    const record = {
      entityId: id,
      adviceId: validated.advice.adviceId || crypto.randomUUID(),
      createdAt: validated.advice.createdAt || now,
      summary: validated.advice.summary.trim(),
      focusAreas: validated.advice.focusAreas ?? [],
      studyMediaReferences: validated.mediaReferences,
      sourceExportId: validated.advice.sourceExportId ?? null,
      modifiedAt: now,
    };
    mutations.push({
      entityId: `${moduleKey}:${id}`,
      module: moduleKey,
      entityType: 'learning-ai-advice',
      schemaVersion: 1,
      operation: 'create',
      record: record as unknown as JsonValue,
      pendingSync: pending(id, 'learning-ai-advice', record),
    });
  }
  const events = await mutateEntitiesAtomically(mutations, options);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('zeustek-records-updated'));
    void flushDiveChanges();
  }
  return { ...validated, eventIds: events.map((event) => event.eventId) };
}
