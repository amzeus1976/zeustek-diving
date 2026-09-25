import { currentDiveAccount } from './dive-store';
import { recordIdentity } from '../record-identity';
import {
  listRecords,
  removeRecord,
  saveRecord,
  type CertificationRecord,
  type DiveSiteRecord,
  type PersonRecord,
  type Stored,
} from './dive-planning';
import type { DiveRecord } from './dives';
import { saveReferenceRequirementSet } from './technical-workspace';
import { isWaterSkillsRubric, projectWaterSkills, WATER_EXERCISES, type WaterSkillsAttempt, type WaterSkillsRubric } from '../professional-development/water-skills';
import {
  SKILL_COMPETENCE_LEVELS,
  listCanonicalSkills,
  resolveCanonicalSkillReference,
  skillRecordKey,
  type CanonicalSkillRecord,
  type SkillCompetenceLevel,
  type SkillEvidenceRecord,
} from './dive-context';

export type ProfessionalPathwayStatus =
  | 'considering'
  | 'enrolled'
  | 'in_progress'
  | 'paused'
  | 'completed';
export type ProfessionalRequirementState =
  | 'satisfied'
  | 'not_satisfied'
  | 'unknown'
  | 'manual_review';
export type ProfessionalRequirementKind =
  | 'certification'
  | 'count'
  | 'recency'
  | 'assessment'
  | 'document'
  | 'manual';
export type ProfessionalEvidenceType =
  | 'assessment-result'
  | 'exam-result'
  | 'knowledge-review'
  | 'stamina'
  | 'skills-circuit'
  | 'workshop'
  | 'assisting'
  | 'guided-dive'
  | 'briefing'
  | 'site-map'
  | 'eap'
  | 'mentor-feedback'
  | 'requirement-link'
  | 'other';

export interface ProfessionalRequirementDefinition {
  key: string;
  label: string;
  kind: ProfessionalRequirementKind;
  rule: Record<string, unknown>;
  notes?: string;
}

export interface ProfessionalReferenceRequirementSetRecord {
  agency: string;
  pathwayKey: string;
  pathwayLabel?: string;
  versionLabel: string;
  effectiveFrom: string | null;
  effectiveTo?: string | null;
  sourceCitation: string | null;
  requirements: ProfessionalRequirementDefinition[];
  capturedAt: string;
  createdAt: string;
  modifiedAt: string;
}

export interface ProfessionalPathwayRecord {
  userId: string;
  agency: string;
  pathwayKey: string;
  displayName: string;
  requirementSetId: string | null;
  status: ProfessionalPathwayStatus;
  startedAt: string | null;
  mentorPersonIds: string[];
  notes: string | null;
  createdAt: string;
  modifiedAt: string;
}

export interface ProfessionalEvidenceRecord {
  pathwayId: string;
  evidenceType: string;
  occurredAt: string;
  relatedDiveId: string | null;
  relatedCertificationId?: string | null;
  /** Legacy/single-link convenience retained for compatibility. */
  relatedSkillEvidenceId: string | null;
  /** Multi-link form used by skills circuits while preserving the single legacy field above. */
  relatedSkillEvidenceIds?: string[];
  relatedSiteId: string | null;
  evaluatorPersonId: string | null;
  relatedPersonIds?: string[];
  attachmentIds: string[];
  requirementSetId?: string | null;
  requirementKey?: string | null;
  payload: Record<string, unknown>;
  notes: string | null;
  createdAt: string;
  modifiedAt: string;
}

export type ProfessionalEvidenceFieldKind =
  | 'text'
  | 'number'
  | 'textarea'
  | 'boolean'
  | 'select';
export interface ProfessionalEvidenceFieldDefinition {
  key: string;
  label: string;
  kind: ProfessionalEvidenceFieldKind;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  step?: number;
  suffix?: string;
}

/** Captured assessment identifiers, not inferred Skill keys or agency-wide completion claims. */
export const PROFESSIONAL_ASSESSMENT_ACTIVITIES: Array<{ code: string; label: string; evidenceType: ProfessionalEvidenceType }> = [
  { code: 'diver-rescue', label: 'Diver rescue assessment', evidenceType: 'assessment-result' },
  { code: 'dive-site-setup', label: 'Dive-site setup / predive management', evidenceType: 'assessment-result' },
  { code: 'dive-briefing', label: 'Dive briefing', evidenceType: 'briefing' },
  { code: 'search-recovery', label: 'Search and Recovery scenario', evidenceType: 'assessment-result' },
  { code: 'deep-dive', label: 'Deep Dive scenario', evidenceType: 'assessment-result' },
  { code: 'discover-local-diving', label: 'Discover Local Diving workshop', evidenceType: 'workshop' },
  { code: 'reactivate', label: 'ReActivate workshop', evidenceType: 'workshop' },
  { code: 'advanced-snorkeler', label: 'Advanced Snorkeler supervision', evidenceType: 'workshop' },
  { code: 'dsd-confined', label: 'DSD confined-water workshop', evidenceType: 'workshop' },
  { code: 'dsd-open-water', label: 'DSD additional open-water workshop', evidenceType: 'workshop' },
  { code: 'open-water-assist', label: 'Assist Open Water course', evidenceType: 'assisting' },
  { code: 'continuing-education-assist', label: 'Assist continuing-education course', evidenceType: 'assisting' },
  { code: 'supervised-guiding', label: 'Supervised guiding', evidenceType: 'guided-dive' },
  { code: 'knowledge-review', label: 'Knowledge development / review', evidenceType: 'knowledge-review' },
  { code: 'dive-theory-exam', label: 'Dive Theory exam', evidenceType: 'exam-result' },
  { code: 'padi-standards-exam', label: 'PADI Standards exam', evidenceType: 'exam-result' },
  { code: 'professionalism-review', label: 'Professionalism mentor review', evidenceType: 'mentor-feedback' },
];

