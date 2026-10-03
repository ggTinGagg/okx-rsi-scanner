import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as core from '../core.js';import * as sizing from '../sizing.js';
test('phone flow scans public data, renders countertrend and recalculates capital; stale values hidden',async()=>{
 let time=1791053704000;const els={};function element(id){return els[id]??={value:'',textContent:'',children:[],listeners:{},append(x){this.children.push(x)},replaceChildren(){this.children=[]},addEventListener(k,fn){this.listeners[k]=fn}};}
 const requests=[];const c={...core,...sizing,Date:class extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return time;}},document:{hidden:false,getElementById:element,createElement:()=>element('new'+Math.random()),addEventListener(){}},window:{addEventListener(){}},localStorage:{getItem:()=>'',setItem(){}},AbortController,URLSearchParams,setInterval(){},clearTimeout(){},setTimeout(fn,ms){if(ms<200)Promise.resolve().then(fn);return 0;},fetch:async url=>{
 requests.push(url);const u=new URL(url);let data=[];const t=core.latestClosedStart(time,'5');
 if(u.pathname.endsWith('/time'))data=[{ts:String(time)}];
 if(u.pathname.endsWith('/instruments'))data=[{instId:'BTC-USDT-SWAP',state:'live',ctType:'linear',settleCcy:'USDT',lever:'100'}];
 if(u.pathname.endsWith('/tickers'))data=[{instId:'BTC-USDT-SWAP',last:'100',volCcy24h:'1000'}];
 if(u.pathname.endsWith('/candles')&&!u.searchParams.has('after'))data=Array.from({length:300},(_,i)=>[String(t-i*300000),'99',i===0?'100':'99','99',i===0?'100':'99','1','1','1','1']);
 return {ok:true,json:async()=>({code:'0',data})};
 }};vm.createContext(c);let source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');vm.runInContext(source+'\nglobalThis.hooks={scan,render};',c);
 element('equity').value='750';await c.hooks.scan();assert.equal(element('signals').children.length,1);let row=element('signals').children[0];assert.match(row.children[0].children[1].textContent,/SHORT/);assert.equal(row.children[2].textContent,'8.09');assert.equal(row.children[3].textContent,'8.90');assert(requests.every(u=>u.startsWith('https://www.okx.com/api/v5/')));
 element('equity').value='1500';c.hooks.render();assert.equal(element('signals').children[0].children[2].textContent,'16.19');time+=300000;c.hooks.render();assert.equal(element('signals').children[0].children[2].textContent,'—');
});
