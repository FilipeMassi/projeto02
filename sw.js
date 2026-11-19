const CACHE='liberta2027-shell-v13';
const SHELL=['./','./index.html','./manifest.webmanifest','./icons/vasco-app.svg','./icons/vasco-camisa-v12-192.png','./icons/vasco-camisa-v12-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener('fetch',event=>{
if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
event.respondWith(fetch(event.request).then(response=>{if(response.ok&&event.request.url.includes('/projeto02/')&&!event.request.url.includes('/data/')){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}return response}).catch(()=>caches.match(event.request).then(cached=>cached||Response.error())))
});
