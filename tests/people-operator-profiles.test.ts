import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DiveRecord } from '../lib/offline/dives';
import type {
  CertificationRecord,
  PersonRecord,
} from '../lib/offline/dive-planning';
import {
  assertSingleOwnerProfile,
  derivePersonProfileStats,
  findOwnerProfile,
  hasPersonRole,
  refreshPersonDerivedStats,
} from '../lib/offline/people-profiles';

const basePerson = (patch: Partial<PersonRecord> = {}): PersonRecord => ({
  name: 'Alex Diver',
  role: 'buddy',
  agency: '',
  highestQualification: '',
  membershipNumber: '',
  email: '',
  phone: '',
  emergencyContact: '',
  notes: '',
  createdAt: '2026-01-01',
  modifiedAt: '2026-01-01',
  ...patch,
});

const dive = (
  entityId: string,
  patch: Partial<DiveRecord> = {},
): DiveRecord & { entityId: string } => ({
  entityId,
  site: 'Test Site',
  date: '2026-09-01',
  maxDepthM: 20,
  bottomTimeMin: 40,
  gas: 'Air',
  notes: '',
  source: 'manual',
  createdAt: '2026-09-01',
  modifiedAt: '2026-09-01',
  ...patch,
});

const certification = (
  certificationName: string,
  courseType: NonNullable<CertificationRecord['courseType']>,
): CertificationRecord => ({
  agency: 'Test agency',
  certification: certificationName,
  level: '',
  certificationNumber: '',
  issuedAt: '2026-01-01',
  expiresAt: '',
  instructor: '',
  notes: '',
  imageKey: '',
  imageName: '',
  courseType,
  createdAt: '2026-01-01',
  modifiedAt: '2026-01-01',
});

describe('P01 People & Operators / owner profile foundation', () => {
  it('uses one special Person record as My Profile and prevents duplicates', () => {
    const owner = {
      ...basePerson({ roles: { ownerProfile: true, buddy: true } }),
      entityId: 'owner-1',
    };
    expect(findOwnerProfile([owner])).toBe(owner);
    expect(() =>
      assertSingleOwnerProfile([owner], {
        ...basePerson(),
        roles: { ownerProfile: true },
      }),
    ).toThrow(/already exists/i);
    expect(() =>
      assertSingleOwnerProfile([owner], { ...owner, entityId: 'owner-1' }),
    ).not.toThrow();
  });

  it('supports combined buddy, instructor and operator roles plus additive profile data', () => {
    const profile = basePerson({
      roles: { buddy: true, instructor: true, diveOperator: true },
      instructorAgency: 'PADI',
      instructorNumber: 'I-1',
      instructorSpecialties: ['Nitrox'],
      operatorName: 'ZeusTek Test Centre',
      operatorType: 'dive-centre',
      operatorPhone: '000',
      emergencyContactName: 'Emergency Person',
      emergencyContactNumber: '111',
      highestTechnicalCertification: 'Tec 40',
      maxAllowedDepthM: 40,
    });
    const reopened = JSON.parse(JSON.stringify(profile)) as PersonRecord;
    expect(hasPersonRole(reopened, 'buddy')).toBe(true);
    expect(hasPersonRole(reopened, 'instructor')).toBe(true);
    expect(hasPersonRole(reopened, 'diveOperator')).toBe(true);
    expect(reopened.instructorSpecialties).toEqual(['Nitrox']);
    expect(reopened.operatorName).toBe('ZeusTek Test Centre');
    expect(reopened.emergencyContactNumber).toBe('111');
    expect(reopened.highestTechnicalCertification).toBe('Tec 40');
  });

  it('derives owner Logbook stats and certification tracks without turning missing evidence into zero', () => {
    const owner = basePerson({ roles: { ownerProfile: true } });
    const derived = derivePersonProfileStats(
      owner,
      [
        dive('d1', {
          maxDepthM: 18,
          sacRate: 20,
          rmvRate: 17,
          diveTypes: ['Boat', 'Night'],
        }),
        dive('d2', {
          date: '2026-09-02',
          maxDepthM: 32,
          sacRate: 16,
          rmvRate: 15,
          diveTypes: ['Shore', 'Wreck'],
          diveMode: 'technical',
        }),
      ],
      [
        certification('Advanced Open Water', 'core'),
        certification('Tec 40', 'technical'),
        certification('Divemaster', 'professional'),
      ],
    );
    expect(derived.totalLinkedDives).toBe(2);
    expect(derived.maxDepthM).toBe(32);
    expect(derived.averageSac).toBe(18);
    expect(derived.averageRmv).toBe(16);
    expect(derived.boatDives).toBe(1);
    expect(derived.shoreDives).toBe(1);
    expect(derived.highestTechnicalCertification).toBe('Tec 40');
    expect(derived.highestProfessionalCertification).toBe('Divemaster');
    const unknown = derivePersonProfileStats(
      owner,
      [dive('d3', { maxDepthM: null, sacRate: null, rmvRate: null })],
      [],
    );
    expect(unknown.maxDepthM).toBeNull();
    expect(unknown.averageSac).toBeNull();
    expect(unknown.averageRmv).toBeNull();
  });

  it('preserves manual overrides unless replacement is explicitly confirmed', () => {
    const owner = basePerson({
      averageSac: 13,
      manualOverrideFields: ['averageSac'],
      profileValueSources: { averageSac: 'owner-entered' },
    });
    const derived = derivePersonProfileStats(
      { ...owner, roles: { ownerProfile: true } },
      [dive('d1', { sacRate: 20 })],
      [],
    );
    expect(refreshPersonDerivedStats(owner, derived).averageSac).toBe(13);
    expect(refreshPersonDerivedStats(owner, derived, true).averageSac).toBe(20);
  });

  it('integrates the profile source with Overview and preserves Dive Planning search-and-add', () => {
    const dashboard = readFileSync('app/dashboard-client.tsx', 'utf8');
    const people = readFileSync('components/people-operators.tsx', 'utf8');
    const planning = readFileSync(
      'components/dive-planning-centre.tsx',
      'utf8',
    );
    expect(dashboard).toContain('findOwnerProfile(people)');
    expect(dashboard).toContain(
      "ownerProfile ? 'Open My Profile' : 'Create My Profile'",
    );
    expect(people).toContain('Refresh derived stats');
    expect(people).toContain('Instructor profile');
    expect(people).toContain('Dive operator profile');
    expect(planning).toContain('Search People');
    expect(planning).toContain('Matching People');
    expect(planning).not.toContain(
      'people.map(person=><label><input type="checkbox"',
    );
    expect(planning).toContain('Recorded depth capability (m)');
  });

  it('retains the accepted workflow and synthetic-cleanup safety guards', () => {
    const workflow = readFileSync('lib/workflow/workflow-model.ts', 'utf8');
    const cleanupTests = readFileSync(
      'tests/t12-4-synthetic-cleanup.test.ts',
      'utf8',
    );
    expect(workflow).toContain("key: 'dive-preparation'");
    expect(workflow).toContain("section: 'diving-cpd'");
    expect(cleanupTests).toContain(
      'Liverpool wreck history or physical fixtures',
    );
  });
});
