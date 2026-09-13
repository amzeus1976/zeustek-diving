import { describe, expect, it } from 'vitest';
import { equipmentDiveCount, equipmentServiceStatus } from '../lib/offline/equipment-usage';
import type { DiveRecord } from '../lib/offline/dives';
import type { EquipmentRecord, Stored } from '../lib/offline/dive-planning';

const equipment: Stored<EquipmentRecord> = {
  entityId: 'reg-a', name: 'Regulator A', category: 'First stage regulator', manufacturer: 'Apeks', model: '', serialNumber: '', purchasedAt: '2026-01-01', lastServiceAt: '2026-02-01', nextServiceAt: '2028-02-01', serviceIntervalMonths: 24, serviceIntervalDives: 2, divesAtLastService: 1, notes: '', retired: false, createdAt: '', modifiedAt: '',
};
const dive = (date: string, overrides: Partial<DiveRecord> = {}): DiveRecord & { entityId: string } => ({
  entityId: date, site: 'Site', date, maxDepthM: 20, bottomTimeMin: 30, gas: 'Air', notes: '', source: 'manual', createdAt: '', modifiedAt: '', ...overrides,
});

describe('equipment usage servicing', () => {
  it('counts an explicitly selected item and excludes hire gear', () => {
    const dives = [dive('2026-03-01', { equipmentIds: ['reg-a'] }), dive('2026-04-01', { equipmentIds: ['reg-b'] }), dive('2026-05-01', { hireGear: true })];
    expect(equipmentDiveCount(equipment, dives)).toBe(1);
  });

  it('counts selected owned kit on a mixed hired-and-owned dive',()=>{expect(equipmentDiveCount(equipment,[dive('2026-03-01',{hireGear:true,equipmentIds:['reg-a']})])).toBe(1);});

  it('uses all kit owned on the dive date as the legacy/import fallback', () => {
    const dives = [dive('2025-12-31'), dive('2026-01-02'), dive('2026-02-02')];
    expect(equipmentDiveCount(equipment, dives)).toBe(2);
  });

  it('marks service due when the item-specific use threshold is reached', () => {
    const dives = [dive('2026-03-01', { equipmentIds: ['reg-a'] }), dive('2026-04-01', { equipmentIds: ['reg-a'] }), dive('2026-05-01', { equipmentIds: ['reg-a'] })];
    expect(equipmentServiceStatus(equipment, dives).state).toBe('overdue');
  });

  it('uses the purchase date when the item has never been serviced', () => {
    const newEquipment = {
      ...equipment,
      purchasedAt: '2026-01-10',
      lastServiceAt: '',
      nextServiceAt: '',
      divesAtLastService: null,
    };
    const dives = [dive('2026-01-10'), dive('2026-02-01')];
    const status = equipmentServiceStatus(newEquipment, dives);
    expect(status.serviceBaseline).toBe('2026-01-10');
    expect(status.baselineKind).toBe('purchase');
    expect(status.dateDue).toBe('2028-01-10');
    expect(status.dueAt).toBe(3);
  });
});
