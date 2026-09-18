const CACHE='karaoke-maleta-admin-loader-v20';
const ROOT='/karaoke-maleta-pwa/admin/';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll([ROOT,ROOT+'index.html',ROOT+'manifest.webmanifest','/karaoke-maleta-pwa/singer/icon.svg'])).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)))});