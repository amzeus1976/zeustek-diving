import { describe, expect, it } from 'vitest';
import {
  projectSkillCurrency,
  currencySummary,
  recommendedNextPractice,
  type CurrencyPolicyRecord,
} from '../lib/offline/skills-currency';
import type {
  CanonicalSkillRecord,
  SkillEvidenceRecord,
} from '../lib/offline/dive-context';
import { canonicalSkillGroups } from '../lib/offline/dive-context';

describe('canonical Skill Groups shared with Settings', () => {
  it('retains all 54 configured names, archived-only groups and future additions without changing Skills', () => {
    const skills = Array.from({ length: 54 }, (_, index): CanonicalSkillRecord => ({
      entityId: `group-skill-${index}`, name: `Skill ${index}`, group: `Custom group ${index + 1}`, archived: index === 53,
    }));
    const before = JSON.stringify(skills);
    expect(canonicalSkillGroups(skills)).toHaveLength(54);
    expect(canonicalSkillGroups(skills)).toContain('Custom group 54');
    expect(canonicalSkillGroups([...skills, {...skills[0]!, entityId: 'duplicate', group: ' Custom group 1 '}])).toHaveLength(54);
    expect(canonicalSkillGroups([...skills, {entityId: 'new', name: 'New Skill', group: 'New owner group'}])).toContain('New owner group');
    expect(JSON.stringify(skills)).toBe(before);
  });
});

const skill: CanonicalSkillRecord = {
  entityId: 'skill-1',
  skillKey: 'skill-1',
  name: 'DSMB deployment',
  group: 'DSMB & ascent',
};
const policy = (
  overrides: Partial<CurrencyPolicyRecord> = {},
): CurrencyPolicyRecord => ({
  skillKey: 'skill-1',
  recommendedIntervalDays: 90,
  dueSoonDays: 14,
  qualifyingAssessmentValues: [],
  enabled: true,
  createdAt: '',
  modifiedAt: '',
  ...overrides,
});
const evidence = (
  performedAt: string,
  overrides: Partial<SkillEvidenceRecord> = {},
): SkillEvidenceRecord => ({
  entityId: `ev-${performedAt}`,
  skillKey: 'skill-1',
  performedAt,
  competenceLevel: 'competent',
  confidenceLevel: 4,
  evaluatorPersonId: null,
  attachmentIds: [],
  ...overrides,
});

describe('T06 Skills & Currency derived projection', () => {
  it('excludes future evidence, preserves numeric history, and supports disabled/no-evidence states', () => {
    const clock = new Date('2026-09-13T12:00:00Z');
    const old = evidence('2026-05-01T12:00:00Z', { competenceLevel: 3 });
    const future = evidence('2026-12-01T12:00:00Z');
    expect(
      projectSkillCurrency(skill, [old, future], policy(), clock).status,
    ).toBe('needs-practice');
    const disabled = projectSkillCurrency(
      skill,
      [old, future],
      policy({ enabled: false }),
      clock,
    );
    expect(disabled.status).toBe('not-assessed');
    expect(disabled.latestEvidence?.competenceLevel).toBe(3);
    expect(projectSkillCurrency(skill, [], policy(), clock).status).toBe(
      'not-assessed',
    );
  });
  it('returns Not assessed when no policy exists rather than inventing currency', () => {
    const row = projectSkillCurrency(
      skill,
      [evidence('2026-09-01T12:00:00Z')],
      null,
      new Date('2026-09-13T12:00:00Z'),
    );
    expect(row.status).toBe('not-assessed');
    expect(row.policyEnabled).toBe(false);
  });
  it('derives Current and Due soon deterministically from evidence plus policy', () => {
    expect(
      projectSkillCurrency(
        skill,
        [evidence('2026-09-01T12:00:00Z')],
        policy(),
        new Date('2026-09-13T12:00:00Z'),
      ).status,
    ).toBe('current');
    expect(
      projectSkillCurrency(
        skill,
        [evidence('2026-06-29T12:00:00Z')],
        policy(),
        new Date('2026-09-13T12:00:00Z'),
      ).status,
    ).toBe('due-soon');
  });
  it('derives Needs practice after the policy interval without rewriting evidence', () => {
    const item = evidence('2026-05-01T12:00:00Z');
    const original = { ...item };
    const row = projectSkillCurrency(
      skill,
      [item],
      policy(),
      new Date('2026-09-13T12:00:00Z'),
    );
    expect(row.status).toBe('needs-practice');
    expect(item).toEqual(original);
  });
  it('honours qualifying assessment values and evaluator verification separately', () => {
    const p = policy({ qualifyingAssessmentValues: ['Pass'] });
    const unqualified = evidence('2026-09-01T12:00:00Z', {
      assessment: 'Needs work',
      evaluatorPersonId: 'person-1',
    });
    const row = projectSkillCurrency(
      skill,
      [unqualified],
      p,
      new Date('2026-09-13T12:00:00Z'),
    );
    expect(row.status).toBe('not-assessed');
    expect(row.latestEvidence?.entityId).toBe(unqualified.entityId);
    expect(row.evaluatorVerified).toBe(true);
  });
  it('summarises and prioritises practice without persisting derived state', () => {
    const rows = [
      {
        projection: {
          ...projectSkillCurrency(
            skill,
            [evidence('2026-05-01T12:00:00Z')],
            policy(),
            new Date('2026-09-13T12:00:00Z'),
          ),
        },
      },
      {
        projection: {
          ...projectSkillCurrency(
            skill,
            [evidence('2026-09-01T12:00:00Z')],
            policy(),
            new Date('2026-09-13T12:00:00Z'),
          ),
        },
      },
    ];
    const summary = currencySummary(rows.map((row) => row.projection));
    expect(summary['needs-practice']).toBe(1);
    expect(summary.current).toBe(1);
    expect(recommendedNextPractice(rows)[0]?.projection.status).toBe(
      'needs-practice',
    );
  });
});
