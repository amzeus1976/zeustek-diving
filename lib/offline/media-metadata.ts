import { zeustekDb } from './db';
import { currentDiveAccount } from './dive-store';

export interface MediaMetadata { id: string; fileName: string; contentType: string; caption: string }
/** Non-authoritative account-scoped UI cache. No original binaries or copied attachments. */
export async function loadMediaMetadata(ownerKind: string, ownerId: string): Promise<{ items: MediaMetadata[]; unavailable: boolean }> {
  const account = currentDiveAccount();
  if (!account) throw new Error('Sign in to view Dive media.');
  const key = `media-cache:${account}:${ownerKind}:${ownerId}`;
  const cached = (await zeustekDb.settings.get(key))?.value as unknown as MediaMetadata[] | undefined;
  if (currentDiveAccount() !== account) throw new Error('Account changed');
  if (!navigator.onLine) return { items: Array.isArray(cached) ? cached : [], unavailable: true };
  try {
    const response = await fetch(`/api/media?kind=${encodeURIComponent(ownerKind)}&ownerId=${encodeURIComponent(ownerId)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Media unavailable');
    const result = await response.json() as { items?: MediaMetadata[] };
    if (!Array.isArray(result.items)) throw new Error('Invalid media response');
    if (currentDiveAccount() !== account) throw new Error('Account changed');
    await zeustekDb.settings.put({ key, value: result.items.map(item => ({ id: item.id, fileName: item.fileName, contentType: item.contentType, caption: item.caption ?? '' })) });
    return { items: result.items, unavailable: false };
  } catch {
    if (currentDiveAccount() !== account) throw new Error('Account changed');
    return { items: Array.isArray(cached) ? cached : [], unavailable: true };
  }
}
