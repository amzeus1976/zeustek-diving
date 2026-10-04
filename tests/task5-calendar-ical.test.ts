import { describe, expect, it } from 'vitest';
import { buildCalendarPreview, DEFAULT_CALENDAR_OPTIONS, type CalendarSourceSnapshot } from '../lib/calendar/calendar-model';
import { escapeCalendarText, foldCalendarLine, renderCalendar } from '../lib/calendar/calendar-ical';
import { prepareCalendarDownload, type CalendarRevisionManifest } from '../lib/calendar/calendar-revisions';

const source = (data: Record<string, unknown>): CalendarSourceSnapshot => ({ accountId: 'fixture-account-private', snapshotAt: '2026-10-02T12:00:00Z', completeKinds: ['trip'], records: [{ kind: 'trip', id: 'canonical-private-id', data: { startDate: '2026-10-10', ...data }, modifiedAt: '2026-10-01T12:00:00Z' }] });
const options = { ...DEFAULT_CALENDAR_OPTIONS, categories: ['bookings'] as const };

describe('private RFC calendar download and change management', () => {
  it('encodes text as text instead of permitting calendar property injection', () => {
    expect(escapeCalendarText('A\\B,C;D\r\nBEGIN:VEVENT')).toBe('A\\\\B\\,C\\;D\\nBEGIN:VEVENT');
    expect(escapeCalendarText('safe\u0000text')).toBe('safetext');
  });
  it('folds at UTF-8 octets and round-trips multilingual text without splitting characters', () => {
    const line = 'SUMMARY:' + '🌊日本語 Ελληνικά '.repeat(12);
    const folded = foldCalendarLine(line);
    for (const physical of folded.split('\r\n')) expect(new TextEncoder().encode(physical).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
    expect(new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(folded))).toBe(folded);
  });
  it('renders only selected calendar DTO fields, with CRLF and a final complete event', async () => {
    const preview = await buildCalendarPreview(source({ name: 'Private name', notes: 'SECRET', buddy: 'Private buddy', serialNumber: 'SECRET-SERIAL' }), options);
    const download = await prepareCalendarDownload(preview, undefined, '2026-10-02T12:00:00Z');
    expect(download.content).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n');
    expect(download.content).toContain('DTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20261011\r\n');
    expect(download.content).toContain('LAST-MODIFIED:20261001T120000Z');
    expect(download.content).toContain('CLASS:PRIVATE');
    expect(download.content).toContain('TRANSP:TRANSPARENT');
    expect(download.content).toContain('SEQUENCE:0');
    expect(download.content.endsWith('END:VEVENT\r\nEND:VCALENDAR\r\n')).toBe(true);
    expect(download.content).not.toMatch(/Private|SECRET|canonical-private-id|fixture-account-private|ATTENDEE|ORGANIZER|VALARM|ATTACH/);
    expect(download.content.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(JSON.stringify(download.manifest)).not.toMatch(/canonical-private-id|fixture-account-private|Private|SECRET/);
  });
  it('keeps unchanged projection sequences stable and increments on date, selected title and cancellation edits', async () => {
    const first = await prepareCalendarDownload(await buildCalendarPreview(source({ name: 'First', bookingStatus: 'confirmed' }), options), undefined, '2026-10-02T12:00:00Z');
    const repeated = await prepareCalendarDownload(await buildCalendarPreview(source({ name: 'Second', bookingStatus: 'confirmed' }), options), first.manifest, '2026-10-03T12:00:00Z');
    expect(repeated.content).toContain('SEQUENCE:0');
    const edited = await prepareCalendarDownload(await buildCalendarPreview(source({ startDate: '2026-10-11', name: 'Second', bookingStatus: 'confirmed' }), { ...options, fields: { title: true } }), repeated.manifest, '2026-10-03T12:00:00Z');
    expect(edited.content).toContain('SEQUENCE:1');
    const cancelled = await prepareCalendarDownload(await buildCalendarPreview(source({ startDate: '2026-10-11', name: 'Second', bookingStatus: 'cancelled' }), { ...options, fields: { title: true }, includeCancelled: true }), edited.manifest, '2026-10-04T12:00:00Z');
    expect(cancelled.content).toContain('SEQUENCE:2');
    expect(cancelled.content).toContain('STATUS:CANCELLED');
    expect(Object.keys(cancelled.manifest.entries)).toEqual(Object.keys(first.manifest.entries));
  });
  it('prepares new metadata without mutating prior metadata or preview', async () => {
    const preview = await buildCalendarPreview(source({}), options);
    const manifest: CalendarRevisionManifest = { version: 1, entries: {} };
    const before = structuredClone({ manifest, preview });
    await prepareCalendarDownload(preview, manifest, '2026-10-02T12:00:00Z');
    expect({ manifest, preview }).toEqual(before);
  });
  it('retains prior export identities when a category is deselected', async () => {
    const first = await prepareCalendarDownload(await buildCalendarPreview(source({}), options), undefined, '2026-10-02T12:00:00Z');
    const none = await prepareCalendarDownload(await buildCalendarPreview(source({}), { ...options, categories: [] }), first.manifest, '2026-10-03T12:00:00Z');
    expect(none.manifest).toEqual(first.manifest);
    expect(none.content).not.toContain('BEGIN:VEVENT');
  });
  it('rejects invalid revision data and malformed event dates before serialisation', async () => {
    const preview = await buildCalendarPreview(source({}), options);
    const uid = preview.events[0]!.uid;
    await expect(prepareCalendarDownload(preview, { version: 1, entries: { [uid]: { digest: 'a'.repeat(64), sequence: -1 } } }, '2026-10-02T12:00:00Z')).rejects.toThrow();
    expect(() => renderCalendar([{ ...preview.events[0]!, start: { type: 'date', value: '20260230' } }], { [uid]: 0 }, '2026-10-02T12:00:00Z')).toThrow();
    expect(() => renderCalendar([{ ...preview.events[0]!, url: 'javascript:alert(1)' }], { [uid]: 0 }, '2026-10-02T12:00:00Z')).toThrow();
  });
  it('escapes hostile selected labels but preserves every final record in a long file', async () => {
    const rows = Array.from({ length: 170 }, (_, index) => ({ kind: 'trip', id: `dummy-${index}`, data: { startDate: '2026-10-10', name: index === 169 ? 'FINAL 日本語\r\nATTENDEE:mailto:leak@example.invalid' : '🌊'.repeat(100) } }));
    const preview = await buildCalendarPreview({ ...source({}), records: rows }, { ...options, fields: { title: true } });
    const { content } = await prepareCalendarDownload(preview, undefined, '2026-10-02T12:00:00Z');
    expect(content.match(/BEGIN:VEVENT\r\n/g)).toHaveLength(170);
    const unfolded = content.replace(/\r\n /g, '');
    expect(unfolded).toContain('SUMMARY:FINAL 日本語\\nATTENDEE:mailto:leak@example.invalid');
    expect(content).not.toContain('\r\nATTENDEE:');
  });
});
