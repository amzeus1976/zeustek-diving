import { calculateBuhlmannNdl, type BuhlmannModel, type NdlResult, type WaterType } from './buhlmann-ndl';
import { ambientBar, calculateEmergencyReserve, calculateRouteCheckpoints, selectReserve, type ReserveStrategy, type RouteMode, type RouteSegment } from './recreational-gas-reserve';

export const REC_GAS_VERSION = 'zeustek-rec-gas-101/1.0';
export interface GasChoice { label: string; oxygenFraction: number; source: 'preset' | 'analysed-fill' | 'custom'; analysed: boolean; evidence?: string | null }
export interface GasCandidateSnapshot {
  label: string; source: GasChoice['source']; selected: boolean; analysed: boolean; analysedEvidence: string | null;
  oxygenFraction: number; nitrogenFraction: number; heliumFraction: 0;
  modM: number; ppo2AtPlannedDepth: number; ppo2AtConservativeDepth: number; eadM: number;
  ndl: NdlResult; otherModelNdl: NdlResult | null;
  tableBackup: { state: 'not-configured' | 'available' | 'unavailable'; provider: string | null; version: string | null; minutes: number | null; reason: string | null };
  gasLimitedTimeMin: number | null; warnings: string[];
}
export interface RecreationalGasInput {
  mode: RouteMode; selectedBuhlmannModel: BuhlmannModel; compareOtherModel: boolean; gfLow: number; gfHigh: number;
  waterType: WaterType; surfacePressureBar: number; plannedDepthM: number; conservatismM: number;
  maxPpo2: number; selectedGasLabel: string; customGas?: GasChoice | null; analysedGases?: GasChoice[];
  cylinderWaterVolumeL: number | null; startPressureBar: number | null;
  ownRmvLMin: number | null; buddyRmvLMin: number | null; reserveStrategy: ReserveStrategy;
  ascentRateMMin: number; ownerMaxDurationMin: number | null; routeSegments: RouteSegment[];
  tableProvider?: { name: string; version: string; lookup: (depthM: number, oxygenFraction: number) => number | null } | null;
}
export interface RecreationalGasSnapshot extends Omit<RecreationalGasInput, 'tableProvider'> {
  version: typeof REC_GAS_VERSION; createdAt: string; bestOxygenFraction: number; conservativeOxygenFraction: number;
  gasCandidates: GasCandidateSnapshot[]; totalGasLitres: number | null;
  reserve: ReturnType<typeof calculateEmergencyReserve> & { strategy: ReserveStrategy; thirdsLitres: number | null; selectedLitres: number | null; selectedBar: number | null };
  routeCheckpoints: ReturnType<typeof calculateRouteCheckpoints>;
  limitingFactor: 'NDL' | 'gas' | 'owner-duration' | 'unavailable'; plannedWorkingTimeMin: number | null;
  warnings: string[]; assumptions: string[];
}
const PRESETS: GasChoice[] = [21, 28, 30, 32, 36].map(value => ({ label: value === 21 ? 'Air / EAN21' : `EAN${value}`, oxygenFraction: value / 100, source: 'preset', analysed: false }));
export function buildRecreationalGasSnapshot(input: RecreationalGasInput, createdAt = new Date().toISOString()): RecreationalGasSnapshot {
  if (!Number.isFinite(input.plannedDepthM) || input.plannedDepthM <= 0 || !Number.isFinite(input.conservatismM) || input.conservatismM < 0 || !Number.isFinite(input.maxPpo2) || input.maxPpo2 <= 0) {
    throw new Error('Enter a valid planned depth, conservatism depth and PPO₂ limit.');
  }
  const depth = input.plannedDepthM, conservativeDepth = depth + input.conservatismM;
  const bestOxygenFraction = input.maxPpo2 / ambientBar(depth, input.waterType, input.surfacePressureBar);
  const conservativeOxygenFraction = input.maxPpo2 / ambientBar(conservativeDepth, input.waterType, input.surfacePressureBar);
  const emergency = input.ownRmvLMin == null
    ? { state: 'unavailable' as const, reason: 'Own RMV is unavailable.', phases: [], totalLitres: null, buddyRmvUsed: null, buddyFallback: input.buddyRmvLMin == null }
    : calculateEmergencyReserve({ maxDepthM: depth, ownRmvLMin: input.ownRmvLMin, buddyRmvLMin: input.buddyRmvLMin, ascentRateMMin: input.ascentRateMMin, waterType: input.waterType, surfacePressureBar: input.surfacePressureBar });
  const totalGasLitres = input.cylinderWaterVolumeL != null && input.cylinderWaterVolumeL > 0 && input.startPressureBar != null && input.startPressureBar > 0
    ? input.cylinderWaterVolumeL * input.startPressureBar : null;
  const selected = selectReserve(totalGasLitres, emergency, input.reserveStrategy);
  const reserve = { ...emergency, strategy: input.reserveStrategy, thirdsLitres: selected.thirdsLitres, selectedLitres: selected.selectedLitres,
    selectedBar: selected.selectedLitres != null && input.cylinderWaterVolumeL != null && input.cylinderWaterVolumeL > 0 ? selected.selectedLitres / input.cylinderWaterVolumeL : null };
  const candidates = [...PRESETS, ...(input.analysedGases ?? []), ...(input.customGas ? [input.customGas] : [])];
  if (candidates.some(gas => !Number.isFinite(gas.oxygenFraction) || gas.oxygenFraction < .16 || gas.oxygenFraction >= 1))
    throw new Error('Candidate oxygen fractions must be between 16% and 100%.');
  const otherModel = input.selectedBuhlmannModel === 'ZH-L16B' ? 'ZH-L16C' : 'ZH-L16B';
  const completeLevels = input.mode === 'multilevel' && input.routeSegments.length > 0 && input.routeSegments.every(level => level.depthM != null && level.minutes != null && level.depthM >= 0 && level.minutes > 0)
    ? input.routeSegments : null;
  const gasCandidates = candidates.map((gas): GasCandidateSnapshot => {
    const fo2 = gas.oxygenFraction;
    const ppo2AtPlannedDepth = fo2 * ambientBar(depth, input.waterType, input.surfacePressureBar);
    const ppo2AtConservativeDepth = fo2 * ambientBar(conservativeDepth, input.waterType, input.surfacePressureBar);
    const metresPerBar = input.waterType === 'fresh' ? 10.3 : 10;
    const modM = (input.maxPpo2 / fo2 - input.surfacePressureBar) * metresPerBar;
    const eadM = ((1 - fo2) / .79) * (depth + metresPerBar) - metresPerBar;
    const ndlInput = { depthM: input.mode === 'multilevel' && !completeLevels ? Number.NaN : completeLevels?.at(-1)?.depthM ?? depth, oxygenFraction: fo2, gfLow: input.gfLow, gfHigh: input.gfHigh,
      waterType: input.waterType, surfacePressureBar: input.surfacePressureBar, ascentRateMMin: input.ascentRateMMin,
      priorLevels: completeLevels?.slice(0, -1).map(level => ({ depthM: level.depthM!, minutes: level.minutes! })) };
    const ndl = calculateBuhlmannNdl({ ...ndlInput, model: input.selectedBuhlmannModel });
    const otherModelNdl = input.compareOtherModel ? calculateBuhlmannNdl({ ...ndlInput, model: otherModel }) : null;
    const tableMinutes = input.tableProvider?.lookup(depth, fo2) ?? null;
    const tableBackup: GasCandidateSnapshot['tableBackup'] = !input.tableProvider
      ? { state: 'not-configured', provider: null, version: null, minutes: null, reason: 'No backup table configured.' }
      : tableMinutes != null && Number.isFinite(tableMinutes) && tableMinutes > 0
        ? { state: 'available', provider: input.tableProvider.name, version: input.tableProvider.version, minutes: tableMinutes, reason: null }
        : { state: 'unavailable', provider: input.tableProvider.name, version: input.tableProvider.version, minutes: null, reason: 'No lookup entry for this depth and mix.' };
    const gasLimitedTimeMin = totalGasLitres != null && reserve.selectedLitres != null && input.ownRmvLMin != null && input.ownRmvLMin > 0
      ? Math.max(0, totalGasLitres - reserve.selectedLitres) / (input.ownRmvLMin * ambientBar(depth, input.waterType, input.surfacePressureBar)) : null;
    const warnings = [
      ...(fo2 <= 0 || fo2 >= 1 ? ['Invalid oxygen fraction.'] : []),
      ...(modM < depth ? ['MOD is shallower than planned depth.'] : []),
      ...(ppo2AtPlannedDepth > input.maxPpo2 + 1e-9 ? ['PPO₂ exceeds the selected limit at planned depth.'] : []),
      ...(ppo2AtConservativeDepth > input.maxPpo2 + 1e-9 ? ['PPO₂ exceeds the selected limit at conservative depth.'] : []),
      ...(ndl.state !== 'available' ? [ndl.unavailableReason ?? 'NDL unavailable.'] : []),
      ...(gasLimitedTimeMin == null ? ['Gas-limited time unavailable until cylinder and RMV are complete.'] : []),
      ...(input.mode === 'multilevel' && !completeLevels ? ['Complete every multilevel segment to calculate carried-tissue NDL.'] : []),
    ];
    return { label: gas.label, source: gas.source, selected: gas.label === input.selectedGasLabel, analysed: gas.analysed,
      analysedEvidence: gas.evidence ?? null, oxygenFraction: fo2, nitrogenFraction: 1 - fo2, heliumFraction: 0,
      modM, ppo2AtPlannedDepth, ppo2AtConservativeDepth, eadM, ndl, otherModelNdl, tableBackup, gasLimitedTimeMin, warnings };
  });
  const selectedGas = gasCandidates.find(row => row.selected);
  const routeCheckpoints = calculateRouteCheckpoints({ mode: input.mode, segments: input.routeSegments, totalGasLitres,
    reserveLitres: reserve.selectedLitres, ownRmvLMin: input.ownRmvLMin, waterType: input.waterType, surfacePressureBar: input.surfacePressureBar });
  const limits = [
    ...(selectedGas?.ndl.state === 'available' && selectedGas.ndl.minutes != null ? [{ kind: 'NDL' as const, minutes: selectedGas.ndl.minutes }] : []),
    ...(selectedGas?.gasLimitedTimeMin != null ? [{ kind: 'gas' as const, minutes: selectedGas.gasLimitedTimeMin }] : []),
    ...(input.ownerMaxDurationMin != null && input.ownerMaxDurationMin > 0 ? [{ kind: 'owner-duration' as const, minutes: input.ownerMaxDurationMin }] : []),
  ].sort((a, b) => a.minutes - b.minutes);
  const warnings = [
    ...(emergency.buddyFallback ? ['Buddy RMV unknown; own RMV is used as fallback.'] : []),
    ...(selectedGas ? selectedGas.warnings : ['Select a gas candidate.']),
    ...(input.mode !== 'direct-ascent' && routeCheckpoints.state === 'unavailable' ? [routeCheckpoints.reason] : []),
    ...(reserve.selectedLitres != null && totalGasLitres != null && reserve.selectedLitres >= totalGasLitres ? ['Reserve meets or exceeds total gas.'] : []),
  ];
  const { tableProvider: _tableProvider, ...persistedInput } = input;
  void _tableProvider;
  return { ...persistedInput, version: REC_GAS_VERSION, createdAt, bestOxygenFraction, conservativeOxygenFraction,
    gasCandidates, totalGasLitres, reserve, routeCheckpoints, limitingFactor: limits[0]?.kind ?? 'unavailable',
    plannedWorkingTimeMin: limits[0]?.minutes ?? null, warnings,
    assumptions: ['NDL is no-decompression limit at depth, separate from gas-limited breathing time.',
      'Freshwater adds 1 bar per 10.3 m; saltwater per 10 m.', 'Table values are optional lookup backup and never drive readiness.',
      'Only rested surface-air or same-dive tissues are supported. No technical decompression schedule is generated.'] };
}

