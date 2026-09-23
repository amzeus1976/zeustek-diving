import { describe, it, expect } from 'vitest';
import {
  professionalGuideSteps,
  advanceProfessionalGuide,
} from '../lib/professional-guide';
describe('T14 guided professional setup', () => {
  it('keeps missing requirements and evidence as unmet steps', () => {
    const steps = professionalGuideSteps({
      pathwayId: 'p',
      requirementSetId: null,
      evidenceCount: 0,
    });
    expect(steps.map((step) => step.complete)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(() =>
      advanceProfessionalGuide(
        { version: 1, pathwayId: 'p', step: 1 },
        steps,
        '',
      ),
    ).toThrow(/requirement/i);
  });
  it('records explicit review progress without turning setup completion into readiness', () => {
    const context = {
      pathwayId: 'p',
      requirementSetId: 'r1',
      evidenceCount: 1,
    };
    const progress = { version: 1 as const, pathwayId: 'p', step: 3 };
    const reviewed = advanceProfessionalGuide(
      progress,
      professionalGuideSteps(context),
      'Discuss unknown requirements with mentor',
    );
    expect(reviewed.step).toBe(4);
    const completed = advanceProfessionalGuide(
      reviewed,
      professionalGuideSteps(context, reviewed),
      'Discuss unknown requirements with mentor',
    );
    expect(completed.completedAt).toBeTruthy();
    expect(completed).not.toHaveProperty('ready');
    expect(completed.reviewedRequirementSetId).toBe('r1');
  });
  it('requires a fresh review after the captured standard changes', () => {
    const progress = {
      version: 1 as const,
      pathwayId: 'p',
      step: 4,
      reviewedRequirementSetId: 'old',
      completedAt: '2026-09-23T12:00:00Z',
      mentorReviewNote: 'Review with mentor',
    };
    expect(
      professionalGuideSteps(
        { pathwayId: 'p', requirementSetId: 'new', evidenceCount: 1 },
        progress,
      )
        .slice(3)
        .every((step) => !step.complete),
    ).toBe(true);
  });
});
