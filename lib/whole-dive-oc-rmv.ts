import type { DiveRecord } from './offline/dives';

export type WholeDiveOcrmvResult =
  | { kind: 'unavailable'; reason: 'invalid-dive-data' | 'unreviewed-participation' | 'unsupported-configuration' | 'duplicate-cylinder' | 'invalid-cylinder-data' | 'fewer-than-two-used' }
  | ({ kind: 'estimate'; includedCylinderIds: string[] } & NonNullable<DiveRecord['rmvEstimate']>);

const OPEN_CIRCUIT_CONFIGURATIONS = new Set(['Single Tank', 'Doubles Manifold', 'Independent Doubles', 'Sidemount']);

/** An estimate from *explicitly selected* OC supplies; never a segment SAC, reserve or physiological assessment. */
export function estimateWholeDiveOcrmv(dive: Pick<DiveRecord, 'cylinders' | 'averageDepthM' | 'totalElapsedMin'>): WholeDiveOcrmvResult {
  const {averageDepthM: depth, totalElapsedMin: minutes} = dive;
  if (depth == null || !Number.isFinite(depth) || depth < 0 || minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
    return {kind: 'unavailable', reason: 'invalid-dive-data'};
  }
  const cylinders = dive.cylinders ?? [];
  if (cylinders.some(c => !OPEN_CIRCUIT_CONFIGURATIONS.has(c.configuration))) {
    return {kind: 'unavailable', reason: 'unsupported-configuration'};
  }
  const ids = cylinders.map(c => c.id);
  if (ids.some(id => !id?.trim()) || new Set(ids).size !== ids.length) {
    return {kind: 'unavailable', reason: 'duplicate-cylinder'};
  }
  if (cylinders.some(c => c.wholeDiveRmvParticipation !== 'used' && c.wholeDiveRmvParticipation !== 'excluded')) {
    return {kind: 'unavailable', reason: 'unreviewed-participation'};
  }
  const used = cylinders.filter(c => c.wholeDiveRmvParticipation === 'used');
  if (used.length < 2) return {kind: 'unavailable', reason: 'fewer-than-two-used'};
  if (used.some(c => c.internalVolumeLiters == null || c.startPressureBar == null || c.endPressureBar == null ||
    ![c.internalVolumeLiters, c.startPressureBar, c.endPressureBar].every(Number.isFinite) ||
    c.internalVolumeLiters <= 0 || c.startPressureBar <= c.endPressureBar || c.endPressureBar < 0)) {
    return {kind: 'unavailable', reason: 'invalid-cylinder-data'};
  }
  const includedCylinders = used.map(c => ({
    id: c.id, internalVolumeLiters: c.internalVolumeLiters!, startPressureBar: c.startPressureBar!, endPressureBar: c.endPressureBar!,
  }));
  const usedLitres = includedCylinders.reduce((total, c) => total + (c.startPressureBar - c.endPressureBar) * c.internalVolumeLiters, 0);
  const rmvLitresPerMinute = usedLitres / (minutes * (1 + depth / 10));
  if (!Number.isFinite(usedLitres) || !Number.isFinite(rmvLitresPerMinute)) {
    return {kind: 'unavailable', reason: 'invalid-cylinder-data'};
  }
  return {
    kind: 'estimate', version: 'whole-dive-oc-rmv/1', includedCylinderIds: includedCylinders.map(c => c.id), includedCylinders,
    averageDepthM: depth, elapsedMinutes: minutes, usedLitres, rmvLitresPerMinute,
    pressureModel: 'seawater-10m-per-atm',
  };
}

/** Caller must invoke this from an explicit user action; it never writes to storage. */
export function applyMissingWholeDiveOcrmv<T extends Pick<DiveRecord, 'cylinders' | 'averageDepthM' | 'totalElapsedMin' | 'rmvRate' | 'rmvEstimate'>>(dive: T) {
  if (dive.rmvRate != null) return {changed: false as const, reason: 'existing-value' as const, dive};
  const result = estimateWholeDiveOcrmv(dive);
  if (result.kind === 'unavailable') return {changed: false as const, reason: result.reason, dive};
  const {kind: _kind, includedCylinderIds: _ids, ...rmvEstimate} = result;
  return {changed: true as const, reason: 'applied' as const, dive: {...dive, rmvRate: result.rmvLitresPerMinute, rmvEstimate}};
}

export function isWholeDiveRmvEstimateCurrent(dive: Pick<DiveRecord, 'cylinders' | 'averageDepthM' | 'totalElapsedMin' | 'rmvRate' | 'rmvEstimate'>): boolean {
  if (!dive.rmvEstimate || dive.rmvRate !== dive.rmvEstimate.rmvLitresPerMinute) return false;
  const current = estimateWholeDiveOcrmv(dive);
  if (current.kind !== 'estimate') return false;
  return current.version === dive.rmvEstimate.version &&
    current.averageDepthM === dive.rmvEstimate.averageDepthM &&
    current.elapsedMinutes === dive.rmvEstimate.elapsedMinutes &&
    current.usedLitres === dive.rmvEstimate.usedLitres &&
    JSON.stringify(current.includedCylinders) === JSON.stringify(dive.rmvEstimate.includedCylinders);
}
