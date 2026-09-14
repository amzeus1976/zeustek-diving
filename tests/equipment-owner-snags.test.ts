import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, saveLocalRecord } from '../lib/offline/dive-store';
import {
  listEquipment,
  type EquipmentRecord,
  type Stored,
} from '../lib/offline/dive-planning';
import { overviewServiceItems } from '../lib/offline/equipment-usage';
import {
  equipmentEventsFor,
  latestEquipmentEvents,
  listEquipmentEvents,
  resolveEquipmentEvent,
  saveEquipmentEvent,
  updateEquipmentServiceBaseline,
} from '../lib/offline/equipment-events';
import { DIVE_RECORD_KINDS } from '../lib/record-identity';
import {
  localBackupPayload,
  restoreLocalPayload,
} from '../lib/offline/local-backup';

const equipment = (
  entityId: string,
  overrides: Partial<Stored<EquipmentRecord>> = {},
): Stored<EquipmentRecord> => ({
  entityId,
  name: entityId,
  category: 'Regulator',
  manufacturer: 'Scubapro',
  model: '',
  serialNumber: '',
  purchasedAt: '2026-01-01',
  lastServiceAt: '',
  nextServiceAt: '2099-01-01',
  serviceRequired: true,
  serviceIntervalMonths: 24,
  serviceIntervalDives: null,
  divesAtLastService: null,
  notes: '',
  retired: false,
  createdAt: '',
  modifiedAt: '',
  ...overrides,
});

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('equipment-owner-snags');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('SNAG-EQUIP-001 Overview Kit Status projection', () => {
  it('shows only active scheduled-service items with a real due date', () => {
    const items = [
      equipment('valid'),
      equipment('no-service', { serviceRequired: false }),
      equipment('retired', { retired: true }),
      equipment('no-date', {
        nextServiceAt: '',
        purchasedAt: '',
        lastServiceAt: '',
        serviceIntervalMonths: null,
      }),
    ];
    expect(overviewServiceItems(items, [])).toEqual([items[0]]);
  });

  it('orders overdue first and then future dates soonest-first', () => {
    const overdue = equipment('overdue', { nextServiceAt: '2020-01-01' });
    const later = equipment('later', { nextServiceAt: '2099-06-01' });
    const sooner = equipment('sooner', { nextServiceAt: '2099-02-01' });
    expect(
      overviewServiceItems([later, overdue, sooner], []).map(
        (item) => item.entityId,
      ),
    ).toEqual(['overdue', 'sooner', 'later']);
  });

  it('does not infer serviceability from an equipment category', () => {
    const wetsuit = equipment('wetsuit', {
      category: 'Wetsuit',
      serviceRequired: false,
      nextServiceAt: '2028-01-01',
    });
    expect(overviewServiceItems([wetsuit], [])).toHaveLength(0);
  });
});

