export type WaterType = 'salt' | 'fresh';
export type ReserveStrategy = 'thirds' | 'calculated' | 'most-conservative';
export type RouteMode = 'direct-ascent' | 'out-and-back' | 'reef-return' | 'multilevel';

export interface ReservePhase {
  label: string;
  depthM: number;
  minutes: number;
  multiplier: number;
  litres: number;
}
export interface EmergencyReserve {
  state: 'available' | 'unavailable';
  reason?: string;
  phases: ReservePhase[];
  totalLitres: number | null;
  buddyRmvUsed: number | null;
  buddyFallback: boolean;
}

export const ambientBar = (depthM: number, waterType: WaterType = 'salt', surfacePressureBar = 1) =>
  surfacePressureBar + depthM / (waterType === 'fresh' ? 10.3 : 10);

export function calculateEmergencyReserve(input: {
  maxDepthM: number; ownRmvLMin: number; buddyRmvLMin?: number | null;
  ascentRateMMin?: number; safetyStopDepthM?: number; safetyStopMin?: number;
  waterType?: WaterType; surfacePressureBar?: number;
}): EmergencyReserve {
  const { maxDepthM, ownRmvLMin } = input;
  const buddyFallback = input.buddyRmvLMin == null;
  const buddyRmvUsed = buddyFallback ? ownRmvLMin : input.buddyRmvLMin!;
  const ascentRate = input.ascentRateMMin ?? 9;
  const stopDepth = input.safetyStopDepthM ?? 5;
  const stopMin = input.safetyStopMin ?? 3;
  if (![maxDepthM, ownRmvLMin, buddyRmvUsed, ascentRate, stopDepth, stopMin, input.surfacePressureBar ?? 1].every(Number.isFinite)
    || maxDepthM < stopDepth || ownRmvLMin <= 0 || buddyRmvUsed <= 0 || ascentRate <= 0 || stopDepth < 0 || stopMin <= 0 || (input.surfacePressureBar ?? 1) <= 0) {
    return { state: 'unavailable', reason: 'Depth, RMV or ascent/stop settings are missing or invalid.', phases: [], totalLitres: null, buddyRmvUsed: null, buddyFallback };
  }
  const pressure = (depth: number) => ambientBar(depth, input.waterType, input.surfacePressureBar);
  const phase = (label: string, depthM: number, minutes: number, multiplier: number): ReservePhase => ({
    label, depthM, minutes, multiplier,
    litres: (ownRmvLMin + buddyRmvUsed) * multiplier * pressure(depthM) * minutes,
  });
  const phases = [
    phase('Bottom problem', maxDepthM, 1, 2),
    phase('Ascent to 5 m', (maxDepthM + stopDepth) / 2, Math.ceil((maxDepthM - stopDepth) / 9), 1.5),
    phase('Safety stop', stopDepth, stopMin, 1.5),
    phase('Final ascent', stopDepth / 2, Math.ceil(stopDepth / ascentRate), 1.25),
  ];
  return { state: 'available', phases, totalLitres: phases.reduce((sum, row) => sum + row.litres, 0), buddyRmvUsed, buddyFallback };
}

export function selectReserve(totalGasLitres: number | null, emergency: EmergencyReserve, strategy: ReserveStrategy) {
  if (totalGasLitres == null || !Number.isFinite(totalGasLitres) || totalGasLitres <= 0 || emergency.totalLitres == null)
    return { state: 'unavailable' as const, reason: 'Cylinder volume, start pressure or emergency reserve is unavailable.', thirdsLitres: null, selectedLitres: null };
  const thirdsLitres = totalGasLitres / 3;
  return { state: 'available' as const, thirdsLitres, selectedLitres: strategy === 'thirds' ? thirdsLitres : strategy === 'calculated' ? emergency.totalLitres : Math.max(thirdsLitres, emergency.totalLitres) };
}

export interface RouteSegment { id: string; label: string; depthM: number | null; minutes: number | null }
export interface RouteCheckpoint { label: string; requiredLitres: number; expectedLitres: number; status: 'ok' | 'warning'; reason: string }
export function calculateRouteCheckpoints(input: {
  mode: RouteMode; segments: RouteSegment[]; totalGasLitres: number | null;
  reserveLitres: number | null; ownRmvLMin: number | null; waterType?: WaterType; surfacePressureBar?: number;
}): { state: 'available'; checkpoints: RouteCheckpoint[] } | { state: 'unavailable'; reason: string; checkpoints: [] } {
  if (input.mode === 'direct-ascent') return { state: 'unavailable', reason: 'Direct ascent has no route checkpoints.', checkpoints: [] };
  if (!input.segments.length) return { state: 'unavailable', reason: 'Add route segments to calculate checkpoint reserves.', checkpoints: [] };
  if (input.totalGasLitres == null || input.reserveLitres == null || input.ownRmvLMin == null || input.totalGasLitres <= 0 || input.reserveLitres < 0 || input.ownRmvLMin <= 0)
    return { state: 'unavailable', reason: 'Cylinder gas, emergency reserve or RMV is unavailable.', checkpoints: [] };
  const usage = input.segments.map(segment => segment.depthM != null && segment.minutes != null && segment.depthM >= 0 && segment.minutes > 0
    ? input.ownRmvLMin! * ambientBar(segment.depthM, input.waterType, input.surfacePressureBar) * segment.minutes : null);
  if (usage.some(value => value == null)) return { state: 'unavailable', reason: 'Every route segment needs a depth and duration.', checkpoints: [] };
  let spent = 0;
  const checkpoints = input.segments.map((segment, index) => {
    spent += usage[index]!;
    const remainingRoute = usage.slice(index + 1).reduce<number>((sum, value) => sum + value!, 0);
    const requiredLitres = input.reserveLitres! + remainingRoute;
    const expectedLitres = input.totalGasLitres! - spent;
    return { label: segment.label || `Checkpoint ${index + 1}`, requiredLitres, expectedLitres,
      status: expectedLitres >= requiredLitres ? 'ok' as const : 'warning' as const,
      reason: expectedLitres >= requiredLitres ? 'Return route plus final reserve covered.' : 'Insufficient gas for remaining route plus final reserve.' };
  });
  return { state: 'available', checkpoints };
}
