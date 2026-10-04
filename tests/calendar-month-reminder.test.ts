import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CalendarExport } from '../components/planning/calendar-export';
import { buildCalendarPreview, DEFAULT_CALENDAR_OPTIONS, type CalendarSourceSnapshot } from '../lib/calendar/calendar-model';
import { prepareCalendarDownload } from '../lib/calendar/calendar-revisions';

const options = { ...DEFAULT_CALENDAR_OPTIONS, categories: ['cylinder-inspection'] as const };
const source = (month: string): CalendarSourceSnapshot => ({
  accountId: 'dummy-calendar-owner', snapshotAt: '2026-10-04T09:00:00Z',
  completeKinds: ['cylinder', 'equipment'],
  records: [{ kind: 'cylinder', id: 'dummy-cylinder', data: { name: 'DUMMY cylinder', hydroDueAt: month } }],
});

describe('one-day reminders for month-only cylinder inspection evidence', () => {
  it.each([
    ['2026-10', '20261001', '20261002'],
    ['2028-02', '20280201', '20280202'],
    ['2026-12', '20261201', '20261202'],
  ])('shows %s once at the start of the month', async (month, start, end) => {
    const snapshot = source(month);
    const unchanged = structuredClone(snapshot);
    const preview = await buildCalendarPreview(snapshot, options);
    expect(preview.events).toHaveLength(1);
    expect(preview.events[0]).toMatchObject({ start: { type: 'date', value: start }, end: { type: 'date', value: end }, precision: 'month', transparent: true });
    expect(preview.events[0]?.summary).toContain('due this month');
    expect(preview.events[0]?.description).toContain('exact day unknown');
    expect(preview.events[0]?.description).toContain('not a first-day deadline');
    expect(preview.events[0]?.dateLabel).toContain(`reminder on ${month}-01`);
    const download = await prepareCalendarDownload(preview, undefined, '2026-10-04T09:00:00Z');
    expect(download.content).toContain(`DTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\n`);
    expect(download.content.match(/BEGIN:VEVENT\r\n/g)).toHaveLength(1);
    expect(download.content).not.toContain('RRULE');
    expect(snapshot).toEqual(unchanged);
  });

  it('applies the same reminder policy to visual and legacy cylinder evidence', async () => {
    const snapshot = source('2026-10');
    snapshot.records = [
      { kind: 'cylinder', id: 'canonical', data: { hydroDueAt: '2026-10', visualDueAt: '2026-12' } },
      { kind: 'equipment', id: 'legacy', data: { category: 'Cylinder', hydroDueAt: '2027-05', visualDueAt: '2027-06' } },
    ];
    const preview = await buildCalendarPreview(snapshot, options);
    expect(preview.events).toHaveLength(4);
    expect(preview.events.map(event => [event.start.value, event.end?.value])).toEqual([
      ['20261001', '20261002'], ['20261201', '20261202'], ['20270501', '20270502'], ['20270601', '20270602'],
    ]);
    expect(preview.events.every(event => event.precision === 'month' && event.summary.includes('due this month'))).toBe(true);
  });

  it('preserves the event identity and increments the export revision when shortening an earlier month span', async () => {
    const preview = await buildCalendarPreview(source('2026-10'), options);
    const earlier = structuredClone(preview);
    earlier.events[0]!.end = { type: 'date', value: '20261101' };
    const oldDownload = await prepareCalendarDownload(earlier, undefined, '2026-10-03T09:00:00Z');
    const corrected = await prepareCalendarDownload(preview, oldDownload.manifest, '2026-10-04T09:00:00Z');
    expect(Object.keys(corrected.manifest.entries)).toEqual(Object.keys(oldDownload.manifest.entries));
    expect(corrected.content).toContain('SEQUENCE:1');
    expect(corrected.content).toContain('DTEND;VALUE=DATE:20261002');
    expect(corrected.content.match(/BEGIN:VEVENT\r\n/g)).toHaveLength(1);
  });

  it('keeps exact recorded inspection days and genuine multi-day trips intact', async () => {
    const snapshot = source('2026-10');
    snapshot.completeKinds = ['cylinder', 'equipment', 'dive-trip'];
    snapshot.records = [
      { kind: 'cylinder', id: 'exact-day', data: { hydroDueAt: '2026-10-20' } },
      { kind: 'dive-trip', id: 'trip', data: { startsOn: '2026-10-12', endsOn: '2026-10-15' } },
    ];
    const preview = await buildCalendarPreview(snapshot, { ...options, categories: ['cylinder-inspection', 'trips'] });
    expect(preview.events.find(event => event.source.id === 'exact-day')).toMatchObject({ precision: 'day', start: { value: '20261020' }, end: { value: '20261021' } });
    expect(preview.events.find(event => event.source.id === 'trip')).toMatchObject({ precision: 'day', start: { value: '20261012' }, end: { value: '20261016' } });
  });

  it('explains the first-of-month reminder in the download workspace', () => {
    const html = renderToStaticMarkup(createElement(CalendarExport, { snapshot: source('2026-10'), onDownloadManifest: async () => {} }));
    expect(html).toContain('once on the first day');
    expect(html).toContain('exact due day remains unknown');
  });
});
