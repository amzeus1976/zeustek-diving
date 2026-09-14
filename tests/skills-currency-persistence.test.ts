import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import {
  configureDiveStore,
  listLocalDiveRecords,
  saveLocalRecord,
} from '../lib/offline/dive-store';
import {
  listCurrencyPolicies,
  saveCurrencyPolicy,
  projectSkillCurrency,
} from '../lib/offline/skills-currency';
import {
  listCanonicalSkills,
  listSkillEvidence,
  previewUnusedArchivedSkills,
} from '../lib/offline/dive-context';
beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t06-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());
describe('T06 canonical policy and historical evidence safety', () => {
  it('saves and reopens one policy offline, preserving references, history and unknown facts', async () => {
    await saveLocalRecord('skill', {
      entityId: 'skill',
      skillKey: 'stable-key',
      name: 'Practice',
      archived: true,
    });
    await saveLocalRecord('skill_evidence', {
      entityId: 'evidence',
      skillKey: 'skill',
      diveId: 'dive',
      planId: 'plan',
      competenceLevel: 3,
      attachmentIds: ['photo'],
      performedAt: '2026-08-01T12:00:00Z',
    });
    for (const kind of [
      'trip',
      'dive-trip',
      'site',
      'site-overhead-profile',
      'equipment',
      'equipment-set',
      'cylinder-fill',
      'gas-analysis',
      'person',
      'dive',
    ])
      await saveLocalRecord(kind, { entityId: kind, name: 'Keep' });
    const evidenceBefore = await listSkillEvidence();
    await saveCurrencyPolicy({
      skillKey: 'skill',
      recommendedIntervalDays: 90,
      dueSoonDays: 14,
      enabled: true,
    });
    const first = (await listCurrencyPolicies())[0]!;
    await saveLocalRecord('currency-policy', {
      entityId: first.entityId,
      futureFact: 'Keep',
    });
    await saveCurrencyPolicy({
      skillKey: 'stable-key',
      recommendedIntervalDays: 10,
      dueSoonDays: 2,
      enabled: true,
    });
    zeustekDb.close();
    await zeustekDb.open();
    expect(await listCurrencyPolicies()).toHaveLength(1);
    expect((await listCurrencyPolicies())[0]).toMatchObject({
      entityId: first.entityId,
      skillKey: 'stable-key',
      futureFact: 'Keep',
    });
    expect(await listSkillEvidence()).toEqual(evidenceBefore);
    expect(
      projectSkillCurrency(
        (await listCanonicalSkills())[0]!,
        evidenceBefore,
        (await listCurrencyPolicies())[0],
        new Date('2026-09-14T12:00:00Z'),
      ).status,
    ).toBe('needs-practice');
    expect(
      (await previewUnusedArchivedSkills()).protected.map(
        (row) => row.skill.entityId,
      ),
    ).toEqual(['skill']);
    for (const kind of [
      'trip',
      'dive-trip',
      'site',
      'site-overhead-profile',
      'equipment',
      'equipment-set',
      'cylinder-fill',
      'gas-analysis',
      'person',
      'dive',
    ])
      expect((await listLocalDiveRecords(kind))[0]?.entityId).toBe(kind);
    expect(await zeustekDb.outbox.count()).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects unavailable references rather than remapping similar names', async () => {
    await saveLocalRecord('skill', {
      entityId: 'new-skill',
      name: 'Same name',
    });
    await expect(
      saveCurrencyPolicy({
        skillKey: 'missing-old-skill',
        recommendedIntervalDays: 90,
        dueSoonDays: 14,
        enabled: true,
      }),
    ).rejects.toThrow('Unknown / unavailable');
    expect(await listCurrencyPolicies()).toHaveLength(0);
  });
});
