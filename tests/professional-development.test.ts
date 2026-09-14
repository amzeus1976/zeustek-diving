import { describe, expect, it } from 'vitest';
import {
  evaluateProfessionalReadiness,
  evaluateProfessionalRequirement,
  evidenceMatchesRequirement,
  professionalEvidenceReferenceIssueSummary,
  professionalEvidenceSummary,
  type ProfessionalEvidenceRecord,
  type ProfessionalReferenceRequirementSetRecord,
  type ProfessionalRequirementDefinition,
} from '../lib/offline/professional-development';
import type { DiveRecord } from '../lib/offline/dives';
import type { CertificationRecord, Stored } from '../lib/offline/dive-planning';
import type {
  CanonicalSkillRecord,
  SkillEvidenceRecord,
} from '../lib/offline/dive-context';

const dive = (entityId: string): DiveRecord & { entityId: string } => ({
  entityId,
  site: 'Test site',
  date: '2026-09-01',
  maxDepthM: 20,
  bottomTimeMin: 40,
  gas: 'Air',
  notes: '',
  source: 'manual',
  createdAt: '',
  modifiedAt: '',
});
const skill: CanonicalSkillRecord = {
  entityId: 'skill-briefing',
  skillKey: 'skill-briefing',
  name: 'Dive briefing',
  group: 'Leadership & Pro',
};
const skillEvidence: SkillEvidenceRecord = {
  entityId: 'se-1',
  skillKey: 'skill-briefing',
  performedAt: '2026-09-12T10:00:00Z',
  competenceLevel: 'competent',
  evaluatorPersonId: 'person-1',
  attachmentIds: [],
};
const evidence = (
  entityId: string,
  evidenceType: string,
  extra: Partial<ProfessionalEvidenceRecord> = {},
): Stored<ProfessionalEvidenceRecord> => ({
  entityId,
  pathwayId: 'path-1',
  evidenceType,
  occurredAt: '2026-09-10T10:00:00Z',
  relatedDiveId: null,
  relatedSkillEvidenceId: null,
  relatedSiteId: null,
  evaluatorPersonId: null,
  attachmentIds: [],
  payload: {},
  notes: null,
  createdAt: '',
  modifiedAt: '',
  ...extra,
});
const context = {
  dives: [dive('dive-1'), dive('dive-2')],
  certifications: [] as Array<Stored<CertificationRecord>>,
  skills: [skill],
  skillEvidence: [skillEvidence],
  professionalEvidence: [
    evidence('assist-1', 'assisting'),
    evidence('guide-1', 'guided-dive'),
    evidence('eap-1', 'eap', { attachmentIds: ['file-1'] }),
  ],
  sites: [],
  people: [],
  asOf: new Date('2026-09-13T12:00:00Z'),
};

const set = (
  requirements: ProfessionalRequirementDefinition[],
): Stored<ProfessionalReferenceRequirementSetRecord> => ({
  entityId: 'ref-1',
  agency: 'Example Agency',
  pathwayKey: 'pro-path',
  pathwayLabel: 'Professional Pathway',
  versionLabel: 'captured-2026-09',
  effectiveFrom: null,
  effectiveTo: null,
  sourceCitation: 'Owner-checked source',
  requirements,
  capturedAt: '2026-09-13T12:00:00Z',
  createdAt: '',
  modifiedAt: '',
});

