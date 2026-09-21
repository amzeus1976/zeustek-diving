import { calculateBuhlmannNdl, type BuhlmannModel, type NdlResult, type WaterType } from './buhlmann-ndl';
import { ambientBar, calculateEmergencyReserve, calculateRouteCheckpoints, selectReserve, type ReserveStrategy, type RouteMode, type RouteSegment } from './recreational-gas-reserve';

export const REC_GAS_VERSION = 'zeustek-rec-gas-102/1.1';
export type GasChoiceSource = 'preset' | 'analysed-fill' | 'custom' | 'owned-cylinder' | 'rental-snapshot' | 'operator-supplied' | 'calculated-best' | 'calculated-conservative';
export type RmvEvidenceSource = 'profile-average' | 'owner-entered' | 'plan-snapshot' | 'buddy-profile' | 'owner-fallback' | 'unknown';
export interface GasChoice { label: string; oxygenFraction: number; source: GasChoiceSource; analysed: boolean; evidence?: string | null }
export interface GasCandidateSnapshot {
  label: string; source: GasChoiceSource; selected: boolean; analysed: boolean; analysedEvidence: string | null;
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
  cylinderSourceMode?: 'owned' | 'rental' | 'manual'; cylinderSourceId?: string | null; cylinderSourceLabel?: string | null;
  pressureSource?: string | null; fillProvenance?: string[]; analysisProvenance?: string | null;
  sourceWarnings?: string[];
  ownRmvLMin: number | null; buddyRmvLMin: number | null; ownRmvSource?: RmvEvidenceSource; buddyRmvSource?: RmvEvidenceSource;
  reserveStrategy: ReserveStrategy; ascentRateMMin: number; ownerMaxDurationMin: number | null;
  plannedWorkingTimeMin: number | null; routeSegments: RouteSegment[];
  repetitiveDive?: boolean;
  tableProvider?: { name: string; version: string; lookup: (depthM: number, oxygenFraction: number) => number | null } | null;
}
export interface RecreationalGasSnapshot extends Omit<RecreationalGasInput, 'tableProvider'> {
  version: typeof REC_GAS_VERSION; createdAt: string; bestOxygenFraction: number; conservativeOxygenFraction: number;
  gasCandidates: GasCandidateSnapshot[]; totalGasLitres: number | null;
  reserve: ReturnType<typeof calculateEmergencyReserve> & { strategy: ReserveStrategy; thirdsLitres: number | null; selectedLitres: number | null; selectedBar: number | null };
  routeCheckpoints: ReturnType<typeof calculateRouteCheckpoints>;
  limitingFactor: 'NDL' | 'gas' | 'owner-duration' | 'reserve' | 'missing-data';
  availableWorkingTimeMin: number | null;
  selectedGasAssessment: { lowerOxygenThanBest: boolean; lowerOxygenThanConservative: boolean; summary: string };
  readiness: 'Ready' | 'Caution' | 'Blocked'; readinessReasons: string[];
  warnings: string[]; assumptions: string[];
}
const PRESETS: GasChoice[] = [21, 28, 30, 32, 36].map(value => ({ label: value === 21 ? 'Air / EAN21' : `EAN${value}`, oxygenFraction: value / 100, source: 'preset', analysed: false }));
const recommendation = (label: string, oxygenFraction: number, source: 'calculated-best' | 'calculated-conservative'): GasChoice => ({ label: `${label} · EAN${(oxygenFraction * 100).toFixed(1)}`, oxygenFraction, source, analysed: false, evidence: 'Calculated comparison only — verify and analyse the actual gas before use.' });

