import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore } from '../lib/offline/dive-store';
import {
  cylinderPickerSummary,
  cylinderReadinessWarnings,
  projectGasCylinder,
  planningPageSources,
  warnGasPlan,
} from '../lib/offline/planning-pages';
import {
  deriveCylinderCurrentState,
  listGasAnalyses,
  saveCylinderFill,
  saveCylinderProfile,
  saveGasAnalysis,
  type CylinderEquipmentRecord,
  type CylinderFillRecord,
  type GasAnalysisRecord,
} from '../lib/offline/loadouts-gas';
import type { Stored } from '../lib/offline/dive-planning';

const storedCylinder = (
  patch: Partial<Stored<CylinderEquipmentRecord>> = {},
): Stored<CylinderEquipmentRecord> => ({
  entityId: 'cylinder-1',
  name: '12 L steel',
  category: 'Cylinder',
  manufacturer: 'Faber',
  model: 'FX',
  serialNumber: 'FAB-123',
  purchasedAt: '',
  lastServiceAt: '',
  nextServiceAt: '',
  notes: '',
  retired: false,
  cylinderNumber: '03',
  waterVolumeLiters: 12,
  valveType: 'DIN',
  hydroTestAt: '2025-01',
  hydroDueAt: '2030-01',
  visualTestAt: '2025-01',
  visualDueAt: '2027-07',
  oxygenClean: false,
  oxygenCleanUntil: null,
  createdAt: '2026-09-20T08:00:00.000Z',
  modifiedAt: '2026-09-20T08:00:00.000Z',
  ...patch,
});

const storedFill = (
  patch: Partial<Stored<CylinderFillRecord>> = {},
): Stored<CylinderFillRecord> => ({
  entityId: 'fill-root',
  cylinderEquipmentId: 'cylinder-1',
  filledAt: '2026-09-20T09:00:00.000Z',
  pressureBar: 232,
  oxygenFraction: 0.32,
  heliumFraction: 0,
  provider: 'ZeusTek Fill Station',
  notes: '',
  source: 'recorded',
  eventType: 'fill',
  originFillId: null,
  pressureUsedBar: null,
  createdAt: '2026-09-20T09:00:00.000Z',
  modifiedAt: '2026-09-20T09:00:00.000Z',
  ...patch,
});

const storedAnalysis = (
  patch: Partial<Stored<GasAnalysisRecord>> = {},
): Stored<GasAnalysisRecord> => ({
  entityId: 'analysis-root',
  cylinderEquipmentId: 'cylinder-1',
  fillId: 'fill-root',
  analysedAt: '2026-09-20T09:15:00.000Z',
  oxygenFraction: 0.32,
  heliumFraction: 0,
  analysedByPersonId: 'person-1',
  attachmentIds: [],
  notes: '',
  createdAt: '2026-09-20T09:15:00.000Z',
  modifiedAt: '2026-09-20T09:15:00.000Z',
  ...patch,
});

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t12-5e-cylinder-planner');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('T12.5E canonical cylinder planning sources', () => {
  it('loads a new canonical cylinder into Gas Planning with its stable ID and water volume', async () => {
    const saved = await saveCylinderProfile({
      name: '12 L steel',
      category: 'Cylinder',
      manufacturer: 'Faber',
      model: 'FX',
      serialNumber: 'FAB-123',
      purchasedAt: '',
      lastServiceAt: '',
      nextServiceAt: '',
      notes: '',
      retired: false,
      waterVolumeLiters: 12,
      valveType: 'DIN',
      lastTestType: 'hydro',
      lastTestAt: '2025-01',
    });
    const sources = await planningPageSources();
    expect(sources.cylinders).toEqual([
      expect.objectContaining({
        entityId: saved.id,
        recordStorageKind: 'cylinder',
        waterVolumeLiters: 12,
      }),
    ]);
  });
});

