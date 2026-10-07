const CACHE='okx-dca-3so-v2',SCOPE=new URL('./',self.location.href).href;
const SHELL=['./','index.html','app.js','core.js','sizing.js','pwa.js','style.css','manifest.webmanifest','icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/touch.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('okx-dca-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.href.startsWith(SCOPE))return;
 // Only the app shell is cached; live OKX data never enters this cache.
 if(!SHELL.some(p=>new URL(p,SCOPE).pathname===u.pathname))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request).then(r=>r|| (e.request.mode==='navigate'?caches.match(new URL('index.html',SCOPE).href):Response.error()))));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{for(const c of clients){if(c.url.startsWith(SCOPE)&&'focus' in c)return c.focus();}return self.clients.openWindow(SCOPE);}));});
