import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  evaluateProfessionalRequirement,
  professionalEvidenceReferenceIssues,
  PROFESSIONAL_ASSESSMENT_ACTIVITIES,
  professionalAssessmentFields,
  type ProfessionalEvidenceRecord,
  type ProfessionalEvaluationContext,
  type ProfessionalRequirementDefinition,
} from '../lib/offline/professional-development';
import type { Stored } from '../lib/offline/dive-planning';
import { PROFESSIONAL_EVIDENCE_DELETE_CONSTRAINT, professionalEvidenceDeleteBindings } from '../lib/professional-development/evidence-dependencies';

const asOf = new Date('2026-09-25T12:00:00Z');
const assessment: ProfessionalRequirementDefinition = {
  key: 'rescue-assessment',
  label: 'Diver rescue assessment',
  kind: 'assessment',
  rule: {
    source: 'professional-evidence',
    evidenceType: 'assessment-result',
    activityCode: 'diver-rescue',
    evaluatorRequired: true,
    result: 'passed',
  },
};
const record = (
  id: string,
  extra: Partial<ProfessionalEvidenceRecord> = {},
): Stored<ProfessionalEvidenceRecord> => ({
  entityId: id,
  pathwayId: 'path-1',
  evidenceType: 'assessment-result',
  occurredAt: '2026-09-20T10:00:00Z',
  relatedDiveId: 'dive-1',
  relatedSkillEvidenceId: null,
  relatedSiteId: null,
  evaluatorPersonId: 'evaluator-1',
  attachmentIds: [],
  requirementSetId: 'set-v3',
  requirementKey: 'rescue-assessment',
  payload: { activityCode: 'diver-rescue', result: 'passed' },
  notes: null,
  createdAt: '',
  modifiedAt: '',
  ...extra,
});
const context = (
  ...professionalEvidence: Array<Stored<ProfessionalEvidenceRecord>>
): ProfessionalEvaluationContext => ({
  dives: [{ entityId: 'dive-1' } as ProfessionalEvaluationContext['dives'][number]],
  certifications: [],
  skills: [],
  skillEvidence: [],
  professionalEvidence,
  sites: [],
  people: [{ entityId: 'evaluator-1' } as ProfessionalEvaluationContext['people'][number]],
  asOf,
});
const evaluate = (
  requirement: ProfessionalRequirementDefinition,
  ...records: Array<Stored<ProfessionalEvidenceRecord>>
) => evaluateProfessionalRequirement(requirement, 'set-v3', context(...records));

