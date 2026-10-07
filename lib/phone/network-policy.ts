/** Per-document policy. A phone window cannot change another desktop window's sync. */
let mode: 'automatic' | 'manual' = 'automatic';
let owner = '';
let permitted = 0;
let generation = 0;

export function configureRecordNetwork(
  account: string,
  next: 'automatic' | 'manual' = 'automatic',
) {
  if (owner === account && mode === next) return;
  generation++;
  owner = account;
  mode = next;
  permitted = 0;
}
export function recordNetworkAllowed() {
  return mode === 'automatic' || permitted > 0;
}
export function manualRecordNetwork() {
  return mode === 'manual';
}
export async function withRecordNetwork<T>(
  account: string,
  action: () => Promise<T>,
): Promise<T> {
  if (account !== owner)
    throw new Error('The account changed. Reopen sync in the current account.');
  const started = generation;
  permitted++;
  try {
    const result = await action();
    if (account !== owner || generation !== started)
      throw new Error(
        'The account changed during sync. Your saved records are retained.',
      );
    return result;
  } finally {
    if (account === owner && generation === started)
      permitted = Math.max(0, permitted - 1);
  }
}
