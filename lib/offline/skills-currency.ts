import {
  listRecords,
  removeRecord,
  saveRecord,
  type DiveTripRecord,
  type Stored,
} from './dive-planning';
import {
  resolveCanonicalSkillReference,
  skillRecordKey,
  listCanonicalSkills,
  type CanonicalSkillRecord,
  type SkillEvidenceRecord,
} from './dive-context';

export type SkillCurrencyStatus =
  | 'current'
  | 'due-soon'
  | 'needs-practice'
  | 'not-assessed';

export interface CurrencyPolicyRecord {
  skillKey: string;
  recommendedIntervalDays: number | null;
  dueSoonDays: number | null;
  qualifyingAssessmentValues: string[];
  enabled: boolean;
  notes?: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface CurrencyPolicyInput {
  entityId?: string;
  skillKey: string;
  recommendedIntervalDays: number | null;
  dueSoonDays: number | null;
  qualifyingAssessmentValues?: string[];
  enabled: boolean;
  notes?: string | null;
}

export interface SkillCurrencyProjection {
  skillKey: string;
  status: SkillCurrencyStatus;
  latestEvidence: SkillEvidenceRecord | null;
  latestEvidenceId: string | null;
  assessedAt: string | null;
  dueAt: string | null;
  daysRemaining: number | null;
  policyEnabled: boolean;
  reason: string;
  evaluatorVerified: boolean;
}

export const listCurrencyPolicies = () =>
  listRecords<CurrencyPolicyRecord>('currency-policy');
export const deleteCurrencyPolicy = removeRecord;

const normal = (value: string) =>
  value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-GB')
    .replace(/\s+/g, ' ');
const unique = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

export async function saveCurrencyPolicy(input: CurrencyPolicyInput) {
  if (!input.skillKey.trim())
    throw new Error('Choose a Skill for this currency policy.');
  const skill = resolveCanonicalSkillReference(
    input.skillKey.trim(),
    await listCanonicalSkills(),
  );
  if (!skill)
    throw new Error(
      'Unknown / unavailable Skill. Review the reference before saving.',
    );
  const key = skillRecordKey(skill);
  const existing = (await listCurrencyPolicies()).filter((policy) =>
    resolveCanonicalSkillReference(policy.skillKey, [skill]),
  );
  if (
    input.entityId &&
    !existing.some((policy) => policy.entityId === input.entityId)
  )
    throw new Error(
      'This policy reference is no longer available. Reopen the Skill.',
    );
  if (existing.length > 1)
    throw new Error(
      'Multiple policies reference this Skill. Review them before editing.',
    );
  if (
    input.recommendedIntervalDays != null &&
    (!Number.isInteger(input.recommendedIntervalDays) ||
      input.recommendedIntervalDays < 1 ||
      input.recommendedIntervalDays > 3650)
  )
    throw new Error('Recommended interval must be between 1 and 3650 days.');
  if (
    input.dueSoonDays != null &&
    (!Number.isInteger(input.dueSoonDays) ||
      input.dueSoonDays < 0 ||
      input.dueSoonDays > 3650)
  )
    throw new Error('Due-soon window must be between 0 and 3650 days.');
  if (
    input.recommendedIntervalDays != null &&
    input.dueSoonDays != null &&
    input.dueSoonDays > input.recommendedIntervalDays
  )
    throw new Error(
      'Due-soon window cannot be longer than the practice interval.',
    );
  return saveRecord('currency-policy', {
    ...input,
    ...(existing[0] ? { entityId: existing[0].entityId } : {}),
    skillKey: key,
    qualifyingAssessmentValues: unique(input.qualifyingAssessmentValues ?? []),
    notes: input.notes?.trim() || '',
  });
}

function addDays(value: string, days: number) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function wholeDaysBetween(left: Date, right: Date) {
  return Math.ceil((right.getTime() - left.getTime()) / 86_400_000);
}

export function evidenceQualifiesForPolicy(
  evidence: SkillEvidenceRecord,
  policy: CurrencyPolicyRecord | null | undefined,
) {
  if (!policy?.enabled) return false;
  if (
    !evidence.performedAt ||
    !Number.isFinite(Date.parse(evidence.performedAt))
  )
    return false;
  const accepted = policy.qualifyingAssessmentValues ?? [];
  if (!accepted.length) return true;
  return accepted.map(normal).includes(normal(evidence.assessment ?? ''));
}

export function evidenceForCanonicalSkill(
  skill: CanonicalSkillRecord,
  evidence: SkillEvidenceRecord[],
) {
  const aliases = new Set(
    [skill.entityId, skill.skillKey, skill.key, skillRecordKey(skill)].filter(
      (value): value is string => Boolean(value),
    ),
  );
  return evidence.filter((item) => aliases.has(item.skillKey));
}

/** Derived advisory projection only. Never persist the returned status as canonical truth. */
export function projectSkillCurrency(
  skill: CanonicalSkillRecord,
  evidence: SkillEvidenceRecord[],
  policy: CurrencyPolicyRecord | null | undefined,
  asOf = new Date(),
): SkillCurrencyProjection {
  const skillEvidence = evidenceForCanonicalSkill(skill, evidence)
    .filter(
      (item) =>
        item.performedAt && Date.parse(item.performedAt) <= asOf.getTime(),
    )
    .sort((a, b) => Date.parse(b.performedAt!) - Date.parse(a.performedAt!));
  const latestAny = skillEvidence[0] ?? null;
  if (!policy?.enabled) {
    return {
      skillKey: skillRecordKey(skill),
      status: 'not-assessed',
      latestEvidence: latestAny,
      latestEvidenceId: latestAny?.entityId ?? null,
      assessedAt: latestAny?.performedAt ?? null,
      dueAt: null,
      daysRemaining: null,
      policyEnabled: false,
      reason: policy
        ? 'Currency policy is disabled.'
        : 'No currency policy has been set for this Skill.',
      evaluatorVerified: Boolean(latestAny?.evaluatorPersonId),
    };
  }
  const qualifying = skillEvidence.filter((item) =>
    evidenceQualifiesForPolicy(item, policy),
  );
  const latest = qualifying[0] ?? null;
  if (!latest?.performedAt) {
    return {
      skillKey: skillRecordKey(skill),
      status: 'not-assessed',
      latestEvidence: latestAny,
      latestEvidenceId: latestAny?.entityId ?? null,
      assessedAt: latestAny?.performedAt ?? null,
      dueAt: null,
      daysRemaining: null,
      policyEnabled: true,
      reason: policy.qualifyingAssessmentValues?.length
        ? 'No evidence currently meets this policy’s qualifying assessment values.'
        : 'No qualifying practice evidence has been recorded.',
      evaluatorVerified: Boolean(latestAny?.evaluatorPersonId),
    };
  }
  if (policy.recommendedIntervalDays == null) {
    return {
      skillKey: skillRecordKey(skill),
      status: 'current',
      latestEvidence: latest,
      latestEvidenceId: latest.entityId,
      assessedAt: latest.performedAt,
      dueAt: null,
      daysRemaining: null,
      policyEnabled: true,
      reason:
        'Qualifying evidence exists; this policy has no recency interval.',
      evaluatorVerified: Boolean(latest.evaluatorPersonId),
    };
  }
  const dueAt = addDays(latest.performedAt, policy.recommendedIntervalDays);
  if (!dueAt) {
    return {
      skillKey: skillRecordKey(skill),
      status: 'not-assessed',
      latestEvidence: latest,
      latestEvidenceId: latest.entityId,
      assessedAt: latest.performedAt,
      dueAt: null,
      daysRemaining: null,
      policyEnabled: true,
      reason: 'The latest evidence date could not be evaluated.',
      evaluatorVerified: Boolean(latest.evaluatorPersonId),
    };
  }
  const dueDate = new Date(dueAt);
  const daysRemaining = wholeDaysBetween(asOf, dueDate);
  if (dueDate.getTime() < asOf.getTime())
    return {
      skillKey: skillRecordKey(skill),
      status: 'needs-practice',
      latestEvidence: latest,
      latestEvidenceId: latest.entityId,
      assessedAt: latest.performedAt,
      dueAt,
      daysRemaining,
      policyEnabled: true,
      reason: `Practice interval expired ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) === 1 ? '' : 's'} ago.`,
      evaluatorVerified: Boolean(latest.evaluatorPersonId),
    };
  const dueSoonDays = policy.dueSoonDays ?? 0;
  if (daysRemaining <= dueSoonDays)
    return {
      skillKey: skillRecordKey(skill),
      status: 'due-soon',
      latestEvidence: latest,
      latestEvidenceId: latest.entityId,
      assessedAt: latest.performedAt,
      dueAt,
      daysRemaining,
      policyEnabled: true,
      reason: `Practice is due in ${Math.max(0, daysRemaining)} day${daysRemaining === 1 ? '' : 's'}.`,
      evaluatorVerified: Boolean(latest.evaluatorPersonId),
    };
  return {
    skillKey: skillRecordKey(skill),
    status: 'current',
    latestEvidence: latest,
    latestEvidenceId: latest.entityId,
    assessedAt: latest.performedAt,
    dueAt,
    daysRemaining,
    policyEnabled: true,
    reason: `Practice is current for ${daysRemaining} more day${daysRemaining === 1 ? '' : 's'}.`,
    evaluatorVerified: Boolean(latest.evaluatorPersonId),
  };
}

export function buildSkillsCurrencyProjection(
  skills: CanonicalSkillRecord[],
  evidence: SkillEvidenceRecord[],
  policies: Array<Stored<CurrencyPolicyRecord>>,
  asOf = new Date(),
) {
  const bySkill = new Map<string, Stored<CurrencyPolicyRecord>>();
  for (const policy of policies) bySkill.set(policy.skillKey, policy);
  return skills.map((skill) => {
    const key = skillRecordKey(skill);
    const direct =
      bySkill.get(key) ??
      policies.find((policy) =>
        resolveCanonicalSkillReference(policy.skillKey, [skill]),
      );
    return {
      skill,
      policy: direct ?? null,
      projection: projectSkillCurrency(skill, evidence, direct, asOf),
    };
  });
}

export function currencySummary(projections: SkillCurrencyProjection[]) {
  return projections.reduce(
    (summary, projection) => {
      summary[projection.status] += 1;
      if (projection.evaluatorVerified) summary.verified += 1;
      return summary;
    },
    {
      current: 0,
      'due-soon': 0,
      'needs-practice': 0,
      'not-assessed': 0,
      verified: 0,
    },
  );
}

const statusPriority: Record<SkillCurrencyStatus, number> = {
  'needs-practice': 0,
  'due-soon': 1,
  'not-assessed': 2,
  current: 3,
};
export function recommendedNextPractice<
  T extends { projection: SkillCurrencyProjection },
>(rows: T[], limit = 6) {
  return [...rows]
    .sort(
      (a, b) =>
        statusPriority[a.projection.status] -
          statusPriority[b.projection.status] ||
        (a.projection.daysRemaining ?? Number.MAX_SAFE_INTEGER) -
          (b.projection.daysRemaining ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, limit);
}

export interface PlannedSkillPractice {
  planId: string;
  planName: string;
  startsOn: string;
  skillKeys: string[];
}

/** Compatibility hook for T10/current Plan extensions. Plans without plannedSkillKeys simply contribute nothing. */
export function plannedSkillPractice(
  plans: Array<Stored<DiveTripRecord & { plannedSkillKeys?: string[] }>>,
  asOf = new Date(),
) {
  const today = asOf.toISOString().slice(0, 10);
  return plans
    .filter(
      (plan) =>
        Array.isArray(plan.plannedSkillKeys) &&
        plan.plannedSkillKeys.length > 0 &&
        (!plan.startDate || plan.startDate >= today),
    )
    .map((plan) => ({
      planId: plan.entityId,
      planName: plan.name,
      startsOn: plan.startDate,
      skillKeys: [...new Set(plan.plannedSkillKeys ?? [])],
    }))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}
