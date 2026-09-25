import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProfessionalRequirementBuilder } from '../components/professional-requirement-builder';
import { SkillCircuitTracker } from '../components/skill-circuit-tracker';
import { PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026, projectSkillCircuit } from '../lib/professional-development/skill-circuit';

describe('T14 #63 circuit capture and presentation', () => {
  it('offers a versioned 24-skill progress rule beside existing assessment sources', () => {
    const html = renderToStaticMarkup(React.createElement(ProfessionalRequirementBuilder, { value: '[]', change: () => {}, skills: [] }));
    expect(html).toContain('24-skill circuit progress');
    expect(html).toMatch(/five-exercise water-skills progress/i);
  });
  it('renders 24 named rows, history actions and a clearly provisional 82-point target', () => {
    const rubric = PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026;
    const progress = projectSkillCircuit(rubric, [{ id: 'attempt-1', itemKey: 'skill-01', rubricId: rubric.id,
      occurredAt: '2026-09-25T12:00:00Z', mode: 'practice', evaluatorPersonId: null, evaluatorScore: 4 }]);
    const html = renderToStaticMarkup(React.createElement(SkillCircuitTracker, { rubric, progress,
      openAttempt: () => {}, addAttempt: () => {} }));
    expect(html).toContain('24-skill circuit');
    expect(html).toContain('0 / 120');
    expect(html).toContain('instructor confirmation pending');
    expect(html).toContain('Five-point ascent');
    expect(html).toContain('Emergency weight drop');
    expect(html.match(/Record attempt for /g)).toHaveLength(24);
    expect(html).toContain('Open recorded attempt');
    expect(html).not.toContain('PADI certified');
  });
  it('makes a below-three formal score and an underwater five understandable by text', () => {
    const rubric = PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026;
    const attempts = [
      { id: 'low', itemKey: 'skill-01', rubricId: rubric.id, occurredAt: '2026-09-24T10:00:00Z',
        mode: 'formal' as const, evaluatorPersonId: 'evaluator', evaluatorScore: 2 },
      { id: 'underwater-five', itemKey: 'skill-14', rubricId: rubric.id, occurredAt: '2026-09-24T10:00:00Z',
        mode: 'formal' as const, evaluatorPersonId: 'evaluator', evaluatorScore: 5 },
    ];
    const html = renderToStaticMarkup(React.createElement(SkillCircuitTracker, {
      rubric, progress: projectSkillCircuit(rubric, attempts), openAttempt: () => {}, addAttempt: () => {},
    }));
    expect(html).toContain('Below 3-point minimum');
    expect(html).toContain('Underwater 5 recorded');
  });
});
