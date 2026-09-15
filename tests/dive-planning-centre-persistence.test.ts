import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore, pendingDiveChanges, saveLocalRecord } from '../lib/offline/dive-store';
import { applyReusableLoadout, listReusableLoadouts } from '../lib/offline/loadouts-gas';
import {
  createDiveDraftFromEnrichedPlan,
  listEnrichedDivePlans,
  saveEnrichedDivePlan,
} from '../lib/offline/dive-planning-centre';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t10-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('T10 local-first Plan integration', () => {
  it('preserves the Plan ID, newer fields and immutable Plan-to-Dive provenance offline', async () => {
    await saveLocalRecord('trip', {
      entityId: 'plan-1', name: 'T10 plan', planType: 'day-dive', startDate: '2026-09-20', endDate: '2026-09-20',
      siteId: 'site-1', siteName: 'Quarry', buddy: 'Gemma', status: 'planned', notes: 'Original plan',
      planTeam: [{ personId: 'person-1', role: 'Buddy' }], plannedSkillKeys: ['skill-1'],
      conditions: { weather: 'Calm', provenance: 'recorded', capturedAt: '2026-09-15T09:00:00.000Z' },
      futurePlanField: { keep: true },
    });
    const original = (await listEnrichedDivePlans())[0]!;
    await saveEnrichedDivePlan({ ...original, entityId: original.entityId, notes: 'Edited plan' });
    const reopened = (await listEnrichedDivePlans())[0]!;
    expect(reopened).toMatchObject({ entityId: 'plan-1', siteId: 'site-1', planTeam: [{ personId: 'person-1', role: 'Buddy' }], futurePlanField: { keep: true } });
    const draft = await createDiveDraftFromEnrichedPlan(reopened.entityId);
    expect(draft).toMatchObject({ originatingPlanId: 'plan-1', siteId: 'site-1' });
    expect(draft.originatingPlanRevision?.eventId).toBeTruthy();
    expect((await pendingDiveChanges()).some((row) => row.key.endsWith(':plan-1'))).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('applies a reusable loadout as stable references and a slot snapshot without copying descriptions', async () => {
    await saveLocalRecord('equipment-set', { entityId: 'set-1', name: 'Cold-water set', description: 'Original description', equipmentIds: ['reg-1'], slots: { primaryRegulatorId: 'reg-1' } });
    await saveEnrichedDivePlan({ entityId: 'plan-1', name: 'Loadout plan', planType: 'day-dive', startDate: '2026-09-20', endDate: '2026-09-20', siteName: '', buddy: '', status: 'planned', notes: '', equipmentSetId: 'set-1' });
    const loadout = (await listReusableLoadouts())[0]!;
    await applyReusableLoadout('trip', 'plan-1', loadout);
    await saveLocalRecord('equipment-set', { entityId: 'set-1', description: 'Later edited description', slots: { primaryRegulatorId: 'reg-2' } });
    const plan = (await listEnrichedDivePlans())[0]!;
    expect(plan.equipmentSetId).toBe('set-1');
    expect(plan.equipmentIds).toContain('reg-1');
    expect(plan.equipmentSetApplications?.[0]).toMatchObject({ equipmentSetId: 'set-1', slots: { primaryRegulatorId: 'reg-1' } });
    expect(JSON.stringify(plan)).not.toContain('Original description');
  });
});
