export function logTimeRange(timeIn?: string | null, timeOut?: string | null) {
  const clock = (value?: string | null) => value && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value) ? value.slice(0,5) : '—';
  return `${clock(timeIn)} – ${clock(timeOut)}`;
}
