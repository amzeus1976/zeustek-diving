/** A captured progress rubric, never an automatic PADI course-pass decision. */
export type WaterExerciseKey = 'swim-400' | 'tread-15' | 'snorkel-800' | 'tow-100' | 'equipment-exchange';
export type WaterAttemptMode = 'practice' | 'formal';
export interface WaterSkillsRubric {
  id: string;
  source: string;
  unit: 'metres';
  combinedTarget: number;
  selection: 'latest-formal';
  timedBands: Record<'swim-400' | 'snorkel-800' | 'tow-100', [number, number, number, number]>;
}

/** Template to copy into an explicitly captured version; not a current-standards claim. */
export const METRIC_WATER_SKILLS_RUBRIC_2021: WaterSkillsRubric = {
  id: 'padi-dm-water-skills-metric-2021-progress-v1',
  source: 'PADI Instructor Manual 2021, Divemaster Course, Waterskills Development, pp. 116–119; progress only',
  unit: 'metres', combinedTarget: 15, selection: 'latest-formal',
  timedBands: { 'swim-400': [390, 520, 660, 780], 'snorkel-800': [840, 990, 1110, 1260], 'tow-100': [130, 195, 260, 330] },
};

export const WATER_EXERCISES: Array<{ key: WaterExerciseKey; label: string }> = [
  { key: 'swim-400', label: '400 m swim' },
  { key: 'tread-15', label: '15-minute tread / float' },
  { key: 'snorkel-800', label: '800 m snorkel swim' },
  { key: 'tow-100', label: '100 m inert diver tow' },
  { key: 'equipment-exchange', label: 'Equipment exchange' },
];

export function isWaterSkillsRubric(value: unknown): value is WaterSkillsRubric {
  if (!value || typeof value !== 'object') return false;
  const rubric = value as Partial<WaterSkillsRubric>;
  if (typeof rubric.id !== 'string' || !rubric.id.trim() || typeof rubric.source !== 'string' || !rubric.source.trim() ||
      rubric.unit !== 'metres' || rubric.selection !== 'latest-formal' ||
      typeof rubric.combinedTarget !== 'number' || rubric.combinedTarget < 1 || rubric.combinedTarget > 25) return false;
  return (['swim-400', 'snorkel-800', 'tow-100'] as const).every(key => {
    const bands = rubric.timedBands?.[key];
    return Array.isArray(bands) && bands.length === 4 && bands.every((seconds, index) =>
      typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 && (index === 0 || seconds > bands[index - 1]!));
  });
}

export interface WaterSkillsAttempt {
  id: string;
  exerciseKey: WaterExerciseKey;
  occurredAt: string;
  mode: WaterAttemptMode;
  evaluatorPersonId: string | null;
  rubricId: string;
  distanceM?: number | undefined;
  durationSec?: number | undefined;
  nonstop?: boolean | undefined;
  aidsUsed?: boolean | undefined;
  maskSnorkelFins?: boolean | undefined;
  flotationAidUsed?: boolean | undefined;
  armsUsed?: boolean | undefined;
  bothDiversFullScuba?: boolean | undefined;
  assistanceReceived?: boolean | undefined;
  completed?: boolean | undefined;
  handsOutFinalTwo?: boolean | undefined;
  supportCount?: number | undefined;
  evaluatorScore?: number | undefined;
  confinedWater?: boolean | undefined;
  tooDeepToStand?: boolean | undefined;
  equipmentComplete?: boolean | undefined;
  sharedRegulator?: boolean | undefined;
  alternateAirSource?: boolean | undefined;
  ownMaskRemoval?: boolean | undefined;
  neutralBuoyancy?: boolean | undefined;
  surfaceContacts?: number | undefined;
  bottomContact?: boolean | undefined;
}

export interface WaterAttemptResult {
  id: string;
  score: number | null;
  reasons: string[];
  warnings: string[];
  formalQualifying: boolean;
  attempt: WaterSkillsAttempt;
}

const validDuration = (seconds: number | undefined) => typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0;
const timedScore = (seconds: number, bands: [number, number, number, number]) =>
  seconds < bands[0] ? 5 : seconds < bands[1] ? 4 : seconds < bands[2] ? 3 : seconds <= bands[3] ? 2 : 1;

