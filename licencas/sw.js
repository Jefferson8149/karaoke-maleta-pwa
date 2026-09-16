const CACHE='karaoke-maleta-licencas-v021';
const ROOT='/karaoke-maleta-pwa/licencas/';
const ASSETS=[ROOT,ROOT+'index.html',ROOT+'app.css?v=3',ROOT+'app.js?v=3',ROOT+'manifest.webmanifest','/karaoke-maleta-pwa/singer/icon.svg'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.pathname.includes('/licencas/') || u.pathname==='/karaoke-maleta-pwa/singer/icon.svg'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
  }
});