export function buildRecreationalGasSnapshot(input: RecreationalGasInput, createdAt = new Date().toISOString()): RecreationalGasSnapshot {
  if (!Number.isFinite(input.plannedDepthM) || input.plannedDepthM <= 0 || !Number.isFinite(input.conservatismM) || input.conservatismM < 0 || !Number.isFinite(input.maxPpo2) || input.maxPpo2 <= 0) {
    throw new Error('Enter a valid planned depth, conservatism depth and PPO₂ limit.');
  }
  const depth = input.plannedDepthM, conservativeDepth = depth + input.conservatismM;
  const bestOxygenFraction = Math.min(.4, input.maxPpo2 / ambientBar(depth, input.waterType, input.surfacePressureBar));
  const conservativeOxygenFraction = Math.min(.4, input.maxPpo2 / ambientBar(conservativeDepth, input.waterType, input.surfacePressureBar));
  const emergency = input.ownRmvLMin == null
    ? { state: 'unavailable' as const, reason: 'Own RMV is unavailable.', phases: [], totalLitres: null, buddyRmvUsed: null, buddyFallback: input.buddyRmvLMin == null }
    : calculateEmergencyReserve({ maxDepthM: depth, ownRmvLMin: input.ownRmvLMin, buddyRmvLMin: input.buddyRmvLMin, ascentRateMMin: input.ascentRateMMin, waterType: input.waterType, surfacePressureBar: input.surfacePressureBar });
  const totalGasLitres = input.cylinderWaterVolumeL != null && input.cylinderWaterVolumeL > 0 && input.startPressureBar != null && input.startPressureBar > 0
    ? input.cylinderWaterVolumeL * input.startPressureBar : null;
  const selected = selectReserve(totalGasLitres, emergency, input.reserveStrategy);
  const reserve = { ...emergency, strategy: input.reserveStrategy, thirdsLitres: selected.thirdsLitres, selectedLitres: selected.selectedLitres,
    selectedBar: selected.selectedLitres != null && input.cylinderWaterVolumeL != null && input.cylinderWaterVolumeL > 0 ? selected.selectedLitres / input.cylinderWaterVolumeL : null };
  const candidates = [...PRESETS, ...(input.analysedGases ?? []), ...(input.customGas ? [input.customGas] : []),
    recommendation('Best mix', bestOxygenFraction, 'calculated-best'), recommendation('Conservative mix', conservativeOxygenFraction, 'calculated-conservative')];
  if (candidates.some(gas => !Number.isFinite(gas.oxygenFraction) || gas.oxygenFraction < .16 || gas.oxygenFraction >= 1))
    throw new Error('Candidate oxygen fractions must be between 16% and 100%.');
  if (!candidates.some(gas => gas.label === input.selectedGasLabel))
    throw new Error('Select a current gas candidate before saving the recreational snapshot.');
  const otherModel = input.selectedBuhlmannModel === 'ZH-L16B' ? 'ZH-L16C' : 'ZH-L16B';
  const completeLevels = input.mode === 'multilevel' && input.routeSegments.length > 0 && input.routeSegments.every(level => {
    const levelDepth = level.averageDepthM ?? level.depthM;
    const levelMinutes = level.durationMin ?? level.minutes;
    return levelDepth != null && levelMinutes != null && levelDepth >= 0 && levelMinutes > 0;
  }) ? input.routeSegments : null;
  const gasCandidates = candidates.map((gas): GasCandidateSnapshot => {
    const fo2 = gas.oxygenFraction;
    const ppo2AtPlannedDepth = fo2 * ambientBar(depth, input.waterType, input.surfacePressureBar);
    const ppo2AtConservativeDepth = fo2 * ambientBar(conservativeDepth, input.waterType, input.surfacePressureBar);
    const metresPerBar = input.waterType === 'fresh' ? 10.3 : 10;
    const modM = (input.maxPpo2 / fo2 - input.surfacePressureBar) * metresPerBar;
    const eadM = ((1 - fo2) / .79) * (depth + metresPerBar) - metresPerBar;
    const ndlInput = { depthM: input.mode === 'multilevel' && !completeLevels ? Number.NaN : completeLevels?.at(-1)?.averageDepthM ?? completeLevels?.at(-1)?.depthM ?? depth, oxygenFraction: fo2, gfLow: input.gfLow, gfHigh: input.gfHigh,
      waterType: input.waterType, surfacePressureBar: input.surfacePressureBar, ascentRateMMin: input.ascentRateMMin, calculatedAt: createdAt,
      residualNitrogenUnknown: input.repetitiveDive === true,
      priorLevels: completeLevels?.slice(0, -1).map(level => ({ depthM: (level.averageDepthM ?? level.depthM)!, minutes: (level.durationMin ?? level.minutes)! })) };
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
      ...(modM < depth ? ['MOD is shallower than planned depth.'] : []),
      ...(ppo2AtPlannedDepth > input.maxPpo2 + 1e-9 ? ['PPO₂ exceeds the selected limit at planned depth.'] : []),
      ...(ppo2AtConservativeDepth > input.maxPpo2 + 1e-9 ? ['PPO₂ exceeds the selected limit at conservative depth.'] : []),
      ...(ndl.state !== 'available' ? [ndl.unavailableReason ?? 'NDL unavailable.'] : []),
      ...(gasLimitedTimeMin == null ? ['Gas-limited time unavailable until cylinder and RMV are complete.'] : []),
      ...(fo2 > .21 + 1e-9 && !gas.analysed && gas.source !== 'calculated-best' && gas.source !== 'calculated-conservative'
        ? ['Selected nitrox has no current gas analysis evidence.'] : []),
      ...(input.mode === 'multilevel' && !completeLevels ? ['Complete every multilevel segment to calculate carried-tissue NDL.'] : []),
    ];
    return { label: gas.label, source: gas.source, selected: gas.label === input.selectedGasLabel, analysed: gas.analysed,
      analysedEvidence: gas.evidence ?? null, oxygenFraction: fo2, nitrogenFraction: 1 - fo2, heliumFraction: 0,
      modM, ppo2AtPlannedDepth, ppo2AtConservativeDepth, eadM, ndl, otherModelNdl, tableBackup, gasLimitedTimeMin, warnings };
  });
  const selectedGas = gasCandidates.find(row => row.selected);
  const routeCheckpoints = calculateRouteCheckpoints({ mode: input.mode, segments: input.routeSegments, totalGasLitres,
    reserveLitres: reserve.selectedLitres, ownRmvLMin: input.ownRmvLMin, buddyRmvLMin: input.buddyRmvLMin,
    cylinderWaterVolumeL: input.cylinderWaterVolumeL, waterType: input.waterType, surfacePressureBar: input.surfacePressureBar });
  const limits = [
    ...(selectedGas?.ndl.state === 'available' && selectedGas.ndl.minutes != null ? [{ kind: 'NDL' as const, minutes: selectedGas.ndl.minutes }] : []),
    ...(selectedGas?.gasLimitedTimeMin != null ? [{ kind: 'gas' as const, minutes: selectedGas.gasLimitedTimeMin }] : []),
    ...(input.ownerMaxDurationMin != null && input.ownerMaxDurationMin > 0 ? [{ kind: 'owner-duration' as const, minutes: input.ownerMaxDurationMin }] : []),
  ].sort((a, b) => a.minutes - b.minutes);
  const reserveBlocked = reserve.selectedLitres == null || totalGasLitres == null || reserve.selectedLitres >= totalGasLitres
    || (routeCheckpoints.state === 'available' && routeCheckpoints.checkpoints.some(point => point.status === 'warning'));
  const missingData = !selectedGas || selectedGas.ndl.state !== 'available' || totalGasLitres == null || input.ownRmvLMin == null;
  const limitingFactor = missingData ? 'missing-data' as const : reserveBlocked ? 'reserve' as const : limits[0]?.kind ?? 'missing-data' as const;
  const lowerOxygenThanBest = Boolean(selectedGas && selectedGas.oxygenFraction + 1e-9 < bestOxygenFraction);
  const lowerOxygenThanConservative = Boolean(selectedGas && selectedGas.oxygenFraction + 1e-9 < conservativeOxygenFraction);
  const selectedGasAssessment = { lowerOxygenThanBest, lowerOxygenThanConservative,
    summary: !selectedGas ? 'No selected gas.' : lowerOxygenThanConservative ? 'Selected gas is lower O₂ than the conservative recommendation; it remains allowed and its NDL/MOD values are shown.' : lowerOxygenThanBest ? 'Selected gas is lower O₂ than the best-mix recommendation.' : 'Selected gas meets or exceeds the calculated O₂ recommendation; verify MOD and analysis.' };
  const exceedsNoStop = Boolean(input.plannedWorkingTimeMin != null && selectedGas?.ndl.minutes != null && input.plannedWorkingTimeMin > selectedGas.ndl.minutes);
  const exceedsAvailableTime = Boolean(input.plannedWorkingTimeMin != null && limits[0]?.minutes != null && input.plannedWorkingTimeMin > limits[0].minutes);
  const warnings = [
    ...(emergency.buddyFallback ? ['Buddy RMV unknown — using owner RMV fallback for emergency reserve.'] : []),
    ...(selectedGas ? selectedGas.warnings : ['Select a gas candidate.']),
    ...(input.mode !== 'direct-ascent' && routeCheckpoints.state === 'unavailable' ? [routeCheckpoints.reason] : []),
    ...(reserve.selectedLitres != null && totalGasLitres != null && reserve.selectedLitres >= totalGasLitres ? ['Reserve meets or exceeds total gas.'] : []),
    ...(input.plannedWorkingTimeMin == null ? ['Planned working time is not set.'] : []),
    ...(input.sourceWarnings ?? []),
    ...(exceedsNoStop ? ['This plan exceeds recreational no-stop scope. Technical decompression planning is not enabled in T12.6R.'] : []),
    ...(!exceedsNoStop && exceedsAvailableTime ? [`Planned working time exceeds the ${limits[0]!.kind} limit.`] : []),
  ];
  const { tableProvider: _tableProvider, ...persistedInput } = input;
  void _tableProvider;
  const provisional: RecreationalGasSnapshot = { ...persistedInput, version: REC_GAS_VERSION, createdAt, bestOxygenFraction, conservativeOxygenFraction,
    gasCandidates, totalGasLitres, reserve, routeCheckpoints, limitingFactor, availableWorkingTimeMin: limits[0]?.minutes ?? null,
    selectedGasAssessment, readiness: 'Blocked', readinessReasons: [], warnings,
    assumptions: ['NDL is no-decompression limit at depth, separate from gas-limited breathing time.',
      'Freshwater adds 1 bar per 10.3 m; saltwater per 10 m.', 'Table values are optional lookup backup and never drive readiness.',
      'Only rested surface-air or same-dive tissues are supported. No technical decompression schedule is generated.'] };
  const blockers = recreationalReadinessBlockers(provisional);
  const readiness = blockers.length ? 'Blocked' : warnings.length ? 'Caution' : 'Ready';
  return { ...provisional, readiness, readinessReasons: blockers.length ? blockers : warnings };
}

