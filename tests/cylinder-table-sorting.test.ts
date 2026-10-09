import { describe, expect, it } from 'vitest';
import { buildCylinderTableRows, nextCylinderSort, sortCylinderTableRows } from '../lib/cylinders/cylinder-table';
import { CYLINDER_COLUMNS } from '../lib/cylinders/cylinder-column-preferences';
import type { Stored } from '../lib/offline/dive-planning';
import type { CylinderEquipmentRecord, CylinderFillRecord, GasAnalysisRecord } from '../lib/offline/loadouts-gas';

const cylinder = (id: string, extra: Partial<CylinderEquipmentRecord> = {}): Stored<CylinderEquipmentRecord> => ({
  entityId: id, name: id, category: 'Cylinder', manufacturer: '', model: '', serialNumber: '', purchasedAt: '', lastServiceAt: '', nextServiceAt: '', notes: '', retired: false, createdAt: '', modifiedAt: '', ...extra,
});
const fill = (id: string, pressure: number | null, filledAt = '2026-10-09T10:00:00Z', oxygen = .21): Stored<CylinderFillRecord> => ({
  entityId: `fill-${id}`, cylinderEquipmentId: id, pressureBar: pressure, filledAt, oxygenFraction: oxygen, heliumFraction: 0, provider: 'Test centre', notes: '', source: 'recorded', createdAt: '', modifiedAt: '',
});
const ids = (rows: ReturnType<typeof buildCylinderTableRows>) => rows.map(row => row.item.entityId);

describe('Cylinder table ordering', () => {
  it('orders display IDs naturally and preserves missing/invalid legacy IDs without assigning replacements', () => {
    const cylinders = [cylinder('ten', { cylinderNumber: '10' }), cylinder('missing'), cylinder('two', { cylinderNumber: '02' }), cylinder('one', { cylinderNumber: '01' })];
    const before = JSON.stringify(cylinders);
    const rows = buildCylinderTableRows(cylinders, [], []);
    expect(ids(sortCylinderTableRows(rows, { column: 'id', direction: 'ascending' }))).toEqual(['one', 'two', 'ten', 'missing']);
    expect(ids(sortCylinderTableRows(rows, { column: 'id', direction: 'descending' }))).toEqual(['ten', 'two', 'one', 'missing']);
    expect(JSON.stringify(cylinders)).toBe(before);
    expect(ids(rows)).toEqual(['ten', 'missing', 'two', 'one']);
  });

  it('orders pressures numerically, keeps zero meaningful and leaves missing pressure last both ways', () => {
    const cylinders = ['high', 'low', 'middle', 'unknown', 'empty'].map(id => cylinder(id));
    const rows = buildCylinderTableRows(cylinders, [fill('high', 200), fill('low', 8), fill('middle', 80), fill('unknown', null), fill('empty', 0)], []);
    expect(ids(sortCylinderTableRows(rows, { column: 'pressure', direction: 'ascending' }))).toEqual(['empty', 'low', 'middle', 'high', 'unknown']);
    expect(ids(sortCylinderTableRows(rows, { column: 'pressure', direction: 'descending' }))).toEqual(['high', 'middle', 'low', 'empty', 'unknown']);
  });

  it('uses the current remaining-pressure event and preserves the explicit analysis chain', () => {
    const cylinders = [cylinder('used'), cylinder('full')];
    const fills = [fill('used', 230), fill('full', 150), { ...fill('used', 40, '2026-10-09T11:00:00Z'), entityId: 'usage-used', eventType: 'usage' as const, originFillId: 'fill-used' }];
    const analyses: Array<Stored<GasAnalysisRecord>> = [{ entityId: 'analysis-used', cylinderEquipmentId: 'used', fillId: 'fill-used', analysedAt: '2026-10-09T10:15:00Z', oxygenFraction: .32, heliumFraction: 0, analysedByPersonId: null, attachmentIds: [], notes: '', createdAt: '', modifiedAt: '' }];
    const before = JSON.stringify({ cylinders, fills, analyses });
    const rows = buildCylinderTableRows(cylinders, fills, analyses);
    const sorted = sortCylinderTableRows(rows, { column: 'pressure', direction: 'ascending' });
    expect(ids(sorted)).toEqual(['used', 'full']);
    expect(sorted[0]?.state.currentAnalysis?.entityId).toBe('analysis-used');
    expect(sorted[0]?.state.latestFill?.pressureBar).toBe(40);
    expect(JSON.stringify({ cylinders, fills, analyses })).toBe(before);
  });

  it('orders dates chronologically across years and timezone offsets, keeping unrecorded dates last', () => {
    const rows = buildCylinderTableRows(['newer', 'older', 'missing'].map(id => cylinder(id)), [fill('newer', 200, '2027-01-01T00:30:00+01:00'), fill('older', 200, '2026-12-31T23:00:00Z')], []);
    expect(ids(sortCylinderTableRows(rows, { column: 'lastFill', direction: 'ascending' }))).toEqual(['older', 'newer', 'missing']);
    expect(ids(sortCylinderTableRows(rows, { column: 'lastFill', direction: 'descending' }))).toEqual(['newer', 'older', 'missing']);
    const deadlines = buildCylinderTableRows([cylinder('later', { oxygenCleanUntil: '2027-01' }), cylinder('earlier', { oxygenCleanUntil: '2026-12' }), cylinder('unknown')], [], []);
    expect(ids(sortCylinderTableRows(deadlines, { column: 'nextTest', direction: 'ascending' }))).toEqual(['earlier', 'later', 'unknown']);
  });

  it('orders gas labels and serials naturally, including multi-digit mixtures', () => {
    const rows = buildCylinderTableRows([cylinder('rich', { serialNumber: 'SN10' }), cylinder('air', { serialNumber: 'SN1' }), cylinder('lean', { serialNumber: 'SN2' }), cylinder('missing')], [fill('rich', 200, undefined, .36), fill('air', 200), fill('lean', 200, undefined, .08)], []);
    expect(ids(sortCylinderTableRows(rows, { column: 'gas', direction: 'ascending' }))).toEqual(['air', 'lean', 'rich', 'missing']);
    expect(ids(sortCylinderTableRows(rows, { column: 'serial', direction: 'ascending' }))).toEqual(['air', 'lean', 'rich', 'missing']);
  });

  it('supports every selectable column, keeps equal values stable and never rearranges its input array', () => {
    const rows = buildCylinderTableRows([cylinder('a', { waterVolumeLiters: 12 }), cylinder('b', { waterVolumeLiters: 12 })], [], []);
    Object.freeze(rows);
    for (const column of CYLINDER_COLUMNS) for (const direction of ['ascending', 'descending'] as const) {
      expect(ids(sortCylinderTableRows(rows, { column, direction }))).toEqual(['a', 'b']);
    }
  });

  it('reverses repeated header activation and starts a newly selected column ascending', () => {
    const ascending = { column: 'id' as const, direction: 'ascending' as const };
    const descending = nextCylinderSort(ascending, 'id');
    expect(descending.direction).toBe('descending');
    expect(nextCylinderSort(descending, 'id')).toEqual(ascending);
    expect(nextCylinderSort(descending, 'pressure')).toEqual({ column: 'pressure', direction: 'ascending' });
  });
});
