import { describe, it, expect } from 'vitest';
import {
  assessGasAllocation,
  type AllocationPlan,
  type AllocationContext,
  type AllocationCylinder,
} from '../lib/gas-allocation/model';
import { ownedFullEligibility } from '../lib/gas-allocation/supply';
const cylinder = (
  id: string,
  litres: number,
  patch: Partial<AllocationCylinder> = {},
): AllocationCylinder => ({
  id,
  snapshotId: 'snap-' + id,
  capturedAt: '2026-09-23',
  canonicalId: null,
  mode: 'temporary',
  label: id,
  role: 'main',
  gas: { oxygen: 0.21, helium: 0 },
  waterVolumeL: 10,
  currentPressureBar: litres / 10,
  plannedStartPressureBar: litres / 10,
  ratedPressureBar: 300,
  availableFrom: 'start',
  analysisConfirmed: true,
  analysisSource: 'analysed-by-operator',
  analysedAt: '2026-09-23T08:00:00Z',
  conditionConfirmed: true,
  ...patch,
});
const leg = (id: string, supplyId: string, minutes: number) => ({
  id,
  label: id,
  depthM: 0,
  minutes,
  startDepthM: 0,
  endDepthM: 0,
  cylinderId: supplyId,
  stressFactor: 1,
});
const context = (
  segments: AllocationContext['segments'],
  reserveMinimumL = 0,
): AllocationContext => ({
  segments,
  ownRmvLMin: 10,
  buddyRmvLMin: 10,
  waterType: 'salt',
  surfacePressureBar: 1,
  reserveMinimumL,
  maxPpo2: 1.4,
});
const plan = (
  cylinders: AllocationCylinder[],
  patch: Partial<AllocationPlan> = {},
): AllocationPlan => ({
  version: 'zeustek-allocation/1',
  mode: 'supplied',
  cylinders,
  manifolds: [],
  reserves: [],
  scenarios: [],
  ...patch,
});
describe('T14 independent accessibility allocation', () => {
  it('requires compatible actual pressure evidence before combining an open manifold', () => {
    const p = plan(
      [cylinder('a', 1200), cylinder('b', 1200, { currentPressureBar: 80 })],
      {
        manifolds: [
          {
            id: 'm',
            label: 'Pair',
            cylinderIds: ['a', 'b'],
            connected: true,
            operatingState: 'open',
          },
        ],
      },
    );
    expect(
      assessGasAllocation(p, context([leg('one', 'm', 10)])).reasons.join(' '),
    ).toMatch(/Manifold/);
  });
  it('requires actual pressure and dated analysis evidence before a hire request can pass', () => {
    const result = assessGasAllocation(
      plan([
        cylinder('hire', 2000, {
          mode: 'hire',
          currentPressureBar: null,
          analysisSource: 'label-only',
          analysedAt: null,
        }),
      ]),
      context([leg('one', 'hire', 10)]),
    );
    expect(result.status).toBe('CAUTION');
    expect(result.cylinders[0]?.reasons.join(' ')).toMatch(/pressure/i);
    expect(result.cylinders[0]?.reasons.join(' ')).toMatch(/analysis/i);
  });
  it('blocks reserve gas that cannot be breathed at its assigned checkpoint depth', () => {
    const p = plan(
      [
        cylinder('air', 2000),
        cylinder('oxygen', 1000, {
          role: 'pony',
          gas: { oxygen: 0.8, helium: 0 },
        }),
      ],
      {
        reserves: [
          {
            id: 'r',
            supplyId: 'oxygen',
            litres: 200,
            from: 'start',
            through: 'one',
          },
        ],
      },
    );
    const result = assessGasAllocation(
      p,
      context(
        [
          {
            ...leg('one', 'air', 10),
            startDepthM: 20,
            endDepthM: 20,
            depthM: 20,
          },
        ],
        200,
      ),
    );
    expect(result.status).toBe('BLOCKED');
    expect(result.cylinders.find((row) => row.id === 'oxygen')?.status).toBe(
      'BLOCKED',
    );
  });
  it('rejects overlapping reserve assignments and ambiguous duplicate scenario identities', () => {
    const p = plan([cylinder('a', 2000)], {
      reserves: [
        { id: 'r1', supplyId: 'a', litres: 100, from: 'start', through: 'one' },
        { id: 'r2', supplyId: 'a', litres: 100, from: 'one', through: 'two' },
      ],
    });
    expect(
      assessGasAllocation(
        p,
        context([leg('one', 'a', 10), leg('two', 'a', 10)], 100),
      ).status,
    ).toBe('BLOCKED');
  });
  it('blocks 600/1400 L against 700/900 L despite a sufficient aggregate', () => {
    const result = assessGasAllocation(
      plan([cylinder('left', 600), cylinder('right', 1400)]),
      context([leg('a', 'left', 70), leg('b', 'right', 90)]),
    );
    expect(result.cylinders.find((row) => row.id === 'left')).toMatchObject({
      status: 'BLOCKED',
      availableLitres: 600,
      requiredLitres: 700,
    });
    expect(result.cylinders.find((row) => row.id === 'right')?.status).toBe(
      'PASS',
    );
    expect(result.status).toBe('BLOCKED');
  });
  it('permits an explicit connected manifold, preserves both members and matches a combined working supply', () => {
    const group = {
      id: 'pair',
      label: 'Open manifold',
      cylinderIds: ['a', 'b'],
      connected: true,
      operatingState: 'open' as const,
    };
    const combined = assessGasAllocation(
      plan(
        [
          cylinder('single', 2400, {
            waterVolumeL: 20,
            currentPressureBar: 120,
            plannedStartPressureBar: 120,
          }),
        ],
        {
          reserves: [
            {
              id: 'r',
              supplyId: 'single',
              litres: 200,
              from: 'start',
              through: 'route',
            },
          ],
        },
      ),
      context([leg('route', 'single', 100)], 200),
    );
    const paired = assessGasAllocation(
      plan([cylinder('a', 1200), cylinder('b', 1200)], {
        manifolds: [group],
        reserves: [
          {
            id: 'r',
            supplyId: 'pair',
            litres: 200,
            from: 'start',
            through: 'route',
          },
        ],
      }),
      context([leg('route', 'pair', 100)], 200),
    );
    expect(combined.status).toBe('PASS');
    expect(paired.status).toBe('PASS');
    expect(paired.cylinders).toHaveLength(2);
    expect(
      paired.cylinders.reduce((total, row) => total + row.requiredLitres, 0),
    ).toBe(combined.cylinders[0]?.requiredLitres);
    expect(paired.cylinders.map((row) => row.requiredLitres)).toEqual([
      600, 600,
    ]);
    const invalid = plan(
      [cylinder('a', 1200), cylinder('b', 1200, { conditionConfirmed: false })],
      {
        manifolds: [group],
        reserves: [
          {
            id: 'r',
            supplyId: 'pair',
            litres: 200,
            from: 'start',
            through: 'route',
          },
        ],
      },
    );
    expect(
      assessGasAllocation(invalid, context([leg('route', 'pair', 100)], 200))
        .status,
    ).not.toBe('PASS');
  });
  it('blocks missing reserves, unavailable stages and a missing explicit gas switch', () => {
    expect(
      assessGasAllocation(
        plan([cylinder('a', 2000)]),
        context([leg('one', 'a', 20)], 800),
      ).status,
    ).toBe('BLOCKED');
    expect(
      assessGasAllocation(
        plan([
          cylinder('stage', 2000, { role: 'stage', availableFrom: 'one' }),
        ]),
        context([leg('one', 'stage', 20)]),
      ).status,
    ).toBe('BLOCKED');
    const mixed = plan([
      cylinder('a', 2000),
      cylinder('b', 2000, { gas: { oxygen: 0.32, helium: 0 } }),
    ]);
    const result = assessGasAllocation(
      mixed,
      context([leg('one', 'a', 10), leg('two', 'b', 10)]),
    );
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons.join(' ')).toMatch(/explicit switch/i);
  });
  it('keeps pony gas reserved and blocks independent deficits without moving surplus', () => {
    const result = assessGasAllocation(
      plan([cylinder('main', 500), cylinder('pony', 1000, { role: 'pony' })], {
        reserves: [
          {
            id: 'r',
            supplyId: 'pony',
            litres: 800,
            from: 'start',
            through: 'leg',
          },
        ],
      }),
      context([leg('leg', 'main', 60)], 800),
    );
    expect(result.cylinders.find((row) => row.id === 'main')?.status).toBe(
      'BLOCKED',
    );
    expect(
      result.cylinders.find((row) => row.id === 'pony')?.requiredLitres,
    ).toBe(800);
  });
  it('checks alternative contingencies separately and blocks a selected failed-switch scenario', () => {
    const reserve = [
      { id: 'r', supplyId: 'a', litres: 100, from: 'start', through: 'two' },
    ];
    const scenario = {
      id: 'failed-switch',
      label: 'Later switch fails',
      selected: true,
      at: 'one',
      failedSupplyIds: ['b'],
      assignments: [{ segmentId: 'two', supplyId: 'a' }],
      reserves: reserve,
    };
    const result = assessGasAllocation(
      plan([cylinder('a', 600), cylinder('b', 1200)], {
        reserves: reserve,
        scenarios: [scenario],
      }),
      context([leg('one', 'a', 30), leg('two', 'b', 50)], 100),
    );
    expect(result.scenarios[0]).toMatchObject({
      status: 'BLOCKED',
      kind: 'contingency/bailout',
    });
    expect(result.status).toBe('BLOCKED');
    const enough = assessGasAllocation(
      plan([cylinder('a', 1000), cylinder('b', 1200)], {
        reserves: reserve,
        scenarios: [scenario, { ...scenario, id: 'alternative' }],
      }),
      context([leg('one', 'a', 30), leg('two', 'b', 50)], 100),
    );
    expect(enough.status).toBe('PASS');
  });
  it('applies a selected contingency factor once to route consumption, never to the frozen reserve', () => {
    const reserves = [
      { id: 'r', supplyId: 'a', litres: 200, from: 'start', through: 'one' },
    ];
    const p = plan([cylinder('a', 2000)], {
      reserves,
      scenarios: [
        {
          id: 's',
          label: 'Owner extra allowance',
          selected: true,
          at: 'start',
          failedSupplyIds: [],
          assignments: [{ segmentId: 'one', supplyId: 'a' }],
          reserves,
          advanced: {
            version: 1,
            enabled: true,
            factor: 2,
            basis: 'route-consumption-excluding-reserve',
            ownerSelectedAt: '2026-09-23',
          },
        },
      ],
    });
    const result = assessGasAllocation(
      p,
      context([{ ...leg('one', 'a', 10), stressFactor: 1.5 }], 200),
    );
    expect(result.scenarios[0]?.cylinders[0]?.requiredLitres).toBe(500); // 100 ×1.5 ×2 +200, not (150+200)×2
    expect(result.cylinders[0]?.requiredLitres).toBe(350);
  });
  it('reports sidemount balance per checkpoint against an explicit owner-selected tolerance', () => {
    const p = plan(
      [
        cylinder('l', 2000, { role: 'sidemount-left' }),
        cylinder('r', 2000, { role: 'sidemount-right' }),
      ],
      { sidemountBalanceToleranceBar: 20 },
    );
    const result = assessGasAllocation(
      p,
      context([leg('one', 'l', 30), leg('two', 'r', 30)]),
    );
    expect(
      result.balance.some(
        (row) => row.differenceBar === 30 && row.status === 'BLOCKED',
      ),
    ).toBe(true);
    expect(result.status).toBe('BLOCKED');
  });
  it('rejects duplicate identities, incompatible manifolds, invalid parameters and discontinuous depths', () => {
    expect(
      assessGasAllocation(
        plan([cylinder('a', 1000), cylinder('a', 1000)]),
        context([leg('one', 'a', 10)]),
      ).status,
    ).toBe('BLOCKED');
    const p = plan(
      [
        cylinder('a', 1000),
        cylinder('b', 1000, { gas: { oxygen: 0.32, helium: 0 } }),
      ],
      {
        manifolds: [
          {
            id: 'm',
            label: 'Bad',
            cylinderIds: ['a', 'b'],
            connected: true,
            operatingState: 'open',
          },
        ],
      },
    );
    expect(assessGasAllocation(p, context([leg('one', 'm', 10)])).status).toBe(
      'BLOCKED',
    );
    expect(
      assessGasAllocation(
        plan([cylinder('a', 1000)]),
        context([
          leg('one', 'a', 10),
          { ...leg('two', 'a', 10), startDepthM: 10 },
        ]),
      ).status,
    ).toBe('BLOCKED');
  });
  it('uses requested pressure minus the explicit tolerance, not one global full threshold', () => {
    expect(
      ownedFullEligibility({
        currentPressureBar: 200,
        requestedPressureBar: 300,
        toleranceBar: 5,
      }),
    ).toBe(false);
    expect(
      ownedFullEligibility({
        currentPressureBar: 225,
        requestedPressureBar: 230,
        toleranceBar: 5,
      }),
    ).toBe(true);
    expect(
      ownedFullEligibility({
        currentPressureBar: null,
        requestedPressureBar: 200,
        toleranceBar: 5,
      }),
    ).toBe(false);
  });
  it('does not allow an unselected failed scenario to poison another alternative', () => {
    const p = plan([cylinder('a', 2000)], {
      scenarios: [
        {
          id: 'off',
          label: 'Not selected',
          selected: false,
          at: 'start',
          failedSupplyIds: ['a'],
          assignments: [{ segmentId: 'one', supplyId: 'a' }],
          reserves: [],
        },
        {
          id: 'on',
          label: 'Selected valid alternative',
          selected: true,
          at: 'start',
          failedSupplyIds: [],
          assignments: [{ segmentId: 'one', supplyId: 'a' }],
          reserves: [],
        },
      ],
    });
    const result = assessGasAllocation(p, context([leg('one', 'a', 10)]));
    expect(result.scenarios[0]?.status).toBe('BLOCKED');
    expect(result.scenarios[1]?.status).toBe('PASS');
    expect(result.status).toBe('PASS');
  });
  it('enforces frozen thirds floors for each accessible supply, even when the total emergency reserve is assigned', () => {
    const p = plan([cylinder('a', 2400), cylinder('b', 2400)], {
      reserves: [
        { id: 'r', supplyId: 'a', litres: 1600, from: 'start', through: 'two' },
      ],
    });
    const result = assessGasAllocation(p, {
      ...context([leg('one', 'a', 10), leg('two', 'b', 10)], 860.625),
      reserveFloors: [
        { supplyId: 'a', litres: 800 },
        { supplyId: 'b', litres: 800 },
      ],
    });
    expect(result.status).toBe('BLOCKED');
    expect(result.reasons.join(' ')).toMatch(/individual.*reserve floor/i);
  });
});
