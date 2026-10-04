import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DivingCalendarBookings, requestedCalendarEventId, selectCalendarBooking } from '../components/planning/diving-calendar-bookings';

const rows = [{ entityId: 'first', name: 'First visible event' }, { entityId: 'old-event', name: 'Archived requested event' }];
afterEach(() => vi.unstubAllGlobals());

describe('exact read-only Calendar source selection', () => {
  it('receives either exact eventId or generic recordId and preserves encoded IDs', () => {
    expect(requestedCalendarEventId('?section=Diving+Calendar+%26+Bookings&eventId=old-event')).toBe('old-event');
    expect(requestedCalendarEventId('?recordId=id+with+%26+punctuation')).toBe('id with & punctuation');
    expect(requestedCalendarEventId('?eventId=domain-id&recordId=other-id')).toBe('domain-id');
    expect(requestedCalendarEventId('?section=Diving+Calendar+%26+Bookings')).toBeNull();
  });
  it('selects the exact source outside the upcoming or filtered event list without changing records', () => {
    const before = structuredClone(rows);
    expect(selectCalendarBooking(rows, rows.slice(0, 1), 'old-event')).toBe(rows[1]);
    expect(rows).toEqual(before);
  });
  it('never substitutes a first visible event for an explicit missing or empty identity', () => {
    expect(selectCalendarBooking(rows, rows.slice(0, 1), 'missing')).toBeNull();
    expect(requestedCalendarEventId('?eventId=&recordId=first')).toBe('');
    expect(selectCalendarBooking(rows, rows, '')).toBeNull();
    expect(selectCalendarBooking([], rows, 'first')).toBeNull();
  });
  it('keeps ordinary Calendar browsing available when no exact source was requested', () => {
    expect(selectCalendarBooking(rows, rows.slice(0, 1), null)).toBe(rows[0]);
    expect(selectCalendarBooking(rows, [], null)).toBeNull();
  });
  it('opens the read-only source receiver without turning an edit parameter into an editor', () => {
    vi.stubGlobal('window', { location: { search: '?eventId=missing&edit=true' } });
    const html = renderToStaticMarkup(createElement(DivingCalendarBookings, {}));
    expect(html).toContain('Loading linked event');
    expect(html).toContain('No other event has been selected');
    expect(html).not.toContain('Save event');
    expect(html).not.toContain('Edit calendar event');
  });
});