describe('T12.5E pressure, fill and analysis lineage', () => {
  const rootFill = storedFill();
  const usage = storedFill({
    entityId: 'usage-1',
    filledAt: '2026-09-21T10:00:00.000Z',
    pressureBar: 180,
    eventType: 'usage',
    originFillId: 'fill-root',
    pressureUsedBar: 52,
  });
  const analysis = storedAnalysis();

  it('keeps root-fill analysis current after a usage-only pressure event', () => {
    const result = projectGasCylinder(
      {
        id: 'slot-1',
        role: 'primary',
        cylinderEquipmentId: 'cylinder-1',
        reservePressureBar: 50,
      },
      { plannedDepthM: 24, plannedBottomTimeMin: 30, rmvRateLitresMin: 18 },
      [rootFill, usage],
      [analysis],
      [storedCylinder()],
      '2026-09-21T12:00:00.000Z',
    );
    expect(result.analysisState).toBe('current');
    expect(result.analysisId).toBe('analysis-root');
    expect(result.fillId).toBe('usage-1');
    expect(result.rootFillId).toBe('fill-root');
    expect(result.volume?.usableLitres).toBe(1560);
    expect(result.startPressureEvidence).toMatchObject({
      kind: 'current-pressure',
      pressureBar: 180,
      eventId: 'usage-1',
    });
    expect(result.provenanceChain.join(' → ')).toContain(
      'Filled at ZeusTek Fill Station',
    );
    expect(result.provenanceChain.join(' → ')).toContain(
      'analysed at 2026-09-20T09:15:00.000Z',
    );
    expect(result.provenanceChain.join(' → ')).toContain(
      '52 bar used at 2026-09-21T10:00:00.000Z',
    );
  });

  it('uses the latest canonical pressure event when a plan has not pinned a fill event', () => {
    const warnings = warnGasPlan(
      {
        cylinders: [
          {
            id: 'slot-1',
            role: 'primary',
            cylinderEquipmentId: 'cylinder-1',
            reservePressureBar: 50,
          },
        ],
        plannedDepthM: 24,
        plannedBottomTimeMin: 30,
        rmvRateLitresMin: 18,
      },
      [rootFill, usage],
      [storedCylinder()],
      [analysis],
      '2026-09-21T12:00:00.000Z',
    );
    expect(warnings).not.toContain(
      'primary cylinder has no current fill evidence.',
    );
    expect(warnings).not.toContain('primary cylinder has no start pressure.');
  });

  it('keeps composition current but warns when an older pressure event is selected', () => {
    const result = projectGasCylinder(
      {
        id: 'slot-1',
        role: 'primary',
        cylinderEquipmentId: 'cylinder-1',
        fillId: 'fill-root',
        reservePressureBar: 50,
      },
      { plannedDepthM: 24, plannedBottomTimeMin: 30, rmvRateLitresMin: 18 },
      [rootFill, usage],
      [analysis],
      [storedCylinder()],
      '2026-09-21T12:00:00.000Z',
    );
    expect(result.analysisState).toBe('current');
    expect(result.startPressureEvidence).toMatchObject({
      kind: 'selected-fill',
      pressureBar: 232,
      eventId: 'fill-root',
    });
    expect(result.warnings).toContain(
      'Selected pressure event is older than the latest pressure event for this fill chain.',
    );
  });

  it('honours an owner-stale analysis across the shared cylinder current-state projection', () => {
    const state = deriveCylinderCurrentState(
      storedCylinder(),
      [rootFill, usage],
      [storedAnalysis({ markedStaleAt: '2026-09-21T11:00:00.000Z' })],
    );
    expect(state.currentAnalysis).toBeNull();
    expect(state.analysisState).toBe('stale');
  });

  it('normalises a new analysis linked from a usage event back to the root fill', async () => {
    await saveCylinderFill(rootFill);
    await saveCylinderFill(usage);
    await saveGasAnalysis({
      cylinderEquipmentId: 'cylinder-1',
      fillId: 'usage-1',
      analysedAt: '2026-09-21T10:15:00.000Z',
      oxygenFraction: 0.319,
      heliumFraction: 0,
      analysedByPersonId: 'person-1',
      attachmentIds: [],
      notes: '',
      source: 'recorded',
    });
    expect((await listGasAnalyses())[0]?.fillId).toBe('fill-root');
  });

  it('identifies an explicit plan snapshot separately from an owner-entered override', () => {
    const snapshot = projectGasCylinder(
      {
        id: 'slot-1',
        role: 'primary',
        cylinderEquipmentId: 'cylinder-1',
        startPressureBar: 190,
        reservePressureBar: 50,
      },
      { plannedDepthM: 24, plannedBottomTimeMin: 30, rmvRateLitresMin: 18 },
      [rootFill, usage],
      [analysis],
      [storedCylinder()],
      '2026-09-21T12:00:00.000Z',
    );
    const override = projectGasCylinder(
      {
        id: 'slot-1',
        role: 'primary',
        cylinderEquipmentId: 'cylinder-1',
        startPressureBar: 175,
        startPressureSource: 'owner-override',
        reservePressureBar: 50,
      },
      { plannedDepthM: 24, plannedBottomTimeMin: 30, rmvRateLitresMin: 18 },
      [rootFill, usage],
      [analysis],
      [storedCylinder()],
      '2026-09-21T12:00:00.000Z',
    );
    expect(snapshot.startPressureEvidence.kind).toBe('plan-snapshot');
    expect(override.startPressureEvidence.kind).toBe('owner-override');
  });

  it('makes the previous analysis stale after a composition-changing fill', () => {
    const newFill = storedFill({
      entityId: 'fill-new',
      filledAt: '2026-09-22T09:00:00.000Z',
      pressureBar: 220,
      oxygenFraction: 0.36,
      originFillId: null,
    });
    const result = projectGasCylinder(
      {
        id: 'slot-1',
        role: 'primary',
        cylinderEquipmentId: 'cylinder-1',
        reservePressureBar: 50,
      },
      { plannedDepthM: 24, plannedBottomTimeMin: 30, rmvRateLitresMin: 18 },
      [rootFill, usage, newFill],
      [analysis],
      [storedCylinder()],
      '2026-09-22T12:00:00.000Z',
    );
    expect(result.rootFillId).toBe('fill-new');
    expect(result.analysisState).toBe('stale');
    expect(result.mix).toBeNull();
    expect(result.warnings).toContain(
      'Current fill chain has no valid analysis provenance.',
    );
  });
});

