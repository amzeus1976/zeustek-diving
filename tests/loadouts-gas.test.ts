import { describe, expect, it } from 'vitest';
import {
  approximateSurfaceGasLitres,
  deriveCylinderCurrentState,
  gasMixLabel,
  maximumOperatingDepthM,
  normaliseReusableLoadout,
  validateReusableLoadout,
  type CylinderFillRecord,
  type GasAnalysisRecord,
  type ReusableLoadoutRecord,
} from '../lib/offline/loadouts-gas';
import type { EquipmentRecord, Stored } from '../lib/offline/dive-planning';

const gear = (entityId: string, retired = false): Stored<EquipmentRecord> => ({
  entityId, name: entityId, category: 'Other', manufacturer: '', model: '', serialNumber: '', purchasedAt: '', lastServiceAt: '', nextServiceAt: '', notes: '', retired,
  createdAt: '2026-01-01T00:00:00Z', modifiedAt: '2026-01-01T00:00:00Z',
});

describe('T05 reusable loadouts and cylinder evidence', () => {
  it('preserves legacy Equipment Set item IDs as unassigned other items during semantic-slot adoption', () => {
    const record = {
      ...gear('set-1'), entityId: 'set-1', name: 'Legacy set', equipmentIds: ['a','b'], notes: '', iconMediaId: '', slots: { 'personal.mask': 'a' },
    } as unknown as Stored<ReusableLoadoutRecord>;
    const normalised = normaliseReusableLoadout(record);
    expect(normalised.slots?.['personal.mask']).toBe('a');
    expect(normalised.otherItemIds).toEqual(['b']);
    expect(normalised.equipmentIds).toEqual(['a','b']);
  });

  it('keeps missing and retired equipment explicit rather than silently deleting historical selections', () => {
    const result = validateReusableLoadout({ slots: { 'personal.mask': 'a', other: ['missing','retired'] }, equipmentIds: [] }, [gear('a'), gear('retired', true)]);
    expect(result.missingEquipmentIds).toEqual(['missing']);
    expect(result.retiredEquipmentIds).toEqual(['retired']);
    expect(result.warnings.join(' ')).toContain('unavailable');
    expect(result.warnings.join(' ')).toContain('retired');
  });

  it('never treats an analysis linked to an older fill as current after a newer fill', () => {
    const fills = [
      { entityId: 'fill-old', cylinderEquipmentId: 'cyl', filledAt: '2026-09-01T10:00:00Z', pressureBar: 200, oxygenFraction: .32, heliumFraction: 0, provider: '', notes: '', source: 'recorded', createdAt: '', modifiedAt: '' },
      { entityId: 'fill-new', cylinderEquipmentId: 'cyl', filledAt: '2026-09-10T10:00:00Z', pressureBar: 220, oxygenFraction: .32, heliumFraction: 0, provider: '', notes: '', source: 'recorded', createdAt: '', modifiedAt: '' },
    ] as Array<Stored<CylinderFillRecord>>;
    const analyses = [
      { entityId: 'analysis-old', cylinderEquipmentId: 'cyl', fillId: 'fill-old', analysedAt: '2026-09-01T10:15:00Z', oxygenFraction: .319, heliumFraction: 0, analysedByPersonId: null, attachmentIds: [], notes: '', createdAt: '', modifiedAt: '' },
    ] as Array<Stored<GasAnalysisRecord>>;
    const state = deriveCylinderCurrentState({ waterVolumeLiters: 12 }, fills, analyses);
    expect(state.latestFill?.entityId).toBe('fill-new');
    expect(state.currentAnalysis).toBeNull();
    expect(state.analysisState).toBe('stale');
    expect(state.analysedMixLabel).toContain('stale');
  });

  it('promotes only an analysis explicitly linked to the latest fill', () => {
    const fills = [{ entityId: 'fill-new', cylinderEquipmentId: 'cyl', filledAt: '2026-09-10T10:00:00Z', pressureBar: 232, oxygenFraction: .33, heliumFraction: 0, provider: '', notes: '', source: 'recorded', createdAt: '', modifiedAt: '' }] as Array<Stored<CylinderFillRecord>>;
    const analyses = [{ entityId: 'analysis-new', cylinderEquipmentId: 'cyl', fillId: 'fill-new', analysedAt: '2026-09-10T10:20:00Z', oxygenFraction: .329, heliumFraction: 0, analysedByPersonId: null, attachmentIds: [], notes: '', createdAt: '', modifiedAt: '' }] as Array<Stored<GasAnalysisRecord>>;
    const state = deriveCylinderCurrentState({ waterVolumeLiters: 12 }, fills, analyses);
    expect(state.analysisState).toBe('current');
    expect(state.analysedMixLabel).toBe('Nitrox 33');
    expect(state.approximateSurfaceLitres).toBe(2784);
  });

  it('marks gas calculations as deterministic helpers without persisting them as source facts', () => {
    expect(approximateSurfaceGasLitres(12, 232)).toBe(2784);
    expect(gasMixLabel(.21, 0)).toBe('Air');
    expect(gasMixLabel(.18, .45)).toBe('Trimix 18/45');
    expect(Math.round(maximumOperatingDepthM(.32, 1.4) ?? 0)).toBe(34);
  });
  it('does not infer a fully known gas mix from partial analysis', () => {
    expect(gasMixLabel(.32, null)).toContain('He unrecorded');
    expect(gasMixLabel(null, .45)).toContain('O₂ unrecorded');
  });
  it('warns about invalid semantic slots while preserving the selected IDs', () => {
    const slots = {'personal.mask': 'cylinder'};
    expect(validateReusableLoadout({slots,equipmentIds:['cylinder']},[{...gear('cylinder'),category:'Cylinder'}]).warnings.join(' ')).toContain('does not match');
    expect(slots).toEqual({'personal.mask':'cylinder'});
  });
});
