import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zeustekDb } from '../lib/offline/db';
import { configureDiveStore } from '../lib/offline/dive-store';
import {
  listPeople,
  savePerson,
  type PersonRecord,
} from '../lib/offline/dive-planning';
import {
  derivePersonProfileStats,
  planTeamMemberFromPerson,
} from '../lib/offline/people-profiles';

beforeEach(async () => {
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('navigator', { onLine: false });
  vi.stubGlobal('fetch', vi.fn());
  configureDiveStore('p01-profile-test');
  await zeustekDb.open();
  for (const table of zeustekDb.tables) await table.clear();
});

afterEach(() => vi.unstubAllGlobals());

const profile = (): Omit<PersonRecord, 'createdAt' | 'modifiedAt'> => ({
  name: 'Alex Diver',
  forename: 'Alex',
  surname: 'Diver',
  displayName: 'Alex Diver',
  role: 'both',
  roles: {
    ownerProfile: true,
    buddy: true,
    instructor: true,
    diveOperator: true,
  },
  agency: 'Test agency',
  membershipNumber: 'MEM-1',
  membershipId: 'MEM-1',
  highestQualification: 'Rescue Diver',
  highestRecreationalCertification: 'Rescue Diver',
  maxAllowedDepthM: 30,
  maxAllowedDepthSource: 'owner-entered',
  certificationFlags: { rescue: true, nitrox: true },
  certificationEvidenceNotes: 'Owner verified test evidence',
  email: 'alex@example.invalid',
  phone: '000',
  emergencyContact: '',
  emergencyContactName: 'Emergency Test',
  emergencyContactNumber: '111',
  contactVisibility: 'planning',
  instructorAgency: 'Test agency',
  instructorNumber: 'INST-1',
  instructorSpecialties: ['Nitrox'],
  instructorActive: true,
  operatorName: 'Test Dive Centre',
  operatorType: 'dive-centre',
  operatorPhone: '222',
  operatorEmail: 'operator@example.invalid',
  linkedTripIds: ['trip-1'],
  linkedDivePlanIds: ['plan-1'],
  linkedDiveIds: ['dive-1'],
  notes: 'P01 persistence test',
});

describe('P01 profile persistence and planning integration', () => {
  it('saves and reopens the additive owner, contact, instructor and operator fields offline', async () => {
    await savePerson(profile());
    zeustekDb.close();
    await zeustekDb.open();
    const reopened = (await listPeople())[0]!;
    expect(reopened).toMatchObject({
      roles: { ownerProfile: true, buddy: true, instructor: true, diveOperator: true },
      membershipId: 'MEM-1',
      emergencyContactName: 'Emergency Test',
      instructorNumber: 'INST-1',
      instructorSpecialties: ['Nitrox'],
      operatorName: 'Test Dive Centre',
      operatorType: 'dive-centre',
      linkedDivePlanIds: ['plan-1'],
    });
    expect(await zeustekDb.outbox.count()).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('copies advisory Person evidence into a stable Plan team snapshot', async () => {
    await savePerson(profile());
    const person = (await listPeople())[0]!;
    expect(planTeamMemberFromPerson(person)).toMatchObject({
      personId: person.entityId,
      role: 'Instructor',
      rescueDiverStatus: 'yes',
      certifiedDepthM: 30,
      capabilityEvidence: 'Owner verified test evidence',
    });
    expect(planTeamMemberFromPerson(person).specialties).toContain('nitrox');
  });

  it('uses validated cylinder rate evidence when direct Dive SAC/RMV fields are absent', () => {
    const derived = derivePersonProfileStats(
      profile(),
      [
        {
          entityId: 'dive-1',
          site: 'Test Site',
          date: '2026-09-01',
          maxDepthM: 20,
          bottomTimeMin: 40,
          gas: 'Air',
          notes: '',
          source: 'manual',
          cylinders: [{
            id: 'cylinder-1',
            name: 'Test cylinder',
            gasType: 'Air',
            oxygenPercent: 21,
            heliumPercent: 0,
            configuration: 'Back gas',
            material: 'Steel',
            size: '12 L',
            startPressureBar: 200,
            endPressureBar: 100,
            switchDepthM: null,
            switchRuntimeMin: null,
            sacPressureBarMin: 1.2,
            rmvRate: 18,
          }],
          createdAt: '2026-09-01',
          modifiedAt: '2026-09-01',
        },
      ],
      [],
    );
    expect(derived.averageSac).toBe(1.2);
    expect(derived.averageRmv).toBe(18);
  });
});
