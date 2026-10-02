import { calendarDigest, type CalendarPreview } from './calendar-model';
import { calendarEventLines, renderCalendar } from './calendar-ical';

export interface CalendarRevisionEntry { digest: string; sequence: number }
export interface CalendarRevisionManifest { version: 1; entries: Record<string, CalendarRevisionEntry> }

/** Export-delivery metadata only: no canonical records, source identities or selected text. */
export function validateCalendarManifest(value: unknown): CalendarRevisionManifest {
  if (value === undefined || value === null) return { version: 1, entries: {} };
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Calendar export history needs review.');
  const row = value as Record<string, unknown>, entries = row.entries;
  if (row.version !== 1 || Object.keys(row).some(key => !['version', 'entries'].includes(key)) || !entries || typeof entries !== 'object' || Array.isArray(entries) || Object.keys(entries).length > 25_000) throw new Error('Calendar export history needs review.');
  const projected: CalendarRevisionManifest = { version: 1, entries: {} };
  for (const [uid, raw] of Object.entries(entries)) {
    if (!/^ztek-[0-9a-f]{64}@calendar\.zeustek$/.test(uid) || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Calendar export history needs review.');
    const entry = raw as Record<string, unknown>;
    if (Object.keys(entry).some(key => !['digest', 'sequence'].includes(key)) || typeof entry.digest !== 'string' || !/^[0-9a-f]{64}$/.test(entry.digest) || typeof entry.sequence !== 'number' || !Number.isSafeInteger(entry.sequence) || entry.sequence < 0 || entry.sequence > 2_147_483_647) throw new Error('Calendar export history needs review.');
    projected.entries[uid] = { digest: entry.digest, sequence: entry.sequence };
  }
  return projected;
}

/** Preparation is pure. The caller persists this metadata only for an explicit download. */
export async function prepareCalendarDownload(preview: CalendarPreview, previous: CalendarRevisionManifest | undefined, generatedAt: string) {
  const manifest = validateCalendarManifest(previous), sequences: Record<string, number> = {};
  for (const event of preview.events) {
    const digest = await calendarDigest(calendarEventLines(event).join('\r\n'));
    const old = manifest.entries[event.uid];
    const sequence = old ? old.digest === digest ? old.sequence : old.sequence + 1 : 0;
    if (sequence > 2_147_483_647) throw new Error('Calendar revision history has reached its supported limit.');
    manifest.entries[event.uid] = { digest, sequence }; sequences[event.uid] = sequence;
  }
  if (Object.keys(manifest.entries).length > 25_000) throw new Error('Calendar export history has reached its supported limit.');
  return { content: renderCalendar(preview.events, sequences, generatedAt), manifest };
}
