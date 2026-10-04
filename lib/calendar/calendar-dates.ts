export type CalendarFoldChoice = 'earlier' | 'later';
export type CalendarDateTimeResult =
  | { kind: 'resolved'; value: string; instant: string; display: string }
  | { kind: 'invalid' | 'gap' | 'fold'; message: string };

export function validCalendarDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function addCalendarDays(value: string, days: number): string | null {
  if (!validCalendarDay(value) || !Number.isSafeInteger(days)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  return validCalendarDay(result) ? result : null;
}

export function calendarMonthRange(value: unknown): { start: string; end: string } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value) || !validCalendarDay(`${value}-01`)) return null;
  const date = new Date(`${value}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const end = date.toISOString().slice(0, 10);
  return validCalendarDay(end) ? { start: `${value}-01`, end } : null;
}

export function calendarUtcStamp(value: string): string | null {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/);
  if (!match || !validCalendarDay(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] ?? '0') > 59) return null;
  const offset = match[5]?.match(/^[+-](\d{2}):(\d{2})$/);
  if (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || !/^\d{4}-/.test(date.toISOString())) return null;
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function zoneFormatter(timezone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
}

function localParts(formatter: Intl.DateTimeFormat, value: number): string {
  const parts = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year?.padStart(4, '0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

/** Resolve a saved wall-clock time, never the timezone of the computer running the export. */
export function resolveCalendarDateTime(
  value: unknown, timezone: string, foldChoice?: CalendarFoldChoice,
): CalendarDateTimeResult {
  const invalid = (): CalendarDateTimeResult => ({ kind: 'invalid', message: 'A valid saved date, time and export timezone are required.' });
  if (typeof value !== 'string') return invalid();
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!match || !validCalendarDay(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] ?? '0') > 59) return invalid();
  let formatter: Intl.DateTimeFormat;
  try { formatter = zoneFormatter(timezone); } catch { return invalid(); }
  const resolved = (instant: number): CalendarDateTimeResult => {
    const iso = new Date(instant).toISOString();
    const stamp = calendarUtcStamp(iso);
    return stamp ? { kind: 'resolved', value: stamp, instant: iso, display: `${localParts(formatter, instant).slice(0, 16)} (${timezone}) · ${iso}` } : invalid();
  };
  if (match[5]) {
    const offset = match[5].match(/^[+-](\d{2}):(\d{2})$/);
    if (offset && (Number(offset[1]) > 23 || Number(offset[2]) > 59)) return invalid();
    const instant = Date.parse(value);
    return Number.isFinite(instant) ? resolved(instant) : invalid();
  }
  const local = `${match[1]}T${match[2]}:${match[3]}:${match[4] ?? '00'}`;
  const naive = Date.parse(`${local}Z`);
  if (!Number.isFinite(naive)) return invalid();
  const offsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const probe = naive + hours * 3_600_000;
    offsets.add(Date.parse(`${localParts(formatter, probe)}Z`) - probe);
  }
  const matches = [...offsets].map(offset => naive - offset)
    .filter(candidate => localParts(formatter, candidate) === local).sort((a, b) => a - b);
  if (!matches.length) return { kind: 'gap', message: 'This local time does not occur during the daylight-saving change. Open the source record to review it.' };
  if (matches.length > 1 && !foldChoice) return { kind: 'fold', message: 'This local time occurs twice. Choose the earlier or later occurrence for this export.' };
  return resolved((foldChoice === 'later' ? matches.at(-1) : matches[0])!);
}
