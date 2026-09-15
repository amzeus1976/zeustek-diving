import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import {
  configureDiveStore,
  listLocalDiveRecords,
  pendingDiveChanges,
  saveLocalRecord,
} from '../lib/offline/dive-store';
import {
  listEnrichedDivePlans,
  saveEnrichedDivePlan,
} from '../lib/offline/dive-planning-centre';
import {
  archiveDivingCalendarBooking,
  deriveRmvBaseline,
  fractionLabel,
  gasAvailableLitres,
  gasNeededLitres,
  listDivingCalendarBookings,
  listGasPlans,
  saveDivingCalendarBooking,
  saveGasPlan,
  saveGasPlanNotesToDivePlan,
  setDivingCalendarBookingStatus,
  warnGasPlan,
} from '../lib/offline/planning-pages';
import { DIVE_RECORD_KINDS } from '../lib/record-identity';
import {
  resolveWorkflowRoute,
  WORKFLOW_ROUTES,
} from '../lib/workflow/workflow-model';

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), 'utf8');

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t12-3-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('T12.3 planning-page domain', () => {
  it('creates, edits, completes and archives a calendar booking offline', async () => {
    const saved = await saveDivingCalendarBooking({
      name: 'Club shore dive',
      bookingKind: 'club',
      bookingStatus: 'booked',
      planType: 'club-meet',
      startDate: '2026-09-26',
      endDate: '2026-09-26',
      siteName: 'Beadnell',
      buddy: '',
      status: 'confirmed',
      notes: 'Meet at 08:00',
    });
    let booking = (await listDivingCalendarBookings())[0]!;
    expect(booking).toMatchObject({
      entityId: saved.id,
      bookingKind: 'club',
      bookingStatus: 'booked',
      siteName: 'Beadnell',
    });

    await saveDivingCalendarBooking({
      ...booking,
      entityId: booking.entityId,
      notes: 'Meet at 07:30',
    });
    booking = (await listDivingCalendarBookings())[0]!;
    expect(booking.notes).toBe('Meet at 07:30');
    await setDivingCalendarBookingStatus(booking, 'completed');
    booking = (await listDivingCalendarBookings())[0]!;
    expect(booking.bookingStatus).toBe('completed');
    await archiveDivingCalendarBooking(booking);
    expect((await listDivingCalendarBookings())[0]).toMatchObject({
      entityId: saved.id,
      bookingStatus: 'archived',
    });
    expect((await pendingDiveChanges()).length).toBeGreaterThan(0);
    expect(await listEnrichedDivePlans()).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps legacy Dive Plan IDs and records unchanged while saving a linked gas plan', async () => {
    await saveLocalDiveFixture();
    await saveEnrichedDivePlan({
      entityId: 'plan-1',
      name: 'Wreck plan',
      planType: 'day-dive',
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      siteId: 'site-1',
      siteName: 'Wreck',
      buddy: 'Gemma',
      status: 'planned',
      notes: 'Original plan notes',
      plannedMaxDepthM: 24,
      plannedDurationMin: 35,
    });
    await saveLocalRecord('equipment', {
      entityId: 'cylinder-1',
      name: '12 L steel',
      category: 'Cylinder',
      waterVolumeLiters: 12,
    });
    await saveLocalRecord('cylinder-fill', {
      entityId: 'fill-1',
      cylinderEquipmentId: 'cylinder-1',
      filledAt: '2026-09-15T12:00:00.000Z',
      pressureBar: 210,
      oxygenFraction: 0.32,
      heliumFraction: 0,
      provider: 'Test centre',
      notes: null,
      source: 'recorded',
    });
    await saveLocalRecord('gas-analysis', {
      entityId: 'analysis-1',
      cylinderEquipmentId: 'cylinder-1',
      fillId: 'fill-1',
      analysedAt: '2026-09-15T12:15:00.000Z',
      oxygenFraction: 0.32,
      heliumFraction: 0,
      analysedByPersonId: null,
      attachmentIds: [],
      notes: null,
    });
    const originalDive = (await listLocalDiveRecords('dive'))[0];
    const originalPlan = (await listEnrichedDivePlans()).find(
      (plan) => plan.entityId === 'plan-1',
    )!;

    const result = await saveGasPlan({
      name: 'Wreck EAN32',
      divePlanId: 'plan-1',
      status: 'planned',
      plannedDepthM: 24,
      plannedBottomTimeMin: 35,
      rmvRateLitresMin: 18,
      rmvSource: 'manual',
      rmvSourceDiveIds: [],
      cylinders: [
        {
          id: 'slot-1',
          role: 'primary',
          cylinderEquipmentId: 'cylinder-1',
          fillId: 'fill-1',
          analysisId: 'analysis-1',
          startPressureBar: 210,
          endPressureBar: 70,
          reservePressureBar: 50,
          turnPressureBar: 130,
          notes: 'Switch if below agreed turn pressure',
        },
      ],
      warnings: [],
      notes: 'Team review before entry',
    });
    const gasPlan = (await listGasPlans())[0]!;
    expect(gasPlan).toMatchObject({
      entityId: result.id,
      divePlanId: 'plan-1',
      cylinders: [
        {
          cylinderEquipmentId: 'cylinder-1',
          fillId: 'fill-1',
          analysisId: 'analysis-1',
        },
      ],
    });
    await saveGasPlanNotesToDivePlan(originalPlan, gasPlan);
    const linkedPlan = (await listEnrichedDivePlans()).find(
      (plan) => plan.entityId === 'plan-1',
    )!;
    expect(linkedPlan.entityId).toBe(originalPlan.entityId);
    expect(linkedPlan.gasPlanLinks).toEqual([
      expect.objectContaining({ gasPlanId: gasPlan.entityId }),
    ]);
    expect(await listLocalDiveRecords('dive')).toEqual([originalDive]);
    expect(await listLocalDiveRecords('equipment')).toHaveLength(1);
    expect(await listLocalDiveRecords('cylinder-fill')).toHaveLength(1);
    expect(await listLocalDiveRecords('gas-analysis')).toHaveLength(1);
  });

  it('derives only valid RMV evidence and keeps the simple estimates explicit', () => {
    const baseline = deriveRmvBaseline([
      {
        entityId: 'dive-1',
        site: 'A',
        date: '2026-01-01',
        maxDepthM: 20,
        bottomTimeMin: 30,
        gas: 'Air',
        notes: '',
        source: 'manual',
        rmvRate: 18,
        cylinders: [],
        createdAt: '',
        modifiedAt: '',
      },
      {
        entityId: 'dive-2',
        site: 'B',
        date: '2026-01-02',
        maxDepthM: 20,
        bottomTimeMin: 30,
        gas: 'Air',
        notes: '',
        source: 'manual',
        rmvRate: null,
        cylinders: [],
        createdAt: '',
        modifiedAt: '',
      },
    ]);
    expect(baseline).toEqual({
      litresPerMinute: 18,
      observationCount: 1,
      diveIds: ['dive-1'],
    });
    expect(gasNeededLitres(20, 30, 18)).toBe(1620);
    expect(gasAvailableLitres(12, 200, 50)).toBe(1800);
    expect(fractionLabel(0.21, 0)).toBe('Air');
    expect(fractionLabel(0.32, 0)).toBe('EAN32');
    expect(fractionLabel(0.18, 0.45)).toBe('Trimix 18/45');
  });

  it('warns clearly instead of inventing complete gas evidence', () => {
    const warnings = warnGasPlan(
      {
        plannedDepthM: 28,
        plannedBottomTimeMin: 35,
        rmvRateLitresMin: null,
        cylinders: [{ id: 'c1', role: 'primary', cylinderEquipmentId: 'eq1' }],
      },
      [],
    );
    expect(warnings).toContain(
      'Using no RMV baseline; enter a conservative override.',
    );
    expect(
      warnings.some((warning) => warning.includes('no current fill evidence')),
    ).toBe(true);
    expect(
      warnings.some((warning) => warning.includes('no start pressure')),
    ).toBe(true);
  });
});

