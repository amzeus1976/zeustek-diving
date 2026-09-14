import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tripReadiness, type DiveExpeditionTripRecord } from '../lib/offline/trips-expeditions';

const read = (path: string) => readFileSync(path, 'utf8');

const base = (overrides: Partial<DiveExpeditionTripRecord> = {}): DiveExpeditionTripRecord => ({
  name: 'Farne Islands weekend',
  destination: 'Northumberland',
  startsOn: '2026-10-09',
  endsOn: '2026-10-11',
  status: 'planned',
  organiserPersonId: '',
  organiserUserId: '',
  teamPersonIds: [],
  guestParticipants: [],
  siteIds: ['site-1'],
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
  createdAt: '2026-09-13T22:00:00.000Z',
  modifiedAt: '2026-09-13T22:00:00.000Z',
  ...overrides,
});

describe('Trip owner steering snags', () => {
  it('treats a non-diving guest as a recorded participant for readiness', () => {
    const result = tripReadiness(base({
      guestParticipants: [{ id: 'guest-1', name: 'Alex Brown', role: 'family-guest', notes: '' }],
    }));
    expect(result.checks.find((check) => check.id === 'team')?.complete).toBe(true);
  });

  it('keeps the signed-in account separate from diver People when selecting an organiser', () => {
    const source = read('components/trips-expeditions.tsx');
    expect(source).toContain("import { currentDiveAccount } from '../lib/offline/dive-store'");
    expect(source).toContain("kind:'account' as const,id:currentUserId");
    expect(source).toContain('tripOrganiserReferences(selection)');
    expect(source).toContain('Me (this account)');
    expect(source).toContain("organiserPersonId: ''");
  });

  it('supports first-class non-diving participants without changing PersonRecord roles', () => {
    const source = read('components/trips-expeditions.tsx');
    const planning = read('lib/offline/dive-planning.ts');
    expect(source).toContain('Non-diving participants');
    expect(source).toContain('Add non-diver');
    expect(source).toContain("['family-guest', 'Family / guest']");
    expect(planning).toContain("role: 'buddy' | 'instructor' | 'both'");
  });

  it('offers non-dive itinerary event types including excursions and rest', () => {
    const source = read('components/trips-expeditions.tsx');
    const model = read('lib/offline/trips-expeditions.ts');
    expect(source).toContain("['activity', 'Activity / excursion']");
    expect(source).toContain("['meal', 'Meal']");
    expect(source).toContain("['rest', 'Rest / free time']");
    expect(source).toContain("['training', 'Training']");
    expect(source).toContain("['meeting', 'Meeting']");
    expect(source).toContain('Desert camel safari');
    expect(model).toContain("| 'activity'");
  });

  it('uses tablet-safe selector layout instead of anywhere character breaking', () => {
    const css = read('components/trips-expeditions.module.css');
    expect(css).toContain('@media (max-width: 1100px)');
    expect(css).toContain('.choiceGrid { grid-template-columns: 1fr; }');
    expect(css).toContain('word-break: normal');
    expect(css).toContain("grid-template-columns: auto minmax(0, 1fr)");
    expect(css).not.toContain('overflow-wrap: anywhere');
    expect(css).not.toContain('.detail, .editor { box-sizing: border-box; overflow-wrap: anywhere; }');
  });
});
