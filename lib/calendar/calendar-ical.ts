import type { CalendarEvent } from './calendar-model';
import { calendarUtcStamp, validCalendarDay } from './calendar-dates';

export function escapeCalendarText(value: string): string {
  return Array.from(value).filter(character => { const code = character.codePointAt(0)!; return code >= 32 && code !== 127 || [9, 10, 13].includes(code); }).join('')
    .replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

/** Content-line limits are UTF-8 octets, including a continuation line's leading space. */
export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = '', octets = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (octets + length > 75) { lines.push(current); current = ' '; octets = 1; }
    current += character; octets += length;
  }
  lines.push(current);
  return lines.join('\r\n');
}

function dateProperty(name: string, date: CalendarEvent['start']): string {
  if (date.type === 'date' && /^\d{8}$/.test(date.value)) {
    const day = `${date.value.slice(0, 4)}-${date.value.slice(4, 6)}-${date.value.slice(6, 8)}`;
    if (validCalendarDay(day)) return `${name};VALUE=DATE:${date.value}`;
  }
  if (date.type === 'date-time' && /^\d{8}T\d{6}Z$/.test(date.value)) {
    const iso = `${date.value.slice(0, 4)}-${date.value.slice(4, 6)}-${date.value.slice(6, 8)}T${date.value.slice(9, 11)}:${date.value.slice(11, 13)}:${date.value.slice(13, 15)}Z`;
    if (calendarUtcStamp(iso) === date.value) return `${name}:${date.value}`;
  }
  throw new Error('A calendar event has an invalid date. No file was generated.');
}

function calendarSourceUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('The selected source link is unavailable. No file was generated.'); }
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('The selected source link is unavailable. No file was generated.');
  if (Array.from(value).some(character => { const code = character.codePointAt(0)!; return code < 32 || code === 127; })) throw new Error('The selected source link is unavailable. No file was generated.');
  return url.toString();
}

/** Explicit projection shared by the download and revision digest; unknown fields never serialize. */
export function calendarEventLines(event: CalendarEvent): string[] {
  if (!/^ztek-[0-9a-f]{64}@calendar\.zeustek$/.test(event.uid) || !['TENTATIVE', 'CONFIRMED', 'CANCELLED'].includes(event.status)) throw new Error('A calendar event is invalid. No file was generated.');
  const lines = [`UID:${event.uid}`, dateProperty('DTSTART', event.start)];
  if (event.end) {
    if (event.end.type !== event.start.type || event.end.value <= event.start.value) throw new Error('A calendar event has an invalid range. No file was generated.');
    lines.push(dateProperty('DTEND', event.end));
  }
  lines.push(`SUMMARY:${escapeCalendarText(event.summary)}`, `DESCRIPTION:${escapeCalendarText(event.description)}`, `STATUS:${event.status}`, 'CLASS:PRIVATE', `TRANSP:${event.transparent ? 'TRANSPARENT' : 'OPAQUE'}`);
  if (event.location) lines.push(`LOCATION:${escapeCalendarText(event.location)}`);
  if (event.url) lines.push(`URL:${calendarSourceUrl(event.url)}`);
  for (const [property, value] of [['CREATED', event.createdAt], ['LAST-MODIFIED', event.modifiedAt]] as const) {
    if (!value) continue;
    const stamp = calendarUtcStamp(value); if (!stamp) throw new Error('A calendar revision date is invalid. No file was generated.');
    lines.push(`${property}:${stamp}`);
  }
  return lines;
}

export function renderCalendar(events: readonly CalendarEvent[], sequences: Readonly<Record<string, number>>, generatedAt: string): string {
  const stamp = calendarUtcStamp(generatedAt);
  if (!stamp) throw new Error('The export time is invalid. No file was generated.');
  const seen = new Set<string>();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ZeusTek Diving//Selected calendar export 1.0//EN', 'CALSCALE:GREGORIAN'];
  for (const event of events) {
    const sequence = sequences[event.uid];
    if (seen.has(event.uid) || !Number.isSafeInteger(sequence) || sequence! < 0 || sequence! > 2_147_483_647) throw new Error('Calendar revision history needs review. No file was generated.');
    seen.add(event.uid);
    lines.push('BEGIN:VEVENT', ...calendarEventLines(event), `DTSTAMP:${stamp}`, `SEQUENCE:${sequence}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}
