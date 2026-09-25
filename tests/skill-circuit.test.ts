import { describe, expect, it } from 'vitest';
import {
  PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026,
  isSkillCircuitRubric,
  projectSkillCircuit,
  scoreSkillCircuitAttempt,
  type SkillCircuitAttempt,
} from '../lib/professional-development/skill-circuit';

const rubric = PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026;
const attempt = (itemKey: string, score: number, changes: Partial<SkillCircuitAttempt> = {}): SkillCircuitAttempt => ({
  id: `${itemKey}-${score}`, itemKey, rubricId: rubric.id,
  occurredAt: '2026-09-25T12:00:00Z', mode: 'formal', evaluatorPersonId: 'instructor-1',
  evaluatorScore: score, neutralBuoyancyObserved: true, ...changes,
});
const complete = (score: number) => rubric.items.map(item => attempt(item.key, score));

describe('T14 #63 source-versioned 24-skill circuit', () => {
  it('keeps the published 24-item order and a pending instructor confirmation state', () => {
    expect(isSkillCircuitRubric(rubric)).toBe(true);
    expect(rubric.items).toHaveLength(24);
    expect(new Set(rubric.items.map(item => item.key)).size).toBe(24);
    expect(rubric.items[12]?.label).toMatch(/five.point ascent/i);
    expect(rubric.items[13]?.label).toMatch(/emergency swimming ascent/i);
    expect(rubric.items[22]?.label).toMatch(/cylinder band/i);
    expect(rubric.confirmation).toBe('pending-instructor');
    expect(rubric.items.every(item => item.canonicalSkillId === null)).toBe(true);
  });
  it('rejects duplicate keys, missing flags and unsupported thresholds in a captured rubric', () => {
    expect(isSkillCircuitRubric({ ...rubric, items: [rubric.items[0], ...rubric.items.slice(0, 23)] })).toBe(false);
    expect(isSkillCircuitRubric({ ...rubric, items: rubric.items.map((item, index) => index === 2 ? { ...item, underwater: undefined } : item) })).toBe(false);
    expect(isSkillCircuitRubric({ ...rubric, totalTarget: 24 })).toBe(false);
  });
  it('accepts only integer 1–5 scores and a named evaluator for formal evidence', () => {
    expect(scoreSkillCircuitAttempt(rubric, attempt('skill-01', 3)).formalQualifying).toBe(true);
    expect(scoreSkillCircuitAttempt(rubric, attempt('skill-01', 0)).score).toBeNull();
    expect(scoreSkillCircuitAttempt(rubric, attempt('skill-01', 6)).score).toBeNull();
    expect(scoreSkillCircuitAttempt(rubric, attempt('skill-01', 3.5)).score).toBeNull();
    expect(scoreSkillCircuitAttempt(rubric, attempt('skill-01', 3, { evaluatorPersonId: null })).formalQualifying).toBe(false);
    expect(scoreSkillCircuitAttempt(rubric, attempt('skill-01', 3, { rubricId: 'other-version' })).score).toBeNull();
  });
  it('requires observed neutral buoyancy for a 5 on regulator and mask skills', () => {
    for (const key of ['skill-07', 'skill-08']) {
      expect(scoreSkillCircuitAttempt(rubric, attempt(key, 5, { neutralBuoyancyObserved: false })).formalQualifying).toBe(false);
      expect(scoreSkillCircuitAttempt(rubric, attempt(key, 5, { neutralBuoyancyObserved: true })).formalQualifying).toBe(true);
    }
  });
  it('keeps practice and historical attempts but uses each latest qualifying formal score once', () => {
    const older = attempt('skill-01', 5, { id: 'older', occurredAt: '2026-09-01T12:00:00Z' });
    const newer = attempt('skill-01', 3, { id: 'newer', occurredAt: '2026-09-20T12:00:00Z' });
    const practice = attempt('skill-01', 5, { id: 'practice', mode: 'practice' });
    const row = projectSkillCircuit(rubric, [older, newer, practice]).items[0];
    expect(row?.attempts).toHaveLength(3);
    expect(row?.formal?.id).toBe('newer');
    expect(row?.best?.score).toBe(5);
    expect(row?.latest?.id).toBe('practice');
  });
  it('distinguishes all 24, 81/82/120 points, individual minimum and underwater 5', () => {
    expect(projectSkillCircuit(rubric, complete(3)).total).toBe(72);
    const eightyOne = complete(3).map((row, index) => index < 9 ? { ...row, evaluatorScore: 4 } : row);
    expect(projectSkillCircuit(rubric, eightyOne).total).toBe(81);
    expect(projectSkillCircuit(rubric, eightyOne).progressTargetMet).toBe(false);
    const eightyTwo = complete(3).map((row, index) => index === 13 ? { ...row, evaluatorScore: 5 } : index < 8 ? { ...row, evaluatorScore: 4 } : row);
    expect(projectSkillCircuit(rubric, eightyTwo).total).toBe(82);
    expect(projectSkillCircuit(rubric, eightyTwo).progressTargetMet).toBe(true);
    const noUnderwaterFive = eightyOne.map((row, index) => index === 0 ? { ...row, evaluatorScore: 5 } : row);
    expect(projectSkillCircuit(rubric, noUnderwaterFive).total).toBe(82);
    expect(projectSkillCircuit(rubric, noUnderwaterFive).progressTargetMet).toBe(false);
    const belowThree = complete(4).map((row, index) => index === 0 ? { ...row, evaluatorScore: 2 } : row);
    expect(projectSkillCircuit(rubric, belowThree).total).toBe(94);
    expect(projectSkillCircuit(rubric, belowThree).progressTargetMet).toBe(false);
    expect(projectSkillCircuit(rubric, complete(5)).total).toBe(120);
    expect(projectSkillCircuit(rubric, complete(5)).progressTargetMet).toBe(true);
  });
  it('never makes a PADI pass claim while source confirmation is pending', () => {
    const result = projectSkillCircuit(rubric, complete(5));
    expect(result.progressTargetMet).toBe(true);
    expect(result.agencyMinimumConfirmed).toBe(false);
  });
});
