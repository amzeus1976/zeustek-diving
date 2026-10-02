import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CalendarExport, CalendarPreviewList } from '../components/planning/calendar-export';
import { buildCalendarPreview, DEFAULT_CALENDAR_OPTIONS } from '../lib/calendar/calendar-model';

const snapshot = { accountId: 'fixture-owner', snapshotAt: '2026-10-02T12:00:00Z', records: [], completeKinds: [] };

describe('calendar export accessible private review surface', () => {
  it('starts with private text fields off and download unavailable while preparing a preview', () => {
    const html = renderToStaticMarkup(createElement(CalendarExport, { snapshot, onDownloadManifest: async () => {} }));
    expect(html).toContain('Calendar download');
    expect(html).toContain('aria-label="Export timezone"');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[^<]*Download \.ics/);
    expect(html).toContain('Inspection time');
    for (const label of ['Include source titles', 'Include locations', 'Include private source links']) {
      const field = html.match(new RegExp(`<input[^>]*aria-label="${label}"[^>]*>`))?.[0];
      expect(field).toBeDefined();
      expect(field).not.toContain('checked');
    }
  });
  it('renders the exact selected labels safely and retains month precision wording', async () => {
    const preview = await buildCalendarPreview({ ...snapshot, completeKinds: ['cylinder', 'equipment'], records: [{ kind: 'cylinder', id: 'tank', data: { name: '<script>alert(1)</script>', hydroDueAt: '2026-10', visualDueAt: '2026-11' } }] }, { ...DEFAULT_CALENDAR_OPTIONS, categories: ['cylinder-inspection'], fields: { title: true } });
    const html = renderToStaticMarkup(createElement(CalendarPreviewList, { events: preview.events, selectedEventKeys: null, onToggle: () => {} }));
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('due month; exact day unknown');
    expect(html).toContain('aria-label="Select calendar event');
    expect(html).toContain('Review source');
  });
});
