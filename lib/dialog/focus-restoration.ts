type FocusTarget = {
  isConnected: boolean;
  focus: (options?: FocusOptions) => void;
};

/** A destructive action may remove its own trigger; retain a useful focus destination. */
export function restoreDialogFocus(previous: FocusTarget | null, fallback?: FocusTarget | null) {
  const destination = previous?.isConnected ? previous : fallback?.isConnected ? fallback : null;
  destination?.focus({ preventScroll: true });
}
