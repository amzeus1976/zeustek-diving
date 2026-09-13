import { describe, expect, it } from 'vitest';
import { sameTripFingerprint, tripReadiness, type DiveExpeditionTripRecord } from '../lib/offline/trips-expeditions';

const base = (overrides: Partial<DiveExpeditionTripRecord> = {}): DiveExpeditionTripRecord => ({
  name: 'Farne Islands weekend',
  destination: 'Northumberland',
  startsOn: '2026-10-09',
  endsOn: '2026-10-11',
  status: 'planned',
  organiserPersonId: '',
  teamPersonIds: [],
  siteIds: [],
  planIds: [],
  accommodation: '',
  itinerary: [],
  bookings: [],
  packingEquipmentSetIds: [],
  packingItems: [],
  gasLogistics: [],
  documentAttachmentIds: [],
  emergencyNotes: '',
  insuranceNotes: '',
  medicalNotes: '',
  notes: '',
  createdAt: '2026-09-13T18:00:00.000Z',
  modifiedAt: '2026-09-13T18:00:00.000Z',
  ...overrides,
});

describe('T04 trip readiness', () => {
  it('is derived rather than requiring every optional logistics field', () => {
    const result = tripReadiness(base({
      teamPersonIds: ['person-1'],
      siteIds: ['site-1'],
      itinerary: [{ id: 'leg-1', kind: 'travel', title: 'Drive to Seahouses' }],
      packingEquipmentSetIds: ['set-1'],
      emergencyNotes: 'Nearest chamber recorded in trip notes.',
    }));
    expect(result.percent).toBeGreaterThanOrEqual(80);
    expect(result.checks.find((check) => check.id === 'diving')?.complete).toBe(true);
  });

  it('does not report valid dates when the end is before the start', () => {
    const result = tripReadiness(base({ startsOn: '2026-10-11', endsOn: '2026-10-09' }));
    expect(result.checks.find((check) => check.id === 'dates')?.complete).toBe(false);
  });

  it('treats readiness as advisory when optional logistics are absent', () => {
    const result = tripReadiness(base());
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
  });
});

describe('T04 conservative duplicate hint', () => {
  it('matches normalized name/destination and exact date range', () => {
    expect(sameTripFingerprint(
      base(),
      base({ name: '  FARNE   ISLANDS WEEKEND ', destination: ' northumberland ' }),
    )).toBe(true);
  });

  it('does not collapse different date ranges', () => {
    expect(sameTripFingerprint(base(), base({ startsOn: '2026-10-16', endsOn: '2026-10-18' }))).toBe(false);
  });

  it('does not create a server identity rule for trips that may legitimately look similar', () => {
    expect(sameTripFingerprint(base(), base({ destination: 'Eyemouth' }))).toBe(false);
  });
});
