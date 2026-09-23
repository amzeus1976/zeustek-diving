import { describe, it, expect } from 'vitest';
import { reviewAllocationEvidence } from '../lib/gas-allocation/evidence-review';
import { emptyAllocation } from '../lib/gas-allocation/integration';
import { newAllocationCylinder } from '../lib/gas-allocation/editor-input';
import type { GasPlanRecord } from '../lib/offline/planning-pages';
import type { CylinderEquipmentRecord } from '../lib/offline/loadouts-gas';
import type { Stored } from '../lib/offline/dive-planning';
describe('T14 captured supply evidence review', () => {
  it('blocks missing or changed canonical evidence without rewriting the saved snapshot', () => {
    const allocation = emptyAllocation();
    allocation.cylinders = [
      {
        ...newAllocationCylinder('own-full', 0.21),
        canonicalId: 'owned',
        conditionConfirmed: true,
        waterVolumeL: 12,
        ratedPressureBar: 232,
        currentPressureBar: 200,
        fillId: 'old-fill',
        analysisId: 'old-analysis',
      },
    ];
    const before = structuredClone(allocation),
      draft = { cylinders: [] } as unknown as GasPlanRecord;
    const missing = reviewAllocationEvidence(allocation, draft, [], [], []);
    expect(missing.cylinders[0]?.blockedReasons?.join(' ')).toMatch(/missing/i);
    const cylinder = {
      entityId: 'owned',
      name: 'Owned',
      waterVolumeLiters: 15,
      workingPressureBar: 232,
      currentPressureBar: 100,
      cylinderStatus: 'retired',
    } as unknown as Stored<CylinderEquipmentRecord>;
    const changed = reviewAllocationEvidence(
      allocation,
      draft,
      [cylinder],
      [],
      [],
    );
    expect(changed.cylinders[0]?.blockedReasons?.join(' ')).toMatch(/changed/i);
    expect(changed.cylinders[0]?.blockedReasons?.join(' ')).toMatch(
      /inspection.*missing/i,
    );
    expect(changed.cylinders[0]?.snapshotId).toBe(
      before.cylinders[0]?.snapshotId,
    );
    expect(allocation).toEqual(before);
  });
});
