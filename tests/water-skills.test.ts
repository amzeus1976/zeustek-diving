import { describe, expect, it } from 'vitest';
import {
  METRIC_WATER_SKILLS_RUBRIC_2021,
  scoreWaterSkillsAttempt,
  projectWaterSkills,
  type WaterSkillsAttempt,
} from '../lib/professional-development/water-skills';
import { evaluateProfessionalRequirement, professionalAssessmentFields, type ProfessionalEvaluationContext,
  type ProfessionalEvidenceRecord, type ProfessionalRequirementDefinition } from '../lib/offline/professional-development';
import type { Stored } from '../lib/offline/dive-planning';

const rubric = METRIC_WATER_SKILLS_RUBRIC_2021;
const swim = (seconds: number, extra: Partial<WaterSkillsAttempt> = {}): WaterSkillsAttempt => ({
  id: `swim-${seconds}`, exerciseKey: 'swim-400', occurredAt: '2026-09-20T12:00:00Z',
  mode: 'formal', evaluatorPersonId: 'evaluator', rubricId: rubric.id,
  distanceM: 400, durationSec: seconds, nonstop: true, aidsUsed: false, ...extra,
});
const snorkel = (seconds: number, extra: Partial<WaterSkillsAttempt> = {}): WaterSkillsAttempt => ({
  ...swim(seconds), id: `snorkel-${seconds}`, exerciseKey: 'snorkel-800', distanceM: 800,
  maskSnorkelFins: true, flotationAidUsed: false, armsUsed: false, ...extra,
});
const tow = (seconds: number, extra: Partial<WaterSkillsAttempt> = {}): WaterSkillsAttempt => ({
  ...swim(seconds), id: `tow-${seconds}`, exerciseKey: 'tow-100', distanceM: 100,
  bothDiversFullScuba: true, assistanceReceived: false, ...extra,
});
const tread = (extra: Partial<WaterSkillsAttempt> = {}): WaterSkillsAttempt => ({
  ...swim(900), id: 'tread', exerciseKey: 'tread-15', distanceM: undefined,
  completed: true, handsOutFinalTwo: true, supportCount: 0, aidsUsed: false, ...extra,
});
const exchange = (score: number, extra: Partial<WaterSkillsAttempt> = {}): WaterSkillsAttempt => ({
  ...swim(0), id: `exchange-${score}`, exerciseKey: 'equipment-exchange',
  durationSec: undefined, distanceM: undefined, evaluatorScore: score,
  confinedWater: true, tooDeepToStand: true, equipmentComplete: true,
  sharedRegulator: true, alternateAirSource: true, ownMaskRemoval: true,
  neutralBuoyancy: true, completed: true, surfaceContacts: 0, bottomContact: false,
  ...extra,
});

