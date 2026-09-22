import { describe, expect, it } from 'vitest';
import { calculateBuhlmannNdl, N2_A, NDL_TERMINOLOGY } from '../lib/offline/buhlmann-ndl';
import { buildRecreationalGasSnapshot, recreationalReadinessBlockers, type RecreationalGasInput } from '../lib/offline/recreational-gas-planner';
import { ambientBar, calculateEmergencyReserve, calculateRouteCheckpoints } from '../lib/offline/recreational-gas-reserve';

const input: RecreationalGasInput = {
  mode: 'direct-ascent', selectedBuhlmannModel: 'ZH-L16B', compareOtherModel: true,
  gfLow: 40, gfHigh: 85, waterType: 'salt', surfacePressureBar: 1,
  plannedDepthM: 30, conservatismM: 3, maxPpo2: 1.4, selectedGasLabel: 'Air / EAN21',
  cylinderWaterVolumeL: 12, startPressureBar: 200, ownRmvLMin: 20, buddyRmvLMin: null,
  ownRmvSource: 'profile-average', buddyRmvSource: 'owner-fallback',
  reserveStrategy: 'calculated', ascentRateMMin: 9, ownerMaxDurationMin: 60,
  plannedWorkingTimeMin: 10, routeSegments: [],
  cylinderSourceMode: 'owned', cylinderSourceId: 'cylinder-03', cylinderSourceLabel: 'Cyl 03 · 12 L',
  pressureSource: 'current cylinder pressure', fillProvenance: ['Filled at X', 'Used at Z'],
  analysisProvenance: 'Analysed at Y',
};
describe('T12.6R NDL and gas planner', () => {
  it('uses depth-specific NDL wording and complete distinct coefficient sets', () => {
    expect(NDL_TERMINOLOGY).toContain('no-decompression limit at the selected depth');
    expect(NDL_TERMINOLOGY).toContain('not time to surface');
    expect(N2_A['ZH-L16B']).toHaveLength(16);
    expect(N2_A['ZH-L16C']).toHaveLength(16);
    expect(N2_A['ZH-L16B'][5]).not.toBe(N2_A['ZH-L16C'][5]);
  });
  it('calculates explicit B and C no-stop times, preserving model and GF', () => {
    const calculatedAt = '2026-09-21T12:00:00.000Z';
    const b = calculateBuhlmannNdl({ model: 'ZH-L16B', depthM: 18, oxygenFraction: .32, gfLow: 40, gfHigh: 85, waterType: 'salt', surfacePressureBar: 1, calculatedAt });
    const c = calculateBuhlmannNdl({ model: 'ZH-L16C', depthM: 18, oxygenFraction: .32, gfLow: 40, gfHigh: 85, waterType: 'salt', surfacePressureBar: 1, calculatedAt });
    expect(b.state).toBe('available'); expect(c.state).toBe('available');
    expect(b.minutes).toBeGreaterThan(c.minutes!);
    expect(b.model).toBe('ZH-L16B'); expect(c.model).toBe('ZH-L16C');
    expect(b.calculatedAt).toBe(calculatedAt);
    expect(calculateBuhlmannNdl({ model: 'ZH-L16B', depthM: 18, oxygenFraction: .32, gfLow: 20, gfHigh: 85, waterType: 'salt', surfacePressureBar: 1 }).minutes).toBe(b.minutes);
  });
  it('uses separate fresh and salt water depth-to-bar conversions', () => {
    expect(ambientBar(16, 'salt')).toBeCloseTo(2.6, 5);
    expect(ambientBar(16, 'fresh')).toBeCloseTo(2.5534, 3);
    const salt = buildRecreationalGasSnapshot(input);
    const fresh = buildRecreationalGasSnapshot({ ...input, waterType: 'fresh' });
    expect(fresh.gasCandidates[0]!.ppo2AtPlannedDepth).toBeLessThan(salt.gasCandidates[0]!.ppo2AtPlannedDepth);
    expect(fresh.gasCandidates[0]!.modM).toBeGreaterThan(salt.gasCandidates[0]!.modM);
  });
  it('matches owner reserve phase vector before gas-limited time', () => {
    const reserve = calculateEmergencyReserve({ maxDepthM: 30, ownRmvLMin: 20 });
    expect(reserve.phases.map(phase => phase.litres)).toEqual([320, 495, 270, 62.5]);
    expect(reserve.totalLitres).toBe(1147.5);
    expect(reserve.buddyFallback).toBe(true);
    const snapshot = buildRecreationalGasSnapshot(input);
    expect(snapshot.reserve.selectedBar).toBeCloseTo(95.625, 3);
    expect(snapshot.gasCandidates[0]!.gasLimitedTimeMin).toBeCloseTo(15.65625, 3);
    expect(snapshot.gasCandidates[0]!.ndl.minutes).not.toBe(snapshot.gasCandidates[0]!.gasLimitedTimeMin);
    expect(snapshot.plannedWorkingTimeMin).toBe(10);
    expect(snapshot.availableWorkingTimeMin).toBe(13);
    expect(snapshot.limitingFactor).toBe('NDL');
    expect(snapshot.readiness).toBe('Caution');
    expect(snapshot.ownRmvSource).toBe('profile-average');
    expect(snapshot.buddyRmvSource).toBe('owner-fallback');
  });
  it('preserves every candidate, allows lower-O2 actual gas and warns on EAN36', () => {
    const snapshot = buildRecreationalGasSnapshot(input);
    expect(snapshot.gasCandidates).toHaveLength(7);
    expect(snapshot.bestOxygenFraction).toBeCloseTo(.35, 3);
    expect(snapshot.gasCandidates[0]!.selected).toBe(true);
    for (const gas of snapshot.gasCandidates) {
      expect(gas.modM).toBeGreaterThan(0);
      expect(gas.ppo2AtPlannedDepth).toBeGreaterThan(0);
      expect(gas.ndl.model).toBe('ZH-L16B');
      expect(gas.otherModelNdl?.model).toBe('ZH-L16C');
      expect(gas.gasLimitedTimeMin).toBeGreaterThan(0);
      expect(gas.tableBackup.state).toBe('not-configured');
    }
    expect(snapshot.gasCandidates[4]!.warnings).toContain('MOD is shallower than planned depth.');
    expect(snapshot.gasCandidates[4]!.warnings).toContain('PPO₂ exceeds the selected limit at planned depth.');
    expect(snapshot.gasCandidates.some(candidate => candidate.source === 'calculated-best')).toBe(true);
    expect(snapshot.gasCandidates.some(candidate => candidate.source === 'calculated-conservative')).toBe(true);
    expect(snapshot.selectedGasAssessment.lowerOxygenThanBest).toBe(true);
    expect(snapshot.selectedGasAssessment.lowerOxygenThanConservative).toBe(true);
  });

  it('retains selected-source safety warnings and warns when actual nitrox is not analysed', () => {
    const snapshot = buildRecreationalGasSnapshot({
      ...input,
      selectedGasLabel: 'Operator EAN32',
      customGas: {
        label: 'Operator EAN32', oxygenFraction: .32,
        source: 'operator-supplied', analysed: false,
      },
      sourceWarnings: ['Rental cylinder — service history not recorded in ZeusTek. Verify with operator.'],
    });
    expect(snapshot.warnings).toContain('Selected nitrox has no current gas analysis evidence.');
    expect(snapshot.warnings).toContain('Rental cylinder — service history not recorded in ZeusTek. Verify with operator.');
    expect(snapshot.readiness).toBe('Caution');
  });
  it('rejects a stale selected gas instead of saving a snapshot without an actual gas', () => {
    expect(() => buildRecreationalGasSnapshot({ ...input, selectedGasLabel: 'Custom EAN29', customGas: {
      label: 'Custom EAN30', oxygenFraction: .30, source: 'custom', analysed: false,
    } })).toThrow('Select a current gas candidate');
    const snapshot = buildRecreationalGasSnapshot({ ...input, selectedGasLabel: 'Custom EAN30', customGas: {
      label: 'Custom EAN30', oxygenFraction: .30, source: 'custom', analysed: false,
    } });
    expect(snapshot.gasCandidates.filter(candidate => candidate.selected).map(candidate => candidate.label)).toEqual(['Custom EAN30']);
  });
  it('withholds rested NDL for a repetitive dive when prior tissue loading is unknown', () => {
    const snapshot = buildRecreationalGasSnapshot({ ...input, repetitiveDive: true });
    expect(snapshot.gasCandidates.every(candidate => candidate.ndl.state === 'unavailable')).toBe(true);
    expect(snapshot.gasCandidates[0]?.ndl.unavailableReason).toContain('Repetitive-dive tissue carryover is not supported');
    expect(snapshot.warnings.join(' ')).toContain('Repetitive-dive tissue carryover is not supported');
    expect(snapshot.plannedWorkingTimeMin).toBe(10);
    expect(snapshot.availableWorkingTimeMin).toBeCloseTo(snapshot.gasCandidates[0]!.gasLimitedTimeMin!, 5);
    expect(snapshot.assumptions).toContain('Only rested surface-air or same-dive tissues are supported. No technical decompression schedule is generated.');
  });
  it('keeps table lookup backup out of the NDL and uses route checkpoint reserves', () => {
    const route = buildRecreationalGasSnapshot({ ...input, mode: 'out-and-back', routeSegments: [
      { id: 'out', label: 'Turn', depthM: 30, minutes: 5 }, { id: 'back', label: 'Exit', depthM: 20, minutes: 5 },
    ], tableProvider: { name: 'Test lookup', version: '1', lookup: () => 99 } });
    expect(route.gasCandidates[0]!.tableBackup.minutes).toBe(99);
    expect(route.gasCandidates[0]!.ndl.minutes).not.toBe(99);
    expect(route.routeCheckpoints.state).toBe('available');
    expect(route.routeCheckpoints.checkpoints).toHaveLength(3);
    expect(route.routeCheckpoints.checkpoints[0]).toMatchObject({ label: 'Start', requiredPressureBar: expect.any(Number), expectedPressureBar: 200 });
    const missing = calculateRouteCheckpoints({ mode: 'out-and-back', segments: [], totalGasLitres: 2400, reserveLitres: 1000, ownRmvLMin: 20 });
    expect(missing.state).toBe('unavailable');
    expect(missing).not.toHaveProperty('requiredLitres', 0);
    expect(route).not.toHaveProperty('decompressionSchedule');
  });

  it('blocks planned working time beyond the no-stop limit without generating a deco schedule', () => {
    const snapshot = buildRecreationalGasSnapshot({ ...input, plannedWorkingTimeMin: 30 });
    expect(snapshot.readiness).toBe('Blocked');
    expect(snapshot.warnings).toContain('This plan exceeds recreational no-stop scope. Technical decompression planning is not enabled in T12.6R.');
    expect(recreationalReadinessBlockers(snapshot)).toContain('Planned working time exceeds the selected gas NDL.');
    expect(snapshot).not.toHaveProperty('decompressionSchedule');
  });

  it('reports missing-data and reserve limiting states explicitly', () => {
    const missing = buildRecreationalGasSnapshot({ ...input, cylinderWaterVolumeL: null });
    expect(missing.limitingFactor).toBe('missing-data');
    expect(missing.readiness).toBe('Blocked');
    const reserve = buildRecreationalGasSnapshot({ ...input, cylinderWaterVolumeL: 3, startPressureBar: 100 });
    expect(reserve.limitingFactor).toBe('reserve');
    expect(reserve.readiness).toBe('Blocked');
  });

  it('preserves cylinder, pressure, fill and analysis provenance in the calculation snapshot', () => {
    const snapshot = buildRecreationalGasSnapshot(input, '2026-09-21T12:00:00.000Z');
    expect(snapshot).toMatchObject({
      createdAt: '2026-09-21T12:00:00.000Z', cylinderSourceMode: 'owned', cylinderSourceId: 'cylinder-03',
      cylinderSourceLabel: 'Cyl 03 · 12 L', pressureSource: 'current cylinder pressure',
      fillProvenance: ['Filled at X', 'Used at Z'], analysisProvenance: 'Analysed at Y',
    });
    expect(snapshot.gasCandidates.every(candidate => candidate.ndl.calculatedAt === snapshot.createdAt)).toBe(true);
  });

  it('uses the configured ascent rate and complete route evidence for checkpoint gas and pressure', () => {
    const reserve = calculateEmergencyReserve({ maxDepthM: 30, ownRmvLMin: 20, ascentRateMMin: 6 });
    expect(reserve.phases.find(phase => phase.label === 'Ascent to 5 m')?.minutes).toBe(5);
    const route = calculateRouteCheckpoints({
      mode: 'wreck-route', totalGasLitres: 2400, reserveLitres: 800, ownRmvLMin: 20,
      buddyRmvLMin: 24, cylinderWaterVolumeL: 12,
      segments: [{
        id: 'turn', label: 'Turn point', checkpointKind: 'turn', startDepthM: 24, endDepthM: 30,
        averageDepthM: 27, durationMin: 5, depthM: null, minutes: null, cylinderId: 'cylinder-03',
        stressFactor: 1.5, buddySharing: true, directAscentPossible: false, notes: 'Inside wreck route.',
      }],
    });
    expect(route.state).toBe('available');
    if (route.state === 'available') {
      expect(route.checkpoints).toHaveLength(2);
      expect(route.checkpoints[1]).toMatchObject({ label: 'Turn point', requiredPressureBar: expect.any(Number), expectedPressureBar: expect.any(Number) });
      expect(route.checkpoints[1]!.reason).toContain('remaining route plus final reserve');
    }
  });
});
