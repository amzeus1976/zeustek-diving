/// <reference lib="webworker" />
import { clientsClaim, type WorkboxPlugin } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import {ExpirationPlugin} from 'workbox-expiration';
import {isCompleteIconPath} from '../lib/brand/icon-path';
import {clearPhoneOfflineIdentity,preparePhoneShell,phoneShellReady,phoneNavigation,PHONE_SHELL_CACHE,PHONE_ENTRY_PATH} from '../lib/phone/worker-access';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
clientsClaim();

// Updating a prepared phone installs a fresh anonymous shell alongside the new
// precache. A failed download leaves the preceding worker usable offline.
self.addEventListener('install',event=>event.waitUntil((async()=>{
  if((await caches.keys()).some(name=>name.startsWith('zeustek-phone-shell-')))await preparePhoneShell();
})()));

// Identity-dependent HTML and revocable public snapshots must never be replayed.
const clearNavigationCaches=async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('zeustek-navigation-')).map(name=>caches.delete(name)));
};
self.addEventListener('activate',event=>event.waitUntil(clearNavigationCaches()));
registerRoute(({request,url})=>request.mode==='navigate'&&/^\/(?:signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(url.pathname),async({request})=>{
  await clearNavigationCaches();
  if(new URL(request.url).pathname.startsWith('/signout-with-chatgpt'))await clearPhoneOfflineIdentity();
  return fetch(request);
});
registerRoute(({request,url})=>request.mode==='navigate'&&(url.pathname==='/phone'||url.pathname.startsWith('/phone/')||url.pathname==='/'&&url.searchParams.get('source')==='pwa'),({request})=>phoneNavigation(request));
registerRoute(({request,url})=>url.origin===self.location.origin&&request.method==='GET'&&request.headers.get('RSC')==='1'&&(url.pathname==='/phone'||url.pathname==='/phone/offline'||url.pathname==='/'&&url.searchParams.get('source')==='pwa'),({request})=>phoneNavigation(request));
registerRoute(new NavigationRoute(new NetworkOnly()));
registerRoute(({ request,url }) => url.origin===self.location.origin&&(request.destination === 'script' || request.destination === 'style'), new CacheFirst({ cacheName: 'zeustek-static-v55' }));
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly());
registerRoute(({url})=>url.origin===self.location.origin&&isCompleteIconPath(url.pathname),new CacheFirst({
  cacheName:'zeustek-complete-icons-v1',
  // Workbox marks optional callbacks as possibly undefined; its runtime plugin contract accepts them.
  plugins:[new ExpirationPlugin({maxEntries:96,maxAgeSeconds:30*24*60*60,purgeOnQuotaError:true}) as WorkboxPlugin],
}));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
  if(['PREPARE_PHONE_OFFLINE','PHONE_OFFLINE_STATUS','CLEAR_PHONE_ENTRY'].includes(event.data?.type))event.waitUntil((async()=>{
    try{
      if(event.data.type==='PREPARE_PHONE_OFFLINE')await preparePhoneShell();
      if(event.data.type==='CLEAR_PHONE_ENTRY')await (await caches.open(PHONE_SHELL_CACHE)).delete(PHONE_ENTRY_PATH);
      event.ports[0]?.postMessage({ready:await phoneShellReady()});
    }catch(error){event.ports[0]?.postMessage({error:error instanceof Error?error.message:'Offline preparation failed.'});}
  })());
});
