import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DiveRecordDetail } from '../components/dive-record-detail';
import type { DiveRecord } from '../lib/offline/dives';

const dive: DiveRecord & { entityId: string } = {
  entityId: 'writing-fixture', site: 'Fixture quarry', date: '2026-10-03', gas: 'Air',
  notes: 'Original Dive facts', maxDepthM:13.5, bottomTimeMin:33, source: 'manual', createdAt: '2026-10-03', modifiedAt: '2026-10-03',
  debrief: { wentWell: 'Calm ascent\nGood communication', nextDiveActions: 'Practise trim', humanFactorsOutcome: { communication: 'Clear signals' } },
  story: { narrative: 'A quiet, memorable Dive — 海', personalReflection: 'I enjoyed the wreck', timelineNotes: [{ timeOffsetMin: 12, depthM: 8, text: 'A shoal passed overhead' }] },
};
const props = { dive, title: dive.site, eyebrow: 'manual dive', ownerKind: 'dive', ownerId: dive.entityId, rows: [] as Array<[string, string]>, close: () => {}, edit: () => {}, remove: () => {} };
const render = (initialView: 'debrief' | 'story') => renderToStaticMarkup(createElement(DiveRecordDetail, { ...props, initialView }));

describe('readable Dive writing workspaces', () => {
  it('gives each debrief prompt a labelled writing area and retains saved multiline reflections', () => {
    const html = render('debrief');
    expect((html.match(/class="dive-writing-field"/g) ?? []).length).toBeGreaterThanOrEqual(6);
    for (const label of ['What went well', 'What could be improved', 'Problems / unexpected events', 'Decisions and adaptations', 'Lessons learned', 'Next dive actions']) {
      expect(html).toContain(`<span>${label}</span><textarea`);
    }
    expect(html).toContain('Calm ascent\nGood communication');
    expect(html).toContain('Practise trim');
    expect(html).toContain('Clear signals');
  });
  it('opens the dedicated Skills page once from Debrief without embedding its editor', () => {
    const html = render('debrief');
    expect(html.match(/>Open Skills practised<\/button>/g)).toHaveLength(1);
    expect(html).not.toContain('Record multiple skills');
    const skillsPage=renderToStaticMarkup(createElement(DiveRecordDetail,{...props,initialView:'skills'}));
    expect(skillsPage.match(/> Record multiple skills<\/button>/g)).toHaveLength(1);
    expect(skillsPage).toContain('No skills recorded for this dive yet.');
  });
  it('gives the main Story room to write and keeps every reflection and timeline record', () => {
    const html = render('story');
    expect(html).toContain('class="dive-writing-field dive-writing-primary"');
    expect(html).toMatch(/<span>What happened<\/span><textarea[^>]*rows="8"/);
    expect(html).toContain('A quiet, memorable Dive — 海');
    for (const label of ['Standout / best moment', 'Most challenging moment', 'What surprised me', 'Wildlife, wreck, environment or team moments', 'Personal reflection']) expect(html).toContain(`<span>${label}</span><textarea`);
    expect(html).toContain('I enjoyed the wreck');
    expect(html).toContain('A shoal passed overhead');
    expect(html).toContain('value="12"');
    expect(html).toContain('value="8"');
  });
  it.each(['debrief', 'story'] as const)('explains autosaving next to %s writing and offers a labelled Done action', view => {
    const html = render(view);
    expect(html).toContain('Changes save automatically on this device.');
    expect(html).toContain('class="dive-writing-status"');
    expect(html).toContain('<output aria-live="polite">');
    expect(html).toContain('>Done</button>');
    expect(html.indexOf('class="dive-writing-status"')).toBeLessThan(html.indexOf('class="dive-writing-fields"'));
  });
});
