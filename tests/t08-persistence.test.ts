import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import {
  configureDiveStore,
  listLocalDiveRecords,
  saveLocalRecord,
} from '../lib/offline/dive-store';
import {
  localBackupPayload,
  restoreLocalPayload,
} from '../lib/offline/local-backup';
import {
  captureProfessionalRequirementSet,
  createRequirementEvidenceLink,
  deleteProfessionalEvidence,
  deleteProfessionalPathway,
  listProfessionalEvidence,
  listProfessionalPathways,
  listProfessionalRequirementSets,
  saveProfessionalEvidence,
  saveProfessionalPathway,
  updateProfessionalEvidenceAttachments,
} from '../lib/offline/professional-development';
beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('t08-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});
afterEach(() => vi.unstubAllGlobals());
const snapshot = {
  agency: 'Synthetic only',
  pathwayKey: 'test-only',
  pathwayLabel: 'No real qualification',
  versionLabel: 'v1',
  effectiveFrom: null,
  effectiveTo: null,
  sourceCitation: 'Synthetic software test',
  requirements: [
    {
      key: 'manual',
      label: 'Synthetic manual check',
      kind: 'manual' as const,
      rule: {},
    },
  ],
  capturedAt: '2026-09-14T10:00:00Z',
};
const pathwayInput = {
  agency: 'Synthetic only',
  pathwayKey: 'test-only',
  displayName: 'Synthetic only',
  requirementSetId: null,
  status: 'considering' as const,
  startedAt: null,
  mentorPersonIds: ['person'],
  notes: null,
};
describe('T08 canonical offline history and reference safety', () => {
  it('rejects unsupported new assessment rules without altering old snapshots', async () => {
    for (const rule of [{}, { source: 'professional-evidence', evidenceType: 'workshop' }, { source: 'canonical-skill', skillKey: 'missing', minCompetence: 'competent' }]) {
      await expect(captureProfessionalRequirementSet({ ...snapshot, versionLabel: `invalid-${JSON.stringify(rule)}`,
        requirements: [{ key: 'assessment', label: 'Synthetic assessment', kind: 'assessment', rule }] })).rejects.toThrow();
    }
    expect(await listProfessionalRequirementSets()).toHaveLength(0);
  });
  it('warns about a duplicate pathway rather than replacing existing history',async()=>{
    const original=await saveProfessionalPathway(pathwayInput);
    await expect(saveProfessionalPathway({...pathwayInput,displayName:'Changed'})).rejects.toThrow('already exists');
    expect((await listProfessionalPathways())[0]).toMatchObject({entityId:original.id,displayName:'Synthetic only'});
  });
  it('links existing professional experience to a new standards version without rewriting its historical evaluation',async()=>{
    const path=await saveProfessionalPathway(pathwayInput);
    const original=await saveProfessionalEvidence({pathwayId:path.id,evidenceType:'workshop',occurredAt:'2026-09-14T10:00:00Z',relatedDiveId:null,relatedSkillEvidenceId:null,relatedSiteId:null,evaluatorPersonId:null,attachmentIds:['file'],requirementSetId:'v1',requirementKey:'old',payload:{title:'Synthetic original'},notes:null});
    const candidate={kind:'professional-evidence' as const,id:original.id,label:'Synthetic original'};
    const newLink=await createRequirementEvidenceLink({pathwayId:path.id,requirementSetId:'v2',requirementKey:'new',candidate});
    const repeated=await createRequirementEvidenceLink({pathwayId:path.id,requirementSetId:'v2',requirementKey:'new',candidate});
    expect(repeated.id).toBe(newLink.id);expect(await listProfessionalEvidence()).toHaveLength(2);
    expect((await listProfessionalEvidence()).find(item=>item.entityId===original.id)).toMatchObject({requirementSetId:'v1',requirementKey:'old'});
    expect((await listProfessionalEvidence()).find(item=>item.entityId===newLink.id)).toMatchObject({requirementSetId:'v2',requirementKey:'new',payload:{sourceKind:'professional-evidence',sourceId:original.id}});
    await expect(deleteProfessionalEvidence(original.id)).rejects.toThrow('linked');
    await deleteProfessionalEvidence(newLink.id);
    await deleteProfessionalEvidence(original.id);
  });
  it('uses the shared immutable capture guard and appends standards versions without overwriting history', async () => {
    const first = await captureProfessionalRequirementSet(snapshot);
    await expect(
      captureProfessionalRequirementSet({ ...snapshot, versionLabel: ' V1 ' }),
    ).rejects.toThrow('already exists');
    await expect(
      captureProfessionalRequirementSet({
        ...snapshot,
        entityId: first.id,
      } as typeof snapshot),
    ).rejects.toThrow('immutable');
    await captureProfessionalRequirementSet({
      ...snapshot,
      versionLabel: 'v2',
    });
    expect(await listProfessionalRequirementSets()).toHaveLength(2);
    expect(
      (await listProfessionalRequirementSets()).find(
        (item) => item.entityId === first.id,
      )?.versionLabel,
    ).toBe('v1');
  });
  it('persists repeatable evidence, version links, unknown payload fields and canonical IDs through reopening/backup', async () => {
    for (const kind of [
      'dive',
      'trip',
      'site',
      'person',
      'skill_evidence',
      'certification',
      'equipment-set',
      'site-overhead-profile',
      'dive-trip',
    ])
      await saveLocalRecord(kind, {
        entityId: kind === 'person' ? 'person' : kind,
        synthetic: true,
      });
    const reference = await captureProfessionalRequirementSet(snapshot);
    const path = await saveProfessionalPathway(pathwayInput);
    for (let i = 0; i < 2; i++)
      await saveProfessionalEvidence({
        pathwayId: path.id,
        evidenceType: 'workshop',
        occurredAt: '2026-09-14T10:00:00Z',
        relatedDiveId: 'dive',
        relatedCertificationId: 'certification',
        relatedSkillEvidenceId: 'skill_evidence',
        relatedSkillEvidenceIds: ['skill_evidence'],
        relatedSiteId: 'site',
        evaluatorPersonId: 'person',
        relatedPersonIds: ['person'],
        attachmentIds: ['file1', 'file2'],
        requirementSetId: reference.id,
        requirementKey: 'manual',
        payload: { title: 'Synthetic', futureFact: { keep: true } },
        notes: 'Offline',
      });
    zeustekDb.close();
    await zeustekDb.open();
    expect(await listProfessionalEvidence()).toHaveLength(2);
    expect(await zeustekDb.outbox.count()).toBeGreaterThan(9);
    expect(fetch).not.toHaveBeenCalled();
    const backup = await localBackupPayload();
    for (const table of zeustekDb.tables) await table.clear();
    await restoreLocalPayload(backup);
    expect((await listProfessionalEvidence())[0]).toMatchObject({
      relatedDiveId: 'dive',
      relatedSiteId: 'site',
      relatedCertificationId: 'certification',
      requirementSetId: reference.id,
      payload: { futureFact: { keep: true } },
    });
    await expect(deleteProfessionalPathway(path.id)).rejects.toThrow('linked');
    for (const kind of [
      'dive',
      'trip',
      'site',
      'person',
      'skill_evidence',
      'certification',
      'equipment-set',
      'site-overhead-profile',
      'dive-trip',
    ])
      expect(await listLocalDiveRecords(kind)).toHaveLength(1);
  });
  it('creates links without mutating canonical records and removes only its own evidence/pathway records', async () => {
    await saveLocalRecord('dive', {
      entityId: 'dive',
      date: '2026-09-14',
      site: 'Synthetic',
    });
    const original = await listLocalDiveRecords('dive');
    const path = await saveProfessionalPathway(pathwayInput);
    const ref = await captureProfessionalRequirementSet(snapshot);
    const link = await createRequirementEvidenceLink({
      pathwayId: path.id,
      requirementSetId: ref.id,
      requirementKey: 'manual',
      candidate: { kind: 'dive', id: 'dive', label: 'Synthetic Dive' },
    });
    expect((await listProfessionalEvidence())[0]?.relatedDiveId).toBe('dive');
    expect(await listLocalDiveRecords('dive')).toEqual(original);
    await deleteProfessionalEvidence(link.id);
    await deleteProfessionalPathway(path.id);
    expect(await listProfessionalEvidence()).toHaveLength(0);
    expect(await listProfessionalPathways()).toHaveLength(0);
    expect(await listLocalDiveRecords('dive')).toEqual(original);
  });
  it('reloads the canonical attachment list for sequential multi-file removals, retaining other evidence facts', async () => {
    const path = await saveProfessionalPathway(pathwayInput);
    const item = await saveProfessionalEvidence({
      pathwayId: path.id,
      evidenceType: 'eap',
      occurredAt: '2026-09-14T10:00:00Z',
      relatedDiveId: null,
      relatedSkillEvidenceId: null,
      relatedSiteId: 'site',
      evaluatorPersonId: null,
      attachmentIds: ['file1', 'file2', 'keep'],
      payload: { futureFact: 'keep' },
      notes: null,
    });
    await updateProfessionalEvidenceAttachments(item.id, [], ['file1']);
    await updateProfessionalEvidenceAttachments(item.id, [], ['file2']);
    await updateProfessionalEvidenceAttachments(item.id, ['new', 'new']);
    expect((await listProfessionalEvidence())[0]).toMatchObject({
      attachmentIds: ['keep', 'new'],
      relatedSiteId: 'site',
      payload: { futureFact: 'keep' },
    });
  });
});
