import { describe, expect, it } from 'vitest';
import { buildCalendarPreview, DEFAULT_CALENDAR_OPTIONS, type CalendarSourceSnapshot } from '../lib/calendar/calendar-model';

const record = (kind: string, id: string, data: Record<string, unknown>) => ({ kind, id, data, createdAt: '2026-01-01T00:00:00Z', modifiedAt: '2026-10-01T12:00:00Z' });
const snapshot = (records: CalendarSourceSnapshot['records'], completeKinds = ['trip', 'dive-trip', 'equipment', 'cylinder', 'certification', 'person']): CalendarSourceSnapshot => ({ accountId: 'fixture-owner', snapshotAt: '2026-10-02T12:00:00Z', completeKinds, records });

describe('selected canonical calendar projection', () => {
  it('exports both planning bookings and independent expeditions without copying private fields', async () => {
    const source = snapshot([
      record('trip', 'plan-private', { name: 'Private plan title', startDate: '2026-10-10', endDate: '2026-10-11', siteName: 'Private site', buddy: 'Secret person', notes: 'Private notes', bookingStatus: 'confirmed' }),
      record('dive-trip', 'trip-private', { name: 'Private expedition', destination: 'Private destination', startsOn: '2026-10-12', endsOn: '2026-10-15', status: 'confirmed', medicalNotes: 'Secret medical', itinerary: [{ id: 'flight-private', title: 'Private flight', startsAt: '2026-10-12T10:00', endsAt: '2026-10-12T12:00', bookingRef: 'SECRET-REF' }], bookings: [{ id: 'payment-private', dueOn: '2026-10-05', provider: 'Private provider', amount: 123, reference: 'SECRET-BOOKING' }] }),
    ]);
    const before = structuredClone(source);
    const preview = await buildCalendarPreview(source, DEFAULT_CALENDAR_OPTIONS);
    expect(preview.events.map(event => event.category).sort()).toEqual(['booking-deadlines', 'bookings', 'itinerary', 'trips']);
    expect(preview.events.find(event => event.category === 'bookings')).toMatchObject({ summary: 'Diving booking', start: { type: 'date', value: '20261010' }, end: { type: 'date', value: '20261012' } });
    expect(preview.events.find(event => event.category === 'trips')).toMatchObject({ end: { type: 'date', value: '20261016' } });
    expect(preview.events.find(event => event.category === 'itinerary')).toMatchObject({ start: { type: 'date-time', value: '20261012T090000Z' } });
    for (const event of preview.events) expect(JSON.stringify(event)).not.toMatch(/Private|Secret|SECRET|amount|medical|buddy|notes/);
    expect(source).toEqual(before);
  });
  it('opts title, location and private source URLs in only when selected', async () => {
    const source = snapshot([record('trip', 'id with & punctuation', { name: 'Chosen title', siteName: 'Chosen location', startDate: '2026-10-10' })]);
    const minimal = await buildCalendarPreview(source, DEFAULT_CALENDAR_OPTIONS);
    expect(minimal.events[0]).not.toHaveProperty('location');
    expect(minimal.events[0]).not.toHaveProperty('url');
    const selected = await buildCalendarPreview(source, { ...DEFAULT_CALENDAR_OPTIONS, fields: { title: true, location: true, sourceLink: true }, sourceOrigin: 'https://fixture.example' });
    expect(selected.events[0]).toMatchObject({ summary: 'Chosen title', location: 'Chosen location' });
    expect(selected.events[0]?.url).toContain('recordId=id+with+%26+punctuation');
    expect(selected.events[0]?.url).toMatch(/^https:\/\/fixture\.example\//);
  });
  it('withholds exported source URLs until a safe explicit application origin is available', async () => {
    const source = snapshot([record('trip', 'one', { startDate: '2026-10-10' })]);
    for (const sourceOrigin of [undefined, 'javascript:alert(1)', 'https://user:secret@fixture.example', 'http://untrusted.example']) {
      const preview = await buildCalendarPreview(source, { ...DEFAULT_CALENDAR_OPTIONS, fields: { sourceLink: true }, ...(sourceOrigin ? { sourceOrigin } : {}) });
      expect(preview.events[0]).not.toHaveProperty('url');
    }
  });
  it('keeps an opaque stable UID across title/date edits and gives child events separate identities', async () => {
    const a = await buildCalendarPreview(snapshot([record('dive-trip', 'private-trip-id', { startsOn: '2026-10-10', itinerary: [{ id: 'child-id', startsAt: '2026-10-10T12:00' }] })]), DEFAULT_CALENDAR_OPTIONS);
    const b = await buildCalendarPreview(snapshot([record('dive-trip', 'private-trip-id', { name: 'Edited', startsOn: '2026-10-11', itinerary: [{ id: 'child-id', startsAt: '2026-10-11T12:00' }] })]), DEFAULT_CALENDAR_OPTIONS);
    expect(a.events.map(event => event.uid).sort()).toEqual(b.events.map(event => event.uid).sort());
    expect(new Set(a.events.map(event => event.uid)).size).toBe(2);
    expect(a.events[0]?.uid).toMatch(/^ztek-[0-9a-f]{64}@calendar\.zeustek$/);
    expect(a.events[0]?.uid).not.toContain('private-trip-id');
  });
  it('allows none categories and none records independently', async () => {
    const source = snapshot([record('trip', 'one', { startDate: '2026-10-10' })]);
    expect((await buildCalendarPreview(source, { ...DEFAULT_CALENDAR_OPTIONS, categories: [] })).events).toEqual([]);
    expect((await buildCalendarPreview(source, { ...DEFAULT_CALENDAR_OPTIONS, selectedEventKeys: [] })).events).toEqual([]);
    const all = await buildCalendarPreview(source, DEFAULT_CALENDAR_OPTIONS);
    expect((await buildCalendarPreview(source, { ...DEFAULT_CALENDAR_OPTIONS, selectedEventKeys: [all.events[0]!.uid] })).events).toHaveLength(1);
  });
  it('omits invalid/reversed/undated records with review explanations', async () => {
    const preview = await buildCalendarPreview(snapshot([
      record('trip', 'impossible', { startDate: '2026-02-30' }), record('trip', 'reverse', { startDate: '2026-10-10', endDate: '2026-10-09' }), record('trip', 'undated', {}),
    ]), DEFAULT_CALENDAR_OPTIONS);
    expect(preview.events).toHaveLength(0);
    expect(preview.omissions.map(row => row.code).sort()).toEqual(['invalid-date', 'missing-date', 'reversed-date']);
  });
  it('keeps a timed start without inventing an end and flags date/time conflicts', async () => {
    const preview = await buildCalendarPreview(snapshot([
      record('trip', 'start-only', { startDate: '2026-10-10', startAt: '2026-10-10T10:00' }),
      record('trip', 'conflict', { startDate: '2026-10-10', startAt: '2026-10-11T10:00' }),
    ]), DEFAULT_CALENDAR_OPTIONS);
    expect(preview.events).toHaveLength(1);
    expect(preview.events[0]).not.toHaveProperty('end');
    expect(preview.omissions[0]?.code).toBe('conflicting-date');
  });
  it('keeps cancellations with their old UID only when explicitly selected', async () => {
    const active = await buildCalendarPreview(snapshot([record('trip', 'same', { startDate: '2026-10-10', bookingStatus: 'confirmed' })]), DEFAULT_CALENDAR_OPTIONS);
    const cancelledSource = snapshot([record('trip', 'same', { startDate: '2026-10-10', bookingStatus: 'cancelled' })]);
    expect((await buildCalendarPreview(cancelledSource, DEFAULT_CALENDAR_OPTIONS)).events).toHaveLength(0);
    const cancelled = await buildCalendarPreview(cancelledSource, { ...DEFAULT_CALENDAR_OPTIONS, includeCancelled: true });
    expect(cancelled.events[0]).toMatchObject({ uid: active.events[0]?.uid, status: 'CANCELLED' });
  });
  it('omits paid deadlines and completed history until selected', async () => {
    const source = snapshot([record('dive-trip', 'past', { startsOn: '2026-01-01', status: 'completed', bookings: [{ id: 'paid', paid: true, dueOn: '2026-01-01' }] })]);
    expect((await buildCalendarPreview(source, DEFAULT_CALENDAR_OPTIONS)).events).toHaveLength(0);
    const result = await buildCalendarPreview(source, { ...DEFAULT_CALENDAR_OPTIONS, includeHistory: true, includePaid: true });
    expect(result.events).toHaveLength(2);
    expect(result.events.some(event => event.status as string === 'COMPLETED')).toBe(false);
  });
  it('requires export-draft resolution for a repeated local time', async () => {
    const source = snapshot([record('trip', 'fold', { startDate: '2026-10-25', startAt: '2026-10-25T01:30' })]);
    const unresolved = await buildCalendarPreview(source, DEFAULT_CALENDAR_OPTIONS);
    expect(unresolved.events).toEqual([]);
    expect(unresolved.omissions[0]).toMatchObject({ code: 'ambiguous-time' });
    const key = unresolved.omissions[0]!.resolutionKey!;
    const resolved = await buildCalendarPreview(source, { ...DEFAULT_CALENDAR_OPTIONS, foldChoices: { [key]: 'later' } });
    expect(resolved.events[0]).toMatchObject({ start: { value: '20261025T013000Z' } });
  });
  it('exports equipment service evidence without turning a use threshold into a date', async () => {
    const preview = await buildCalendarPreview(snapshot([
      record('equipment', 'explicit', { nextServiceAt: '2026-10-10', serviceRequired: true }),
      record('equipment', 'derived', { lastServiceAt: '2025-10-15', serviceIntervalMonths: 12, serviceRequired: true }),
      record('equipment', 'use-only', { serviceIntervalDives: 100, serviceRequired: true }),
      record('equipment', 'retired', { nextServiceAt: '2026-10-10', retired: true }),
    ]), DEFAULT_CALENDAR_OPTIONS);
    expect(preview.events).toHaveLength(2);
    expect(preview.events.find(event => event.start.value === '20261015')?.description).toContain('service baseline');
    expect(preview.omissions.some(row => row.code === 'missing-date')).toBe(true);
  });
  it('preserves cylinder month precision and separates legacy and canonical storage', async () => {
    const preview = await buildCalendarPreview(snapshot([
      record('cylinder', 'tank', { hydroTestAt: '2021-10', visualTestAt: '2024-04' }),
      record('equipment', 'legacy', { category: 'Cylinder', name: 'Legacy', hydroDueAt: '2026-11-20', visualDueAt: '2026-12' }),
      record('cylinder', 'unknown', { hydroTestAt: '2021-13' }),
    ]), { ...DEFAULT_CALENDAR_OPTIONS, categories: ['cylinder-inspection'] });
    expect(preview.events).toHaveLength(4);
    const month = preview.events.find(event => event.start.value === '20261001')!;
    expect(month).toMatchObject({ precision: 'month', transparent: true, end: { value: '20261101' } });
    expect(month.summary).toContain('month');
    expect(month.description).toContain('exact day unknown');
    expect(preview.events.find(event => event.start.value === '20261120')).toMatchObject({ precision: 'day', end: { value: '20261121' } });
    expect(preview.omissions.filter(row => row.code === 'missing-date')).toHaveLength(2);
  });
  it('retains a separate recorded servicing date on cylinder equipment', async () => {
    const preview = await buildCalendarPreview(snapshot([
      record('equipment', 'legacy', { category: 'Cylinder', nextServiceAt: '2026-11-10', serviceRequired: true }),
      record('cylinder', 'canonical', { nextServiceAt: '2026-11-11', serviceRequired: true }),
    ]), { ...DEFAULT_CALENDAR_OPTIONS, categories: ['equipment-service'] });
    expect(preview.events.map(event => event.start.value).sort()).toEqual(['20261110', '20261111']);
  });
  it('never uses another Person’s certification or shared foreign gear', async () => {
    const source = snapshot([
      record('person', 'me', { roles: { ownerProfile: true } }),
      record('certification', 'mine', { personId: 'me', expiresAt: '2026-11-10', certificationNumber: 'SECRET-NUMBER' }),
      record('certification', 'legacy', { expiresAt: '2026-11-11' }),
      record('certification', 'other', { personId: 'someone-else', expiresAt: '2026-11-12' }),
      record('equipment', 'foreign', { householdOwnerId: 'other-account', nextServiceAt: '2026-11-13' }),
    ]);
    expect((await buildCalendarPreview(source, DEFAULT_CALENDAR_OPTIONS)).events.map(event => event.start.value).sort()).toEqual(['20261110', '20261111']);
  });
  it('marks incomplete snapshot coverage unknown instead of claiming a complete empty export', async () => {
    const preview = await buildCalendarPreview(snapshot([], ['trip']), DEFAULT_CALENDAR_OPTIONS);
    expect(preview.coverageUnknown).toBe(true);
    expect(preview.omissions.some(row => row.code === 'coverage-unknown')).toBe(true);
  });
  it('explains malformed itinerary identity rather than assigning an array-index UID', async () => {
    const preview = await buildCalendarPreview(snapshot([record('dive-trip', 'parent', { itinerary: [{ startsAt: '2026-10-10T10:00' }, { id: 'duplicate', startsAt: '2026-10-10T10:00' }, { id: 'duplicate', startsAt: '2026-10-10T11:00' }] })]), { ...DEFAULT_CALENDAR_OPTIONS, categories: ['itinerary'] });
    expect(preview.events).toHaveLength(0);
    expect(preview.omissions).toHaveLength(3);
    expect(preview.omissions.every(row => row.code === 'invalid-identity')).toBe(true);
  });
  it('separates identical canonical IDs belonging to different owner accounts', async () => {
    const first = snapshot([record('trip', 'same-id', { startDate: '2026-10-10' })]);
    const a = await buildCalendarPreview(first, DEFAULT_CALENDAR_OPTIONS);
    const b = await buildCalendarPreview({ ...first, accountId: 'different-fixture-owner' }, DEFAULT_CALENDAR_OPTIONS);
    expect(a.events[0]?.uid).not.toBe(b.events[0]?.uid);
  });
  it('reviews canonical cylinders in Cylinders & Gas and legacy cylinders in Equipment', async () => {
    const preview = await buildCalendarPreview(snapshot([
      record('cylinder', 'canonical-cylinder', { hydroDueAt: '2026-11' }),
      record('equipment', 'legacy-cylinder', { category: 'Cylinder', hydroDueAt: '2026-12' }),
    ]), { ...DEFAULT_CALENDAR_OPTIONS, categories: ['cylinder-inspection'] });
    const canonical = new URLSearchParams(preview.events.find(event => event.source.kind === 'cylinder')!.reviewDestination.slice(1));
    expect(canonical.get('section')).toBe('Cylinders & Gas');
    expect(canonical.get('cylinderId')).toBe('canonical-cylinder');
    const legacy = new URLSearchParams(preview.events.find(event => event.source.kind === 'equipment')!.reviewDestination.slice(1));
    expect(legacy.get('section')).toBe('Equipment');
    expect(legacy.get('equipmentId')).toBe('legacy-cylinder');
  });
  it('bounds nested itinerary scans and marks remaining coverage unknown', async () => {
    const preview = await buildCalendarPreview(snapshot([record('dive-trip', 'large', { itinerary: Array.from({ length: 2100 }, (_, i) => ({ id: `leg-${i}`, startsAt: '2026-10-10T12:00' })) })]), { ...DEFAULT_CALENDAR_OPTIONS, categories: ['itinerary'] });
    expect(preview.events).toHaveLength(2000);
    expect(preview.coverageUnknown).toBe(true);
    expect(preview.omissions.some(row => row.code === 'scan-limit')).toBe(true);
  });
});