describe('T12.3 route and shell integration', () => {
  it('implements both routes, keeps old aliases and removes their Future roadmap shell', () => {
    for (const route of ['Diving Calendar & Bookings', 'Gas Planning']) {
      expect(
        WORKFLOW_ROUTES.find((item) => item.route === route),
      ).toMatchObject({
        implemented: true,
      });
      expect(
        WORKFLOW_ROUTES.find((item) => item.route === route)?.futureTask,
      ).toBeUndefined();
    }
    expect(resolveWorkflowRoute('Bookings')).toBe('Diving Calendar & Bookings');
    expect(resolveWorkflowRoute('Schedule')).toBe('Diving Calendar & Bookings');

    const dashboard = read('app/dashboard-client.tsx');
    expect(dashboard).toContain('<DivingCalendarBookings go={go}');
    expect(dashboard).toContain('<GasPlanning go={go}');
    expect(dashboard).not.toContain(
      "['Diving Calendar & Bookings','Gas Planning'].includes(active)",
    );
    expect(DIVE_RECORD_KINDS).toContain('gas-plan');
    expect(DIVE_RECORD_KINDS).toContain('site-overhead-profile');
  });

  it('retains compact workflow controls and the completed T09-T12.2 surfaces', () => {
    const dashboard = read('app/dashboard-client.tsx');
    const calendar = read('components/planning/diving-calendar-bookings.tsx');
    const gas = read('components/planning/gas-planning.tsx');
    const card = read('components/workflow/collapsible-work-card.tsx');
    for (const surface of [
      'ExperienceAnalytics',
      'DivePlanningCentre',
      'KnowledgeCentre',
      'DiveComputerData',
      'ZeusTekIcon',
    ])
      expect(dashboard).toContain(surface);
    expect(`${calendar}\n${gas}`).toContain('CollapsibleWorkCard');
    expect(`${calendar}\n${gas}`).not.toContain('WorkflowContextStrip');
    expect(card).toContain("minimized ? '+' : '−'");
    expect(calendar).toContain('role="tablist"');
    expect(gas).toContain('This is not decompression software');
  });
});

async function saveLocalDiveFixture() {
  return saveLocalRecord('dive', {
    entityId: 'dive-1',
    site: 'Existing site',
    date: '2026-09-01',
    maxDepthM: 20,
    bottomTimeMin: 30,
    gas: 'Air',
    notes: 'Must remain unchanged',
    source: 'manual',
  });
}
