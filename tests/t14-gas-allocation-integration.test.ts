import { describe, it, expect } from 'vitest';
import {
  allocationContext,
  allocationReadiness,
  allocationSegments,
  allocationEngineInput,
  emptyAllocation,
  gasPlanWithAllocation,
} from '../lib/gas-allocation/integration';
import {
  buildRecreationalGasSnapshot,
  type RecreationalGasInput,
} from '../lib/offline/recreational-gas-planner';
import type { GasPlanRecord } from '../lib/offline/planning-pages';
import { newAllocationCylinder } from '../lib/gas-allocation/editor-input';
const input: RecreationalGasInput = {
  mode: 'direct-ascent',
  selectedBuhlmannModel: 'ZH-L16C',
  compareOtherModel: false,
  gfLow: 40,
  gfHigh: 85,
  waterType: 'salt',
  surfacePressureBar: 1,
  plannedDepthM: 30,
  conservatismM: 0,
  maxPpo2: 1.4,
  selectedGasLabel: 'Air / EAN21',
  cylinderWaterVolumeL: 12,
  startPressureBar: 200,
  ownRmvLMin: 15,
  buddyRmvLMin: 15,
  reserveStrategy: 'most-conservative',
  ascentRateMMin: 9,
  ownerMaxDurationMin: null,
  plannedWorkingTimeMin: 10,
  routeSegments: [],
};
describe('T14 allocation integrates around frozen engines', () => {
  it('preserves custom reserve pressure as an additional floor and retains end/turn observations', () => {
    const allocation = emptyAllocation();
    allocation.cylinders = [
      {
        ...newAllocationCylinder('temporary', 0.21),
        id: 'a',
        waterVolumeL: 12,
        plannedStartPressureBar: 200,
        currentPressureBar: 200,
        reserveFloorBar: 80,
        endPressureBar: 60,
        turnPressureBar: 140,
      },
    ];
    const context = allocationContext(
      input,
      buildRecreationalGasSnapshot(input),
      allocation,
    );
    expect(context.reserveFloors[0]?.litres).toBe(960);
    const output = gasPlanWithAllocation(
      {
        name: 'Retained',
        status: 'draft',
        cylinders: [],
      } as unknown as GasPlanRecord,
      input,
      buildRecreationalGasSnapshot(input),
      allocation,
    );
    expect(output.cylinders[0]).toMatchObject({
      reservePressureBar: 80,
      endPressureBar: 60,
      turnPressureBar: 140,
    });
  });
  it('does not validate a long route using a shorter declared working time', () => {
    const route = {
      ...input,
      mode: 'multilevel' as const,
      plannedWorkingTimeMin: 5,
      routeSegments: [
        {
          id: 'long',
          label: 'Long leg',
          startDepthM: 30,
          endDepthM: 30,
          depthM: 30,
          minutes: 40,
        },
      ],
    };
    expect(
      allocationReadiness(
        route,
        buildRecreationalGasSnapshot(route),
        emptyAllocation(),
      ).physiologicalReasons.join(' '),
    ).toMatch(/route.*working time/i);
  });
  it('does not feed an unverified manifold capacity into the reference engine', () => {
    const allocation = emptyAllocation();
    allocation.referenceSupplyId = 'bad';
    allocation.manifolds = [
      {
        id: 'bad',
        label: 'Unverified',
        cylinderIds: ['missing-a', 'missing-b'],
        connected: false,
        operatingState: 'unknown',
      },
    ];
    const result = allocationEngineInput(input, allocation);
    expect(result.cylinderWaterVolumeL).toBeNull();
    expect(result.sourceWarnings?.join(' ')).toMatch(/reference/i);
  });
  it('retains the 860.625 L reserve and does not apply new universal factors', () => {
    const frozen = buildRecreationalGasSnapshot(input, 'test');
    const before = structuredClone(frozen);
    const allocation = emptyAllocation();
    const context = allocationContext(input, frozen, allocation);
    expect(context.reserveMinimumL).toBe(860.625);
    expect(frozen.reserve.thirdsLitres).toBe(800);
    expect(frozen).toEqual(before);
    expect(allocation.scenarios).toEqual([]);
    expect(allocationSegments(input, allocation)[0]?.stressFactor).toBe(1);
  });
  it('keeps requirements-only plans from becoming ready without owned cylinders or supply commitments', () => {
    expect(
      allocationReadiness(
        input,
        buildRecreationalGasSnapshot(input),
        emptyAllocation(),
      ).status,
    ).toBe('BLOCKED');
  });
  it('retains unknown and legacy record fields when saving versioned allocation metadata', () => {
    const legacy = {
      name: 'Legacy',
      status: 'draft',
      cylinders: [],
      notes: 'Preserve',
      tableReference: { ownerValue: 'original' },
      future: { keep: true },
    } as unknown as GasPlanRecord;
    const output = gasPlanWithAllocation(
      legacy,
      input,
      buildRecreationalGasSnapshot(input),
      emptyAllocation(),
    );
    expect(output).toMatchObject({
      notes: 'Preserve',
      tableReference: { ownerValue: 'original' },
      future: { keep: true },
      allocationV1: { version: 'zeustek-allocation/1' },
    });
    expect(legacy).not.toHaveProperty('allocationV1');
  });
});
