/** T12.6R nitrogen-only, rested/same-dive no-stop model. This never generates a deco schedule. */
export type BuhlmannModel = 'ZH-L16B' | 'ZH-L16C';
export type WaterType = 'salt' | 'fresh';
export const NDL_ENGINE_VERSION = 'zeustek-rec-ndl/1.0.0-5min';
export const NDL_TERMINOLOGY = 'NDL is the no-decompression limit at the selected depth, not time to surface or gas time.';

// Complete 5-minute first-compartment nitrogen sets, from the DipPlanner Bühlmann model.
// The half-times and b values are shared; the model-specific a arrays must never be mixed.
// https://github.com/ThomasChiroux/dipplanner/blob/master/dipplanner/model/buhlmann/model.py
export const N2_HALF_TIMES = [5, 8, 12.5, 18.5, 27, 38.3, 54.3, 77, 109, 146, 187, 239, 305, 390, 498, 635] as const;
export const N2_B = [.5578, .6514, .7222, .7825, .8126, .8434, .8693, .8910, .9092, .9222, .9319, .9403, .9477, .9544, .9602, .9653] as const;
export const N2_A: Record<BuhlmannModel, readonly number[]> = {
  'ZH-L16B': [1.1696, 1, .8618, .7562, .6667, .5600, .4947, .4500, .4187, .3798, .3497, .3223, .2850, .2737, .2523, .2327],
  'ZH-L16C': [1.1696, 1, .8618, .7562, .6200, .5043, .4410, .4000, .3750, .3500, .3295, .3065, .2835, .2610, .2480, .2327],
};
const VAPOUR_BAR = .0627;
const MAX_NDL_MIN = 360;
export interface NdlLevel { depthM: number; minutes: number; oxygenFraction?: number }
export interface NdlInput {
  model: BuhlmannModel; depthM: number; oxygenFraction: number; gfLow: number; gfHigh: number;
  waterType: WaterType; surfacePressureBar: number; ascentRateMMin?: number;
  priorLevels?: NdlLevel[] | undefined;
}
export interface NdlResult {
  state: 'available' | 'unavailable' | 'blocked'; model: BuhlmannModel; gfLow: number; gfHigh: number;
  minutes: number | null; controllingCompartment: number | null; unavailableReason: string | null;
  waterType: WaterType; surfacePressureBar: number; oxygenFraction: number; depthM: number;
  restedOrResidual: 'rested-surface-air' | 'same-dive-levels'; engineVersion: string;
  assumptions: string[];
}
const ambient = (depthM: number, water: WaterType, surface: number) => surface + depthM / (water === 'fresh' ? 10.3 : 10);
const inspiredN2 = (depthM: number, fn2: number, water: WaterType, surface: number) => fn2 * (ambient(depthM, water, surface) - VAPOUR_BAR);
function atConstantDepth(tissues: number[], depthM: number, minutes: number, fn2: number, water: WaterType, surface: number) {
  const inspired = inspiredN2(depthM, fn2, water, surface);
  return tissues.map((p, i) => inspired + (p - inspired) * Math.exp(-Math.LN2 * minutes / N2_HALF_TIMES[i]!));
}
// Schreiner equation for linear pressure changes; result is the tissue state at the end of the interval.
function onRamp(tissues: number[], startDepth: number, endDepth: number, minutes: number, fn2: number, water: WaterType, surface: number) {
  if (minutes <= 0) return tissues;
  const pi0 = inspiredN2(startDepth, fn2, water, surface);
  const rate = (inspiredN2(endDepth, fn2, water, surface) - pi0) / minutes;
  return tissues.map((pt0, i) => {
    const k = Math.LN2 / N2_HALF_TIMES[i]!;
    return pi0 + rate * (minutes - 1 / k) - (pi0 - pt0 - rate / k) * Math.exp(-k * minutes);
  });
}
function allowed(pressure: number, model: BuhlmannModel, gfHigh: number, i: number) {
  const g = gfHigh / 100;
  return pressure * (1 - g + g / N2_B[i]!) + g * N2_A[model][i]!;
}
export function calculateBuhlmannNdl(input: NdlInput): NdlResult {
  const { model, depthM, oxygenFraction: fo2, gfLow, gfHigh, waterType, surfacePressureBar } = input;
  const assumptions = ['Rested tissues begin equilibrated with surface air FN2 0.79; selected nitrox is not credited before descent.',
    'Water vapour pressure 0.0627 bar.', 'Descent at 18 m/min and no-stop ascent at the configured rate; no safety-stop or decompression-stop credit.',
    'GF High controls the no-stop ascent check. GF Low is stored for later engine compatibility and does not alter this NDL.',
    'Five-minute first nitrogen compartment variant; no repetitive-dive tissue carryover.'];
  const base = { state: 'unavailable' as const, model, gfLow, gfHigh, minutes: null, controllingCompartment: null,
    unavailableReason: null, waterType, surfacePressureBar, oxygenFraction: fo2, depthM,
    restedOrResidual: input.priorLevels?.length ? 'same-dive-levels' as const : 'rested-surface-air' as const,
    engineVersion: NDL_ENGINE_VERSION, assumptions };
  if (!N2_A[model] || !['salt', 'fresh'].includes(waterType) || !Number.isFinite(depthM) || depthM <= 0 || depthM > 60
    || !Number.isFinite(fo2) || fo2 < .16 || fo2 >= 1 || !Number.isFinite(surfacePressureBar) || surfacePressureBar <= VAPOUR_BAR
    || !Number.isFinite(gfLow) || !Number.isFinite(gfHigh) || gfLow <= 0 || gfHigh <= 0 || gfLow > gfHigh || gfHigh > 100
    || !Number.isFinite(input.ascentRateMMin ?? 9) || (input.ascentRateMMin ?? 9) <= 0
    || input.priorLevels?.some(level => !Number.isFinite(level.depthM) || level.depthM < 0 || level.depthM > 60 || !Number.isFinite(level.minutes) || level.minutes < 0 || !Number.isFinite(level.oxygenFraction ?? fo2) || (level.oxygenFraction ?? fo2) < .16 || (level.oxygenFraction ?? fo2) >= 1)) {
    return { ...base, unavailableReason: 'Invalid model, depth, air/nitrox mix, gradient factors, pressure, rate or prior level.' };
  }
  const metresPerBar = waterType === 'fresh' ? 10.3 : 10;
  const ascentRate = input.ascentRateMMin ?? 9;
  let tissues = Array<number>(16).fill(.79 * (surfacePressureBar - VAPOUR_BAR));
  let previousDepth = 0;
  for (const level of [...(input.priorLevels ?? []), { depthM, minutes: 0, oxygenFraction: fo2 }]) {
    const gasN2 = 1 - (level.oxygenFraction ?? fo2);
    const change = level.depthM - previousDepth;
    const rate = change >= 0 ? 18 : ascentRate;
    tissues = onRamp(tissues, previousDepth, level.depthM, Math.abs(change) / rate, gasN2, waterType, surfacePressureBar);
    tissues = atConstantDepth(tissues, level.depthM, level.minutes, gasN2, waterType, surfacePressureBar);
    previousDepth = level.depthM;
  }
  const check = (bottomMinutes: number) => {
    let trial = atConstantDepth(tissues, depthM, bottomMinutes, 1 - fo2, waterType, surfacePressureBar);
    let worstIndex = 0; let worstMargin = Number.NEGATIVE_INFINITY;
    let previous = depthM;
    const steps = Math.ceil(depthM / (ascentRate / 60));
    for (let step = 1; step <= steps; step++) {
      const current = depthM * (1 - step / steps);
      const deltaMin = (previous - current) / ascentRate;
      trial = onRamp(trial, previous, current, deltaMin, 1 - fo2, waterType, surfacePressureBar);
      const p = surfacePressureBar + current / metresPerBar;
      for (let i = 0; i < 16; i++) {
        const margin = trial[i]! - allowed(p, model, gfHigh, i);
        if (margin > worstMargin) { worstMargin = margin; worstIndex = i; }
      }
      previous = current;
    }
    return { passes: worstMargin <= 1e-10, compartment: worstIndex + 1 };
  };
  if (!check(0).passes) return { ...base, state: 'blocked', minutes: 0, unavailableReason: 'No-stop ascent is already unavailable at this depth and tissue state.', controllingCompartment: check(0).compartment };
  let lo = 0, hi = MAX_NDL_MIN;
  if (check(hi).passes) return { ...base, state: 'unavailable', unavailableReason: `NDL exceeds the ${MAX_NDL_MIN}-minute calculation cap; no exact limit is reported.` };
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (check(mid).passes) lo = mid; else hi = mid;
  }
  return { ...base, state: 'available', minutes: lo, controllingCompartment: check(hi).compartment, unavailableReason: null };
}
