import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, pendingDiveChanges } from '../lib/offline/dive-store';
import { listEnrichedDivePlans, saveEnrichedDivePlan } from '../lib/offline/dive-planning-centre';
import { listGasPlans, saveGasPlan } from '../lib/offline/planning-pages';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t12-5-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('T12.5 local-first Plan and Gas foundation', () => {
  it('saves and reopens the enriched Plan and agency-table reference without changing the Plan ID', async () => {
    await saveEnrichedDivePlan({
      entityId: 'plan-1', name: 'Local foundation check', planType: 'day-dive',
      startDate: '2026-09-20', startAt: '2026-09-20T10:00', endDate: '2026-09-20',
      siteId: 'site-1', siteName: 'Quarry', buddy: '', status: 'planned', notes: '',
      diveNumberOfDay: 2, multiLevel: true, primaryObjective: 'Return safely to the surface',
      aim: 'Review route', goals: ['Stay together'], secondaryObjectives: ['Practise DSMB'],
      plannedMaxDepthM: 18, maxTotalDurationMin: 60,
      equipmentReadiness: { additionalItems: ['DSMB'] },
    });
    await saveGasPlan({
      entityId: 'gas-1', name: 'Linked gas check', divePlanId: 'plan-1', status: 'draft',
      plannedDepthM: 18, plannedBottomTimeMin: 30, multiLevel: true,
      depthSegments: [{ id: 'segment-1', depthM: 18, minutes: 30 }],
      tableReference: { agency: 'PADI RDP', edition: 'Owner edition', pressureGroup: 'C', ndlMinutes: 40, sourceNote: 'Owner transcription' },
      cylinders: [{ id: 'cylinder-row-1', role: 'primary', cylinderEquipmentId: 'equipment-1', fillId: 'fill-1', analysisId: 'analysis-1' }],
      warnings: [], notes: '',
    });
    const [plan] = await listEnrichedDivePlans();
    const [gas] = await listGasPlans();
    expect(plan).toMatchObject({ entityId: 'plan-1', siteId: 'site-1', diveNumberOfDay: 2, multiLevel: true, aim: 'Review route', maxTotalDurationMin: 60 });
    expect(gas).toMatchObject({ entityId: 'gas-1', divePlanId: 'plan-1', tableReference: { agency: 'PADI RDP', edition: 'Owner edition' }, cylinders: [{ cylinderEquipmentId: 'equipment-1', fillId: 'fill-1', analysisId: 'analysis-1' }] });
    expect((await pendingDiveChanges()).some((row) => row.key.endsWith(':plan-1'))).toBe(true);
    expect((await pendingDiveChanges()).some((row) => row.key.endsWith(':gas-1'))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('persists a Bühlmann method reference without generating decompression results', async () => {
    await saveGasPlan({
      entityId: 'gas-algorithm', name: 'External computer reference', status: 'draft',
      planningMethod: 'buhlmann-zhl16c',
      algorithmReference: { implementation: 'Owner dive computer', version: 'Owner firmware', sourceNote: 'Verify against device' },
      gradientFactorLow: 30, gradientFactorHigh: 85,
      cylinders: [], warnings: [], notes: '',
    });
    const [gas] = await listGasPlans();
    expect(gas).toMatchObject({
      entityId: 'gas-algorithm', planningMethod: 'buhlmann-zhl16c',
      algorithmReference: { implementation: 'Owner dive computer', version: 'Owner firmware' },
      gradientFactorLow: 30, gradientFactorHigh: 85,
    });
    expect(gas?.tableReference).toBeUndefined();
    expect((await pendingDiveChanges()).some((row) => row.key.endsWith(':gas-algorithm'))).toBe(true);
  });
});