describe('T14 #59 exact Professional Evidence mapping', () => {
  it('blocks cloud source deletion while an active same-owner version link exists', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('CREATE TABLE dive_records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, data_json TEXT NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER)');
      const insert = db.prepare('INSERT INTO dive_records (id,user_id,kind,data_json,updated_at,deleted_at) VALUES (?,?,?,?,?,?)');
      insert.run('source', 'owner-a', 'professional-evidence', '{}', 1, null);
      insert.run('other-owner-link', 'owner-b', 'professional-evidence', JSON.stringify({ evidenceType: 'requirement-link', payload: { sourceKind: 'professional-evidence', sourceId: 'source' } }), 1, null);
      const deleteSource = db.prepare(`UPDATE dive_records SET deleted_at=2,updated_at=2 WHERE id=? AND user_id=? AND updated_at=?${PROFESSIONAL_EVIDENCE_DELETE_CONSTRAINT}`);
      const remove = () => deleteSource.run('source', 'owner-a', 1, ...professionalEvidenceDeleteBindings('owner-a', 'source')).changes;
      expect(remove()).toBe(1); // Another owner's link cannot hold this owner's record.
      db.prepare('UPDATE dive_records SET deleted_at=NULL,updated_at=1 WHERE id=?').run('source');
      insert.run('owner-link', 'owner-a', 'professional-evidence', JSON.stringify({ evidenceType: 'requirement-link', payload: { sourceKind: 'professional-evidence', sourceId: 'source' } }), 1, null);
      expect(remove()).toBe(0);
      db.prepare('UPDATE dive_records SET deleted_at=2 WHERE id=?').run('owner-link');
      expect(remove()).toBe(1);
    } finally {
      db.close();
    }
  });
  it('offers stable, non-duplicated activity choices in the matching evidence editor', () => {
    expect(PROFESSIONAL_ASSESSMENT_ACTIVITIES).toHaveLength(17);
    expect(new Set(PROFESSIONAL_ASSESSMENT_ACTIVITIES.map(item => item.code)).size).toBe(17);
    for (const activity of PROFESSIONAL_ASSESSMENT_ACTIVITIES) {
      const field = professionalAssessmentFields(activity.evidenceType).find(item => item.key === 'activityCode');
      expect(field?.options).toContainEqual({ value: activity.code, label: activity.label });
    }
  });
  it.each(PROFESSIONAL_ASSESSMENT_ACTIVITIES)('evaluates only an exact, signed $label result', activity => {
    const requirement: ProfessionalRequirementDefinition = {
      ...assessment,
      rule: { source: 'professional-evidence', evidenceType: activity.evidenceType,
        activityCode: activity.code, evaluatorRequired: true, result: 'passed' },
    };
    const valid = record(activity.code, {
      evidenceType: activity.evidenceType,
      payload: { activityCode: activity.code, result: 'passed' },
    });
    expect(evaluate(requirement, valid).state).toBe('satisfied');
    expect(evaluate(requirement, { ...valid, evaluatorPersonId: null }).state).not.toBe('satisfied');
    expect(evaluate(requirement, { ...valid, payload: { activityCode: activity.code, result: 'incomplete' } }).state).not.toBe('satisfied');
  });
  it('requires a version link for a new canonical Skill assessment', () => {
    const skill = { entityId: 'skill-1', skillKey: 'skill-1', name: 'Skill', group: 'Test' } as ProfessionalEvaluationContext['skills'][number];
    const skillEvidence = { entityId: 'skill-evidence-1', skillKey: 'skill-1', performedAt: '2026-09-20T10:00:00Z', competenceLevel: 'competent', evaluatorPersonId: 'evaluator-1', attachmentIds: [] } as ProfessionalEvaluationContext['skillEvidence'][number];
    const rule: ProfessionalRequirementDefinition = { key: 'skill-check', label: 'Skill check', kind: 'assessment',
      rule: { source: 'canonical-skill', skillKey: 'skill-1', minCompetence: 'competent', evaluatorRequired: true } };
    const base = { ...context(), skills: [skill], skillEvidence: [skillEvidence] };
    expect(evaluateProfessionalRequirement(rule, 'set-v3', base).state).not.toBe('satisfied');
    const link = record('skill-link', { evidenceType: 'requirement-link', requirementKey: 'skill-check',
      evaluatorPersonId: null, relatedDiveId: null,
      relatedSkillEvidenceId: 'skill-evidence-1', payload: { sourceKind: 'skill-evidence', sourceId: 'skill-evidence-1' } });
    const result = evaluateProfessionalRequirement(rule, 'set-v3', { ...base, professionalEvidence: [link] });
    expect(result.state).toBe('satisfied');
    expect(result.evidence.map(item => item.id)).toEqual(expect.arrayContaining(['skill-evidence-1', 'skill-link']));
  });
  it('requires the exact version, key, activity, result and evaluator', () => {
    expect(evaluate(assessment, record('valid')).state).toBe('satisfied');
    for (const invalid of [
      record('old-version', { requirementSetId: 'set-v2' }),
      record('wrong-key', { requirementKey: 'other' }),
      record('wrong-activity', { payload: { activityCode: 'deep-dive', result: 'passed' } }),
      record('no-evaluator', { evaluatorPersonId: null }),
      record('wrong-result', { payload: { activityCode: 'diver-rescue', result: 'practised' } }),
      record('future', { occurredAt: '2099-01-01T00:00:00Z' }),
    ]) expect(evaluate(assessment, invalid).state).not.toBe('satisfied');
  });

  it('does not use another pathway’s evidence even when it names the same version and key', () => {
    const result = evaluateProfessionalRequirement(assessment, 'set-v3', {
      ...context(record('other-path', { pathwayId: 'path-2' })), pathwayId: 'path-1',
    });
    expect(result.state).not.toBe('satisfied');
  });

  it('rejects an evaluator or supporting record that does not resolve canonically', () => {
    expect(evaluate(assessment, record('missing-evaluator', { evaluatorPersonId: 'missing' })).state).not.toBe('satisfied');
    expect(evaluate(assessment, record('missing-dive', { relatedDiveId: 'missing' })).state).not.toBe('satisfied');
  });

  it('does not count duplicate evidence or generic requirement links as a formal result', () => {
    const result = evaluate(assessment, record('valid'), record('valid'), record('link', {
      evidenceType: 'requirement-link',
      evaluatorPersonId: null,
      payload: { sourceKind: 'professional-evidence', sourceId: 'valid' },
    }));
    expect(result.state).toBe('satisfied');
    expect(result.evidence.filter(item => item.id === 'valid')).toHaveLength(1);
  });

  it('can link an older signed result into a new version without rewriting its source', () => {
    const original = record('older-source', { requirementSetId: 'set-v2', requirementKey: 'old' });
    const link = record('version-link', {
      evidenceType: 'requirement-link', evaluatorPersonId: null, relatedDiveId: null,
      payload: { sourceKind: 'professional-evidence', sourceId: 'older-source' },
    });
    const result = evaluate(assessment, original, link);
    expect(result.state).toBe('satisfied');
    expect(result.evidence.map(item => item.id)).toEqual(expect.arrayContaining(['older-source', 'version-link']));
    expect(original.requirementSetId).toBe('set-v2');
    expect(evaluate(assessment, original, { ...link, pathwayId: 'someone-else' }).state).not.toBe('satisfied');
  });

  it('rejects a dangling version link even when its copied fields look valid', () => {
    const link = record('version-link', {
      evidenceType: 'requirement-link',
      payload: { sourceKind: 'professional-evidence', sourceId: 'missing', activityCode: 'diver-rescue', result: 'passed' },
    });
    expect(evaluate(assessment, link).state).not.toBe('satisfied');
    expect(professionalEvidenceReferenceIssues(link, context(link))).toContainEqual(
      expect.objectContaining({ field: 'payload.sourceId', missingId: 'missing' }),
    );
  });

  it('keeps an unsupported or empty assessment rule Unknown', () => {
    expect(evaluate({ ...assessment, rule: {} }, record('valid')).state).toBe('unknown');
    expect(evaluate({ ...assessment, rule: { ...assessment.rule, activityCode: '' } }, record('valid')).state).toBe('unknown');
  });

  it('requires exact document scoping when a new snapshot opts into it', () => {
    const requirement: ProfessionalRequirementDefinition = {
      key: 'site-map', label: 'Site map', kind: 'document',
      rule: { evidenceType: 'site-map', scope: 'requirement' },
    };
    const attachment = record('map', { evidenceType: 'site-map', attachmentIds: ['file-1'] });
    expect(evaluate(requirement, attachment).state).toBe('not_satisfied');
    expect(evaluate(requirement, { ...attachment, requirementKey: 'site-map' }).state).toBe('satisfied');
    const old = { ...attachment, requirementSetId: 'set-v2' };
    const link = record('map-link', { evidenceType: 'requirement-link', requirementKey: 'site-map',
      payload: { sourceKind: 'professional-evidence', sourceId: 'map' }, attachmentIds: [] });
    expect(evaluate(requirement, old, link).state).toBe('satisfied');
  });

  it('counts only distinct, requirement-linked activity evidence in new count rules', () => {
    const rule: ProfessionalRequirementDefinition = { key: 'assists', label: 'Assists', kind: 'count',
      rule: { metric: 'professional-evidence', evidenceType: 'assisting', scope: 'requirement', min: 2 } };
    const one = record('assist-1', { evidenceType: 'assisting', requirementKey: 'assists' });
    expect(evaluate(rule, one, one, record('unlinked', { evidenceType: 'assisting' })).state).toBe('not_satisfied');
    expect(evaluate(rule, one, record('assist-2', { evidenceType: 'assisting', requirementKey: 'assists' })).state).toBe('satisfied');
  });

  it('keeps new manual reviews pending until a scoped evaluator records a pass', () => {
    const rule: ProfessionalRequirementDefinition = { key: 'professionalism', label: 'Professionalism', kind: 'manual',
      rule: { scope: 'requirement', evaluatorRequired: true, result: 'passed' } };
    const feedback = record('feedback', { evidenceType: 'mentor-feedback', requirementKey: 'professionalism', payload: {} });
    expect(evaluate(rule, feedback).state).toBe('manual_review');
    expect(evaluate(rule, { ...feedback, evaluatorPersonId: null, payload: { result: 'passed' } }).state).toBe('manual_review');
    expect(evaluate(rule, { ...feedback, payload: { result: 'passed' } }).state).toBe('satisfied');
  });
});