export function professionalAssessmentFields(evidenceType: string, exerciseKey?: string, structuredStamina = false): ProfessionalEvidenceFieldDefinition[] {
  if (evidenceType === 'stamina' && structuredStamina) {
    const common: ProfessionalEvidenceFieldDefinition[] = [
      { key: 'exerciseKey', label: 'Exercise', kind: 'select', options: WATER_EXERCISES.map(item => ({ value: item.key, label: item.label })) },
      { key: 'attemptMode', label: 'Attempt', kind: 'select', options: [{ value: 'practice', label: 'Practice' }, { value: 'formal', label: 'Formal evaluator assessment' }] },
      { key: 'conditions', label: 'Water conditions / pool', kind: 'text' },
    ];
    const bool = (key: string, label: string): ProfessionalEvidenceFieldDefinition => ({ key, label, kind: 'boolean' });
    if (exerciseKey === 'tread-15') return [...common,
      { key: 'durationSec', label: 'Duration', kind: 'number', min: 0, step: 1, suffix: 'sec' },
      bool('completed', 'Full 15 minutes completed'), bool('aidsUsed', 'Aids used'),
      bool('handsOutFinalTwo', 'Hands out throughout final two minutes'),
      { key: 'supportCount', label: 'Side/bottom support count', kind: 'number', min: 0, step: 1 }];
    if (exerciseKey === 'equipment-exchange') return [...common,
      { key: 'evaluatorScore', label: 'Evaluator-entered score', kind: 'number', min: 1, step: 1 },
      { key: 'observedPerformance', label: 'Evaluator observation of efficiency, anxiety and problem solving', kind: 'textarea' },
      bool('completed', 'Exchange completed'), bool('confinedWater', 'Confined water'), bool('tooDeepToStand', 'Too deep to stand'),
        bool('equipmentComplete', 'Required kit exchanged'), bool('sharedRegulator', 'Single second stage shared'),
        bool('alternateAirSource', 'Buddy alternate air source used during kit switch'), bool('ownMaskRemoval', 'Own masks removed/replaced'),
        bool('neutralBuoyancy', 'Neutral buoyancy maintained'), bool('bottomContact', 'Bottom contact'),
      { key: 'surfaceContacts', label: 'Surface contacts', kind: 'number', min: 0, step: 1 }];
    return [...common,
      { key: 'distanceM', label: 'Measured distance', kind: 'number', min: 0, step: 1, suffix: 'm' },
      { key: 'durationSec', label: 'Duration', kind: 'number', min: 0, step: 1, suffix: 'sec' },
      bool('nonstop', 'Completed nonstop'),
      ...(exerciseKey === 'swim-400' ? [bool('aidsUsed', 'Swimming aids used')] :
        exerciseKey === 'snorkel-800' ? [bool('maskSnorkelFins', 'Mask, snorkel and fins used'), bool('flotationAidUsed', 'Flotation aid used'), bool('armsUsed', 'Arms used for propulsion')] :
        exerciseKey === 'tow-100' ? [bool('bothDiversFullScuba', 'Both divers in full scuba'), bool('assistanceReceived', 'Assistance received'), { key: 'towMethod', label: 'Tow or push method', kind: 'text' as const }] : []),
    ];
  }
  const activityOptions = PROFESSIONAL_ASSESSMENT_ACTIVITIES
    .filter(item => item.evidenceType === evidenceType)
    .map(item => ({ value: item.code, label: item.label }));
  const existing = PROFESSIONAL_EVIDENCE_FIELDS[evidenceType as ProfessionalEvidenceType] ?? [];
  if (!activityOptions.length) return existing;
  return [
    ...existing.filter(field => field.key !== 'activityCode' && field.key !== 'result'),
    { key: 'activityCode', label: 'Assessed activity', kind: 'select', options: activityOptions },
    { key: 'result', label: 'Evaluator result', kind: 'select', options: [
      { value: 'passed', label: 'Passed' }, { value: 'not-passed', label: 'Not passed' },
      { value: 'incomplete', label: 'Incomplete' },
    ] },
  ];
}

/**
 * Presentation metadata only. These fields live inside the extensible evidence payload; they are
 * not hard-coded agency requirements and do not determine readiness unless a captured requirement
 * explicitly references the evidence record.
 */
export const PROFESSIONAL_EVIDENCE_FIELDS: Partial<
  Record<ProfessionalEvidenceType, ProfessionalEvidenceFieldDefinition[]>
> = {
  'assessment-result': [
    { key: 'activityCode', label: 'Assessment activity code', kind: 'text' },
    { key: 'result', label: 'Evaluator result', kind: 'select', options: [
      { value: 'passed', label: 'Passed' }, { value: 'not-passed', label: 'Not passed' },
      { value: 'incomplete', label: 'Incomplete' },
    ] },
  ],
  'exam-result': [
    { key: 'activityCode', label: 'Exam code', kind: 'text' },
    { key: 'result', label: 'Recorded result', kind: 'select', options: [
      { value: 'passed', label: 'Passed' }, { value: 'not-passed', label: 'Not passed' },
      { value: 'incomplete', label: 'Incomplete' },
    ] },
  ],
  'knowledge-review': [
    { key: 'activityCode', label: 'Review code', kind: 'text' },
    { key: 'result', label: 'Recorded result', kind: 'select', options: [
      { value: 'passed', label: 'Passed' }, { value: 'not-passed', label: 'Not passed' },
      { value: 'incomplete', label: 'Incomplete' },
    ] },
  ],
  stamina: [
    {
      key: 'activity',
      label: 'Watermanship activity',
      kind: 'select',
      options: [
        { value: 'swim', label: 'Swim' },
        { value: 'tread', label: 'Tread / float' },
        { value: 'tow', label: 'Tow' },
        { value: 'other', label: 'Other' },
      ],
    },
    {
      key: 'distanceM',
      label: 'Distance',
      kind: 'number',
      min: 0,
      step: 1,
      suffix: 'm',
    },
    {
      key: 'durationSec',
      label: 'Duration',
      kind: 'number',
      min: 0,
      step: 1,
      suffix: 'sec',
    },
    {
      key: 'conditions',
      label: 'Conditions',
      kind: 'text',
      placeholder: 'Pool, open water, exposure protection…',
    },
  ],
  'skills-circuit': [
    {
      key: 'circuitName',
      label: 'Circuit / assessment',
      kind: 'text',
      placeholder: 'Skills circuit name',
    },
    { key: 'score', label: 'Score', kind: 'number', min: 0, step: 0.1 },
    {
      key: 'maxScore',
      label: 'Maximum score',
      kind: 'number',
      min: 0,
      step: 0.1,
    },
    { key: 'outcome', label: 'Assessment outcome', kind: 'textarea' },
  ],
  workshop: [
    { key: 'topic', label: 'Workshop topic', kind: 'text' },
    {
      key: 'role',
      label: 'Role',
      kind: 'select',
      options: [
        { value: 'participant', label: 'Participant' },
        { value: 'assistant', label: 'Assistant' },
        { value: 'leader', label: 'Leader / facilitator' },
        { value: 'other', label: 'Other' },
      ],
    },
    { key: 'outcome', label: 'Outcome / learning', kind: 'textarea' },
  ],
  assisting: [
    { key: 'courseOrActivity', label: 'Course / activity', kind: 'text' },
    {
      key: 'role',
      label: 'Assisting role',
      kind: 'text',
      placeholder: 'Surface support, student support, demonstration…',
    },
    {
      key: 'participantCount',
      label: 'Participants supported',
      kind: 'number',
      min: 0,
      step: 1,
    },
  ],
  'guided-dive': [
    { key: 'objective', label: 'Dive objective', kind: 'text' },
    {
      key: 'participantCount',
      label: 'Divers guided',
      kind: 'number',
      min: 0,
      step: 1,
    },
    { key: 'briefingCompleted', label: 'Briefing completed', kind: 'boolean' },
    { key: 'debriefCompleted', label: 'Debrief completed', kind: 'boolean' },
  ],
  briefing: [
    { key: 'topic', label: 'Briefing topic', kind: 'text' },
    {
      key: 'audienceSize',
      label: 'Audience size',
      kind: 'number',
      min: 0,
      step: 1,
    },
    {
      key: 'durationMin',
      label: 'Duration',
      kind: 'number',
      min: 0,
      step: 1,
      suffix: 'min',
    },
    { key: 'outcome', label: 'Feedback / outcome', kind: 'textarea' },
  ],
  'site-map': [
    { key: 'mapTitle', label: 'Map / project title', kind: 'text' },
    {
      key: 'scale',
      label: 'Scale / method',
      kind: 'text',
      placeholder: 'Sketch, measured survey, route map…',
    },
    { key: 'coverage', label: 'Coverage / route', kind: 'textarea' },
  ],
  eap: [
    { key: 'scenario', label: 'Scenario / site', kind: 'text' },
    { key: 'reviewed', label: 'Reviewed / exercised', kind: 'boolean' },
    { key: 'outcome', label: 'Review notes / outcome', kind: 'textarea' },
  ],
  'mentor-feedback': [
    { key: 'focusArea', label: 'Feedback focus', kind: 'text' },
    { key: 'feedback', label: 'Mentor feedback', kind: 'textarea' },
    { key: 'actionPoints', label: 'Agreed action points', kind: 'textarea' },
  ],
};