describe('T12.5E cylinder readiness', () => {
  it('warns for overdue or missing inspections and an unknown valve', () => {
    const warnings = cylinderReadinessWarnings(
      storedCylinder({
        valveType: null,
        hydroDueAt: '2026-01',
        visualDueAt: '2026-08',
      }),
      { oxygenFraction: 0.21, heliumFraction: 0 },
      '2026-09-21T12:00:00.000Z',
    );
    expect(warnings).toContain('Cylinder hydro test is overdue (due 2026-01).');
    expect(warnings).toContain(
      'Cylinder visual inspection is overdue (due 2026-08).',
    );
    expect(warnings).toContain('Cylinder valve type is unknown.');
    expect(warnings.some((warning) => warning.includes('O₂-clean'))).toBe(false);
  });

  it('requires current oxygen-clean evidence only for an oxygen-rich mix', () => {
    const air = cylinderReadinessWarnings(
      storedCylinder({ oxygenClean: false, oxygenCleanUntil: null }),
      { oxygenFraction: 0.21, heliumFraction: 0 },
      '2026-09-21T12:00:00.000Z',
    );
    const oxygenRich = cylinderReadinessWarnings(
      storedCylinder({ oxygenClean: true, oxygenCleanUntil: '2026-08' }),
      { oxygenFraction: 0.5, heliumFraction: 0 },
      '2026-09-21T12:00:00.000Z',
    );
    expect(air.some((warning) => warning.includes('O₂-clean'))).toBe(false);
    expect(oxygenRich).toContain(
      'Cylinder O₂-clean evidence is overdue for the selected oxygen-rich mix (due 2026-08).',
    );
  });

  it('builds the compact stable-ID selector summary from canonical evidence', () => {
    expect(
      cylinderPickerSummary(
        storedCylinder(),
        [storedFill(), storedFill({
          entityId: 'usage-1',
          filledAt: '2026-09-21T10:00:00.000Z',
          pressureBar: 180,
          eventType: 'usage',
          originFillId: 'fill-root',
          pressureUsedBar: 52,
        })],
        [storedAnalysis()],
        '2026-09-21T12:00:00.000Z',
      ),
    ).toBe(
      'Cyl 03 · 12 L · Nitrox 32 · 180 bar · analysis current · visual due 2027-07',
    );
  });
});
