import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore } from '../lib/offline/dive-store';
import { listCylinderInventory } from '../lib/offline/loadouts-gas';
import {
  listGasPlans,
  projectGasCylinder,
  rentalCylinderRecreationalInput,
  saveGasPlan,
  saveRentalCylinderAsOwned,
  setGasCylinderSourceMode,
  warnGasPlan,
  type GasPlanCylinder,
  type GasPlanRecord,
} from '../lib/offline/planning-pages';
import { buildRecreationalGasSnapshot } from '../lib/offline/recreational-gas-planner';

const rentalCylinder = (
  patch: Partial<GasPlanCylinder> = {},
): GasPlanCylinder => ({
  id: 'rental-slot-1',
  sourceMode: 'rental',
  role: 'primary',
  cylinderEquipmentId: null,
  reservePressureBar: 50,
  targetPpo2: 1.4,
  rentalSnapshot: {
    label: 'Boat AL80',
    cylinderType: 'aluminium',
    waterVolumeL: 11.1,
    workingPressureBar: 207,
    startPressureBar: 200,
    remainingPressureBar: null,
    valveType: 'DIN',
    gasType: 'nitrox',
    oxygenFraction: 0.32,
    heliumFraction: 0,
    analysisStatus: 'current',
    analysisSource: 'analysed-by-operator',
    analysedAt: '2026-09-21T08:30:00.000Z',
    fillSource: 'day-boat',
    notes: 'Holiday rental cylinder.',
  },
  ...patch,
});

