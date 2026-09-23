import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import {
  configureDiveStore,
  saveLocalRecord,
  pendingDiveChanges,
  flushDiveChanges,
} from '../lib/offline/dive-store';
import { listEquipment, listRecords } from '../lib/offline/dive-planning';
import {
  listEquipmentEvents,
  saveEquipmentEvent,
  resolveEquipmentEvent,
  updateEquipmentEventStatus,
  updateEquipmentServiceBaseline,
} from '../lib/offline/equipment-events';
import {
  equipmentServiceStatus,
  overviewServiceItems,
} from '../lib/offline/equipment-usage';
import {
  localBackupPayload,
  restoreLocalPayload,
} from '../lib/offline/local-backup';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('equipment-safety');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const gear = () =>
  saveLocalRecord('equipment', {
    entityId: 'reg',
    name: 'Synthetic regulator',
    category: 'Regulator',
    manufacturer: '',
    model: '',
    serialNumber: '',
    purchasedAt: '2025-01-01',
    lastServiceAt: '2025-01-01',
    nextServiceAt: '2027-01-01',
    serviceRequired: true,
    serviceIntervalMonths: 24,
    serviceIntervalDives: 10,
    divesAtLastService: 0,
    notes: '',
    retired: false,
    unknownFutureFact: 'retain',
  });
const event = (
  eventType: 'service' | 'fault' | 'repair' | 'note',
  date = '2026-09-14',
) =>
  saveEquipmentEvent({
    equipmentId: 'reg',
    eventType,
    title: 'Synthetic ' + eventType,
    occurredAt: date,
    status: 'open',
  });

