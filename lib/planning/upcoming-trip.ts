type TripDates = {startDate?: string; endDate?: string; startAt?: string; endAt?: string; status?: string; entityId?: string};
function validDay(value: string | undefined) {
  const day = value?.slice(0, 10) ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const date = new Date(day + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : null;
}
export function localToday(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
/** Undated plans remain in Planning, but cannot establish the next scheduled Dive. */
export function selectUpcomingTrip<T extends TripDates>(items: readonly T[], today = localToday()): T | null {
  return items.flatMap(item => {
    if (['completed','cancelled','canceled','archived'].includes(item.status?.toLowerCase() ?? '')) return [];
    const start = validDay(item.startAt || item.startDate);
    const end = validDay(item.endAt || item.endDate || item.startAt || item.startDate);
    return start && end && end >= start && end >= today ? [{item,start}] : [];
  }).sort((a,b) => a.start.localeCompare(b.start) || (a.item.entityId ?? '').localeCompare(b.item.entityId ?? ''))[0]?.item ?? null;
}
