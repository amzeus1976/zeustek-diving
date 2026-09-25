import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore } from '../lib/offline/dive-store';
import {
  captureProfessionalRequirementSet, deleteProfessionalEvidence, listProfessionalEvidence,
  saveProfessionalEvidence, saveProfessionalPathway, updateProfessionalEvidenceAttachments,
} from '../lib/offline/professional-development';
import { PADI_DIVEMASTER_CIRCUIT_PROGRESS_2026 as rubric } from '../lib/professional-development/skill-circuit';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('issue-63-fixture');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());

async function setup() {
  const requirementSet = await captureProfessionalRequirementSet({ agency: 'Synthetic test agency', pathwayKey: 'test-path',
    versionLabel: 'captured-v1', effectiveFrom: null, sourceCitation: 'Fixture, PADI public 2026 article pending instructor verification',
    capturedAt: '2026-09-25T09:00:00Z', requirements: [{ key: 'circuit', label: 'Circuit progress', kind: 'assessment',
      rule: { source: 'skill-circuit', rubric } }] });
  const pathway = await saveProfessionalPathway({ agency: 'Synthetic test agency', pathwayKey: 'test-path', displayName: 'Synthetic',
    requirementSetId: requirementSet.id, status: 'in_progress', startedAt: null, mentorPersonIds: [], notes: null });
  return { requirementSet, pathway };
}

describe('T14 #63 canonical circuit evidence', () => {
  it('preserves a scored attempt and allows only attachment changes', async () => {
    const { requirementSet, pathway } = await setup();
    const input = { pathwayId: pathway.id, evidenceType: 'skills-circuit', occurredAt: '2026-09-25T10:00:00Z',
      relatedDiveId: null, relatedSkillEvidenceId: null, relatedSiteId: null, evaluatorPersonId: null,
      attachmentIds: [], requirementSetId: requirementSet.id, requirementKey: 'circuit',
      payload: { rubricId: rubric.id, itemKey: 'skill-01', attemptMode: 'practice', evaluatorScore: 4 }, notes: null };
    const saved = await saveProfessionalEvidence(input);
    await expect(saveProfessionalEvidence({ ...input, entityId: saved.id, payload: { ...input.payload, evaluatorScore: 5 } })).rejects.toThrow('historical');
    await expect(deleteProfessionalEvidence(saved.id)).rejects.toThrow('historical');
    await updateProfessionalEvidenceAttachments(saved.id, ['dummy-file']);
    expect((await listProfessionalEvidence()).find(item => item.entityId === saved.id)).toMatchObject({
      attachmentIds: ['dummy-file'], payload: { itemKey: 'skill-01', evaluatorScore: 4 },
    });
  });
  it('rejects the wrong version, unknown skill and out-of-range score without creating evidence', async () => {
    const { requirementSet, pathway } = await setup();
    const base = { pathwayId: pathway.id, evidenceType: 'skills-circuit', occurredAt: '2026-09-25T10:00:00Z',
      relatedDiveId: null, relatedSkillEvidenceId: null, relatedSiteId: null, evaluatorPersonId: null,
      attachmentIds: [], requirementSetId: requirementSet.id, requirementKey: 'circuit',
      payload: { rubricId: rubric.id, itemKey: 'skill-01', attemptMode: 'practice', evaluatorScore: 4 }, notes: null };
    for (const payload of [{ ...base.payload, rubricId: 'wrong' }, { ...base.payload, itemKey: 'skill-25' },
      { ...base.payload, evaluatorScore: 6 }, { ...base.payload, evaluatorScore: 2.5 }])
      await expect(saveProfessionalEvidence({ ...base, payload })).rejects.toThrow('captured circuit version');
    expect(await listProfessionalEvidence()).toHaveLength(0);
  });
});