export interface ProfessionalEvidenceReferenceIssue {
  evidenceId: string;
  field:
    | 'relatedDiveId'
    | 'relatedCertificationId'
    | 'relatedSkillEvidenceId'
    | 'relatedSkillEvidenceIds'
    | 'relatedSiteId'
    | 'evaluatorPersonId'
    | 'relatedPersonIds'
    | 'payload.sourceId';
  missingId: string;
}

export interface ProfessionalEvaluationContext {
  pathwayId?: string | undefined;
  dives: Array<DiveRecord & { entityId: string }>;
  certifications: Array<Stored<CertificationRecord>>;
  skills: CanonicalSkillRecord[];
  skillEvidence: SkillEvidenceRecord[];
  professionalEvidence: Array<Stored<ProfessionalEvidenceRecord>>;
  sites: Array<Stored<DiveSiteRecord>>;
  people: Array<Stored<PersonRecord>>;
  asOf?: Date;
}

export function professionalWaterSkillsProgress(
  rubric: WaterSkillsRubric,
  requirementSetId: string,
  requirementKey: string,
  context: ProfessionalEvaluationContext,
) {
  const asOf = context.asOf ?? new Date();
  const attempts: WaterSkillsAttempt[] = context.professionalEvidence
    .filter(item => (!context.pathwayId || item.pathwayId === context.pathwayId) &&
      item.evidenceType === 'stamina' && item.requirementSetId === requirementSetId &&
      item.requirementKey === requirementKey && Date.parse(item.occurredAt) <= asOf.getTime() &&
      WATER_EXERCISES.some(exercise => exercise.key === item.payload.exerciseKey) &&
      (!item.relatedDiveId || context.dives.some(dive => dive.entityId === item.relatedDiveId)) &&
      (!item.relatedSiteId || context.sites.some(site => site.entityId === item.relatedSiteId)))
    .map(item => ({
      id: item.entityId,
      exerciseKey: item.payload.exerciseKey as WaterSkillsAttempt['exerciseKey'],
      occurredAt: item.occurredAt,
      mode: item.payload.attemptMode as WaterSkillsAttempt['mode'],
      evaluatorPersonId: item.evaluatorPersonId && context.people.some(person => person.entityId === item.evaluatorPersonId) ? item.evaluatorPersonId : null,
      rubricId: item.payload.rubricId as string,
      distanceM: item.payload.distanceM as number | undefined,
      durationSec: item.payload.durationSec as number | undefined,
      nonstop: item.payload.nonstop as boolean | undefined,
      aidsUsed: item.payload.aidsUsed as boolean | undefined,
      maskSnorkelFins: item.payload.maskSnorkelFins as boolean | undefined,
      flotationAidUsed: item.payload.flotationAidUsed as boolean | undefined,
      armsUsed: item.payload.armsUsed as boolean | undefined,
      bothDiversFullScuba: item.payload.bothDiversFullScuba as boolean | undefined,
      assistanceReceived: item.payload.assistanceReceived as boolean | undefined,
      completed: item.payload.completed as boolean | undefined,
      handsOutFinalTwo: item.payload.handsOutFinalTwo as boolean | undefined,
      supportCount: item.payload.supportCount as number | undefined,
      evaluatorScore: item.payload.evaluatorScore as number | undefined,
      confinedWater: item.payload.confinedWater as boolean | undefined,
      tooDeepToStand: item.payload.tooDeepToStand as boolean | undefined,
      equipmentComplete: item.payload.equipmentComplete as boolean | undefined,
      sharedRegulator: item.payload.sharedRegulator as boolean | undefined,
      alternateAirSource: item.payload.alternateAirSource as boolean | undefined,
      ownMaskRemoval: item.payload.ownMaskRemoval as boolean | undefined,
      neutralBuoyancy: item.payload.neutralBuoyancy as boolean | undefined,
      surfaceContacts: item.payload.surfaceContacts as number | undefined,
      bottomContact: item.payload.bottomContact as boolean | undefined,
    }));
  return projectWaterSkills(rubric, attempts);
}

export interface ProfessionalEvidenceLink {
  kind:
    | 'dive'
    | 'certification'
    | 'skill-evidence'
    | 'professional-evidence'
    | 'site'
    | 'person';
  id: string;
  label: string;
}

export interface EvaluatedProfessionalRequirement {
  requirement: ProfessionalRequirementDefinition;
  state: ProfessionalRequirementState;
  detail: string;
  evidence: ProfessionalEvidenceLink[];
}

export interface ProfessionalReadiness {
  state: ProfessionalRequirementState;
  percent: number;
  satisfied: number;
  notSatisfied: number;
  unknown: number;
  manualReview: number;
  total: number;
  requirements: EvaluatedProfessionalRequirement[];
}

export const PROFESSIONAL_EVIDENCE_CATEGORIES: Array<{
  type: ProfessionalEvidenceType;
  label: string;
  description: string;
}> = [
  { type: 'assessment-result', label: 'Assessed scenario', description: 'Requirement-specific, evaluator-attested scenario result.' },
  { type: 'exam-result', label: 'Exam result', description: 'Recorded examination result tied to a captured requirement.' },
  { type: 'knowledge-review', label: 'Knowledge review', description: 'Evaluator-backed knowledge review with its captured source.' },
  {
    type: 'stamina',
    label: 'Water skills & stamina',
    description:
      'Timed swims, tread water and other recorded watermanship evidence.',
  },
  {
    type: 'skills-circuit',
    label: 'Dive skills circuit',
    description:
      'Assessed practical skills and linked canonical Skill Evidence.',
  },
  {
    type: 'workshop',
    label: 'Workshops',
    description:
      'Briefing, rescue, search, mapping and other supervised workshop evidence.',
  },
  {
    type: 'assisting',
    label: 'Assisting log',
    description:
      'Assists linked to the actual Dive or training event where possible.',
  },
  {
    type: 'guided-dive',
    label: 'Guided dives',
    description: 'Leadership and guiding experience linked to canonical Dives.',
  },
  {
    type: 'briefing',
    label: 'Briefings library',
    description: 'Briefing practice and supporting files or templates.',
  },
  {
    type: 'site-map',
    label: 'Dive site map projects',
    description:
      'Site-map projects linked to canonical Sites and evidence files.',
  },
  {
    type: 'eap',
    label: 'Emergency Assistance Plans',
    description: 'EAP preparation, scenario practice and supporting documents.',
  },
  {
    type: 'mentor-feedback',
    label: 'Mentor feedback',
    description: 'Evaluator feedback linked to a saved Person.',
  },
  {
    type: 'requirement-link',
    label: 'Requirement-specific links',
    description:
      'Stable links to existing evidence and its captured requirement version.',
  },
  {
    type: 'other',
    label: 'Other experience',
    description: 'Additional professional experience and supporting evidence.',
  },
];

export const listProfessionalPathways = () =>
  listRecords<ProfessionalPathwayRecord>('professional-pathway');
