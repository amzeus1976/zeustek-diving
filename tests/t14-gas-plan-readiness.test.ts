import { describe, it, expect } from 'vitest';
import {
  applyAllocationReadiness,
  allocationPlanReference,
} from '../lib/gas-allocation/plan-readiness';
import type { PlanReadiness } from '../lib/offline/dive-planning-centre';
describe('T14 linked allocation readiness', () => {
  it('does not let a complete Dive checklist hide a blocked or cautionary gas allocation', () => {
    const base: PlanReadiness = {
      state: 'ready',
      completed: 11,
      total: 11,
      percent: 100,
      warnings: [],
    };
    expect(
      applyAllocationReadiness(base, [
        { name: 'Left cylinder deficit', status: 'BLOCKED' },
      ]),
    ).toMatchObject({ state: 'needs-attention', completed: 11, total: 12 });
    expect(
      applyAllocationReadiness(base, [
        { name: 'Fill requested', status: 'CAUTION' },
      ]).warnings.join(' '),
    ).toMatch(/Fill requested/);
    expect(
      applyAllocationReadiness(base, [
        { name: 'Confirmed supplies', status: 'PASS' },
      ]).state,
    ).toBe('ready');
    expect(applyAllocationReadiness(base, [])).toEqual(base);
  });
  it('stores a labelled allocation summary without presenting the old reference as overall readiness', () => {
    const result = allocationPlanReference(
      {
        entityId: 'gas',
        name: 'Plan',
        notes: 'Keep',
        allocationV1: { version: 'zeustek-allocation/1' },
      } as never,
      {
        status: 'BLOCKED',
        physiologicalStatus: 'PASS',
        physiologicalReasons: [],
        allocation: {
          reasons: [],
          cylinders: [
            {
              id: 'left',
              status: 'BLOCKED',
              reasons: ['Shortfall'],
              availableLitres: 600,
              requiredLitres: 700,
              reserveLitres: 100,
            },
          ],
        },
      } as never,
      'now',
    );
    expect(result).toMatchObject({
      gasPlanId: 'gas',
      notes: 'Keep',
      allocationSummary: { status: 'BLOCKED', physiologicalStatus: 'PASS' },
    });
    expect(result).not.toHaveProperty('recreationalSummary');
  });
});
