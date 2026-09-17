/** Deterministic planning aids, not a decompression model or dive clearance. */
export const GAS_PLANNING_CAUTION = 'Planning aid only. Verify with formal training, agency materials, dive computer, instructor/team briefing and independent checks.';
export const GAS_FORMULA_PROVENANCE = 'Metric seawater approximation: absolute pressure = depth (m) / 10 + 1. Gas-volume calculations assume ideal pressure × cylinder water volume.';

export interface PlanningGasMix {
  oxygenFraction: number;
  heliumFraction: number;
}

export interface GasDepthSegment {
  id: string;
  depthM: number | null;
  minutes: number | null;
  gasCylinderId?: string | null;
  note?: string | null;
}

export interface ManualStop {
  id: string;
  depthM: number | null;
  minutes: number | null;
  gasCylinderId?: string | null;
}

export interface NdlTableProvider {
  id: string;
  version: string;
  source: string;
  lookup(input: { depthM: number; gas: PlanningGasMix }): { limitMinutes: number; citation: string } | null;
}

export const NDL_UNCONFIGURED = 'NDL table not configured. Check a lawful, versioned table or dive computer independently.';

const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: number | null | undefined): value is number => finite(value) && value >= 0;
const positive = (value: number | null | undefined): value is number => finite(value) && value > 0;

export function validateMix(mix: PlanningGasMix): boolean {
  return finite(mix.oxygenFraction) && finite(mix.heliumFraction) &&
    mix.oxygenFraction > 0 && mix.oxygenFraction <= 1 &&
    mix.heliumFraction >= 0 && mix.heliumFraction < 1 &&
    mix.oxygenFraction + mix.heliumFraction <= 1;
}

export function nitrogenFraction(mix: PlanningGasMix): number | null {
  return validateMix(mix) ? 1 - mix.oxygenFraction - mix.heliumFraction : null;
}

export function ambientAta(depthM: number | null | undefined): number | null {
  return nonnegative(depthM) ? depthM / 10 + 1 : null;
}

export function oxygenPartialPressure(mix: PlanningGasMix, depthM: number | null | undefined): number | null {
  const ata = ambientAta(depthM);
  return validateMix(mix) && ata !== null ? mix.oxygenFraction * ata : null;
}

export function maximumOperatingDepth(mix: PlanningGasMix, targetPpo2: number | null | undefined): number | null {
  if (!validateMix(mix) || !positive(targetPpo2) || targetPpo2 < mix.oxygenFraction) return null;
  return (targetPpo2 / mix.oxygenFraction - 1) * 10;
}

export function bestOxygenFraction(depthM: number | null | undefined, targetPpo2: number | null | undefined): number | null {
  const ata = ambientAta(depthM);
  if (ata === null || !positive(targetPpo2)) return null;
  const result = targetPpo2 / ata;
  return result > 0 && result <= 1 ? result : null;
}

export function conservativeOxygenFraction(depthM: number | null | undefined, conservatismM: number | null | undefined, targetPpo2: number | null | undefined): number | null {
  if (!nonnegative(depthM) || !nonnegative(conservatismM)) return null;
  return bestOxygenFraction(depthM + conservatismM, targetPpo2);
}

/** Uses nitrogen fraction FN2/0.79, never FO2/0.21. */
export function equivalentAirDepth(mix: PlanningGasMix, depthM: number | null | undefined): number | null {
  const fn2 = nitrogenFraction(mix);
  if (fn2 === null || !nonnegative(depthM)) return null;
  return (fn2 / 0.79) * (depthM + 10) - 10;
}

export function gasRequiredLitres(rmvLMin: number | null | undefined, depthM: number | null | undefined, minutes: number | null | undefined): number | null {
  const ata = ambientAta(depthM);
  return positive(rmvLMin) && ata !== null && positive(minutes) ? rmvLMin * ata * minutes : null;
}

export function gasRequiredForSegments(rmvLMin: number | null | undefined, segments: GasDepthSegment[]): number | null {
  if (!segments.length) return null;
  const results = segments.map((segment) => gasRequiredLitres(rmvLMin, segment.depthM, segment.minutes));
  return results.every((result): result is number => result !== null) ? results.reduce((sum, result) => sum + result, 0) : null;
}

export function gasVolumeLitres(cylinderWaterVolumeL: number | null | undefined, startBar: number | null | undefined, reserveBar: number | null | undefined): { usableLitres: number; reserveLitres: number; usablePressureBar: number } | null {
  if (!positive(cylinderWaterVolumeL) || !positive(startBar) || !nonnegative(reserveBar) || reserveBar > startBar) return null;
  return {
    usablePressureBar: startBar - reserveBar,
    usableLitres: cylinderWaterVolumeL * (startBar - reserveBar),
    reserveLitres: cylinderWaterVolumeL * reserveBar,
  };
}

export function lookupNdl(provider: NdlTableProvider | null, depthM: number | null | undefined, mix: PlanningGasMix): { state: 'available'; limitMinutes: number; provenance: string } | { state: 'unconfigured' | 'unknown'; message: string } {
  if (!provider) return { state: 'unconfigured', message: NDL_UNCONFIGURED };
  if (!positive(depthM) || !validateMix(mix)) return { state: 'unknown', message: 'Depth or analysed gas is missing/invalid; no NDL lookup is possible.' };
  const result = provider.lookup({ depthM, gas: mix });
  return result && positive(result.limitMinutes)
    ? { state: 'available', limitMinutes: result.limitMinutes, provenance: `${provider.source} ${provider.version} · ${result.citation}` }
    : { state: 'unknown', message: 'This table has no entry for the selected depth and gas.' };
}
