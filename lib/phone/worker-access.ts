/// <reference lib="webworker" />
export const PHONE_SHELL_CACHE = 'zeustek-phone-shell-v58';
export const PHONE_SHELL_PATH = '/phone/offline';
export const PHONE_RSC_PATH = '/phone/offline-payload';
export const PHONE_ENTRY_PATH = '/phone/offline-entry';
export async function clearPhoneOfflineIdentity() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('zeustek-v1');
    request.onupgradeneeded = () => {
      request.transaction?.abort();
    };
    request.onerror = () => resolve(); // No existing database means no saved identity.
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.close();
        resolve();
        return;
      }
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').delete('phone:verified-account');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(new Error('Offline sign-out could not complete.'));
      };
    };
  });
  const cache = await caches.open(PHONE_SHELL_CACHE);
  await cache.delete(PHONE_ENTRY_PATH);
}
export async function preparePhoneShell(progress: (completed: number, total: number) => void = () => {}) {
  progress(0, 2);
  const response = await fetch(PHONE_SHELL_PATH, {
    cache: 'no-store',
    credentials: 'omit',
  });
  if (
    !response.ok ||
    response.redirected ||
    !response.headers.get('content-type')?.includes('text/html')
  )
    throw new Error('The offline app could not be downloaded.');
  progress(1, 2);
  // vinext hydrates SSR with a separate public component payload. Cache that
  // anonymous payload too; an HTML-only fallback cannot become interactive.
  const payload = await fetch(PHONE_SHELL_PATH, {
    cache: 'no-store',
    credentials: 'omit',
    headers: { RSC: '1' },
  });
  if (
    !payload.ok ||
    !payload.headers.get('content-type')?.startsWith('text/x-component')
  )
    throw new Error('The offline app payload could not be downloaded.');
  const cache = await caches.open(PHONE_SHELL_CACHE);
  await cache.put(PHONE_SHELL_PATH, response);
  await cache.put(PHONE_RSC_PATH, payload);
  await cache.put(
    PHONE_ENTRY_PATH,
    new Response('phone', { headers: { 'content-type': 'text/plain' } }),
  );
  progress(2, 2);
}
export async function phoneShellReady() {
  const cache = await caches.open(PHONE_SHELL_CACHE);
  return Boolean(
    (await cache.match(PHONE_SHELL_PATH)) &&
    (await cache.match(PHONE_RSC_PATH)),
  );
}
export async function phoneNavigation(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch (error) {
    const url = new URL(request.url);
    const cache = await caches.open(PHONE_SHELL_CACHE);
    const phonePath =
      url.pathname === '/phone' || url.pathname.startsWith('/phone/');
    const installedEntry =
      url.pathname === '/' &&
      url.searchParams.get('source') === 'pwa' &&
      url.searchParams.get('interface') !== 'full';
    if (
      phonePath ||
      (installedEntry && (await cache.match(PHONE_ENTRY_PATH)))
    ) {
      const shell = await cache.match(
        request.headers.get('RSC') === '1' ? PHONE_RSC_PATH : PHONE_SHELL_PATH,
      );
      if (shell) return shell;
    }
    throw error;
  }
}