describe('T08 Professional Development projections', () => {
  it('does not claim assessment or certification recency from future or undated evidence', () => {
    const assessment: ProfessionalRequirementDefinition = {
      key: 'dated',
      label: 'Recorded assessment',
      kind: 'assessment',
      rule: { skillKey: 'skill-briefing', minCompetence: 'competent' },
    };
    for (const performedAt of ['2099-01-01', '', 'invalid'])
      expect(
        evaluateProfessionalRequirement(assessment, 'ref-1', {
          ...context,
          skillEvidence: [{ ...skillEvidence, performedAt }],
        }).state,
      ).toBe('not_satisfied');
    const recent: ProfessionalRequirementDefinition = {
      key: 'recent',
      label: 'Recorded certification',
      kind: 'recency',
      rule: { maxAgeDays: 30, anyTitleIncludes: ['First Aid'] },
    };
    const future = {
      entityId: 'future',
      agency: 'Example',
      certification: 'First Aid',
      level: '',
      issuedAt: '2099-01-01',
    } as Stored<CertificationRecord>;
    expect(
      evaluateProfessionalRequirement(recent, 'ref-1', {
        ...context,
        certifications: [future],
      }).state,
    ).toBe('not_satisfied');
  });
  it('counts shared canonical Dives without cloning them into professional records', () => {
    const result = evaluateProfessionalRequirement(
      {
        key: 'dives',
        label: 'Captured dive count',
        kind: 'count',
        rule: { metric: 'logged-dives', min: 2 },
      },
      'ref-1',
      context,
    );
    expect(result.state).toBe('satisfied');
    expect(result.evidence.map((item) => item.id)).toEqual(
      expect.arrayContaining(['dive-1', 'dive-2']),
    );
  });

  it('counts typed Professional Evidence using the versioned rule rather than hard-coded agency truth', () => {
    const result = evaluateProfessionalRequirement(
      {
        key: 'assists',
        label: 'Captured assist count',
        kind: 'count',
        rule: {
          metric: 'professional-evidence',
          evidenceType: 'assisting',
          min: 1,
        },
      },
      'ref-1',
      context,
    );
    expect(result.state).toBe('satisfied');
    expect(result.detail).toContain('1 assisting evidence item');
  });

  it('uses canonical Skill Evidence for assessed professional skills', () => {
    const result = evaluateProfessionalRequirement(
      {
        key: 'briefing',
        label: 'Briefing assessment',
        kind: 'assessment',
        rule: {
          skillKey: 'skill-briefing',
          minCompetence: 'competent',
          evaluatorRequired: true,
        },
      },
      'ref-1',
      context,
    );
    expect(result.state).toBe('satisfied');
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'skill-evidence', id: 'se-1' }),
      ]),
    );
  });

  it('requires an actual attachment reference for captured document requirements', () => {
    const yes = evaluateProfessionalRequirement(
      {
        key: 'eap',
        label: 'EAP document',
        kind: 'document',
        rule: { evidenceType: 'eap' },
      },
      'ref-1',
      context,
    );
    const no = evaluateProfessionalRequirement(
      {
        key: 'map',
        label: 'Map document',
        kind: 'document',
        rule: { evidenceType: 'site-map' },
      },
      'ref-1',
      context,
    );
    expect(yes.state).toBe('satisfied');
    expect(no.state).toBe('not_satisfied');
  });

  it('keeps incomplete captured rules visibly unknown/manual rather than guessing', () => {
    expect(
      evaluateProfessionalRequirement(
        { key: 'bad', label: 'Incomplete', kind: 'count', rule: {} },
        'ref-1',
        context,
      ).state,
    ).toBe('unknown');
    expect(
      evaluateProfessionalRequirement(
        { key: 'manual', label: 'Manual check', kind: 'manual', rule: {} },
        'ref-1',
        context,
      ).state,
    ).toBe('manual_review');
  });

  it('derives readiness from the selected immutable requirement snapshot', () => {
    const readiness = evaluateProfessionalReadiness(
      set([
        {
          key: 'dives',
          label: 'Two dives',
          kind: 'count',
          rule: { metric: 'logged-dives', min: 2 },
        },
        {
          key: 'missing',
          label: 'Two assists',
          kind: 'count',
          rule: {
            metric: 'professional-evidence',
            evidenceType: 'assisting',
            min: 2,
          },
        },
        { key: 'manual', label: 'Manual review', kind: 'manual', rule: {} },
      ]),
      context,
    );
    expect(readiness.satisfied).toBe(1);
    expect(readiness.notSatisfied).toBe(1);
    expect(readiness.manualReview).toBe(1);
    expect(readiness.percent).toBe(50);
    expect(readiness.state).toBe('manual_review');
  });

  it('preserves requirement-version linkage on evidence', () => {
    const item = evidence('linked', 'requirement-link', {
      requirementSetId: 'ref-1',
      requirementKey: 'manual',
    });
    expect(evidenceMatchesRequirement(item, 'ref-1', 'manual')).toBe(true);
    expect(evidenceMatchesRequirement(item, 'ref-2', 'manual')).toBe(false);
  });

  it('surfaces broken canonical references without deleting the Professional Evidence record', () => {
    const broken = evidence('broken', 'guided-dive', {
      relatedDiveId: 'missing-dive',
      relatedSkillEvidenceIds: ['missing-skill-evidence'],
      relatedPersonIds: ['missing-person'],
    });
    const result = professionalEvidenceReferenceIssueSummary([broken], {
      ...context,
      professionalEvidence: [broken],
    });
    expect(result.affectedEvidenceCount).toBe(1);
    expect(result.issues.map((item) => item.field)).toEqual(
      expect.arrayContaining([
        'relatedDiveId',
        'relatedSkillEvidenceIds',
        'relatedPersonIds',
      ]),
    );
  });

  it('supports certification recency only from a captured rule, not hard-coded pathway truth', () => {
    const certification: Stored<CertificationRecord> = {
      entityId: 'cert-1',
      agency: 'Example Agency',
      certification: 'First Aid',
      level: '',
      certificationNumber: '',
      issuedAt: '2026-09-01',
      expiresAt: '',
      instructor: '',
      notes: '',
      imageKey: '',
      imageName: '',
      createdAt: '',
      modifiedAt: '',
    };
    const result = evaluateProfessionalRequirement(
      {
        key: 'first-aid-recency',
        label: 'Recent first aid',
        kind: 'recency',
        rule: {
          maxAgeDays: 30,
          agency: 'Example Agency',
          anyTitleIncludes: ['First Aid'],
        },
      },
      'ref-1',
      { ...context, certifications: [certification] },
    );
    expect(result.state).toBe('satisfied');
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'certification', id: 'cert-1' }),
      ]),
    );
  });

  it('summarises workspace categories as derived counts only', () => {
    const summary = professionalEvidenceSummary(context.professionalEvidence);
    expect(summary.assisting).toBe(1);
    expect(summary['guided-dive']).toBe(1);
    expect(summary.eap).toBe(1);
    expect(summary.workshop).toBe(0);
  });
});
