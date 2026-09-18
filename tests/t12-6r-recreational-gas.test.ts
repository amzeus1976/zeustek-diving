import { describe, expect, it } from 'vitest';
import { calculateBuhlmannNdl, N2_A, NDL_TERMINOLOGY } from '../lib/offline/buhlmann-ndl';
import { buildRecreationalGasSnapshot, type RecreationalGasInput } from '../lib/offline/recreational-gas-planner';
import { ambientBar, calculateEmergencyReserve, calculateRouteCheckpoints } from '../lib/offline/recreational-gas-reserve';

const input: RecreationalGasInput = {
  mode: 'direct-ascent', selectedBuhlmannModel: 'ZH-L16B', compareOtherModel: true,
  gfLow: 40, gfHigh: 85, waterType: 'salt', surfacePressureBar: 1,
  plannedDepthM: 30, conservatismM: 3, maxPpo2: 1.4, selectedGasLabel: 'Air / EAN21',
  cylinderWaterVolumeL: 12, startPressureBar: 200, ownRmvLMin: 20, buddyRmvLMin: null,
  reserveStrategy: 'calculated', ascentRateMMin: 9, ownerMaxDurationMin: 60, routeSegments: [],
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
    const b = calculateBuhlmannNdl({ model: 'ZH-L16B', depthM: 18, oxygenFraction: .32, gfLow: 40, gfHigh: 85, waterType: 'salt', surfacePressureBar: 1 });
    const c = calculateBuhlmannNdl({ model: 'ZH-L16C', depthM: 18, oxygenFraction: .32, gfLow: 40, gfHigh: 85, waterType: 'salt', surfacePressureBar: 1 });
    expect(b.state).toBe('available'); expect(c.state).toBe('available');
    expect(b.minutes).toBeGreaterThan(c.minutes!);
    expect(b.model).toBe('ZH-L16B'); expect(c.model).toBe('ZH-L16C');
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
  });
  it('preserves every candidate, allows lower-O2 actual gas and warns on EAN36', () => {
    const snapshot = buildRecreationalGasSnapshot(input);
    expect(snapshot.gasCandidates).toHaveLength(5);
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
  });
  it('keeps table lookup backup out of the NDL and uses route checkpoint reserves', () => {
    const route = buildRecreationalGasSnapshot({ ...input, mode: 'out-and-back', routeSegments: [
      { id: 'out', label: 'Turn', depthM: 30, minutes: 5 }, { id: 'back', label: 'Exit', depthM: 20, minutes: 5 },
    ], tableProvider: { name: 'Test lookup', version: '1', lookup: () => 99 } });
    expect(route.gasCandidates[0]!.tableBackup.minutes).toBe(99);
    expect(route.gasCandidates[0]!.ndl.minutes).not.toBe(99);
    expect(route.routeCheckpoints.state).toBe('available');
    expect(route.routeCheckpoints.checkpoints).toHaveLength(2);
    const missing = calculateRouteCheckpoints({ mode: 'out-and-back', segments: [], totalGasLitres: 2400, reserveLitres: 1000, ownRmvLMin: 20 });
    expect(missing.state).toBe('unavailable');
    expect(missing).not.toHaveProperty('requiredLitres', 0);
    expect(route).not.toHaveProperty('decompressionSchedule');
  });
});
