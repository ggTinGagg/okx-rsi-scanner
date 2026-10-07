import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
test('notifications require user gesture, toggle off, and install help works without install prompt',async()=>{
 const els={},events={},messages=[];let permissions=0,beeps=0,unlocks=0;
 const c={document:{getElementById:id=>els[id]??={}},window:{matchMedia:()=>({matches:false}),addEventListener:(k,f)=>events[k]=f},navigator:{userAgent:'iPhone',serviceWorker:{register:async()=>({showNotification:async(...x)=>messages.push(x)})}},localStorage:{getItem:()=>null,setItem(){}},Notification:{permission:'default',requestPermission:async()=>{permissions++;c.Notification.permission='granted';}}};
 vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('../pwa.js',import.meta.url),'utf8').replaceAll('export ', '')+'\nglobalThis.hooks={setupPWA,alertSignals}',c);
 c.hooks.setupPWA(()=>unlocks++);assert.equal(permissions,0);await els.install.onclick();assert.match(els['install-help'].textContent,/Safari/);
 const row={symbol:'BTC-USDT-SWAP',kind:'overbought',leverage:8,tpPct:.5,slPct:4,closeTime:123};await c.hooks.alertSignals([row],()=>beeps++);assert.equal(messages.length,0);
 await els.notify.onclick();assert.equal(permissions,1);assert.equal(unlocks,1);await c.hooks.alertSignals([row],()=>beeps++);assert.equal(beeps,1);assert.equal(messages.length,1);assert.match(messages[0][1].body,/BTC SHORT/);
 await els.notify.onclick();await c.hooks.alertSignals([row],()=>beeps++);assert.equal(messages.length,1);
});
test('PWA assets exist, icon sizes match manifest, worker ignores market requests',()=>{
 const dir=new URL('../',import.meta.url),manifest=JSON.parse(fs.readFileSync(new URL('manifest.webmanifest',dir),'utf8'));
 assert.equal(manifest.start_url,'./');assert.equal(manifest.scope,'./');
 for(const i of manifest.icons){const b=fs.readFileSync(new URL(i.src,dir));assert.equal(b.readUInt32BE(16),Number(i.sizes.split('x')[0]));assert.equal(b.readUInt32BE(20),Number(i.sizes.split('x')[1]));}
 const handlers={};const c={URL,Response,self:{location:{href:'https://example.test/dca/sw.js',origin:'https://example.test'},addEventListener:(k,f)=>handlers[k]=f}};vm.createContext(c);vm.runInContext(fs.readFileSync(new URL('sw.js',dir),'utf8'),c);
 let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://www.okx.com/api/v5/market/candles'},respondWith(){intercepted=true;}});assert.equal(intercepted,false);
 handlers.fetch({request:{method:'GET',url:'https://example.test/index.html'},respondWith(){intercepted=true;}});assert.equal(intercepted,false);
});
