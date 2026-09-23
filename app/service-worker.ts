/// <reference lib="webworker" />
import { clientsClaim, type WorkboxPlugin } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly, NetworkFirst } from 'workbox-strategies';
import {ExpirationPlugin} from 'workbox-expiration';
import {isCompleteIconPath} from '../lib/brand/icon-path';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// The root is dynamically authenticated HTML, not an entry in the build precache.
// Cache only a successfully loaded dashboard; sign-in/out always clears that shell.
registerRoute(({request,url})=>request.mode==='navigate'&&/^\/(?:signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(url.pathname),async({request})=>{
  await Promise.all(['zeustek-navigation-v1','zeustek-navigation-v2','zeustek-navigation-v3'].map(name=>caches.delete(name)));
  return fetch(request);
});
registerRoute(new NavigationRoute(new NetworkFirst({
  cacheName:'zeustek-navigation-v3',networkTimeoutSeconds:1,
  plugins:[{
    cacheKeyWillBeUsed:async({request})=>new URL('/',request.url).href,
    cacheWillUpdate:async({response})=>response.status===200&&!response.redirected&&response.headers.get('content-type')?.includes('text/html')?response:null,
  }],
}),{allowlist:[/^\/(?:\?.*)?$/]}));
registerRoute(({ request,url }) => url.origin===self.location.origin&&(request.destination === 'script' || request.destination === 'style'), new CacheFirst({ cacheName: 'zeustek-static-v2' }));
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());
registerRoute(({url})=>url.origin===self.location.origin&&isCompleteIconPath(url.pathname),new CacheFirst({
  cacheName:'zeustek-complete-icons-v1',
  // Workbox marks optional callbacks as possibly undefined; its runtime plugin contract accepts them.
  plugins:[new ExpirationPlugin({maxEntries:96,maxAgeSeconds:30*24*60*60,purgeOnQuotaError:true}) as WorkboxPlugin],
}));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});
