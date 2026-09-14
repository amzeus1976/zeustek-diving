import { describe, expect, it } from 'vitest';
import {
  TECH_PATHWAY_STARTERS,
  emptyRequirementSet,
  evaluatePathwayReadiness,
  evaluateTechnicalRequirement,
  isTechnicalDive,
  technicalDiveMetrics,
  technicalPlans,
  configurationCompetence,
  isTechnicalLoadout,
  type ReferenceRequirementSetRecord,
  type TechnicalRequirementDefinition,
} from '../lib/offline/technical-workspace';
import type { DiveRecord } from '../lib/offline/dives';
import type { CertificationRecord, DiveTripRecord, Stored } from '../lib/offline/dive-planning';
import type { CanonicalSkillRecord, SkillEvidenceRecord } from '../lib/offline/dive-context';

const dive = (entityId: string, overrides: Partial<DiveRecord> = {}): DiveRecord & { entityId: string } => ({
  entityId,
  site: 'Test site',
  date: '2026-09-01',
  maxDepthM: 20,
  bottomTimeMin: 40,
  gas: 'Air',
  notes: '',
  source: 'manual',
  createdAt: '2026-09-01T10:00:00Z',
  modifiedAt: '2026-09-01T11:00:00Z',
  ...overrides,
});

const skill: CanonicalSkillRecord = {
  entityId: 'skill-shutdown',
  skillKey: 'skill-shutdown',
  name: 'Valve shutdown drill',
  group: 'Technical drills',
};

const evidence: SkillEvidenceRecord = {
  entityId: 'evidence-1',
  skillKey: 'skill-shutdown',
  performedAt: '2026-09-10T12:00:00Z',
  competenceLevel: 'competent',
  evaluatorPersonId: 'person-1',
  attachmentIds: [],
};

const context = {
  dives: [
    dive('rec-1'),
    dive('tec-1', { diveMode: 'technical', isTechnicalDive: true, maxDepthM: 42, decoDive: true, decoStops: [{ depthM: 6, durationMin: 5, actualDurationMin: 5 }] }),
  ],
  certifications: [] as Array<Stored<CertificationRecord>>,
  skills: [skill],
  evidence: [evidence],
  equipmentSets: [],
  asOf: new Date('2026-09-13T12:00:00Z'),
};

