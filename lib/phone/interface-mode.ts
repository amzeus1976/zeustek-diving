export type InterfaceMode = 'auto' | 'phone' | 'full';
export const PHONE_AUTOMATIC_ENABLED = false; // Enable after physical iPhone/offline acceptance.
export const INTERFACE_MODE_KEY = 'zeustek-interface-mode';
export function phoneSizedTouchDevice(
  shortSide: number,
  coarsePointer: boolean,
) {
  return coarsePointer && shortSide > 0 && shortSide <= 600;
}
export function choosePhoneInterface(
  mode: InterfaceMode,
  shortSide: number,
  coarsePointer: boolean,
  enabled = PHONE_AUTOMATIC_ENABLED,
) {
  return (
    mode === 'phone' ||
    (mode === 'auto' &&
      enabled &&
      phoneSizedTouchDevice(shortSide, coarsePointer))
  );
}
export function readInterfaceMode(search = ''): InterfaceMode {
  const query = new URLSearchParams(search).get('interface');
  if (query === 'phone' || query === 'full' || query === 'auto') return query;
  try {
    const saved = localStorage.getItem(INTERFACE_MODE_KEY);
    if (saved === 'phone' || saved === 'full') return saved;
  } catch {
    /* Storage failure must not prevent opening the site. */
  }
  return 'auto';
}
export function saveInterfaceMode(mode: InterfaceMode) {
  try {
    localStorage.setItem(INTERFACE_MODE_KEY, mode);
  } catch {
    /* The URL still carries the choice. */
  }
}
