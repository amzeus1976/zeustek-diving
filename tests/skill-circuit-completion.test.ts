import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SkillCircuitTracker } from '../components/skill-circuit-tracker';
import { professionalAssessmentFields, professionalSkillCircuitProgress, type ProfessionalEvaluationContext,
  type ProfessionalEvidenceRecord } from '../lib/offline/professional-development';
import type { Stored } from '../lib/offline/dive-planning';
import { isSkillCircuitRubric, PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026 as rubric,
  projectSkillCircuit, scoreSkillCircuitAttempt, type SkillCircuitAttempt } from '../lib/professional-development/skill-circuit';

const attempt = (key: string, score: number, overrides: Partial<SkillCircuitAttempt> = {}): SkillCircuitAttempt => ({
  id: `${key}-${score}`, itemKey: key, rubricId: rubric.id, occurredAt: '2026-09-25T12:00:00Z',
  mode: 'formal', evaluatorPersonId: 'instructor', evaluatorScore: score,
  neutralBuoyancyObserved: true, ...overrides,
});
const all = (score: number) => rubric.items.map(item => attempt(item.key, score));

describe('T14 #63 full circuit acceptance', () => {
  it('captures the scoring scale, 5-point maximum, underwater rule and item-specific conditions in a new rubric version', () => {
    expect(rubric.schemaVersion).toBe(2);
    expect(rubric.maximumPerSkill).toBe(5);
    expect(rubric.underwaterFiveRequired).toBe(true);
    expect(rubric.scoringScale?.map(level => level.score)).toEqual([1, 2, 3, 4, 5]);
    expect(rubric.scoringScale?.[4]?.description).toMatch(/correctly.*slowly/i);
    expect(rubric.items.find(item => item.key === 'skill-07')?.neutralBuoyancyForFive).toBe(true);
    expect(rubric.items.find(item => item.key === 'skill-08')?.neutralBuoyancyForFive).toBe(true);
    expect(isSkillCircuitRubric(rubric)).toBe(true);
    expect(isSkillCircuitRubric({ ...rubric, scoringScale: rubric.scoringScale?.slice(0, 4) })).toBe(false);
  });
  it('keeps a captured v1 rubric readable without changing its owner record', () => {
    const legacy = { ...rubric, schemaVersion: undefined, maximumPerSkill: undefined,
      underwaterFiveRequired: undefined, scoringScale: undefined,
      items: rubric.items.map(item => ({ key: item.key, label: item.label, underwater: item.underwater,
        canonicalSkillId: item.canonicalSkillId })) };
    expect(isSkillCircuitRubric(legacy)).toBe(true);
    expect(projectSkillCircuit(legacy as unknown as typeof rubric, [attempt('skill-07', 5, { rubricId: legacy.id, neutralBuoyancyObserved: false })])
      .items.find(item => item.key === 'skill-07')?.formal).toBeNull();
  });
  it('uses the captured item labels in the attempt editor, even after the bundled template changes', () => {
    const captured = { ...rubric, id: 'captured-custom-version', items: rubric.items.map(item => item.key === 'skill-01'
      ? { ...item, label: 'Captured assembly wording' } : item) };
    const fields = professionalAssessmentFields('skills-circuit', 'skill-01', true, captured);
    expect(fields.find(field => field.key === 'itemKey')?.options?.[0]?.label).toBe('Captured assembly wording');
  });
  it('uses captured item conditions, with separate progress states and counts', () => {
    const noNeutralCondition = { ...rubric, items: rubric.items.map(item => item.key === 'skill-07'
      ? { ...item, neutralBuoyancyForFive: false } : item) };
    expect(scoreSkillCircuitAttempt(noNeutralCondition, attempt('skill-07', 5, { neutralBuoyancyObserved: false })).formalQualifying).toBe(true);
    expect(projectSkillCircuit(rubric, []).status).toBe('not_started');
    const practiceOnly = all(4).map(item => ({ ...item, mode: 'practice' as const }));
    expect(projectSkillCircuit(rubric, practiceOnly).status).toBe('all_skills_attempted');
    const low = all(4).map((item, index) => index === 0 ? { ...item, evaluatorScore: 2 } : item);
    expect(projectSkillCircuit(rubric, low)).toMatchObject({ status: 'needs_improvement', skillsBelowMinimum: 1 });
    const noUnderwaterFive = all(4).map((item, index) => index === 0 ? { ...item, evaluatorScore: 5 } : item);
    expect(projectSkillCircuit(rubric, noUnderwaterFive).status).toBe('needs_underwater_five');
    const minimum = all(3).map((item, index) => index === 13 ? { ...item, evaluatorScore: 5 } : index < 8 ? { ...item, evaluatorScore: 4 } : item);
    expect(projectSkillCircuit(rubric, minimum)).toMatchObject({ status: 'minimum_progress_recorded', pointsBelowTarget: 0, skillsBelowMinimum: 0 });
    expect(projectSkillCircuit(rubric, all(5))).toMatchObject({ status: 'above_minimum', pointsAboveTarget: 38 });
  });
  it('projects evaluator, site, observation, notes and exact Skill Evidence links from canonical records', () => {
    const evidence = { entityId: 'attempt-1', pathwayId: 'path', evidenceType: 'skills-circuit',
      occurredAt: '2026-09-25T12:00:00Z', evaluatorPersonId: 'instructor', relatedDiveId: null,
      relatedCertificationId: null, relatedSkillEvidenceId: 'skill-evidence-1', relatedSkillEvidenceIds: ['skill-evidence-1'],
      relatedSiteId: 'site-1', relatedPersonIds: [], attachmentIds: [], requirementSetId: 'set-v3', requirementKey: 'circuit',
      payload: { rubricId: rubric.id, itemKey: 'skill-01', attemptMode: 'formal', evaluatorScore: 4,
        observedPerformance: 'Slow and correct', conditions: 'Pool', title: 'Assembly' }, notes: 'Instructor notes',
      createdAt: '', modifiedAt: '' } as Stored<ProfessionalEvidenceRecord>;
    const context = { pathwayId: 'path', dives: [], certifications: [], skills: [],
      skillEvidence: [{ entityId: 'skill-evidence-1', skillKey: 'assembly' }], professionalEvidence: [evidence],
      sites: [{ entityId: 'site-1', name: 'Training pool' }], people: [{ entityId: 'instructor', name: 'Instructor One' }],
      asOf: new Date('2026-09-26T00:00:00Z') } as unknown as ProfessionalEvaluationContext;
    const row = professionalSkillCircuitProgress(rubric, 'set-v3', 'circuit', context).items[0];
    expect(row?.formal?.attempt).toMatchObject({ evaluatorName: 'Instructor One', siteName: 'Training pool',
      conditions: 'Pool', observedPerformance: 'Slow and correct', notes: 'Instructor notes',
      relatedSkillEvidence: [{ id: 'skill-evidence-1' }] });
  });
  it('renders review modes, status, attempt context and exact source navigation without a PADI pass claim', () => {
    const progress = projectSkillCircuit(rubric, [attempt('skill-01', 4, {
      evaluatorName: 'Instructor One', siteName: 'Training pool', conditions: 'Pool', notes: 'Good control',
      relatedSkillEvidence: [{ id: 'skill-evidence-1', label: 'Assembly evidence' }],
    })]);
    const html = renderToStaticMarkup(React.createElement(SkillCircuitTracker, { rubric, progress,
      openAttempt: () => {}, addAttempt: () => {} }));
    for (const label of ['Current formal', 'Personal best', 'Latest attempt', 'Attempt count', 'Evaluator',
      'Site/pool', 'Current contribution', 'Instructor One', 'Training pool', 'Good control', 'Assembly evidence'])
      expect(html).toContain(label);
    expect(html).toContain('evidenceId=skill-evidence-1');
    expect(html).toContain('How circuit scores are interpreted');
    expect(html).toContain('instructor confirmation pending');
    expect(html).not.toContain('PADI certified');
  });
});
