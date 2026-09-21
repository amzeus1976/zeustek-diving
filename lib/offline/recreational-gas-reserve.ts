export type WaterType = 'salt' | 'fresh';
export type ReserveStrategy = 'thirds' | 'calculated' | 'most-conservative';
export type RouteMode = 'direct-ascent' | 'out-and-back' | 'reef-return' | 'shore-return' | 'wreck-route' | 'multilevel';

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
    phase('Ascent to 5 m', (maxDepthM + stopDepth) / 2, Math.ceil((maxDepthM - stopDepth) / ascentRate), 1.5),
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

export type RouteCheckpointKind = 'start' | 'farthest' | 'deepest' | 'turn' | 'return' | 'shallow' | 'safety-stop' | 'surface' | 'custom';
export interface RouteSegment {
  id: string;
  label: string;
  checkpointKind?: RouteCheckpointKind;
  startDepthM?: number | null;
  endDepthM?: number | null;
  averageDepthM?: number | null;
  durationMin?: number | null;
  /** Legacy T12.6R fields retained for saved-plan compatibility. */
  depthM: number | null;
  minutes: number | null;
  cylinderId?: string | null;
  stressFactor?: number | null;
  buddySharing?: boolean;
  directAscentPossible?: boolean;
  notes?: string;
}
export interface RouteCheckpoint {
  label: string;
  kind: RouteCheckpointKind;
  requiredLitres: number;
  expectedLitres: number;
  requiredPressureBar: number | null;
  expectedPressureBar: number | null;
  status: 'ok' | 'warning';
  reason: string;
}
export function calculateRouteCheckpoints(input: {
  mode: RouteMode; segments: RouteSegment[]; totalGasLitres: number | null;
  reserveLitres: number | null; ownRmvLMin: number | null; buddyRmvLMin?: number | null;
  cylinderWaterVolumeL?: number | null; waterType?: WaterType; surfacePressureBar?: number;
}): { state: 'available'; checkpoints: RouteCheckpoint[] } | { state: 'unavailable'; reason: string; checkpoints: [] } {
  if (input.mode === 'direct-ascent') return { state: 'unavailable', reason: 'Direct ascent has no route checkpoints.', checkpoints: [] };
  if (!input.segments.length) return { state: 'unavailable', reason: 'Add route segments to calculate checkpoint reserves.', checkpoints: [] };
  if (input.totalGasLitres == null || input.reserveLitres == null || input.ownRmvLMin == null || input.totalGasLitres <= 0 || input.reserveLitres < 0 || input.ownRmvLMin <= 0)
    return { state: 'unavailable', reason: 'Cylinder gas, emergency reserve or RMV is unavailable.', checkpoints: [] };
  const routeValues = input.segments.map(segment => {
    const depthM = segment.averageDepthM ?? segment.depthM ?? (
      segment.startDepthM != null && segment.endDepthM != null
        ? (segment.startDepthM + segment.endDepthM) / 2
        : null
    );
    const minutes = segment.durationMin ?? segment.minutes;
    const stress = segment.stressFactor ?? 1;
    const buddyRmv = input.buddyRmvLMin ?? input.ownRmvLMin;
    const combinedRmv = input.ownRmvLMin! + (segment.buddySharing ? buddyRmv! : 0);
    return { depthM, minutes, stress, combinedRmv };
  });
  const usage = routeValues.map(value => value.depthM != null && value.minutes != null && value.depthM >= 0 && value.minutes > 0 && Number.isFinite(value.stress) && value.stress > 0
    ? value.combinedRmv * value.stress * ambientBar(value.depthM, input.waterType, input.surfacePressureBar) * value.minutes : null);
  if (usage.some(value => value == null)) return { state: 'unavailable', reason: 'Every route segment needs a depth and duration.', checkpoints: [] };
  const toPressure = (litres: number) => input.cylinderWaterVolumeL != null && input.cylinderWaterVolumeL > 0
    ? litres / input.cylinderWaterVolumeL
    : null;
  const startRequired = input.reserveLitres + usage.reduce<number>((sum, value) => sum + value!, 0);
  const startStatus = input.totalGasLitres >= startRequired ? 'ok' as const : 'warning' as const;
  const checkpoints: RouteCheckpoint[] = [{
    label: 'Start', kind: 'start', requiredLitres: startRequired, expectedLitres: input.totalGasLitres,
    requiredPressureBar: toPressure(startRequired), expectedPressureBar: toPressure(input.totalGasLitres), status: startStatus,
    reason: startStatus === 'ok' ? 'Planned route plus final reserve covered.' : 'Insufficient gas for the planned route plus final reserve.',
  }];
  let spent = 0;
  checkpoints.push(...input.segments.map((segment, index) => {
    spent += usage[index]!;
    const remainingRoute = usage.slice(index + 1).reduce<number>((sum, value) => sum + value!, 0);
    const requiredLitres = input.reserveLitres! + remainingRoute;
    const expectedLitres = input.totalGasLitres! - spent;
    return { label: segment.label || `Checkpoint ${index + 1}`, kind: segment.checkpointKind ?? 'custom', requiredLitres, expectedLitres,
      requiredPressureBar: toPressure(requiredLitres), expectedPressureBar: toPressure(expectedLitres),
      status: expectedLitres >= requiredLitres ? 'ok' as const : 'warning' as const,
      reason: expectedLitres >= requiredLitres ? 'Expected gas covers the remaining route plus final reserve.' : 'Insufficient gas for remaining route plus final reserve.' };
  }));
  return { state: 'available', checkpoints };
}
