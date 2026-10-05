/// <reference lib="webworker" />
import { clientsClaim, type WorkboxPlugin } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import {ExpirationPlugin} from 'workbox-expiration';
import {isCompleteIconPath} from '../lib/brand/icon-path';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// Identity-dependent HTML and revocable public snapshots must never be replayed.
const clearNavigationCaches=async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('zeustek-navigation-')).map(name=>caches.delete(name)));
};
self.addEventListener('activate',event=>event.waitUntil(clearNavigationCaches()));
registerRoute(({request,url})=>request.mode==='navigate'&&/^\/(?:signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(url.pathname),async({request})=>{
  await clearNavigationCaches();
  return fetch(request);
});
registerRoute(new NavigationRoute(new NetworkOnly()));
registerRoute(({ request,url }) => url.origin===self.location.origin&&(request.destination === 'script' || request.destination === 'style'), new CacheFirst({ cacheName: 'zeustek-static-v48' }));
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());
registerRoute(({url})=>url.origin===self.location.origin&&isCompleteIconPath(url.pathname),new CacheFirst({
  cacheName:'zeustek-complete-icons-v1',
  // Workbox marks optional callbacks as possibly undefined; its runtime plugin contract accepts them.
  plugins:[new ExpirationPlugin({maxEntries:96,maxAgeSeconds:30*24*60*60,purgeOnQuotaError:true}) as WorkboxPlugin],
}));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
