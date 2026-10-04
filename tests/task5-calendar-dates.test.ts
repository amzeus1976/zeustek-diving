import { describe, expect, it } from 'vitest';
import { addCalendarDays, calendarMonthRange, calendarUtcStamp, validCalendarDay, resolveCalendarDateTime } from '../lib/calendar/calendar-dates';

describe('calendar date provenance and timezone conversion', () => {
  it('rejects impossible dates instead of normalising them', () => {
    expect(validCalendarDay('2026-02-30')).toBe(false);
    expect(validCalendarDay('2024-02-29')).toBe(true);
    expect(validCalendarDay('2026-2-03')).toBe(false);
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('preserves a due month as a whole month, including leap February', () => {
    expect(calendarMonthRange('2024-02')).toEqual({ start: '2024-02-01', end: '2024-03-01' });
    expect(calendarMonthRange('2026-13')).toBeNull();
  });
  it('converts explicit offset timestamps independently of the export timezone', () => {
    expect(resolveCalendarDateTime('2026-07-01T10:15:00+02:00', 'Europe/London')).toMatchObject({ kind: 'resolved', value: '20260701T081500Z' });
    expect(resolveCalendarDateTime('2026-02-30T10:15:00Z', 'Europe/London').kind).toBe('invalid');
  });
  it('resolves London winter and summer correctly without the host timezone', () => {
    expect(resolveCalendarDateTime('2026-01-01T10:15', 'Europe/London')).toMatchObject({ kind: 'resolved', value: '20260101T101500Z' });
    expect(resolveCalendarDateTime('2026-07-01T10:15', 'Europe/London')).toMatchObject({ kind: 'resolved', value: '20260701T091500Z' });
  });
  it('leaves the spring gap unavailable and requires an explicit autumn occurrence', () => {
    expect(resolveCalendarDateTime('2026-03-29T01:30', 'Europe/London').kind).toBe('gap');
    expect(resolveCalendarDateTime('2026-10-25T01:30', 'Europe/London').kind).toBe('fold');
    expect(resolveCalendarDateTime('2026-10-25T01:30', 'Europe/London', 'earlier')).toMatchObject({ kind: 'resolved', value: '20261025T003000Z' });
    expect(resolveCalendarDateTime('2026-10-25T01:30', 'Europe/London', 'later')).toMatchObject({ kind: 'resolved', value: '20261025T013000Z' });
  });
  it('handles another timezone and invalid names without guessing', () => {
    expect(resolveCalendarDateTime('2026-07-01T10:15', 'Asia/Kolkata')).toMatchObject({ kind: 'resolved', value: '20260701T044500Z' });
    expect(resolveCalendarDateTime('2026-07-01T24:15', 'Europe/London').kind).toBe('invalid');
    expect(resolveCalendarDateTime('2026-07-01T10:15', 'Invalid/Zone').kind).toBe('invalid');
  });
  it('does not invent update timestamps from loose, date-only or impossible source metadata', () => {
    expect(calendarUtcStamp('2026-10-01')).toBeNull();
    expect(calendarUtcStamp('01/10/2026')).toBeNull();
    expect(calendarUtcStamp('2026-02-30T12:00:00Z')).toBeNull();
    expect(calendarUtcStamp('2026-10-01T12:00:00+01:00')).toBe('20261001T110000Z');
  });
});