describe('T14 #58 water skills progress scoring', () => {
  it.each([
    [389, 5], [390, 4], [519, 4], [520, 3], [659, 3], [660, 2], [780, 2], [781, 1],
  ])('scores 400 m at %i seconds as %i', (seconds, expected) => {
    expect(scoreWaterSkillsAttempt(rubric, swim(seconds)).score).toBe(expected);
  });
  it.each([
    [839, 5], [840, 4], [989, 4], [990, 3], [1109, 3], [1110, 2], [1260, 2], [1261, 1],
  ])('scores 800 m at %i seconds as %i', (seconds, expected) => {
    expect(scoreWaterSkillsAttempt(rubric, snorkel(seconds)).score).toBe(expected);
  });
  it.each([
    [129, 5], [130, 4], [194, 4], [195, 3], [259, 3], [260, 2], [330, 2], [331, 1],
  ])('scores 100 m tow at %i seconds as %i', (seconds, expected) => {
    expect(scoreWaterSkillsAttempt(rubric, tow(seconds)).score).toBe(expected);
  });
  it('rejects stopped or wrong-equipment timed attempts instead of inventing a 1', () => {
    for (const invalid of [swim(900, { nonstop: false }), swim(900, { aidsUsed: true }),
      snorkel(900, { maskSnorkelFins: false }), snorkel(900, { armsUsed: true }),
      tow(250, { assistanceReceived: true }), tow(250, { bothDiversFullScuba: false }),
      swim(900, { distanceM: 300 })]) {
      expect(scoreWaterSkillsAttempt(rubric, invalid).score).toBeNull();
    }
  });
  it('uses support precedence and actual observations for the 15-minute tread', () => {
    expect(scoreWaterSkillsAttempt(rubric, tread()).score).toBe(5);
    expect(scoreWaterSkillsAttempt(rubric, tread({ handsOutFinalTwo: false })).score).toBe(3);
    expect(scoreWaterSkillsAttempt(rubric, tread({ supportCount: 2 })).score).toBe(1);
    expect(scoreWaterSkillsAttempt(rubric, tread({ supportCount: 3 })).score).toBeNull();
    expect(scoreWaterSkillsAttempt(rubric, tread({ durationSec: 899 })).score).toBeNull();
    expect(scoreWaterSkillsAttempt(rubric, tread({ handsOutFinalTwo: undefined })).score).toBeNull();
  });
  it('takes exchange score only from an evaluator and warns about contradictory observations', () => {
    expect(scoreWaterSkillsAttempt(rubric, exchange(4)).score).toBe(4);
    expect(scoreWaterSkillsAttempt(rubric, exchange(4, { evaluatorPersonId: null })).score).toBeNull();
    expect(scoreWaterSkillsAttempt(rubric, exchange(4, { surfaceContacts: 1 })).warnings).not.toHaveLength(0);
    expect(scoreWaterSkillsAttempt(rubric, exchange(3, { completed: false })).warnings).not.toHaveLength(0);
    expect(scoreWaterSkillsAttempt(rubric, exchange(1, { completed: false, equipmentComplete: false })).formalQualifying).toBe(true);
    expect(scoreWaterSkillsAttempt(rubric, exchange(6)).score).toBeNull();
  });
  it('keeps every attempt but selects the latest qualifying signed formal score', () => {
    const old = swim(500, { occurredAt: '2026-08-01T10:00:00Z' });
    const worse = swim(700, { id: 'worse', occurredAt: '2026-09-01T10:00:00Z' });
    const practice = swim(380, { id: 'practice', mode: 'practice', occurredAt: '2026-09-20T10:00:00Z' });
    const unsigned = swim(300, { id: 'unsigned', evaluatorPersonId: null, occurredAt: '2026-09-21T10:00:00Z' });
    const row = projectWaterSkills(rubric, [old, worse, practice, unsigned]).exercises.find(item => item.key === 'swim-400')!;
    expect(row.attempts).toHaveLength(4);
    expect(row.formal?.id).toBe('worse');
    expect(row.formal?.score).toBe(2);
    expect(row.best?.id).toBe('practice');
    expect(row.latest?.id).toBe('unsigned');
  });
  it('shows a partial total until all five exercises have qualifying formal evidence', () => {
    const attempts = [swim(520), snorkel(1110), tow(260), tread(), exchange(4)];
    const complete = projectWaterSkills(rubric, attempts);
    expect(complete.total).toBe(16);
    expect(complete.maximum).toBe(25);
    expect(complete.target).toBe(15);
    expect(complete.minimumProgressMet).toBe(true);
    expect(complete.pointsAboveTarget).toBe(1);
    expect(complete.contributingIds).toEqual(expect.arrayContaining(attempts.map(item => item.id)));
    const partial = projectWaterSkills(rubric, attempts.slice(0, 4));
    expect(partial.total).toBe(12);
    expect(partial.complete).toBe(false);
    expect(partial.minimumProgressMet).toBe(false);
    expect(partial.pointsToTarget).toBe(3);
  });
  it('distinguishes 14, 15 and 25-point progress without making a PADI pass claim', () => {
    const fourteen = projectWaterSkills(rubric, [swim(390), snorkel(840), tow(130), tread({ supportCount: 1 }), exchange(1)]);
    expect(fourteen.total).toBe(14);
    expect(fourteen.minimumProgressMet).toBe(false);
    const fifteen = projectWaterSkills(rubric, [swim(389), snorkel(840), tow(130), tread({ supportCount: 1 }), exchange(1)]);
    expect(fifteen.total).toBe(15);
    expect(fifteen.minimumProgressMet).toBe(true);
    expect(fifteen.percentOfMaximum).toBe(60);
    const full = projectWaterSkills(rubric, [swim(389), snorkel(839), tow(129), tread(), exchange(5)]);
    expect(full.total).toBe(25);
    expect(full.percentOfMaximum).toBe(100);
  });
  it('keeps old/generic evidence out of a new versioned rubric', () => {
    const mismatch = swim(500, { rubricId: 'old-rubric' });
    expect(projectWaterSkills(rubric, [mismatch]).exercises[0]?.formal).toBeNull();
  });
  it('shows distinct progress states and excludes contradictory scores from personal best', () => {
    expect(projectWaterSkills(rubric, []).status).toBe('not_started');
    const incomplete = projectWaterSkills(rubric, [swim(300, { nonstop: false })]);
    expect(incomplete.status).toBe('in_progress');
    expect(incomplete.incompleteAttemptCount).toBe(1);
    const needsEvaluator = projectWaterSkills(rubric, [swim(300, { evaluatorPersonId: null })]);
    expect(needsEvaluator.needsEvaluatorCount).toBe(1);
    const contradictory = projectWaterSkills(rubric, [exchange(5, { surfaceContacts: 1 })]);
    expect(contradictory.exercises.find(item => item.key === 'equipment-exchange')?.best).toBeNull();
    const atMinimum = projectWaterSkills(rubric, [swim(389), snorkel(840), tow(130), tread({ supportCount: 1 }), exchange(1)]);
    expect(atMinimum.status).toBe('minimum_met');
    const above = projectWaterSkills(rubric, [swim(389), snorkel(839), tow(130), tread({ supportCount: 1 }), exchange(1)]);
    expect(above.status).toBe('above_minimum');
  });
  it('requires captured version/role/evaluator links and never claims a PADI pass', () => {
    const requirement: ProfessionalRequirementDefinition = { key: 'water-progress', label: 'Five-exercise progress', kind: 'assessment',
      rule: { source: 'water-skills', rubric } };
    const evidence = [swim(520), snorkel(1110), tow(260), tread(), exchange(4)].map(attempt => ({
      entityId: attempt.id, pathwayId: 'path-1', evidenceType: 'stamina',
      occurredAt: attempt.occurredAt, evaluatorPersonId: attempt.evaluatorPersonId,
      requirementSetId: 'set-v3', requirementKey: 'water-progress',
      relatedDiveId: null, relatedSkillEvidenceId: null, relatedSiteId: null,
      attachmentIds: [], notes: null, createdAt: '', modifiedAt: '',
      payload: { ...attempt, attemptMode: attempt.mode },
    })) as Array<Stored<ProfessionalEvidenceRecord>>;
    const context: ProfessionalEvaluationContext = { pathwayId: 'path-1', dives: [], certifications: [],
      skills: [], skillEvidence: [], professionalEvidence: evidence, sites: [],
      people: [{ entityId: 'evaluator' } as ProfessionalEvaluationContext['people'][number]],
      asOf: new Date('2026-09-25T12:00:00Z') };
    const result = evaluateProfessionalRequirement(requirement, 'set-v3', context);
    expect(result.state).toBe('manual_review');
    expect(result.detail).toContain('15-point progress target is met');
    expect(result.detail).toContain('not a PADI pass claim');
    expect(result.evidence).toHaveLength(5);
    expect(evaluateProfessionalRequirement(requirement, 'set-v3', { ...context,
      professionalEvidence: evidence.map(item => ({ ...item, requirementSetId: 'set-v2' })) }).evidence).toHaveLength(0);
    expect(evaluateProfessionalRequirement(requirement, 'set-v3', { ...context, people: [] }).evidence).toHaveLength(0);
  });
  it('offers a structured form without replacing the legacy stamina fields', () => {
    expect(professionalAssessmentFields('stamina').some(field => field.key === 'activity')).toBe(true);
    const newFields = professionalAssessmentFields('stamina', 'equipment-exchange', true);
    expect(newFields.map(field => field.key)).toEqual(expect.arrayContaining(['exerciseKey', 'attemptMode', 'evaluatorScore', 'alternateAirSource', 'surfaceContacts']));
    expect(newFields.some(field => field.key === 'activity')).toBe(false);
  });
});