describe('Equipment event safety and canonical compatibility', () => {
  it('marks Monitoring then resolves the same event while preserving unknown evidence and baseline', async () => {
    await gear();
    const result = await event('fault');
    await saveLocalRecord('equipment-event', {
      entityId: result.id,
      unknownEvidence: 'retained',
    });
    await updateEquipmentEventStatus(result.id, 'monitoring');
    let current = (await listEquipmentEvents())[0]!;
    expect(current.status).toBe('monitoring');
    await resolveEquipmentEvent(current, '2026-09-14', 'Synthetic resolution');
    current = (await listEquipmentEvents())[0]!;
    expect(current).toMatchObject({
      entityId: result.id,
      status: 'resolved',
      resolutionNotes: 'Synthetic resolution',
      unknownEvidence: 'retained',
      serviceBaselineApplied: false,
    });
    expect((await listEquipment())[0]).toMatchObject({
      lastServiceAt: '2025-01-01',
      nextServiceAt: '2027-01-01',
      divesAtLastService: 0,
    });
    await expect(updateEquipmentServiceBaseline(result.id)).rejects.toThrow(
      'Service',
    );
  });
  it('Service toggle defaults off, resets usage only on explicit apply, and does not rewrite canonical references', async () => {
    await gear();
    await saveLocalRecord('dive', {
      entityId: 'd1',
      date: '2026-09-01',
      equipmentIds: ['reg'],
    });
    await saveLocalRecord('dive', {
      entityId: 'd2',
      date: '2026-09-15',
      equipmentIds: ['reg'],
    });
    await saveLocalRecord('equipment-set', {
      entityId: 'set',
      name: 'Synthetic set',
      equipmentIds: ['reg'],
    });
    await saveLocalRecord('trip', {
      entityId: 'plan',
      name: 'Synthetic Plan',
      equipmentIds: ['reg'],
    });
    const references = JSON.stringify([
      await listRecords('dive'),
      await listRecords('equipment-set'),
      await listRecords('trip'),
    ]);
    const service = await event('service');
    expect((await listEquipmentEvents())[0]?.serviceBaselineApplied).toBe(
      false,
    );
    expect((await listEquipment())[0]?.lastServiceAt).toBe('2025-01-01');
    await updateEquipmentServiceBaseline(service.id);
    const equipment = (await listEquipment())[0]!;
    expect(equipment).toMatchObject({
      entityId: 'reg',
      lastServiceAt: '2026-09-14',
      nextServiceAt: '2028-09-14',
      serviceIntervalDives: 10,
      divesAtLastService: 1,
      unknownFutureFact: 'retain',
    });
    expect(
      equipmentServiceStatus(equipment, (await listRecords('dive')) as never)
        .dueAt,
    ).toBe(11);
    expect(
      JSON.stringify([
        await listRecords('dive'),
        await listRecords('equipment-set'),
        await listRecords('trip'),
      ]),
    ).toBe(references);
    const writes = await zeustekDb.events.count();
    await updateEquipmentServiceBaseline(service.id);
    expect(await zeustekDb.events.count()).toBe(writes);
  });
  it('rejects invalid/future dates, negative/non-finite costs and backwards resolutions before mutation', async () => {
    for (const occurredAt of ['2026-02-30', 'not-a-date', '2099-01-01'])
      expect(() =>
        saveEquipmentEvent({
          equipmentId: 'reg',
          eventType: 'fault',
          title: 'Synthetic',
          occurredAt,
          status: 'open',
        }),
      ).toThrow();
    for (const cost of [-1, NaN, Infinity])
      expect(() =>
        saveEquipmentEvent({
          equipmentId: 'reg',
          eventType: 'fault',
          title: 'Synthetic',
          occurredAt: '2026-09-14',
          status: 'open',
          cost,
        }),
      ).toThrow();
    const result = await event('fault');
    const current = (await listEquipmentEvents())[0]!;
    await expect(
      resolveEquipmentEvent(current, '2026-09-13', ''),
    ).rejects.toThrow('Resolution');
    expect((await listEquipmentEvents())[0]?.entityId).toBe(result.id);
    expect((await listEquipmentEvents())[0]?.status).toBe('open');
  });
  it('exports/restores baseline markers and immutable history in the existing format', async () => {
    await gear();
    const service = await event('service');
    await updateEquipmentServiceBaseline(service.id);
    const payload = await localBackupPayload();
    const historyCount = payload.events.length;
    for (const table of zeustekDb.tables) await table.clear();
    await restoreLocalPayload(payload);
    expect((await listEquipmentEvents())[0]).toMatchObject({
      entityId: service.id,
      serviceBaselineApplied: true,
    });
    expect(await zeustekDb.events.count()).toBe(historyCount);
    expect((await pendingDiveChanges()).length).toBeGreaterThan(0);
  });
  it('uses generic /api/dive-data localMutation syncing and durable pending event writes', async () => {
    const result = await event('note');
    expect(fetch).not.toHaveBeenCalled();
    expect((await pendingDiveChanges())[0]?.value).toMatchObject({
      kind: 'equipment-event',
      record: { entityId: result.id },
    });
    vi.stubGlobal('navigator', { onLine: true });
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ updatedAt: Date.now() }),
    );
    await flushDiveChanges();
    const call = vi
      .mocked(fetch)
      .mock.calls.find(
        ([url, options]) =>
          url === '/api/dive-data' && options?.method === 'POST',
      )!;
    expect(JSON.parse(call[1]?.body as string)).toMatchObject({
      kind: 'equipment-event',
      id: result.id,
      localMutation: true,
    });
    expect(await pendingDiveChanges()).toHaveLength(0);
  });
  it('keeps household GET/POST/DELETE history shared and guards its canonical parent reference', () => {
    const source = readFileSync('app/api/dive-data/route.ts', 'utf8');
    expect(
      source.match(/kind === 'equipment-event'/g)?.length,
    ).toBeGreaterThanOrEqual(4);
    expect(source).toContain(
      'householdCanEditGear(env,user,parent.ownerUserId)',
    );
    expect(source).toContain('Equipment event association cannot be changed.');
    expect(source).toContain("kind='equipment' AND deleted_at IS NULL");
    expect(source).toContain('readHouseholdUserIds(env, user)');
    expect(source.split('export async function POST')[0]).not.toContain('registerHouseholdUser(env, user)');
    expect(source).toContain('existing.ownerUserId');
  });
});

describe('Overview servicing projection priority', () => {
  it('excludes malformed dates and sorts overdue, due-soon and stable-name future ties without mutating inventory', async () => {
    await gear();
    const base = (await listEquipment())[0]!;
    const { serviceRequired: _serviceRequired, ...legacy } = base;
    const items = [
      {
        ...base,
        entityId: 'later-b',
        name: 'Beta',
        nextServiceAt: '2026-12-01',
      },
      { ...base, entityId: 'bad', nextServiceAt: 'invalid' },
      {
        ...base,
        entityId: 'no-baseline',
        lastServiceAt: '',
        purchasedAt: '',
        nextServiceAt: '',
      },
      { ...base, entityId: 'soon', nextServiceAt: '2026-09-20' },
      {
        ...base,
        entityId: 'late-a',
        name: 'Alpha',
        nextServiceAt: '2026-12-01',
      },
      { ...base, entityId: 'overdue', nextServiceAt: '2026-09-01' },
      { ...legacy, entityId: 'legacy' },
    ];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T12:00:00Z'));
    const before = JSON.stringify(items);
    expect(
      overviewServiceItems(items, []).map((item) => item.entityId),
    ).toEqual(['overdue', 'soon', 'late-a', 'later-b']);
    expect(JSON.stringify(items)).toBe(before);
  });
});