describe('SNAG-EQUIP-003 canonical equipment event history', () => {
  it('registers equipment-event as a canonical local-first record kind', () => {
    expect(DIVE_RECORD_KINDS).toContain('equipment-event');
  });

  it('saves events offline and returns the latest five newest-first', async () => {
    for (let index = 1; index <= 6; index += 1) {
      await saveEquipmentEvent({
        equipmentId: 'reg-a',
        eventType: index % 2 ? 'fault' : 'maintenance',
        title: `Event ${index}`,
        occurredAt: `2026-09-${String(index).padStart(2, '0')}`,
        status: index === 6 ? 'open' : 'resolved',
      });
    }
    const events = await listEquipmentEvents();
    expect(equipmentEventsFor(events, 'reg-a')).toHaveLength(6);
    expect(latestEquipmentEvents(events, 'reg-a')).toHaveLength(5);
    expect(latestEquipmentEvents(events, 'reg-a')[0]?.title).toBe('Event 6');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resolves an issue without changing its canonical entity id', async () => {
    const saved = await saveEquipmentEvent({
      equipmentId: 'reg-a',
      eventType: 'fault',
      title: 'SPG hose leaking',
      occurredAt: '2026-09-12',
      status: 'open',
    });
    const before = (await listEquipmentEvents()).find(
      (event) => event.entityId === saved.id,
    )!;
    await resolveEquipmentEvent(
      before,
      '2026-09-14',
      'Hose replaced and leak test passed.',
    );
    const after = (await listEquipmentEvents()).find(
      (event) => event.entityId === saved.id,
    )!;
    expect(after).toMatchObject({
      entityId: saved.id,
      status: 'resolved',
      resolvedAt: '2026-09-14',
      resolutionNotes: 'Hose replaced and leak test passed.',
    });
    expect(
      await zeustekDb.events
        .where('entityId')
        .equals(`dive:equipment-owner-snags:${saved.id}`)
        .count(),
    ).toBe(2);
  });

  it('only changes scheduled-service baseline when explicitly requested', async () => {
    await saveLocalRecord('equipment', {
      entityId: 'reg-a',
      name: 'MK25 EVO',
      category: 'First stage regulator',
      manufacturer: 'Scubapro',
      model: 'MK25 EVO',
      serialNumber: '',
      purchasedAt: '2025-08-11',
      lastServiceAt: '2025-08-11',
      nextServiceAt: '2027-08-11',
      serviceRequired: true,
      serviceIntervalMonths: 24,
      serviceIntervalDives: null,
      divesAtLastService: null,
      notes: '',
      retired: false,
    });
    await saveEquipmentEvent({
      equipmentId: 'reg-a',
      eventType: 'note',
      title: 'Visual check',
      occurredAt: '2026-09-14',
      status: 'resolved',
    });
    expect((await listEquipment())[0]).toMatchObject({
      lastServiceAt: '2025-08-11',
      nextServiceAt: '2027-08-11',
    });

    const service = await saveEquipmentEvent({
      equipmentId: 'reg-a',
      eventType: 'service',
      title: 'Actual synthetic service',
      occurredAt: '2026-09-14',
      status: 'resolved',
      resolvedAt: '2026-09-14',
    });
    await updateEquipmentServiceBaseline(service.id);
    expect((await listEquipment())[0]).toMatchObject({
      lastServiceAt: '2026-09-14',
      nextServiceAt: '2028-09-14',
    });
    expect(
      (await listEquipmentEvents()).find(
        (event) => event.entityId === service.id,
      )?.serviceBaselineApplied,
    ).toBe(true);
  });

  it('retains equipment events through local backup and restore', async () => {
    await saveEquipmentEvent({
      equipmentId: 'reg-a',
      eventType: 'inspection',
      title: 'Bench inspection',
      occurredAt: '2026-09-14',
      status: 'resolved',
    });
    const backup = await localBackupPayload();
    for (const table of zeustekDb.tables) await table.clear();
    await restoreLocalPayload(backup);
    expect(await listEquipmentEvents()).toHaveLength(1);
    expect((await listEquipmentEvents())[0]?.title).toBe('Bench inspection');
  });
});

describe('Equipment UI precode integration', () => {
  it('prepares the Overview projection, maintenance log and scoped editor layout', () => {
    const script = readFileSync(
      'scripts/apply-equipment-owner-snags-precode.mjs',
      'utf8',
    );
    expect(script).toContain('overviewServiceItems(equipment, dives, 8)');
    expect(script).toContain(
      'No equipment currently requires scheduled servicing.',
    );
    expect(script).toContain(
      '<EquipmentMaintenanceLog equipment={viewing} onEquipmentChanged={refresh} />',
    );
    expect(script).toContain('equipment-form-fields');
    expect(script).toContain('equipment-toggle');
    const dashboard = readFileSync('app/dashboard-client.tsx', 'utf8');
    const inventory = dashboard.slice(
      dashboard.indexOf('function Equipment()'),
      dashboard.indexOf('function EquipmentForm('),
    );
    expect(inventory).toContain(
      '<EquipmentMaintenanceLog equipment={viewing} onEquipmentChanged={refresh} />',
    );
    expect(
      dashboard.slice(
        dashboard.indexOf('function Logbook('),
        dashboard.indexOf('function Equipment()'),
      ),
    ).not.toContain('EquipmentMaintenanceLog');
    const editor = dashboard.slice(
      dashboard.indexOf('function EquipmentForm('),
      dashboard.indexOf('function EquipmentSets('),
    );
    for (const heading of [
      'Identity & item details',
      'Servicing',
      'Status',
      'Notes',
    ])
      expect(editor).toContain(`<h3>${heading}</h3>`);
  });

  it('keeps the detail preview bounded to five events and exposes the full log', () => {
    const component = readFileSync(
      'components/equipment-maintenance-log.tsx',
      'utf8',
    );
    expect(component).toContain(
      'latestEquipmentEvents(events, equipment.entityId, 5)',
    );
    expect(component).toContain('More… view full log');
    expect(component).toContain('Resolve issue');
    expect(component).toContain(
      'Update scheduled-service baseline from this service',
    );
  });
});