export function recreationalReadinessBlockers(snapshot: RecreationalGasSnapshot): string[] {
  const gas = snapshot.gasCandidates.find(candidate => candidate.selected);
  return [
    ...(!gas ? ['Select an actual gas.'] : []),
    ...(gas?.ndl.state !== 'available' ? ['Selected gas has no available Bühlmann NDL.'] : []),
    ...(gas && (gas.modM < snapshot.plannedDepthM || gas.ppo2AtPlannedDepth > snapshot.maxPpo2 || gas.ppo2AtConservativeDepth > snapshot.maxPpo2) ? ['Selected gas exceeds MOD or PPO₂ limits.'] : []),
    ...(snapshot.reserve.selectedLitres == null || snapshot.totalGasLitres == null ? ['Available cylinder gas or reserve is incomplete.'] : []),
    ...(snapshot.reserve.selectedLitres != null && snapshot.totalGasLitres != null && snapshot.reserve.selectedLitres >= snapshot.totalGasLitres ? ['Reserve meets or exceeds total available gas.'] : []),
    ...(snapshot.plannedWorkingTimeMin == null || snapshot.plannedWorkingTimeMin <= 0 ? ['Planned working time is missing.'] : []),
    ...(snapshot.plannedWorkingTimeMin != null && gas?.ndl.minutes != null && snapshot.plannedWorkingTimeMin > gas.ndl.minutes ? ['Planned working time exceeds the selected gas NDL.'] : []),
    ...(snapshot.plannedWorkingTimeMin != null && gas?.gasLimitedTimeMin != null && snapshot.plannedWorkingTimeMin > gas.gasLimitedTimeMin ? ['Planned working time exceeds gas-limited time after reserve.'] : []),
    ...(snapshot.ownerMaxDurationMin != null && snapshot.plannedWorkingTimeMin != null && snapshot.plannedWorkingTimeMin > snapshot.ownerMaxDurationMin ? ['Planned working time exceeds the owner maximum duration.'] : []),
    ...(snapshot.mode !== 'direct-ascent' && snapshot.routeCheckpoints.state !== 'available' ? ['Route checkpoint reserve is unavailable.'] : []),
    ...(snapshot.routeCheckpoints.state === 'available' && snapshot.routeCheckpoints.checkpoints.some(point => point.status === 'warning') ? ['Route checkpoint reserve has an insufficient-gas warning.'] : []),
  ];
}