export function recreationalReadinessBlockers(snapshot: RecreationalGasSnapshot): string[] {
  const gas = snapshot.gasCandidates.find(candidate => candidate.selected);
  return [
    ...(!gas ? ['Select an actual gas.'] : []),
    ...(gas?.ndl.state !== 'available' ? ['Selected gas has no available Bühlmann NDL.'] : []),
    ...(gas && (gas.modM < snapshot.plannedDepthM || gas.ppo2AtPlannedDepth > snapshot.maxPpo2 || gas.ppo2AtConservativeDepth > snapshot.maxPpo2) ? ['Selected gas exceeds MOD or PPO₂ limits.'] : []),
    ...(snapshot.reserve.selectedLitres == null || snapshot.totalGasLitres == null || snapshot.reserve.selectedLitres >= snapshot.totalGasLitres ? ['Available cylinder gas or reserve is incomplete.'] : []),
    ...(snapshot.mode !== 'direct-ascent' && snapshot.routeCheckpoints.state !== 'available' ? ['Route checkpoint reserve is unavailable.'] : []),
    ...(snapshot.routeCheckpoints.state === 'available' && snapshot.routeCheckpoints.checkpoints.some(point => point.status === 'warning') ? ['Route checkpoint reserve has an insufficient-gas warning.'] : []),
  ];
}
