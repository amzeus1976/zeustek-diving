import { describe, expect, it } from 'vitest';
import { flightProximity, previousDiveContext } from '../lib/offline/plan-context-checks';

describe('T12.5 repetitive dive evidence', () => {
  const dives = [
    { entityId: 'old', date: '2026-09-16', timeIn: '09:00', timeOut: '09:40', site: 'Old Site', postPressureGroup: 'B', pressureGroupDataset: 'PADI RDP owner record' },
    { entityId: 'same-day', date: '2026-09-17', timeIn: '09:00', timeOut: '09:35', site: 'Reef', postPressureGroup: 'D', pressureGroupDataset: 'PADI RDP 2024', surfaceIntervalMin: 85 },
  ];
  it('shows an earlier same-day recorded group with provenance but does not compute a new one', () => {
    const result = previousDiveContext({ startDate: '2026-09-17', startAt: '2026-09-17T13:00', diveNumberOfDay: 2 }, dives as never);
    expect(result.diveId).toBe('same-day');
    expect(result.pressureGroup).toBe('D');
    expect(result.dataset).toBe('PADI RDP 2024');
    expect(result.surfaceIntervalMin).toBe(205);
    expect(result.warning).toMatch(/historical evidence only/);
  });
  it('leaves pressure group unknown when the earlier log has no group', () => {
    const result = previousDiveContext({ startDate: '2026-09-17', startAt: '2026-09-17T13:00', diveNumberOfDay: 2 }, [{ ...dives[1]!, postPressureGroup: '' }] as never);
    expect(result.pressureGroup).toBeNull();
    expect(result.warning).toMatch(/Do not infer/);
  });
  it('warns when the plan says first dive but same-day logs exist', () => {
    const result = previousDiveContext({ startDate: '2026-09-17', startAt: '2026-09-17T13:00', diveNumberOfDay: 1 }, dives as never);
    expect(result.pressureGroup).toBeNull();
    expect(result.warning).toMatch(/same-day Logbook/);
  });
  it('does not guess the previous dive when planned or logged exit time is absent', () => {
    expect(previousDiveContext({ startDate: '2026-09-17', startAt: '', diveNumberOfDay: 2 }, dives as never).warning).toMatch(/Cannot determine/);
    expect(previousDiveContext({ startDate: '2026-09-17', startAt: '2026-09-17T13:00', diveNumberOfDay: 2 }, [{ ...dives[1], timeOut: '' }] as never).pressureGroup).toBeNull();
  });
});

describe('T12.5 linked Trip flight advisory', () => {
  const trip = { itinerary: [{ id: 'flight-1', kind: 'travel', travelMode: 'flight', title: 'Home flight', startsAt: '2026-09-18T10:00' }] } as never;
  it('flags a flight inside 24 hours after the estimated dive end', () => {
    const result = flightProximity({ startDate: '2026-09-17', startAt: '2026-09-17T13:00', maxTotalDurationMin: 60 }, trip);
    expect(result.state).toBe('within-24h');
    expect(result.hoursAfterDive).toBe(20);
    expect(result.warning).toMatch(/24-hour/);
  });
  it('does not claim clearance when dive time is missing', () => {
    expect(flightProximity({ startDate: '2026-09-17', startAt: '', maxTotalDurationMin: 60 }, trip).state).toBe('unknown-timing');
  });
  it('does not flag a recorded flight outside the 24-hour window as inside', () => {
    expect(flightProximity({ startDate: '2026-09-16', startAt: '2026-09-16T13:00', maxTotalDurationMin: 60 }, trip).state).toBe('outside-24h');
  });
  it('recognises a legacy free-text flight but labels its provenance as inferred', () => {
    const result = flightProximity({ startDate: '2026-09-17', startAt: '2026-09-17T13:00', maxTotalDurationMin: 60 }, { itinerary: [{ id: 'legacy', kind: 'travel', title: 'Flight home', startsAt: '2026-09-18T10:00' }] } as never);
    expect(result.state).toBe('within-24h');
    expect(result.provenance).toMatch(/inferred/);
  });
});