const gasPlan = (
  cylinder: GasPlanCylinder,
): Omit<GasPlanRecord, 'createdAt' | 'modifiedAt'> => ({
  name: 'Holiday gas plan',
  status: 'draft',
  plannedDepthM: 30,
  plannedBottomTimeMin: 30,
  rmvRateLitresMin: 18,
  cylinders: [cylinder],
  warnings: [],
  notes: '',
});

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t12-5e-rental-cylinder-mode');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('T12.5E rental cylinder projection', () => {
  it('switches source modes without carrying canonical IDs into a rental snapshot', () => {
    const owned: GasPlanCylinder = {
      id: 'slot-1',
      sourceMode: 'owned',
      role: 'primary',
      cylinderEquipmentId: 'cylinder-1',
      fillId: 'fill-1',
      analysisId: 'analysis-1',
      reservePressureBar: 50,
    };

    const rental = setGasCylinderSourceMode(owned, 'rental');
    expect(rental).toMatchObject({
      sourceMode: 'rental',
      cylinderEquipmentId: null,
      fillId: null,
      analysisId: null,
      rentalSnapshot: {
        label: '',
        cylinderType: 'unknown',
        valveType: 'unknown',
        heliumFraction: 0,
        analysisStatus: 'missing',
        fillSource: 'unknown',
      },
    });

    const backToOwned = setGasCylinderSourceMode(rental, 'owned');
    expect(backToOwned.sourceMode).toBe('owned');
    expect(backToOwned.rentalSnapshot).toBeNull();
    expect(backToOwned.cylinderEquipmentId).toBeNull();
  });

  it('calculates rental gas without a canonical cylinder ID or inspection history', () => {
    const result = projectGasCylinder(
      rentalCylinder(),
      gasPlan(rentalCylinder()),
      [],
      [],
      [],
      '2026-09-21T10:00:00.000Z',
    );

    expect(result.analysisState).toBe('current');
    expect(result.mix).toEqual({ oxygenFraction: 0.32, heliumFraction: 0 });
    expect(result.volume).toEqual({
      usablePressureBar: 150,
      usableLitres: 1665,
      reserveLitres: 555,
    });
    expect(result.modM).toBeCloseTo(33.75, 5);
    expect(result.ppo2AtDepth).toBeCloseTo(1.28, 5);
    expect(result.startPressureEvidence).toMatchObject({
      kind: 'rental-snapshot',
      pressureBar: 200,
    });
    expect(result.warnings).toContain(
      'Rental cylinder — service history not recorded in ZeusTek. Verify with operator.',
    );
    expect(result.warnings.some((warning) => /hydro|visual|O₂-clean/i.test(warning))).toBe(false);
    const warnings = warnGasPlan(gasPlan(rentalCylinder()), [], [], []);
    expect(warnings).not.toContain(
      'primary cylinder has no current fill evidence.',
    );
    expect(warnings).not.toContain('primary cylinder has no start pressure.');
  });

  it('uses known remaining pressure as the available planning pressure', () => {
    const cylinder = rentalCylinder({
      rentalSnapshot: {
        ...rentalCylinder().rentalSnapshot!,
        remainingPressureBar: 170,
      },
    });
    const result = projectGasCylinder(cylinder, gasPlan(cylinder), [], [], []);

    expect(result.startPressureEvidence).toMatchObject({
      kind: 'rental-snapshot',
      pressureBar: 170,
    });
    expect(result.volume).toEqual({
      usablePressureBar: 120,
      usableLitres: 1332,
      reserveLitres: 555,
    });
  });

  it('warns for incomplete rental evidence without requiring owned-cylinder servicing', () => {
    const cylinder = rentalCylinder({
      rentalSnapshot: {
        ...rentalCylinder().rentalSnapshot!,
        waterVolumeL: null,
        startPressureBar: null,
        valveType: 'unknown',
        analysisStatus: 'missing',
        analysisSource: 'label-only',
        analysedAt: null,
      },
    });
    const warnings = projectGasCylinder(
      cylinder,
      gasPlan(cylinder),
      [],
      [],
      [],
    ).warnings;

    expect(warnings).toContain('Rental cylinder water volume is missing.');
    expect(warnings).toContain('Rental cylinder start pressure is missing.');
    expect(warnings).toContain('Rental cylinder valve type is unknown.');
    expect(warnings).toContain('Rental nitrox has no current gas analysis evidence.');
    expect(warnings.some((warning) => /hydro|visual|O₂-clean/i.test(warning))).toBe(false);
  });

  it('feeds analysed rental nitrox into MOD, PPO2, NDL, reserve and route calculations', () => {
    const cylinder = rentalCylinder();
    const projected = projectGasCylinder(cylinder, gasPlan(cylinder), [], [], []);
    const input = rentalCylinderRecreationalInput(
      {
        mode: 'out-and-back',
        selectedBuhlmannModel: 'ZH-L16C',
        compareOtherModel: false,
        gfLow: 40,
        gfHigh: 85,
        waterType: 'salt',
        surfacePressureBar: 1,
        plannedDepthM: 30,
        conservatismM: 3,
        maxPpo2: 1.4,
        selectedGasLabel: 'Air / EAN21',
        cylinderWaterVolumeL: null,
        startPressureBar: null,
        ownRmvLMin: 18,
        buddyRmvLMin: 18,
        reserveStrategy: 'thirds',
        ascentRateMMin: 9,
        ownerMaxDurationMin: 40,
        plannedWorkingTimeMin: 30,
        routeSegments: [
          { id: 'turn', label: 'Turn', depthM: 30, minutes: 5 },
          { id: 'return', label: 'Return', depthM: 20, minutes: 5 },
        ],
      },
      cylinder,
      projected,
    );
    const snapshot = buildRecreationalGasSnapshot(input);
    const selected = snapshot.gasCandidates.find((candidate) => candidate.selected)!;

    expect(input.selectedGasLabel).toBe('Rental · Boat AL80 · EAN32');
    expect(snapshot.totalGasLitres).toBe(2220);
    expect(snapshot.reserve.selectedLitres).toBe(740);
    expect(selected.modM).toBeCloseTo(33.75, 5);
    expect(selected.ppo2AtPlannedDepth).toBeCloseTo(1.28, 5);
    expect(selected.ndl.state).toBe('available');
    expect(selected.gasLimitedTimeMin).toBeGreaterThan(0);
    expect(snapshot.routeCheckpoints.state).toBe('available');
    expect(snapshot.warnings).toContain(
      'Rental cylinder — service history not recorded in ZeusTek. Verify with operator.',
    );
  });

  it('does not misrepresent a helium mix as recreational nitrox', () => {
    const cylinder = rentalCylinder({
      rentalSnapshot: {
        ...rentalCylinder().rentalSnapshot!,
        heliumFraction: 0.1,
      },
    });
    const projected = projectGasCylinder(cylinder, gasPlan(cylinder), [], [], []);
    const base = {
      mode: 'direct-ascent' as const,
      selectedBuhlmannModel: 'ZH-L16C' as const,
      compareOtherModel: false,
      gfLow: 40,
      gfHigh: 85,
      waterType: 'salt' as const,
      surfacePressureBar: 1,
      plannedDepthM: 30,
      conservatismM: 3,
      maxPpo2: 1.4,
      selectedGasLabel: 'Air / EAN21',
      cylinderWaterVolumeL: null,
      startPressureBar: null,
      ownRmvLMin: 18,
      buddyRmvLMin: null,
      reserveStrategy: 'thirds' as const,
      ascentRateMMin: 9,
      ownerMaxDurationMin: null,
      plannedWorkingTimeMin: 30,
      routeSegments: [],
    };

    expect(rentalCylinderRecreationalInput(base, cylinder, projected)).toMatchObject({
      cylinderSourceMode: 'rental',
      cylinderSourceId: null,
      selectedGasLabel: '',
    });
    expect(projected.warnings).toContain(
      'Rental helium-containing gas is outside the recreational NDL mode.',
    );
  });
});