export const listProfessionalEvidence = () =>
  listRecords<ProfessionalEvidenceRecord>('professional-evidence');
export const listProfessionalRequirementSets = () =>
  listRecords<ProfessionalReferenceRequirementSetRecord>(
    'reference-requirement-set',
  );
export async function deleteProfessionalEvidence(entityId: string) {
  const all = await listProfessionalEvidence();
  if (all.some(item => item.entityId === entityId && item.payload.rubricId))
    throw new Error('A recorded water-skills attempt is preserved as historical evidence. Record another attempt rather than deleting it.');
  const dependent = all.some(item =>
    item.entityId !== entityId && item.evidenceType === 'requirement-link' &&
    item.payload.sourceKind === 'professional-evidence' && item.payload.sourceId === entityId);
  if (dependent) throw new Error('This Professional Evidence is linked to a captured requirement. Unlink that version before deleting the source.');
  return removeRecord(entityId);
}

export async function deleteProfessionalPathway(entityId: string) {
  const linkedEvidence = (await listProfessionalEvidence()).filter(
    (item) => item.pathwayId === entityId,
  );
  if (linkedEvidence.length)
    throw new Error(
      'Professional Evidence is linked to this pathway. Keep the pathway for history or remove/reassign its evidence first.',
    );
  return removeRecord(entityId);
}

export async function saveProfessionalPathway(
  input: Omit<
    ProfessionalPathwayRecord,
    'userId' | 'createdAt' | 'modifiedAt'
  > & { entityId?: string },
) {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to manage Professional Development.');
  if (
    !input.agency.trim() ||
    !input.pathwayKey.trim() ||
    !input.displayName.trim()
  )
    throw new Error('Agency, pathway key and display name are required.');
  if (!input.entityId && (await listProfessionalPathways()).some(item => recordIdentity('professional-pathway',item) === recordIdentity('professional-pathway',input))) throw new Error('This professional pathway already exists. Edit the existing pathway instead; its history has not been changed.');
  return saveRecord('professional-pathway', {
    ...input,
    userId: account,
    agency: input.agency.trim(),
    pathwayKey: input.pathwayKey.trim(),
    displayName: input.displayName.trim(),
    requirementSetId: input.requirementSetId || null,
    mentorPersonIds: [...new Set(input.mentorPersonIds ?? [])],
    notes: input.notes?.trim() || null,
  });
}

export async function saveProfessionalEvidence(
  input: Omit<ProfessionalEvidenceRecord, 'createdAt' | 'modifiedAt'> & {
    entityId?: string;
  },
) {
  if (!input.pathwayId) throw new Error('Choose a Professional pathway.');
  if (!input.evidenceType.trim()) throw new Error('Choose an evidence type.');
  if (!input.occurredAt || !Number.isFinite(Date.parse(input.occurredAt)))
    throw new Error('Record a valid evidence date and time.');
  if (input.entityId && (await listProfessionalEvidence()).some(item => item.entityId === input.entityId && item.payload.rubricId))
    throw new Error('A saved water-skills attempt is historical evidence. Record a new attempt instead of overwriting it.');
  if (input.evidenceType === 'stamina' && input.payload.rubricId) {
    const set = (await listProfessionalRequirementSets()).find(item => item.entityId === input.requirementSetId);
    const pathway = (await listProfessionalPathways()).find(item => item.entityId === input.pathwayId);
    const requirement = set?.requirements.find(item => item.key === input.requirementKey);
    if (!pathway || !set || set.agency !== pathway.agency || set.pathwayKey !== pathway.pathwayKey ||
      requirement?.rule.source !== 'water-skills' || !isWaterSkillsRubric(requirement.rule.rubric) ||
      requirement.rule.rubric.id !== input.payload.rubricId ||
      !WATER_EXERCISES.some(item => item.key === input.payload.exerciseKey) ||
      (input.payload.attemptMode !== 'practice' && input.payload.attemptMode !== 'formal'))
      throw new Error('Select a valid exercise and attempt mode from the captured water-skills version.');
  }
  return saveRecord('professional-evidence', {
    ...input,
    evidenceType: input.evidenceType.trim(),
    relatedDiveId: input.relatedDiveId || null,
    relatedCertificationId: input.relatedCertificationId || null,
    relatedSkillEvidenceId: input.relatedSkillEvidenceId || null,
    relatedSkillEvidenceIds: [
      ...new Set([
        ...(input.relatedSkillEvidenceIds ?? []),
        ...(input.relatedSkillEvidenceId ? [input.relatedSkillEvidenceId] : []),
      ]),
    ],
    relatedSiteId: input.relatedSiteId || null,
    evaluatorPersonId: input.evaluatorPersonId || null,
    relatedPersonIds: [...new Set(input.relatedPersonIds ?? [])],
    attachmentIds: [...new Set(input.attachmentIds ?? [])],
    requirementSetId: input.requirementSetId || null,
    requirementKey: input.requirementKey || null,
    payload: input.payload ?? {},
    notes: input.notes?.trim() || null,
  });
}

export function professionalEvidenceReferenceIssues(
  item: ProfessionalEvidenceRecord & { entityId: string },
  context: ProfessionalEvaluationContext,
): ProfessionalEvidenceReferenceIssue[] {
  const issues: ProfessionalEvidenceReferenceIssue[] = [];
  const check = (
    field: ProfessionalEvidenceReferenceIssue['field'],
    id: string | null | undefined,
    exists: boolean,
  ) => {
    if (id && !exists)
      issues.push({ evidenceId: item.entityId, field, missingId: id });
  };
  check(
    'relatedDiveId',
    item.relatedDiveId,
    context.dives.some(
      (candidate) => candidate.entityId === item.relatedDiveId,
    ),
  );
  check(
    'relatedCertificationId',
    item.relatedCertificationId,
    context.certifications.some(
      (candidate) => candidate.entityId === item.relatedCertificationId,
    ),
  );
  check(
    'relatedSkillEvidenceId',
    item.relatedSkillEvidenceId,
    context.skillEvidence.some(
      (candidate) => candidate.entityId === item.relatedSkillEvidenceId,
    ),
  );
  for (const id of item.relatedSkillEvidenceIds ?? [])
    check(
      'relatedSkillEvidenceIds',
      id,
      context.skillEvidence.some((candidate) => candidate.entityId === id),
    );
  check(
    'relatedSiteId',
    item.relatedSiteId,
    context.sites.some(
      (candidate) => candidate.entityId === item.relatedSiteId,
    ),
  );
  check(
    'evaluatorPersonId',
    item.evaluatorPersonId,
    context.people.some(
      (candidate) => candidate.entityId === item.evaluatorPersonId,
    ),
  );
  for (const id of item.relatedPersonIds ?? [])
    check(
      'relatedPersonIds',
      id,
      context.people.some((candidate) => candidate.entityId === id),
    );
  if (item.evidenceType === 'requirement-link' && typeof item.payload.sourceId === 'string') {
    const sourceKind = item.payload.sourceKind;
    const sourceId = item.payload.sourceId;
    check('payload.sourceId', sourceId,
      sourceKind === 'professional-evidence'
        ? context.professionalEvidence.some(candidate => candidate.entityId === sourceId && candidate.pathwayId === item.pathwayId && candidate.evidenceType !== 'requirement-link')
        : sourceKind === 'skill-evidence'
          ? context.skillEvidence.some(candidate => candidate.entityId === sourceId)
          : true);
  }
  return issues;
}

