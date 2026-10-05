import {renderToStaticMarkup} from 'react-dom/server';
import {describe,it,expect} from 'vitest';
import {CalendarEventText} from '../components/planning/calendar-event-text';
import {CalendarDiveLinks} from '../components/planning/calendar-dive-links';
import type {CalendarBooking} from '../lib/planning/calendar-booking-workflow';
import type {DiveRecord} from '../lib/offline/dives';
describe('Compact selected event and exact logged Dive links',()=>{
 it('shows a bounded preview and labelled keyboard control without altering saved text',()=>{
  const text='🐬'.repeat(500),html=renderToStaticMarkup(<CalendarEventText text={text} label="event notes"/>);
  expect(html).toContain('aria-expanded="false"');expect(html).toContain('aria-controls=');expect(html).toContain('… More');expect(html).not.toContain(text);expect(text.length).toBe(1000);
 });
 it('does not show More for short text and escapes text injection',()=>{
  const html=renderToStaticMarkup(<CalendarEventText text={'<script>alert(1)</script>'} label="notes"/>);
  expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');expect(html).not.toContain('… More');
 });
 it('opens each precise Logbook record and retains unavailable historical links',()=>{
  const item={name:'Dummy event',linkedDiveIds:['dive-a','dive-b','missing']} as CalendarBooking;
  const dives=[{entityId:'dive-a',diveNumber:1,date:'2026-10-10',site:'Site A'},{entityId:'dive-b',diveNumber:2,date:'2026-10-10',site:'Site B'}] as Array<DiveRecord&{entityId:string}>;
  const html=renderToStaticMarkup(<CalendarDiveLinks item={item} dives={dives} refresh={async()=>{}}/>);
  expect(html).toContain('Dives on this event (3)');expect(html).toContain('diveId=dive-a');expect(html).toContain('diveId=dive-b');expect(html).toContain('Site A');expect(html).toContain('Linked Dive unavailable');expect(html).toContain('Link / manage Dives');
 });
});
