import { describe, expect, it } from 'vitest';
import { applyMissingWholeDiveOcrmv, estimateWholeDiveOcrmv, isWholeDiveRmvEstimateCurrent } from '../lib/whole-dive-oc-rmv';
import type { DiveCylinder, DiveRecord } from '../lib/offline/dives';

function cylinder(id: string, volume: number, start: number, end: number, participation: 'used' | 'excluded' | undefined = 'used'): DiveCylinder {
  return {
    id, name: id, gasType: 'Air', oxygenPercent: 21, heliumPercent: 0,
    configuration: 'Independent Doubles', material: 'Steel', size: '',
    internalVolumeLiters: volume, startPressureBar: start, endPressureBar: end,
    switchDepthM: null, switchRuntimeMin: null,
    wholeDiveRmvParticipation: participation,
  };
}

const left = cylinder('left', 12, 200, 100);
const right = cylinder('right', 7, 180, 80);
const profile = {
  averageDepthM: 20,
  totalElapsedMin: 40,
  cylinders: [left, right],
};

describe('whole-dive open-circuit RMV estimate', () => {
  it('sums only explicitly used cylinders and retains unrounded provenance', () => {
    const result = estimateWholeDiveOcrmv(profile);
    expect(result).toMatchObject({
      kind: 'estimate', version: 'whole-dive-oc-rmv/1',
      usedLitres: 1900, rmvLitresPerMinute: 1900 / 120,
      includedCylinderIds: ['left', 'right'],
      averageDepthM: 20, elapsedMinutes: 40,
    });
    expect(result).not.toHaveProperty('sacPressureBarMin');
  });

  it('excludes an explicitly unused bailout without assigning it a segment rate', () => {
    const result = estimateWholeDiveOcrmv({
      ...profile,
      cylinders: [left, right, cylinder('bailout', 7, 200, 150, 'excluded')],
    });
    expect(result).toMatchObject({kind: 'estimate', usedLitres: 1900, includedCylinderIds: ['left', 'right']});
  });

  it('blocks unreviewed participation, including legacy cylinder rows', () => {
    const legacy = cylinder('legacy', 7, 180, 80);
    delete legacy.wholeDiveRmvParticipation;
    expect(estimateWholeDiveOcrmv({...profile, cylinders: [left, legacy]})).toMatchObject({kind: 'unavailable', reason: 'unreviewed-participation'});
    expect(estimateWholeDiveOcrmv({...profile, cylinders: [left, {...right, wholeDiveRmvParticipation: 'maybe' as 'used'}]})).toMatchObject({kind: 'unavailable', reason: 'unreviewed-participation'});
  });

  it('rejects CCR, unknown configurations and invalid or duplicate evidence', () => {
    expect(estimateWholeDiveOcrmv({...profile, cylinders: [{...left, configuration: 'CCR Oxygen'}, right]})).toMatchObject({kind: 'unavailable', reason: 'unsupported-configuration'});
    expect(estimateWholeDiveOcrmv({...profile, cylinders: [{...left, configuration: 'Unknown'}, right]})).toMatchObject({kind: 'unavailable', reason: 'unsupported-configuration'});
    expect(estimateWholeDiveOcrmv({...profile, cylinders: [left, {...right, id: 'left'}]})).toMatchObject({kind: 'unavailable', reason: 'duplicate-cylinder'});
    expect(estimateWholeDiveOcrmv({...profile, cylinders: [left, {...right, endPressureBar: 190}]})).toMatchObject({kind: 'unavailable', reason: 'invalid-cylinder-data'});
  });

  it('requires valid whole-dive depth and elapsed time and at least two included cylinders', () => {
    expect(estimateWholeDiveOcrmv({...profile, averageDepthM: null})).toMatchObject({kind: 'unavailable', reason: 'invalid-dive-data'});
    expect(estimateWholeDiveOcrmv({...profile, totalElapsedMin: 0})).toMatchObject({kind: 'unavailable', reason: 'invalid-dive-data'});
    expect(estimateWholeDiveOcrmv({...profile, cylinders: [left, {...right, wholeDiveRmvParticipation: 'excluded'}]})).toMatchObject({kind: 'unavailable', reason: 'fewer-than-two-used'});
  });

  it('applies only an owner-requested missing Dive value with versioned source evidence', () => {
    const original: Pick<DiveRecord, 'cylinders' | 'averageDepthM' | 'totalElapsedMin' | 'rmvRate' | 'rmvEstimate'> = {...profile, rmvRate: null, cylinders: profile.cylinders.map(c => ({...c}))};
    const applied = applyMissingWholeDiveOcrmv(original);
    expect(applied.changed).toBe(true);
    if (!applied.changed) throw new Error('Expected an applied estimate');
    expect(applied.dive.rmvRate).toBe(1900 / 120);
    expect(applied.dive.rmvEstimate).toMatchObject({
      version: 'whole-dive-oc-rmv/1', usedLitres: 1900,
      includedCylinders: [{id: 'left', internalVolumeLiters: 12, startPressureBar: 200, endPressureBar: 100}, {id: 'right', internalVolumeLiters: 7, startPressureBar: 180, endPressureBar: 80}],
    });
    expect(original.rmvRate).toBeNull();
    expect(original.cylinders).toEqual(profile.cylinders);
  });

  it('preserves a manual Dive RMV and all cylinder-level manual rates', () => {
    const original = {...profile, rmvRate: 18, cylinders: [{...left, rmvRate: 22, sacPressureBarMin: 2}, right]};
    const applied = applyMissingWholeDiveOcrmv(original);
    expect(applied).toMatchObject({changed: false, reason: 'existing-value'});
    expect(applied.dive).toBe(original);
    expect(original.cylinders[0]).toMatchObject({rmvRate: 22, sacPressureBarMin: 2});
  });

  it('invalidates applied provenance when measured gas or depth changes', () => {
    const source: Pick<DiveRecord, 'cylinders' | 'averageDepthM' | 'totalElapsedMin' | 'rmvRate' | 'rmvEstimate'> = {...profile, rmvRate: null};
    const applied = applyMissingWholeDiveOcrmv(source);
    if (!applied.changed) throw new Error('Expected an applied estimate');
    expect(isWholeDiveRmvEstimateCurrent(applied.dive)).toBe(true);
    expect(isWholeDiveRmvEstimateCurrent({...applied.dive, cylinders: [left, {...right, endPressureBar: 70}]})).toBe(false);
    expect(isWholeDiveRmvEstimateCurrent({...applied.dive, averageDepthM: 18})).toBe(false);
  });
});