export function professionalEvidenceReferenceIssueSummary(
  items: Array<Stored<ProfessionalEvidenceRecord>>,
  context: ProfessionalEvaluationContext,
) {
  const issues = items.flatMap((item) =>
    professionalEvidenceReferenceIssues(item, context),
  );
  return {
    issues,
    affectedEvidenceCount: new Set(issues.map((item) => item.evidenceId)).size,
  };
}

export async function linkProfessionalEvidenceToRequirement(
  entityId: string,
  requirementSetId: string,
  requirementKey: string,
) {
  const current = (await listProfessionalEvidence()).find(
    (item) => item.entityId === entityId,
  );
  if (!current)
    throw new Error(
      'This Professional Evidence is no longer available on this device.',
    );
  const alreadyLinked = (await listProfessionalEvidence()).find(item =>
    item.pathwayId === current.pathwayId && item.requirementSetId === requirementSetId &&
    item.requirementKey === requirementKey && item.payload.sourceKind === 'professional-evidence' &&
    item.payload.sourceId === entityId);
  if (alreadyLinked) return { id: alreadyLinked.entityId };
  // Evaluation linkage is new evidence; the original experience/version is never rewritten.
  return saveProfessionalEvidence({
    pathwayId: current.pathwayId,
    evidenceType: 'requirement-link',
    occurredAt: new Date().toISOString(),
    relatedDiveId: null, relatedSkillEvidenceId: null, relatedSiteId: null, evaluatorPersonId: null,
    attachmentIds: current.attachmentIds ?? [],
    requirementSetId,
    requirementKey,
    payload: { title: typeof current.payload.title === 'string' && current.payload.title.trim() ? current.payload.title : current.evidenceType, sourceKind: 'professional-evidence', sourceId: entityId },
    notes: null,
  });
}

export async function createRequirementEvidenceLink(input: {
  pathwayId: string;
  requirementSetId: string;
  requirementKey: string;
  candidate: ProfessionalEvidenceLink;
  occurredAt?: string;
}) {
  const relatedDiveId =
    input.candidate.kind === 'dive' ? input.candidate.id : null;
  const relatedCertificationId =
    input.candidate.kind === 'certification' ? input.candidate.id : null;
  const relatedSkillEvidenceId =
    input.candidate.kind === 'skill-evidence' ? input.candidate.id : null;
  const relatedSiteId =
    input.candidate.kind === 'site' ? input.candidate.id : null;
  const evaluatorPersonId =
    input.candidate.kind === 'person' ? input.candidate.id : null;
  if (input.candidate.kind === 'professional-evidence')
    return linkProfessionalEvidenceToRequirement(
      input.candidate.id,
      input.requirementSetId,
      input.requirementKey,
    );
  return saveProfessionalEvidence({
    pathwayId: input.pathwayId,
    evidenceType: 'requirement-link',
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    relatedDiveId,
    relatedCertificationId,
    relatedSkillEvidenceId,
    relatedSkillEvidenceIds: relatedSkillEvidenceId
      ? [relatedSkillEvidenceId]
      : [],
    relatedSiteId,
    evaluatorPersonId,
    relatedPersonIds: evaluatorPersonId ? [evaluatorPersonId] : [],
    attachmentIds: [],
    requirementSetId: input.requirementSetId,
    requirementKey: input.requirementKey,
    payload: {
      title: input.candidate.label,
      sourceKind: input.candidate.kind,
      sourceId: input.candidate.id,
    },
    notes: null,
  });
}

/** Reference snapshots are append-only by design: standards updates create another version. */
export async function captureProfessionalRequirementSet(
  input: Omit<
    ProfessionalReferenceRequirementSetRecord,
    'createdAt' | 'modifiedAt'
  >,
) {
  if (
    !input.agency.trim() ||
    !input.pathwayKey.trim() ||
    !input.versionLabel.trim()
  )
    throw new Error('Agency, pathway key and version label are required.');
  if (!input.sourceCitation?.trim())
    throw new Error('Record the source used for this requirement snapshot.');
  if (!Array.isArray(input.requirements))
    throw new Error('Requirements must be an array.');
  const seen = new Set<string>();
  let canonicalSkills: CanonicalSkillRecord[] | null = null;
  for (const requirement of input.requirements) {
    if (!requirement.key?.trim() || !requirement.label?.trim())
      throw new Error('Every requirement needs a key and label.');
    if (
      ![
        'certification',
        'count',
        'recency',
        'assessment',
        'document',
        'manual',
      ].includes(requirement.kind)
    )
      throw new Error(
        `Unsupported requirement kind: ${String(requirement.kind)}`,
      );
    if (seen.has(requirement.key))
      throw new Error(`Duplicate requirement key: ${requirement.key}`);
    seen.add(requirement.key);
    if (requirement.kind === 'assessment') {
      const rule = requirement.rule ?? {};
      if (rule.source === 'water-skills') {
        if (!isWaterSkillsRubric(rule.rubric))
          throw new Error(`Assessment ${requirement.label} needs a complete, versioned water-skills progress rubric.`);
      } else if (rule.source === 'professional-evidence') {
        const evidenceType = stringRule(rule, 'evidenceType');
        const activityCode = stringRule(rule, 'activityCode');
        const knownActivity = PROFESSIONAL_ASSESSMENT_ACTIVITIES.find(item => item.code === activityCode);
        if (!evidenceType || !activityCode || rule.result !== 'passed' || rule.evaluatorRequired !== true ||
            !PROFESSIONAL_EVIDENCE_CATEGORIES.some(item => item.type === evidenceType && item.type !== 'requirement-link') ||
            (knownActivity && knownActivity.evidenceType !== evidenceType))
          throw new Error(`Assessment ${requirement.label} needs an exact evaluator-backed evidence type, activity code and passing result.`);
      } else if (rule.source === 'canonical-skill' || (!rule.source && stringRule(rule, 'skillKey'))) {
        const skillKey = stringRule(rule, 'skillKey');
        const minimum = stringRule(rule, 'minCompetence');
        canonicalSkills ??= await listCanonicalSkills();
        if (!skillKey || !minimum || !SKILL_COMPETENCE_LEVELS.some(level => level === minimum) ||
            !resolveCanonicalSkillReference(skillKey, canonicalSkills))
          throw new Error(`Assessment ${requirement.label} must name a saved canonical Skill and supported competence level.`);
      } else {
        throw new Error(`Assessment ${requirement.label} has no supported evidence rule. Capture it as manual review until it can be mapped.`);
      }
    }
  }
  return saveReferenceRequirementSet({
    ...input,
    agency: input.agency.trim(),
    pathwayKey: input.pathwayKey.trim(),
    pathwayLabel: input.pathwayLabel?.trim() || '',
    versionLabel: input.versionLabel.trim(),
    sourceCitation: input.sourceCitation.trim(),
    capturedAt: input.capturedAt || new Date().toISOString(),
  });
}