export function scoreWaterSkillsAttempt(rubric: WaterSkillsRubric, attempt: WaterSkillsAttempt): WaterAttemptResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score: number | null = null;
  if (attempt.rubricId !== rubric.id) reasons.push('The attempt belongs to a different captured rubric.');
  if (!WATER_EXERCISES.some(item => item.key === attempt.exerciseKey)) reasons.push('Unknown exercise.');
  if (attempt.mode !== 'formal' && attempt.mode !== 'practice') reasons.push('Choose formal or practice.');
  if (!Number.isFinite(Date.parse(attempt.occurredAt))) reasons.push('Record a valid date.');
  if (attempt.mode === 'formal' && !attempt.evaluatorPersonId) reasons.push('Formal assessment needs a named evaluator.');
  if (!reasons.length) {
    if (attempt.exerciseKey === 'swim-400' || attempt.exerciseKey === 'snorkel-800' || attempt.exerciseKey === 'tow-100') {
      const requiredDistance = attempt.exerciseKey === 'swim-400' ? 400 : attempt.exerciseKey === 'snorkel-800' ? 800 : 100;
      if (attempt.distanceM !== requiredDistance) reasons.push(`Record the full ${requiredDistance} m distance.`);
      if (!validDuration(attempt.durationSec)) reasons.push('Record a positive timed duration.');
      if (attempt.nonstop !== true) reasons.push('A stopped or unconfirmed attempt is incomplete.');
      if (attempt.exerciseKey === 'swim-400' && attempt.aidsUsed !== false) reasons.push('Confirm no swimming aids.');
      if (attempt.exerciseKey === 'snorkel-800' && (attempt.maskSnorkelFins !== true || attempt.flotationAidUsed !== false || attempt.armsUsed !== false)) reasons.push('Confirm mask, snorkel and fins only, without flotation or arm propulsion.');
      if (attempt.exerciseKey === 'tow-100' && (attempt.bothDiversFullScuba !== true || attempt.assistanceReceived !== false)) reasons.push('Confirm both divers in full scuba and no assistance.');
      if (!reasons.length) score = timedScore(attempt.durationSec!, rubric.timedBands[attempt.exerciseKey]);
    } else if (attempt.exerciseKey === 'tread-15') {
      if (!validDuration(attempt.durationSec) || attempt.durationSec! < 900 || attempt.completed !== true) reasons.push('Complete the full 15 minutes.');
      if (attempt.aidsUsed !== false) reasons.push('Confirm no aids.');
      if (!Number.isInteger(attempt.supportCount) || attempt.supportCount! < 0) reasons.push('Record the number of side/bottom supports.');
      if (typeof attempt.handsOutFinalTwo !== 'boolean') reasons.push('Record the final-two-minute hands observation.');
      if (!reasons.length && attempt.supportCount! > 2) reasons.push('More than two supports is incomplete.');
      if (!reasons.length) score = attempt.supportCount! > 0 ? 1 : attempt.handsOutFinalTwo ? 5 : 3;
    } else if (attempt.exerciseKey === 'equipment-exchange') {
      if (!Number.isInteger(attempt.evaluatorScore) || attempt.evaluatorScore! < 1 || attempt.evaluatorScore! > 5) reasons.push('Record an evaluator-selected score from 1 to 5.');
      if (!attempt.evaluatorPersonId) reasons.push('Equipment Exchange requires a named evaluator.');
      if ([attempt.confinedWater, attempt.tooDeepToStand, attempt.equipmentComplete, attempt.sharedRegulator,
        attempt.alternateAirSource, attempt.ownMaskRemoval, attempt.neutralBuoyancy, attempt.completed].some(value => typeof value !== 'boolean') ||
        !Number.isInteger(attempt.surfaceContacts) || attempt.surfaceContacts! < 0 || typeof attempt.bottomContact !== 'boolean')
        reasons.push('Record the required procedure and contact observations.');
      if (!reasons.length) {
        score = attempt.evaluatorScore!;
        if (score >= 4 && (attempt.surfaceContacts! > 0 || attempt.bottomContact)) warnings.push('A score of 4 or 5 conflicts with recorded surface/bottom contact; review with the evaluator.');
        if (score >= 3 && (!attempt.completed || !attempt.neutralBuoyancy)) warnings.push('A score of 3 or more conflicts with completion or neutral-buoyancy observations; review with the evaluator.');
        if (!attempt.confinedWater || !attempt.tooDeepToStand ||
            (score >= 2 && (!attempt.equipmentComplete || !attempt.completed)) ||
            (score >= 3 && (!attempt.sharedRegulator || !attempt.alternateAirSource || !attempt.ownMaskRemoval)))
          warnings.push('Recorded procedure conflicts with this score; review with the evaluator.');
      }
    }
  }
  return { id: attempt.id, score, reasons, warnings, formalQualifying: score !== null && attempt.mode === 'formal' && Boolean(attempt.evaluatorPersonId) && warnings.length === 0, attempt };
}

export function projectWaterSkills(rubric: WaterSkillsRubric, attempts: WaterSkillsAttempt[]) {
  const exercises = WATER_EXERCISES.map(exercise => {
    const rows = attempts.filter(attempt => attempt.exerciseKey === exercise.key)
      .map(attempt => scoreWaterSkillsAttempt(rubric, attempt))
      .sort((a, b) => b.attempt.occurredAt.localeCompare(a.attempt.occurredAt) || b.id.localeCompare(a.id));
    return { ...exercise, attempts: rows, latest: rows[0] ?? null,
      formal: rows.find(row => row.formalQualifying) ?? null,
      best: [...rows].filter(row => row.score !== null && row.warnings.length === 0).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null };
  });
  const contributing = exercises.map(item => item.formal).filter((item): item is WaterAttemptResult => Boolean(item));
  const total = contributing.reduce((sum, item) => sum + item.score!, 0);
  const complete = contributing.length === WATER_EXERCISES.length;
  const status = attempts.length === 0 ? 'not_started'
    : complete && total > rubric.combinedTarget ? 'above_minimum'
    : complete && total === rubric.combinedTarget ? 'minimum_met'
    : 'in_progress';
  return { rubricId: rubric.id, exercises, total, maximum: 25, target: rubric.combinedTarget,
    status,
    incompleteAttemptCount: exercises.reduce((sum, item) => sum + item.attempts.filter(attempt => attempt.score === null).length, 0),
    needsEvaluatorCount: exercises.reduce((sum, item) => sum + item.attempts.filter(attempt => attempt.attempt.mode === 'formal' && !attempt.attempt.evaluatorPersonId).length, 0),
    complete, minimumProgressMet: complete && total >= rubric.combinedTarget,
    pointsToTarget: Math.max(0, rubric.combinedTarget - total),
    pointsAboveTarget: complete ? Math.max(0, total - rubric.combinedTarget) : 0,
    percentOfMaximum: Math.round(total / 25 * 100),
    contributingIds: contributing.map(item => item.id),
  };
}