describe('T07 technical workspace derived projections', () => {
  it('keeps configuration evidence scoped and excludes undated/future occurrences without substring false positives',()=>{
    const loadout={entityId:'set',name:'Technical twinset',equipmentIds:['canonical-cylinder'],notes:'',createdAt:'2026-09-01',modifiedAt:'2026-09-01'};
    expect(isTechnicalLoadout({...loadout,name:'Protection kit'})).toBe(false);
    const rows=configurationCompetence([loadout],[skill],[
      {...evidence,equipmentSetId:'set'},
      {...evidence,entityId:'future',equipmentSetId:'set',performedAt:'2099-01-01'},
      {...evidence,entityId:'undated',equipmentSetId:'set',performedAt:''},
      {...evidence,entityId:'other',equipmentSetId:'other'},
    ],context.asOf);
    expect(rows[0]?.evidenceCount).toBe(1);expect(rows[0]?.latestEvidence?.entityId).toBe('evidence-1');
  });
  it('recognises technical/decompression Dives without creating a second logbook', () => {
    expect(isTechnicalDive(context.dives[0]!)).toBe(false);
    expect(isTechnicalDive(context.dives[1]!)).toBe(true);
    expect(technicalDiveMetrics(context.dives)).toEqual({ totalDives: 2, technicalDives: 1, decoDives: 1, deepestM: 42 });
  });

  it('evaluates only explicitly captured pathway rules', () => {
    const requirement: TechnicalRequirementDefinition = {
      key: 'tech-count',
      label: 'Captured technical-dive count',
      kind: 'count',
      rule: { metric: 'technical-dives', min: 1 },
    };
    const result = evaluateTechnicalRequirement(requirement, context);
    expect(result.state).toBe('satisfied');
    expect(result.detail).toContain('1 recorded');
    expect(result.evidence[0]?.id).toBe('tec-1');
  });

  it('uses canonical Skill Evidence for captured competence requirements', () => {
    const requirement: TechnicalRequirementDefinition = {
      key: 'shutdown',
      label: 'Shutdown competence',
      kind: 'assessment',
      rule: { skillKey: 'skill-shutdown', minCompetence: 'competent', evaluatorRequired: true },
    };
    const result = evaluateTechnicalRequirement(requirement, context);
    expect(result.state).toBe('satisfied');
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'skill-evidence', id: 'evidence-1' })]));
  });

  it('keeps incomplete/unsupported captured rules visibly unknown rather than guessing', () => {
    const incomplete: TechnicalRequirementDefinition = { key: 'count', label: 'Incomplete', kind: 'count', rule: { metric: 'technical-dives' } };
    expect(evaluateTechnicalRequirement(incomplete, context).state).toBe('unknown');
    const documentRule: TechnicalRequirementDefinition = { key: 'medical', label: 'Medical evidence', kind: 'document', rule: {} };
    expect(evaluateTechnicalRequirement(documentRule, context).state).toBe('manual_review');
  });

  it('derives readiness from the versioned requirement snapshot and leaves an empty snapshot unknown', () => {
    const base: Stored<ReferenceRequirementSetRecord> = {
      entityId: 'ref-1',
      agency: 'Example Agency',
      pathwayKey: 'tec-example',
      pathwayLabel: 'Example Pathway',
      versionLabel: 'captured-2026-09',
      effectiveFrom: null,
      effectiveTo: null,
      sourceCitation: 'Owner-captured source',
      capturedAt: '2026-09-13T12:00:00Z',
      createdAt: '2026-09-13T12:00:00Z',
      modifiedAt: '2026-09-13T12:00:00Z',
      requirements: [{ key: 'count', label: 'One technical Dive', kind: 'count', rule: { metric: 'technical-dives', min: 1 } }],
    };
    const readiness = evaluatePathwayReadiness(base, context);
    expect(readiness.state).toBe('satisfied');
    expect(readiness.percent).toBe(100);

    const empty = { ...base, entityId: 'ref-empty', requirements: [] };
    expect(evaluatePathwayReadiness(empty, context).state).toBe('unknown');
  });

  it('ships pathway labels only, not supposedly-current agency numeric requirements', () => {
    expect(TECH_PATHWAY_STARTERS.map((item) => item.label)).toEqual(['Tec 40', 'Tec 45', 'Tec 50']);
    const blank = emptyRequirementSet('tec40', 'Tec 40');
    expect(blank.requirements).toEqual([]);
    expect(blank.agency).toBe('');
    expect(blank.sourceCitation).toBeNull();
  });

  it('surfaces only Plans that already carry technical Plan evidence', () => {
    const plans = [
      { entityId: 'ordinary', name: 'Ordinary plan', startDate: '2026-09-20', endDate: '2026-09-20', siteName: '', buddy: '', status: 'planned', notes: '', createdAt: '', modifiedAt: '' },
      { entityId: 'technical', name: 'Tec plan', startDate: '2026-09-21', endDate: '2026-09-21', siteName: '', buddy: '', status: 'planned', notes: '', technicalMode: true, decoSchedule: [{ depthM: 6, durationMin: 5, gas: 'Nx50' }], createdAt: '', modifiedAt: '' },
    ] as Array<Stored<DiveTripRecord & { technicalMode?: boolean; decoSchedule?: Array<{ depthM: number | null; durationMin: number | null; gas?: string }> }>>;
    expect(technicalPlans(plans).map((plan) => plan.entityId)).toEqual(['technical']);
  });
});
