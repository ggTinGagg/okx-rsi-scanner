import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as core from '../core.js';import * as sizing from '../sizing.js';
test('phone flow scans public data, renders countertrend and recalculates capital; stale values hidden',async()=>{
 let time=1791053704000;const els={};function element(id){return els[id]??={value:'',textContent:'',children:[],listeners:{},append(x){this.children.push(x)},replaceChildren(){this.children=[]},addEventListener(k,fn){this.listeners[k]=fn}};}
 const requests=[],timers=new Map(),events={};let timerId=0,alerts=0;const c={...core,...sizing,navigator:{onLine:true},setupPWA(){},alertSignals(rows){alerts+=rows.length;},Date:class extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}},document:{hidden:false,getElementById:element,createElement:()=>element('new'+Math.random()),addEventListener(k,f){events[k]=f;}},window:{addEventListener(k,f){events[k]=f;}},localStorage:{getItem:k=>k==='okx-dca-mobile-equity-v1'?'750':null,setItem(){}},AbortController,URLSearchParams,setInterval(){},clearTimeout(id){timers.delete(id);},setTimeout(fn,ms){const id=++timerId;if(ms<200)Promise.resolve().then(fn);else timers.set(id,{fn,ms});return id;},fetch:async url=>{
 requests.push(url);const u=new URL(url);let data=[];const t=core.latestClosedStart(time,'5');
 if(u.pathname.endsWith('/time'))data=[{ts:String(time)}];
 if(u.pathname.endsWith('/instruments'))data=[{instId:'BTC-USDT-SWAP',state:'live',ctType:'linear',settleCcy:'USDT',lever:'100'}];
 if(u.pathname.endsWith('/tickers'))data=[{instId:'BTC-USDT-SWAP',last:'100',volCcy24h:'1000'}];
 if(u.pathname.endsWith('/candles')&&!u.searchParams.has('after'))data=Array.from({length:300},(_,i)=>[String(t-i*300000),'99',i===0?'100':'99','99',i===0?'100':'99','1','1','1','1']);
 return {ok:true,json:async()=>({code:'0',data})};
 }};vm.createContext(c);let source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');vm.runInContext(source+'\nglobalThis.hooks={scan,render,schedule};',c);
 assert.equal(requests.length,0);assert.equal(timers.size,1);
 events.visibilitychange();events.online();element('equity').listeners.input();assert.equal(requests.length,0);assert.equal(timers.size,1);
 await c.hooks.scan();assert.equal(element('signals').children.length,1);let row=element('signals').children[0];assert.match(row.children[0].children[1].textContent,/SHORT/);assert.equal(row.children[2].textContent,'32.32');assert.equal(row.children[3].textContent,'35.55');assert(requests.every(u=>u.startsWith('https://www.okx.com/api/v5/')));
 assert.equal(alerts,1);await c.hooks.scan();assert.equal(alerts,1);
 // A scheduled scan starts only after the next M5 close, plus the 2-second buffer.
 const scheduled=[...timers.values()][0];assert.equal(scheduled.ms,core.nextScanAt(time,'5')-time);
 time+=scheduled.ms;scheduled.fn();for(let i=0;i<100;i++)await Promise.resolve();assert.equal(alerts,2);
 element('equity').value='1500';c.hooks.render();assert.equal(element('signals').children[0].children[2].textContent,'64.64');time+=300000;c.hooks.render();assert.equal(element('signals').children[0].children[2].textContent,'—');
});
