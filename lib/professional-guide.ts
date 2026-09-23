export type ProfessionalGuideProgress = {
  version: 1;
  pathwayId: string;
  step: number;
  reviewedRequirementSetId?: string;
  mentorReviewNote?: string;
  completedAt?: string;
};
type Context = {
  pathwayId: string;
  requirementSetId: string | null;
  evidenceCount: number;
};
export function professionalGuideSteps(
  context: Context,
  progress?: ProfessionalGuideProgress,
) {
  const reviewed = Boolean(
    context.requirementSetId &&
    progress?.pathwayId === context.pathwayId &&
    progress.reviewedRequirementSetId === context.requirementSetId,
  );
  return [
    {
      title: 'Choose your pathway',
      description: 'Name the agency and pathway, then link a mentor if known.',
      complete: Boolean(context.pathwayId),
    },
    {
      title: 'Capture the requirements',
      description:
        'Use a dated, cited source. Capture its version before linking evidence.',
      complete: Boolean(context.requirementSetId),
    },
    {
      title: 'Add or link evidence',
      description:
        'Record an experience, certification or assessment and link the real supporting records.',
      complete: context.evidenceCount > 0,
    },
    {
      title: 'Review gaps and unknowns',
      description:
        'Read the evidence matrix below. Unknown or manual-review requirements still need a decision.',
      complete: reviewed,
    },
    {
      title: 'Plan your mentor review',
      description:
        'Record your next action. Setup completion does not certify readiness or meet an agency requirement.',
      complete: reviewed && Boolean(progress?.completedAt),
    },
  ].map((step) => ({ ...step, requirementSetId: context.requirementSetId }));
}
export function advanceProfessionalGuide(
  progress: ProfessionalGuideProgress,
  steps: ReturnType<typeof professionalGuideSteps>,
  note: string,
): ProfessionalGuideProgress {
  if (progress.step < 3 && !steps[progress.step]?.complete)
    throw new Error(
      `Complete ${steps[progress.step]?.title.toLowerCase() ?? 'the current step'} first.`,
    );
  if (progress.step >= 3 && steps.slice(0, 3).some((step) => !step.complete))
    throw new Error(
      'Choose a pathway, capture requirements and add evidence before reviewing setup.',
    );
  if (progress.step === 4 && !note.trim())
    throw new Error('Record the next mentor-review action.');
  if (progress.step === 4 && !steps[3]?.complete)
    throw new Error(
      'Review the current requirement version before completing setup.',
    );
  return {
    ...progress,
    step: Math.min(4, progress.step + 1),
    ...(progress.step >= 3
      ? {
          reviewedRequirementSetId: steps[1]!.requirementSetId!,
          mentorReviewNote: note.trim(),
        }
      : {}),
    ...(progress.step === 4 ? { completedAt: new Date().toISOString() } : {}),
  };
}
