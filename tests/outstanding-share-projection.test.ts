import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('../app/chatgpt-auth', () => ({ getChatGPTUser: async () => null }));
import { sharingDatabase } from './selected-sharing-fixture';
import { buildSharePreview } from '../lib/server/share-links';
import {
  validateShareInput,
  validateSharedSnapshot,
} from '../lib/sharing/share-links';
let fixture: ReturnType<typeof sharingDatabase>;
const input = () =>
  validateShareInput({
    version: 1,
    kind: 'profile',
    label: 'Selected diver snapshot',
    expiresAt: null,
    attachmentIds: [],
    profile: {
      displayName: 'Diver',
      biography: 'Chosen text',
      insights: ['highestRecreationalAward'],
      certificationIds: ['award'],
      trainingIds: ['training'],
    },
  });
beforeEach(() => {
  fixture = sharingDatabase();
  fixture.add('owner', 'person', {
    name: 'Private owner',
    roles: { ownerProfile: true },
    email: 'PRIVATE-EMAIL',
    medicalNotes: 'PRIVATE-MEDICAL',
  });
  fixture.add('award', 'certification', {
    personId: 'owner',
    certification: 'Master Scuba Diver',
    agency: 'PADI',
    courseType: 'experience',
    issuedAt: '2026-01-01',
    certificationNumber: 'PRIVATE-NUMBER',
    cardFront: { remoteKey: 'PRIVATE-KEY' },
  });
  fixture.add('training', 'training-progress', {
    courseTitle: 'Buoyancy workshop',
    agency: 'PADI',
    status: 'planned',
    notes: 'PRIVATE-NOTES',
  });
  fixture.add('other-award', 'certification', {
    personId: 'someone-else',
    certification: 'Other person award',
  });
  fixture.add('foreign-plan', 'gas-plan', { name: 'Partner plan' }, 'partner');
});
afterEach(() => fixture.sqlite.close());
describe('approved shared snapshot projection', () => {
  it('selects canonical owner evidence and exact records without publishing private record identity or unrelated fields', async () => {
    const before = fixture.records();
    const result = await buildSharePreview(
      fixture.db,
      'fixture-owner',
      input(),
      '2026-10-03T00:00:00Z',
    );
    expect(result.snapshot.profile?.certifications).toEqual([
      { title: 'Master Scuba Diver', agency: 'PADI', date: '2026-01-01' },
    ]);
    expect(result.snapshot.profile?.training).toEqual([
      { title: 'Buoyancy workshop', agency: 'PADI', status: 'planned' },
    ]);
    expect(result.snapshot.profile?.insights[0]?.value).toBe(
      'Master Scuba Diver',
    );
    expect(JSON.stringify(result.snapshot)).not.toMatch(
      /PRIVATE-|personId|entityId|trainingIds|certificationIds|account|cardFront/,
    );
    expect(fixture.records()).toEqual(before);
    expect(validateSharedSnapshot(result.snapshot)).toEqual(result.snapshot);
  });
  it('rejects foreign, deleted and other-person evidence instead of substituting an arbitrary record', async () => {
    for (const ids of [['other-award'], ['missing']])
      await expect(
        buildSharePreview(
          fixture.db,
          'fixture-owner',
          validateShareInput({
            ...input(),
            profile: { ...input().profile, certificationIds: ids },
          }),
        ),
      ).rejects.toThrow();
    await expect(
      buildSharePreview(
        fixture.db,
        'fixture-owner',
        validateShareInput({
          version: 1,
          kind: 'gas-plan',
          label: 'Gas snapshot',
          expiresAt: null,
          attachmentIds: [],
          gasPlan: {
            recordId: 'foreign-plan',
            inputs: true,
            supplies: true,
            outputs: true,
          },
        }),
      ),
    ).rejects.toThrow();
  });
  it('publishes saved supported Gas Plan values and per-cylinder results, without recalculating, serials, team, private names or aggregate Ready claims', async () => {
    fixture.add('plan', 'gas-plan', {
      name: 'PRIVATE-TRIP',
      notes: 'PRIVATE-NOTES',
      teamIds: ['PRIVATE-PERSON'],
      plannedDepthM: 20,
      plannedBottomTimeMin: 30,
      cylinders: [],
      recGasPlan101: {
        version: 'zeustek-rec-gas-102/1.1',
        createdAt: '2026-10-02T12:00:00Z',
        plannedDepthM: 20,
        plannedWorkingTimeMin: 30,
        ownRmvLMin: 15,
        buddyRmvLMin: 15,
        reserveStrategy: 'most-conservative',
        waterType: 'salt',
        maxPpo2: 1.4,
        totalGasLitres: 2400,
        reserve: { selectedLitres: 800, selectedBar: 66.667, phases: [] },
        gasCandidates: [
          {
            selected: true,
            label: 'PRIVATE-SUPPLY-LABEL',
            oxygenFraction: 0.21,
            heliumFraction: 0,
            modM: 56.7,
            ppo2AtPlannedDepth: 0.63,
            ndl: { state: 'available', minutes: 45 },
            gasLimitedTimeMin: 35,
            warnings: ['PRIVATE-WARNING'],
          },
        ],
        warnings: ['PRIVATE-WARNING'],
        readiness: 'Ready',
      },
      allocationV1: {
        version: 'zeustek-allocation/1',
        cylinders: [
          {
            id: 'PRIVATE-ID',
            canonicalId: 'PRIVATE-CYLINDER',
            snapshotId: 'PRIVATE-SNAPSHOT',
            label: 'PRIVATE-SERIAL',
            role: 'sidemount-left',
            gas: { oxygen: 0.21, helium: 0 },
            waterVolumeL: 12,
            currentPressureBar: 150,
            plannedStartPressureBar: 200,
          },
        ],
        assessment: {
          allocation: {
            cylinders: [
              {
                id: 'PRIVATE-ID',
                status: 'BLOCKED',
                availableLitres: 1800,
                requiredLitres: 1900,
                reserveLitres: 800,
                contingencyRequiredLitres: 2000,
                reasons: ['PRIVATE-ID shortfall'],
                checkpoints: [],
              },
            ],
            scenarios: [],
          },
        },
      },
    });
    const before = fixture.records();
    const selection = validateShareInput({
      version: 1,
      kind: 'gas-plan',
      label: 'Chosen planning snapshot',
      expiresAt: null,
      attachmentIds: [],
      gasPlan: {
        recordId: 'plan',
        inputs: true,
        supplies: true,
        outputs: true,
      },
    });
    const result = await buildSharePreview(
      fixture.db,
      'fixture-owner',
      selection,
    );
    expect(
      result.snapshot.gasPlan?.inputs.find((row) => row.key === 'plannedDepthM')
        ?.value,
    ).toBe(20);
    expect(result.snapshot.gasPlan?.supplies[0]).toMatchObject({
      label: 'Supply 1',
      role: 'sidemount-left',
      currentPressureBar: 150,
      plannedStartPressureBar: 200,
      status: 'BLOCKED',
      requiredLitres: 1900,
    });
    expect(
      result.snapshot.gasPlan?.outputs.find((row) => row.key === 'ndlMinutes')
        ?.value,
    ).toBe(45);
    expect(result.snapshot.gasPlan?.notice).toContain(
      'not independent safety verification',
    );
    expect(JSON.stringify(result.snapshot)).not.toMatch(
      /PRIVATE-|"Ready"|canonicalId|snapshotId|teamIds|notes/,
    );
    expect(fixture.records()).toEqual(before);
  });
  it('keeps absent saved outputs unavailable and never calls a protected calculation engine', async () => {
    fixture.add('legacy', 'gas-plan', {
      plannedDepthM: 18,
      cylinders: [],
      notes: 'Hidden',
    });
    const result = await buildSharePreview(
      fixture.db,
      'fixture-owner',
      validateShareInput({
        version: 1,
        kind: 'gas-plan',
        label: 'Legacy',
        expiresAt: null,
        attachmentIds: [],
        gasPlan: {
          recordId: 'legacy',
          inputs: false,
          supplies: false,
          outputs: true,
        },
      }),
    );
    expect(result.snapshot.gasPlan?.outputs).toEqual([]);
    expect(result.snapshot.gasPlan?.notice).toContain('unavailable');
  });
  it('preserves selected contingency failures and explicit allowance basis instead of hiding them behind normal supply totals', async () => {
    fixture.add('scenario-plan', 'gas-plan', {
      allocationV1: {
        version: 'zeustek-allocation/1',
        cylinders: [
          {
            id: 'private-supply',
            role: 'main',
            gas: { oxygen: 0.21, helium: 0 },
            waterVolumeL: 12,
          },
        ],
        scenarios: [
          {
            id: 'private-scenario',
            label: 'Private trip failure',
            selected: true,
            at: 'start',
            failedSupplyIds: [],
            advanced: {
              enabled: true,
              version: 1,
              factor: 1.2,
              basis: 'route-consumption-excluding-reserve',
            },
          },
        ],
        assessment: {
          physiologicalStatus: 'BLOCKED',
          allocation: {
            cylinders: [
              {
                id: 'private-supply',
                status: 'PASS',
                availableLitres: 1000,
                requiredLitres: 900,
              },
            ],
            scenarios: [
              {
                id: 'private-scenario',
                selected: true,
                status: 'BLOCKED',
                factor: 1.2,
                basis:
                  'Remaining route consumption, including its explicit segment stress/buddy inputs, plus separately assigned unchanged frozen-engine reserve.',
                cylinders: [
                  {
                    id: 'private-supply',
                    status: 'BLOCKED',
                    availableLitres: 1000,
                    requiredLitres: 1200,
                    reserveLitres: 800,
                  },
                ],
              },
            ],
          },
        },
      },
    });
    const result = await buildSharePreview(
      fixture.db,
      'fixture-owner',
      validateShareInput({
        version: 1,
        kind: 'gas-plan',
        label: 'Contingency evidence',
        expiresAt: null,
        attachmentIds: [],
        gasPlan: {
          recordId: 'scenario-plan',
          inputs: false,
          supplies: true,
          outputs: true,
        },
      }),
    );
    expect(result.snapshot.gasPlan).toMatchObject({
      physiologicalStatus: 'BLOCKED',
      scenarios: [
        {
          label: 'Contingency 1',
          kind: 'contingency/bailout',
          status: 'BLOCKED',
          factor: 1.2,
          cylinders: [
            { label: 'Supply 1', status: 'BLOCKED', requiredLitres: 1200 },
          ],
        },
      ],
    });
    expect(JSON.stringify(result.snapshot)).not.toMatch(
      /private-supply|private-scenario|Private trip/,
    );
    expect(result.snapshot.gasPlan?.scenarios[0]?.basis).toContain(
      'unchanged frozen-engine reserve',
    );
  });
  it('rejects unknown and nested publication fields by default, including future schema additions', () => {
    for (const patch of [
      { email: 'private' },
      { profile: { ...input().profile, medicalData: 'private' } },
      { attachmentIds: ['private/r2/key'] },
      {
        gasPlan: {
          recordId: 'p',
          inputs: true,
          supplies: true,
          outputs: true,
          notes: true,
        },
      },
    ])
      expect(() => validateShareInput({ ...input(), ...patch })).toThrow();
    expect(() =>
      validateSharedSnapshot({
        version: 1,
        kind: 'profile',
        label: 'X',
        asOf: '2026-10-03T00:00:00Z',
        source: 'Owner-selected canonical evidence',
        expiresAt: null,
        attachments: [],
        profile: {
          displayName: 'X',
          insights: [],
          certifications: [],
          training: [],
          email: 'private',
        },
      }),
    ).toThrow();
  });
});