describe('T12.5E rental cylinder persistence and conversion', () => {
  it('saves and reopens the rental snapshot without resolving a canonical cylinder', async () => {
    const cylinder = rentalCylinder();
    await saveGasPlan(gasPlan(cylinder));

    const reopened = (await listGasPlans())[0]!;
    expect(reopened.cylinders[0]).toMatchObject({
      sourceMode: 'rental',
      cylinderEquipmentId: null,
      rentalSnapshot: {
        label: 'Boat AL80',
        waterVolumeL: 11.1,
        startPressureBar: 200,
        oxygenFraction: 0.32,
        analysisSource: 'analysed-by-operator',
      },
    });
    expect(await listCylinderInventory()).toEqual([]);
  });

  it('saves and reopens the T12.6R engine, limit and route-checkpoint snapshot inside the existing Gas Plan', async () => {
    const cylinder = rentalCylinder();
    const projected = projectGasCylinder(cylinder, gasPlan(cylinder), [], [], []);
    const recInput = rentalCylinderRecreationalInput(
      {
        mode: 'out-and-back', selectedBuhlmannModel: 'ZH-L16B', compareOtherModel: true,
        gfLow: 35, gfHigh: 80, waterType: 'salt', surfacePressureBar: 1,
        plannedDepthM: 24, conservatismM: 3, maxPpo2: 1.4,
        selectedGasLabel: 'Air / EAN21', cylinderWaterVolumeL: null,
        startPressureBar: null, ownRmvLMin: 18, buddyRmvLMin: null,
        ownRmvSource: 'plan-snapshot', buddyRmvSource: 'owner-fallback',
        reserveStrategy: 'most-conservative', ascentRateMMin: 9,
        ownerMaxDurationMin: 40, plannedWorkingTimeMin: 20,
        routeSegments: [{
          id: 'turn', label: 'Turn point', checkpointKind: 'turn', startDepthM: 24,
          endDepthM: 24, averageDepthM: 24, durationMin: 6, depthM: null,
          minutes: null, cylinderId: null, stressFactor: 1.2, buddySharing: false,
          directAscentPossible: true, notes: 'Return at the turn pressure.',
        }],
        tableProvider: null,
      },
      cylinder,
      projected,
    );
    const snapshot = buildRecreationalGasSnapshot(recInput, '2026-09-21T12:00:00.000Z');
    await saveGasPlan({ ...gasPlan(cylinder), recGasPlan101: snapshot });

    const reopened = (await listGasPlans())[0]!.recGasPlan101!;
    expect(reopened).toMatchObject({
      version: 'zeustek-rec-gas-102/1.1',
      selectedBuhlmannModel: 'ZH-L16B',
      gfLow: 35,
      gfHigh: 80,
      plannedWorkingTimeMin: 20,
      cylinderSourceMode: 'rental',
      readiness: expect.stringMatching(/Ready|Caution|Blocked/),
      routeSegments: [expect.objectContaining({ label: 'Turn point', checkpointKind: 'turn' })],
    });
    expect(reopened.gasCandidates.find((row) => row.selected)?.ndl.minutes).toEqual(expect.any(Number));
    expect(reopened.routeCheckpoints.state).toBe('available');
    expect(await listCylinderInventory()).toEqual([]);
  });

  it('does not create an owned cylinder until explicit conversion is confirmed', async () => {
    const snapshot = rentalCylinder().rentalSnapshot!;

    await expect(saveRentalCylinderAsOwned(snapshot, false)).rejects.toThrow(
      'Confirm Save as cylinder before creating owned equipment.',
    );
    expect(await listCylinderInventory()).toEqual([]);

    const result = await saveRentalCylinderAsOwned(snapshot, true);
    expect(result.id).toBeTruthy();
    expect(await listCylinderInventory()).toEqual([
      expect.objectContaining({
        entityId: result.id,
        name: 'Boat AL80',
        waterVolumeLiters: 11.1,
        workingPressureBar: 207,
        valveType: 'DIN',
      }),
    ]);
    expect(snapshot).not.toHaveProperty('savedCylinderId');
  });
});
