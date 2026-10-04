interface CalendarDeliveryBoundary {
  accountId: string;
  currentAccount: () => string;
  isCurrent: () => boolean;
  persist: () => Promise<void>;
  deliver: () => void;
}
interface CalendarDeliveryInputs {
  snapshot: unknown;
  options: unknown;
  selection: unknown;
  priorManifest: unknown;
}

export function calendarDeliverySourceMatches(attempt: CalendarDeliveryInputs & { manifest: unknown }, current: CalendarDeliveryInputs): boolean {
  return current.snapshot === attempt.snapshot && current.options === attempt.options &&
    current.selection === attempt.selection &&
    // The parent can publish this attempt's manifest before persistence returns.
    (current.priorManifest === attempt.priorManifest || current.priorManifest === attempt.manifest);
}

/** Persistence is asynchronous; file delivery must still belong to the exact current owner view. */
export async function deliverCurrentCalendar(boundary: CalendarDeliveryBoundary): Promise<boolean> {
  const current = () => Boolean(boundary.accountId) &&
    boundary.currentAccount() === boundary.accountId && boundary.isCurrent();
  if (!current()) return false;
  await boundary.persist();
  if (!current()) return false;
  // No asynchronous gap between the final guard and the actual file delivery.
  boundary.deliver();
  return true;
}
