import { describe, expect, it } from 'vitest';
import { PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026 } from '../lib/professional-development/skill-circuit';
import {
  evaluateProfessionalRequirement,
  professionalAssessmentFields,
  professionalSkillCircuitProgress,
  type ProfessionalEvaluationContext,
  type ProfessionalEvidenceRecord,
  type ProfessionalRequirementDefinition,
} from '../lib/offline/professional-development';
import type { Stored } from '../lib/offline/dive-planning';

const rubric = PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026;
const requirement: ProfessionalRequirementDefinition = { key: 'circuit', label: '24-skill circuit', kind: 'assessment',
  rule: { source: 'skill-circuit', rubric } };
const evidence = (itemKey: string, score: number, changes: Partial<Stored<ProfessionalEvidenceRecord>> = {}): Stored<ProfessionalEvidenceRecord> => ({
  entityId: `e-${itemKey}`, pathwayId: 'path', evidenceType: 'skills-circuit',
  occurredAt: '2026-09-24T10:00:00Z', evaluatorPersonId: 'instructor',
  relatedDiveId: null, relatedCertificationId: null, relatedSkillEvidenceId: null,
  relatedSkillEvidenceIds: [], relatedSiteId: null, relatedPersonIds: [], attachmentIds: [],
  requirementSetId: 'set-v3', requirementKey: 'circuit',
  payload: { rubricId: rubric.id, itemKey, attemptMode: 'formal', evaluatorScore: score, neutralBuoyancyObserved: true },
  notes: null, createdAt: '', modifiedAt: '', ...changes,
});
const context = (rows: Array<Stored<ProfessionalEvidenceRecord>>): ProfessionalEvaluationContext => ({
  pathwayId: 'path', dives: [], certifications: [], skills: [], skillEvidence: [],
  professionalEvidence: rows, sites: [],
  people: [{ entityId: 'instructor', name: 'Instructor' } as ProfessionalEvaluationContext['people'][number]],
  asOf: new Date('2026-09-25T12:00:00Z'),
});

describe('T14 #63 circuit integration', () => {
  it('uses only exact version, requirement, pathway, evaluator and valid links', () => {
    const rows = [evidence('skill-01', 4), evidence('skill-02', 5, { requirementSetId: 'old' }),
      evidence('skill-03', 5, { pathwayId: 'other' }),
      evidence('skill-04', 5, { evaluatorPersonId: 'missing' }),
      evidence('skill-05', 5, { relatedDiveId: 'missing-dive' }),
      evidence('skill-06', 5, { relatedSkillEvidenceIds: ['missing-skill-evidence'] })];
    const progress = professionalSkillCircuitProgress(rubric, 'set-v3', 'circuit', context(rows));
    expect(progress.total).toBe(4);
    expect(progress.contributingIds).toEqual(['e-skill-01']);
    expect(progress.items.find(item => item.key === 'skill-05')?.latest?.reasons).toContain('Linked Dive is unavailable.');
    expect(progress.items.find(item => item.key === 'skill-06')?.latest?.reasons).toContain('Linked Skill Evidence is unavailable.');
  });
  it('keeps the captured requirement in manual review even when 82-point progress is recorded', () => {
    const rows = rubric.items.map((item, index) => evidence(item.key, index === 13 ? 5 : index < 8 ? 4 : 3));
    const result = evaluateProfessionalRequirement(requirement, 'set-v3', context(rows));
    expect(result.state).toBe('manual_review');
    expect(result.detail).toContain('82/120');
    expect(result.detail).toContain('instructor confirmation pending');
    expect(result.detail).toContain('not a PADI pass claim');
    expect(result.detail).not.toMatch(/PADI certified/i);
    expect(result.evidence).toHaveLength(24);
    expect(evaluateProfessionalRequirement(requirement, 'set-v2', context(rows)).evidence).toHaveLength(0);
  });
  it('offers the item and 1–5 score form while retaining the generic legacy circuit form', () => {
    expect(professionalAssessmentFields('skills-circuit').some(field => field.key === 'circuitName')).toBe(true);
    const fields = professionalAssessmentFields('skills-circuit', 'skill-07', true).map(field => field.key);
    expect(fields).toEqual(expect.arrayContaining(['itemKey', 'attemptMode', 'evaluatorScore', 'neutralBuoyancyObserved', 'observedPerformance']));
    expect(fields).not.toContain('circuitName');
  });
});
