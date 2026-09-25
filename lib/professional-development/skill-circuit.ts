/** A cited, captured progress rubric. Instructor confirmation and course sign-off are separate. */
export interface SkillCircuitItem {
  key: string;
  label: string;
  underwater: boolean;
  canonicalSkillId: string | null;
}
export interface SkillCircuitRubric {
  id: string;
  source: string;
  confirmation: 'pending-instructor';
  totalTarget: 82;
  individualMinimum: 3;
  items: SkillCircuitItem[];
}
export interface SkillCircuitAttempt {
  id: string;
  itemKey: string;
  rubricId: string;
  occurredAt: string;
  mode: 'practice' | 'formal';
  evaluatorPersonId: string | null;
  evaluatorScore: number;
  neutralBuoyancyObserved?: boolean | undefined;
  referenceIssues?: string[] | undefined;
}
export interface SkillCircuitAttemptResult {
  id: string;
  score: number | null;
  reasons: string[];
  formalQualifying: boolean;
  attempt: SkillCircuitAttempt;
}

const labels = [
  'Equipment assembly, adjustment and disassembly',
  'Predive safety check (BWRAF)',
  'Deep-water entry',
  'Surface buoyancy check',
  'Snorkel and regulator exchange both ways',
  'Five-point descent with buoyancy stop',
  'Regulator recovery and clearing',
  'Mask removal, replacement and clearing',
  'Air depletion and stationary alternate source',
  'Assisted ascent on alternate air source',
  'Breathing from a free-flowing regulator',
  'Neutral buoyancy with low-pressure inflation',
  'Five-point ascent',
  'Controlled emergency swimming ascent',
  'Oral BCD inflation and 60-second hover',
  'Underwater swim without a mask',
  'Underwater weight-system removal and replacement',
  'Underwater scuba-unit removal and replacement',
  'Surface scuba-unit removal and replacement',
  'Surface weight-system removal and replacement',
  'Head-first surface dive with snorkel out of mouth',
  'Low-pressure inflator disconnection',
  'Re-secure a loose cylinder band',
  'Emergency weight drop',
];

/** PADI's January 2026 public list; no claim that this supersedes a current instructor manual. */
export const PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026: SkillCircuitRubric = {
  id: 'padi-dm-24-skill-public-2026-progress-v1',
  source: 'PADI, What’s Covered in the PADI Divemaster Course?, 14 January 2026 (https://blog.padi.com/divemaster-course-parts/); cross-checked against Instructor Manual 2021 pp. 120–122; current instructor confirmation pending',
  confirmation: 'pending-instructor', totalTarget: 82, individualMinimum: 3,
  items: labels.map((label, index) => ({
    key: `skill-${String(index + 1).padStart(2, '0')}`,
    label,
    underwater: (index >= 5 && index <= 17) || index === 20,
    canonicalSkillId: null,
  })),
};

export function isSkillCircuitRubric(value: unknown): value is SkillCircuitRubric {
  if (!value || typeof value !== 'object') return false;
  const rubric = value as Partial<SkillCircuitRubric>;
  if (typeof rubric.id !== 'string' || !rubric.id.trim() ||
      typeof rubric.source !== 'string' || !rubric.source.trim() ||
      rubric.confirmation !== 'pending-instructor' ||
      rubric.totalTarget !== 82 || rubric.individualMinimum !== 3 ||
      !Array.isArray(rubric.items) || rubric.items.length !== 24) return false;
  const keys = new Set<string>();
  for (const [index, item] of rubric.items.entries()) {
    if (!item || typeof item !== 'object' ||
        item.key !== `skill-${String(index + 1).padStart(2, '0')}` || keys.has(item.key) ||
        typeof item.label !== 'string' || !item.label.trim() ||
        typeof item.underwater !== 'boolean' ||
        !(item.canonicalSkillId === null ||
          (typeof item.canonicalSkillId === 'string' && Boolean(item.canonicalSkillId.trim())))) return false;
    keys.add(item.key);
  }
  return rubric.items.some(item => item.underwater);
}

export function scoreSkillCircuitAttempt(rubric: SkillCircuitRubric, attempt: SkillCircuitAttempt): SkillCircuitAttemptResult {
  const reasons: string[] = [];
  const item = rubric.items.find(entry => entry.key === attempt.itemKey);
  if (!isSkillCircuitRubric(rubric)) reasons.push('The captured circuit rubric is incomplete.');
  if (!item) reasons.push('The skill is not in the captured circuit.');
  if (attempt.rubricId !== rubric.id) reasons.push('The attempt belongs to another requirement version.');
  if (!Number.isFinite(Date.parse(attempt.occurredAt))) reasons.push('Record a valid date.');
  if (attempt.mode !== 'practice' && attempt.mode !== 'formal') reasons.push('Choose practice or formal assessment.');
  if (!Number.isInteger(attempt.evaluatorScore) || attempt.evaluatorScore < 1 || attempt.evaluatorScore > 5)
    reasons.push('Record an evaluator score from 1 to 5.');
  reasons.push(...(attempt.referenceIssues ?? []));
  const score = reasons.length ? null : attempt.evaluatorScore;
  if (attempt.mode === 'formal' && !attempt.evaluatorPersonId) reasons.push('Formal assessment needs a named evaluator.');
  if (score === 5 && (item?.key === 'skill-07' || item?.key === 'skill-08') && attempt.neutralBuoyancyObserved !== true)
    reasons.push('Confirm neutral buoyancy for this 5-point demonstration.');
  return { id: attempt.id, score, reasons,
    formalQualifying: score !== null && attempt.mode === 'formal' && reasons.length === 0,
    attempt };
}

export function projectSkillCircuit(rubric: SkillCircuitRubric, attempts: SkillCircuitAttempt[]) {
  const items = rubric.items.map(item => {
    const rows = attempts.filter(attempt => attempt.itemKey === item.key)
      .map(attempt => scoreSkillCircuitAttempt(rubric, attempt))
      .sort((a, b) => b.attempt.occurredAt.localeCompare(a.attempt.occurredAt) || b.id.localeCompare(a.id));
    return { ...item, attempts: rows, latest: rows[0] ?? null,
      formal: rows.find(row => row.formalQualifying) ?? null,
      best: [...rows].filter(row => row.score !== null && row.reasons.length === 0)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null };
  });
  const formal = items.map(item => item.formal).filter((row): row is SkillCircuitAttemptResult => Boolean(row));
  const total = formal.reduce((sum, row) => sum + row.score!, 0);
  const complete = formal.length === 24;
  const individualMinimumMet = complete && formal.every(row => row.score! >= rubric.individualMinimum);
  const underwaterFive = items.some(item => item.underwater && item.formal?.score === 5);
  const progressTargetMet = complete && individualMinimumMet && total >= rubric.totalTarget && underwaterFive;
  return { rubricId: rubric.id, items, total, maximum: 120, target: rubric.totalTarget, complete,
    individualMinimumMet, underwaterFive, progressTargetMet, agencyMinimumConfirmed: false,
    contributingIds: formal.map(row => row.id),
    pointsToTarget: Math.max(0, rubric.totalTarget - total),
    pointsAboveTarget: complete ? Math.max(0, total - rubric.totalTarget) : 0 };
}
