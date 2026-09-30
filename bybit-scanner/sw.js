// Notifications only: never cache market data or intercept API requests.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil((async()=>{const list=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const c of list)if(c.url.startsWith(self.registration.scope))return c.focus();return self.clients.openWindow(self.registration.scope);})());});