function stringRule(rule: Record<string, unknown>, key: string) {
  const value = rule[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function stringArrayRule(rule: Record<string, unknown>, key: string) {
  const value = rule[key];
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === 'string' && Boolean(item.trim()),
        )
        .map((item) => item.trim())
    : [];
}
function numberRule(rule: Record<string, unknown>, key: string) {
  const value = rule[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const competenceRank = new Map(
  SKILL_COMPETENCE_LEVELS.map((level, index) => [level, index]),
);

function aliasesForSkill(skillKey: string, skills: CanonicalSkillRecord[]) {
  const skill = resolveCanonicalSkillReference(skillKey, skills);
  return skill
    ? new Set(
        [
          skill.entityId,
          skill.skillKey,
          skill.key,
          skillRecordKey(skill),
        ].filter((value): value is string => Boolean(value)),
      )
    : new Set<string>();
}

export function evidenceMatchesRequirement(
  item: ProfessionalEvidenceRecord & { entityId?: string },
  requirementSetId: string,
  requirementKey: string,
) {
  return (
    item.requirementSetId === requirementSetId &&
    item.requirementKey === requirementKey
  );
}

function professionalEvidenceOfType(
  context: ProfessionalEvaluationContext,
  evidenceType: string,
) {
  const normalised = evidenceType.toLocaleLowerCase('en-GB');
  return context.professionalEvidence.filter(
    (item) =>
      (!context.pathwayId || item.pathwayId === context.pathwayId) &&
      item.evidenceType.toLocaleLowerCase('en-GB') === normalised &&
      recordedBy(item.occurredAt, context.asOf ?? new Date()),
  );
}

function recordedBy(at: string | null | undefined, asOf: Date) {
  const date = at ? Date.parse(at) : NaN;
  return Number.isFinite(date) && date <= asOf.getTime();
}

/** Reload the canonical record so sequential media callbacks never overwrite another removal. */
export async function updateProfessionalEvidenceAttachments(
  entityId: string,
  added: string[] = [],
  removed: string[] = [],
) {
  const current = (await listProfessionalEvidence()).find(
    (item) => item.entityId === entityId,
  );
  if (!current)
    throw new Error(
      'This Professional Evidence is no longer available on this device.',
    );
  const removeIds = new Set(removed);
  return current.payload.rubricId ? saveRecord('professional-evidence', {
    ...current,
    entityId,
    attachmentIds: [...new Set([...(current.attachmentIds ?? []), ...added])].filter(id => !removeIds.has(id)),
  }) : saveProfessionalEvidence({
    ...current,
    entityId,
    attachmentIds: [
      ...new Set([...(current.attachmentIds ?? []), ...added]),
    ].filter((id) => !removeIds.has(id)),
  });
}

export function evaluateProfessionalRequirement(
  requirement: ProfessionalRequirementDefinition,
  requirementSetId: string,
  context: ProfessionalEvaluationContext,
): EvaluatedProfessionalRequirement {
  const rule = requirement.rule ?? {};
  const asOf = context.asOf ?? new Date();
  const explicitlyLinked = context.professionalEvidence.filter(
    (item) =>
      (!context.pathwayId || item.pathwayId === context.pathwayId) &&
      evidenceMatchesRequirement(item, requirementSetId, requirement.key) &&
      recordedBy(item.occurredAt, asOf),
  );
  const explicitLinks: ProfessionalEvidenceLink[] = [...new Map(explicitlyLinked.map(
    (item) => ({
      kind: 'professional-evidence' as const,
      id: item.entityId,
      label: `${item.evidenceType} · ${new Date(item.occurredAt).toLocaleDateString('en-GB')}`,
    })).map(item => [item.id, item] as const)).values()];
  const scopedSources = [...new Map(explicitlyLinked.flatMap(link => {
    if (link.evidenceType !== 'requirement-link')
      return [{ item: link, linkId: null as string | null }];
    if (link.payload.sourceKind !== 'professional-evidence' || typeof link.payload.sourceId !== 'string')
      return [];
    const source = context.professionalEvidence.find(candidate =>
      candidate.entityId === link.payload.sourceId &&
      candidate.pathwayId === link.pathwayId &&
      candidate.evidenceType !== 'requirement-link' &&
      recordedBy(candidate.occurredAt, asOf));
    return source ? [{ item: source, linkId: link.entityId }] : [];
  }).map(entry => [entry.item.entityId, entry] as const)).values()];

  if (requirement.kind === 'certification') {
    const terms = stringArrayRule(rule, 'anyTitleIncludes').map((value) =>
      value.toLocaleLowerCase('en-GB'),
    );
    const agency = stringRule(rule, 'agency')?.toLocaleLowerCase('en-GB');
    if (!terms.length)
      return {
        requirement,
        state: 'unknown',
        detail: 'Certification rule has no title match terms.',
        evidence: explicitLinks,
      };
    const matches = context.certifications.filter((cert) => {
      const haystack = `${cert.certification} ${cert.level}`.toLocaleLowerCase(
        'en-GB',
      );
      return (
        (!agency || cert.agency.toLocaleLowerCase('en-GB') === agency) &&
        terms.some((term) => haystack.includes(term))
      );
    });
    return matches.length
      ? {
          requirement,
          state: 'satisfied',
          detail: `${matches.length} matching certification record${matches.length === 1 ? '' : 's'}.`,
          evidence: [
            ...matches.slice(0, 6).map((cert) => ({
              kind: 'certification' as const,
              id: cert.entityId,
              label: cert.certification || cert.level,
            })),
            ...explicitLinks,
          ],
        }
      : {
          requirement,
          state: 'not_satisfied',
          detail: 'No matching certification record is currently available.',
          evidence: explicitLinks,
        };
  }

  if (requirement.kind === 'count') {
    const metric = stringRule(rule, 'metric');
    const min = numberRule(rule, 'min');
    if (!metric || min == null)
      return {
        requirement,
        state: 'unknown',
        detail: 'Count rule is incomplete.',
        evidence: explicitLinks,
      };
    if (metric === 'logged-dives') {
      const count = context.dives.length;
      return {
        requirement,
        state: count >= min ? 'satisfied' : 'not_satisfied',
        detail: `${count} logged Dive${count === 1 ? '' : 's'}; captured requirement is ${min}.`,
        evidence: [
          ...context.dives.slice(0, 8).map((dive) => ({
            kind: 'dive' as const,
            id: dive.entityId,
            label: `${dive.date} · ${dive.site}`,
          })),
          ...explicitLinks,
        ],
      };
    }
    if (metric === 'professional-evidence') {
      const evidenceType = stringRule(rule, 'evidenceType');
      if (!evidenceType)
        return {
          requirement,
          state: 'unknown',
          detail: 'Professional-evidence count rule has no evidenceType.',
          evidence: explicitLinks,
        };
      const matches = rule.scope === 'requirement'
        ? scopedSources.map(entry => entry.item).filter(item => item.evidenceType === evidenceType)
        : professionalEvidenceOfType(context, evidenceType);
      return {
        requirement,
        state: matches.length >= min ? 'satisfied' : 'not_satisfied',
        detail: `${matches.length} ${evidenceType} evidence item${matches.length === 1 ? '' : 's'}; captured requirement is ${min}.`,
        evidence: [
          ...matches.slice(0, 8).map((item) => ({
            kind: 'professional-evidence' as const,
            id: item.entityId,
            label: new Date(item.occurredAt).toLocaleDateString('en-GB'),
          })),
          ...explicitLinks,
        ],
      };
    }
    return {
      requirement,
      state: 'unknown',
      detail: `Unsupported professional count metric: ${metric}.`,
      evidence: explicitLinks,
    };
  }

  if (requirement.kind === 'assessment') {
    if (rule.source === 'water-skills') {
      if (!isWaterSkillsRubric(rule.rubric))
        return { requirement, state: 'unknown', detail: 'No valid captured water-skills rubric exists.', evidence: explicitLinks };
      const progress = professionalWaterSkillsProgress(rule.rubric, requirementSetId, requirement.key, context);
      return { requirement, state: 'manual_review',
        detail: progress.complete
          ? `${progress.total}/25 recorded formal points; ${progress.minimumProgressMet ? 'the 15-point progress target is met' : `${progress.pointsToTarget} to the 15-point progress target`}. Instructor review is still required; this is not a PADI pass claim.`
          : `${progress.total}/25 partial formal points; ${5 - progress.contributingIds.length} exercise(s) need qualifying evidence. This is not a PADI pass claim.`,
        evidence: progress.contributingIds.map(id => ({ kind: 'professional-evidence' as const, id, label: 'Contributing water-skills attempt' })) };
    }
    if (rule.source === 'professional-evidence') {
      const evidenceType = stringRule(rule, 'evidenceType');
      const activityCode = stringRule(rule, 'activityCode');
      const expectedResult = stringRule(rule, 'result');
      if (!evidenceType || !activityCode || expectedResult !== 'passed')
        return { requirement, state: 'unknown', detail: 'The captured assessment rule needs an exact evidence type, activity code and passing result.', evidence: explicitLinks };
      const matches = scopedSources.filter(({ item }) =>
        item.evidenceType === evidenceType &&
        item.payload.activityCode === activityCode &&
        item.payload.result === expectedResult &&
        (!rule.evaluatorRequired || Boolean(item.evaluatorPersonId && context.people.some(person => person.entityId === item.evaluatorPersonId))) &&
        (!item.evaluatorPersonId || context.people.some(person => person.entityId === item.evaluatorPersonId)) &&
        (!item.relatedDiveId || context.dives.some(dive => dive.entityId === item.relatedDiveId)) &&
        (!item.relatedSiteId || context.sites.some(site => site.entityId === item.relatedSiteId)) &&
        (!item.relatedCertificationId || context.certifications.some(cert => cert.entityId === item.relatedCertificationId)) &&
        [...new Set([...(item.relatedSkillEvidenceIds ?? []), ...(item.relatedSkillEvidenceId ? [item.relatedSkillEvidenceId] : [])])].every(id => context.skillEvidence.some(skill => skill.entityId === id)) &&
        (item.relatedPersonIds ?? []).every(id => context.people.some(person => person.entityId === id))
      );
      return matches.length
        ? { requirement, state: 'satisfied', detail: 'A version-linked evaluator result meets this captured assessment.', evidence: matches.flatMap(({ item, linkId }) => [
          { kind: 'professional-evidence' as const, id: item.entityId, label: `${item.evidenceType} · ${new Date(item.occurredAt).toLocaleDateString('en-GB')}` },
          ...(linkId ? [{ kind: 'professional-evidence' as const, id: linkId, label: 'Requirement version link' }] : []),
        ]) }
        : { requirement, state: 'not_satisfied', detail: 'No exact, valid, evaluator-backed result is linked to this captured requirement version.', evidence: explicitLinks };
    }
    if (rule.source && rule.source !== 'canonical-skill')
      return { requirement, state: 'unknown', detail: 'Unsupported assessment evidence source.', evidence: explicitLinks };
    const skillKey = stringRule(rule, 'skillKey');
    const minimum = stringRule(
      rule,
      'minCompetence',
    ) as SkillCompetenceLevel | null;
    if (!skillKey || !minimum || !competenceRank.has(minimum))
      return {
        requirement,
        state: 'unknown',
        detail:
          'Assessment rule is incomplete or uses an unsupported competence level.',
        evidence: explicitLinks,
      };
    const aliases = aliasesForSkill(skillKey, context.skills);
    if (!aliases.size)
      return {
        requirement,
        state: 'unknown',
        detail: 'The referenced canonical Skill is unavailable.',
        evidence: explicitLinks,
      };
    const evaluatorRequired = rule.evaluatorRequired === true;
    const versionLinkedSkillIds = new Set(explicitlyLinked
      .filter(item => item.evidenceType === 'requirement-link' && item.payload.sourceKind === 'skill-evidence' && typeof item.payload.sourceId === 'string' && item.relatedSkillEvidenceId === item.payload.sourceId)
      .map(item => String(item.payload.sourceId)));
    const matches = context.skillEvidence
      .filter(
        (item) =>
          aliases.has(item.skillKey) &&
          (rule.source !== 'canonical-skill' || versionLinkedSkillIds.has(item.entityId)) &&
          recordedBy(item.performedAt, asOf) &&
          typeof item.competenceLevel === 'string' &&
          competenceRank.has(item.competenceLevel as SkillCompetenceLevel) &&
          (!evaluatorRequired || Boolean(item.evaluatorPersonId)),
      )
      .sort((a, b) =>
        String(b.performedAt ?? '').localeCompare(String(a.performedAt ?? '')),
      );
    const qualifying = matches.filter(
      (item) =>
        (competenceRank.get(item.competenceLevel as SkillCompetenceLevel) ??
          -1) >= (competenceRank.get(minimum) ?? Infinity),
    );
    return qualifying.length
      ? {
          requirement,
          state: 'satisfied',
          detail: `Qualifying canonical Skill Evidence meets ${minimum}.`,
          evidence: [
            ...qualifying.slice(0, 6).map((item) => ({
              kind: 'skill-evidence' as const,
              id: item.entityId,
              label: item.performedAt
                ? new Date(item.performedAt).toLocaleDateString('en-GB')
                : 'Skill evidence',
            })),
            ...explicitLinks,
          ],
        }
      : {
          requirement,
          state: 'not_satisfied',
          detail: matches.length
            ? `Recorded Skill Evidence does not yet meet ${minimum}.`
            : 'No qualifying Skill Evidence is recorded.',
          evidence: explicitLinks,
        };
  }

  if (requirement.kind === 'recency') {
    const maxAgeDays = numberRule(rule, 'maxAgeDays');
    if (maxAgeDays == null)
      return {
        requirement,
        state: 'unknown',
        detail: 'Recency rule has no maxAgeDays.',
        evidence: explicitLinks,
      };
    const evidenceType = stringRule(rule, 'evidenceType');
    const skillKey = stringRule(rule, 'skillKey');
    let occurred: Array<{
      id: string;
      at: string;
      kind: 'professional-evidence' | 'skill-evidence';
    }> = [];
    if (evidenceType)
      occurred = professionalEvidenceOfType(context, evidenceType).map(
        (item) => ({
          id: item.entityId,
          at: item.occurredAt,
          kind: 'professional-evidence' as const,
        }),
      );
    else if (skillKey) {
      const aliases = aliasesForSkill(skillKey, context.skills);
      occurred = context.skillEvidence
        .filter(
          (item) => aliases.has(item.skillKey) && Boolean(item.performedAt),
        )
        .map((item) => ({
          id: item.entityId,
          at: item.performedAt!,
          kind: 'skill-evidence' as const,
        }));
    } else {
      const certificationTerms = stringArrayRule(rule, 'anyTitleIncludes').map(
        (value) => value.toLocaleLowerCase('en-GB'),
      );
      const agency = stringRule(rule, 'agency')?.toLocaleLowerCase('en-GB');
      if (certificationTerms.length) {
        const matches = context.certifications
          .filter((cert) => {
            const haystack =
              `${cert.certification} ${cert.level}`.toLocaleLowerCase('en-GB');
            return (
              recordedBy(cert.issuedAt, asOf) &&
              (!agency || cert.agency.toLocaleLowerCase('en-GB') === agency) &&
              certificationTerms.some((term) => haystack.includes(term))
            );
          })
          .sort((a, b) =>
            String(b.issuedAt ?? '').localeCompare(String(a.issuedAt ?? '')),
          );
        const latestCert = matches[0];
        if (!latestCert?.issuedAt)
          return {
            requirement,
            state: 'not_satisfied',
            detail: 'No qualifying dated certification is recorded.',
            evidence: explicitLinks,
          };
        const ageDays = Math.floor(
          (asOf.getTime() - Date.parse(latestCert.issuedAt)) / 86_400_000,
        );
        return {
          requirement,
          state: ageDays <= maxAgeDays ? 'satisfied' : 'not_satisfied',
          detail: `Latest qualifying certification is ${ageDays} day${ageDays === 1 ? '' : 's'} old; captured maximum is ${maxAgeDays}.`,
          evidence: [
            {
              kind: 'certification',
              id: latestCert.entityId,
              label: latestCert.certification || latestCert.level,
            },
            ...explicitLinks,
          ],
        };
      }
      return {
        requirement,
        state: 'unknown',
        detail:
          'Recency rule needs evidenceType, skillKey or certification title terms.',
        evidence: explicitLinks,
      };
    }
    const latest = occurred
      .filter((item) => Date.parse(item.at) <= asOf.getTime())
      .sort((a, b) => b.at.localeCompare(a.at))[0];
    if (!latest)
      return {
        requirement,
        state: 'not_satisfied',
        detail: 'No qualifying dated evidence is recorded.',
        evidence: explicitLinks,
      };
    const ageDays = Math.floor(
      (asOf.getTime() - Date.parse(latest.at)) / 86_400_000,
    );
    return {
      requirement,
      state: ageDays <= maxAgeDays ? 'satisfied' : 'not_satisfied',
      detail: `Latest qualifying evidence is ${ageDays} day${ageDays === 1 ? '' : 's'} old; captured maximum is ${maxAgeDays}.`,
      evidence: [
        {
          kind: latest.kind,
          id: latest.id,
          label: new Date(latest.at).toLocaleDateString('en-GB'),
        },
        ...explicitLinks,
      ],
    };
  }

  if (requirement.kind === 'document') {
    const evidenceType = stringRule(rule, 'evidenceType');
    const candidates = rule.scope === 'requirement'
      ? scopedSources.map(entry => entry.item).filter(item => !evidenceType || item.evidenceType === evidenceType)
      : evidenceType
      ? professionalEvidenceOfType(context, evidenceType)
      : explicitlyLinked;
    const withAttachment = candidates.filter(
      (item) => item.attachmentIds.length > 0,
    );
    return withAttachment.length
      ? {
          requirement,
          state: 'satisfied',
          detail: `${withAttachment.length} supporting evidence item${withAttachment.length === 1 ? '' : 's'} with attachment references.`,
          evidence: withAttachment.slice(0, 8).map((item) => ({
            kind: 'professional-evidence',
            id: item.entityId,
            label: `${item.evidenceType} · ${new Date(item.occurredAt).toLocaleDateString('en-GB')}`,
          })),
        }
      : {
          requirement,
          state: 'not_satisfied',
          detail:
            'No supporting document/file evidence is linked to this captured requirement.',
          evidence: explicitLinks,
        };
  }

  if (requirement.kind === 'manual') {
    const evidenceType = stringRule(rule, 'evidenceType');
    const candidates = rule.scope === 'requirement'
      ? scopedSources.map(entry => entry.item).filter(item =>
        (!evidenceType || item.evidenceType === evidenceType) &&
        (!rule.evaluatorRequired || Boolean(item.evaluatorPersonId && context.people.some(person => person.entityId === item.evaluatorPersonId))) &&
        (!rule.result || item.payload.result === rule.result))
      : evidenceType
      ? professionalEvidenceOfType(context, evidenceType)
      : explicitlyLinked;
    if (candidates.length)
      return {
        requirement,
        state: 'satisfied',
        detail: `${candidates.length} owner-recorded evidence item${candidates.length === 1 ? '' : 's'} linked.`,
        evidence: candidates.slice(0, 8).map((item) => ({
          kind: 'professional-evidence',
          id: item.entityId,
          label: `${item.evidenceType} · ${new Date(item.occurredAt).toLocaleDateString('en-GB')}`,
        })),
      };
    return {
      requirement,
      state: 'manual_review',
      detail:
        'This captured requirement needs explicit owner/evaluator evidence; ZeusTek will not infer it.',
      evidence: explicitLinks,
    };
  }

  return {
    requirement,
    state: 'unknown',
    detail: 'Unsupported captured requirement.',
    evidence: explicitLinks,
  };
}

export function evaluateProfessionalReadiness(
  requirementSet:
    | Stored<ProfessionalReferenceRequirementSetRecord>
    | null
    | undefined,
  context: ProfessionalEvaluationContext,
): ProfessionalReadiness {
  if (!requirementSet || !requirementSet.requirements.length)
    return {
      state: 'unknown',
      percent: 0,
      satisfied: 0,
      notSatisfied: 0,
      unknown: 0,
      manualReview: 0,
      total: requirementSet?.requirements.length ?? 0,
      requirements: [],
    };
  const requirements = requirementSet.requirements.map((requirement) =>
    evaluateProfessionalRequirement(
      requirement,
      requirementSet.entityId,
      context,
    ),
  );
  const satisfied = requirements.filter(
    (item) => item.state === 'satisfied',
  ).length;
  const notSatisfied = requirements.filter(
    (item) => item.state === 'not_satisfied',
  ).length;
  const unknown = requirements.filter(
    (item) => item.state === 'unknown',
  ).length;
  const manualReview = requirements.filter(
    (item) => item.state === 'manual_review',
  ).length;
  const known = satisfied + notSatisfied;
  const percent = known ? Math.round((satisfied / known) * 100) : 0;
  const state: ProfessionalRequirementState =
    unknown || manualReview
      ? known
        ? 'manual_review'
        : 'unknown'
      : notSatisfied
        ? 'not_satisfied'
        : 'satisfied';
  return {
    state,
    percent,
    satisfied,
    notSatisfied,
    unknown,
    manualReview,
    total: requirements.length,
    requirements,
  };
}

export function professionalEvidenceSummary(
  items: Array<Stored<ProfessionalEvidenceRecord>>,
) {
  const types: ProfessionalEvidenceType[] = [
    ...PROFESSIONAL_EVIDENCE_CATEGORIES.map((category) => category.type),
    'requirement-link',
    'other',
  ];
  return Object.fromEntries(
    types.map((type) => [
      type,
      items.filter((item) => item.evidenceType === type).length,
    ]),
  ) as Record<ProfessionalEvidenceType, number>;
}

export function requirementSetForPathway(
  pathway: ProfessionalPathwayRecord,
  sets: Array<Stored<ProfessionalReferenceRequirementSetRecord>>,
) {
  return pathway.requirementSetId
    ? (sets.find((set) => set.entityId === pathway.requirementSetId) ?? null)
    : null;
}
