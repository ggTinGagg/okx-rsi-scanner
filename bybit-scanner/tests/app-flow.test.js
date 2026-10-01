import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
class Element {
 constructor(id=''){this.id=id;this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.style={};this.dataset={};this.children=[];this.events={};this._text='';}
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
 set innerHTML(v){this._text=String(v);}get innerHTML(){return this._text;}
 addEventListener(type,f){(this.events[type]||=[]).push(f);}async emit(type){for(const f of this.events[type]||[])await f({preventDefault(){}});}
 append(...v){this.children.push(...v);}prepend(...v){this.children.unshift(...v);}replaceChildren(...v){this._text='';this.children=[...v];}remove(){}get lastChild(){return this.children.at(-1);}
}
test('scanner application flow: 50 contracts, filtering, persistence, dedupe and test notification',async()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element(m[1])]));
 const presets=[70,80,85].map(upper=>{const b=new Element();b.dataset={upper:String(upper),lower:String(100-upper)};return b;});
 globalThis.document={getElementById:id=>elements.get(id),createElement:()=>new Element(),querySelectorAll:()=>presets,body:{classList:{add(){},remove(){}}},addEventListener(){},visibilityState:'visible'};
 const stored=new Map([['bybit-rsi-radar-v1',JSON.stringify({settings:{auto:false},history:[]})]]);globalThis.localStorage={getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)};
 globalThis.window={SCANNER_CONFIG:{apiBase:''},addEventListener(){},focus(){}};globalThis.confirm=()=>true;
 let notificationCalls=0;class Notify{static permission='default';static async requestPermission(){Notify.permission='granted';return 'granted';}constructor(){notificationCalls++;}close(){}}globalThis.Notification=Notify;window.Notification=Notify;
 const notifications={async showNotification(){notificationCalls++;}};Object.defineProperty(globalThis,'navigator',{value:{serviceWorker:{register:async()=>notifications,ready:Promise.resolve(notifications)}},configurable:true});
 class Audio{state='running';currentTime=0;destination={};async resume(){}createOscillator(){return {frequency:{},connect(){},start(){},stop(){}};}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}}window.AudioContext=Audio;
 const realSetTimeout=globalThis.setTimeout;globalThis.setInterval=()=>0;globalThis.setTimeout=(f,t)=>{if(document.visibilityState==='hidden')return 0;const handle=realSetTimeout(f,t);handle.unref?.();return handle;};
 let now=Math.floor(Date.now()/300000)*300000+10000;
 const symbol=i=>['BTCUSDT','ETHUSDT','SOLUSDT'][i]||`TEST${i}USDT`;
 let requests=0;
 globalThis.fetch=async url=>{requests++;const u=new URL(url);let result={};
 if(u.pathname.endsWith('/time'))result={timeSecond:String(Math.floor(now/1000))};
 if(u.pathname.endsWith('/instruments-info'))result={list:Array.from({length:50},(_,i)=>({symbol:symbol(i),status:'Trading',quoteCoin:'USDT',settleCoin:'USDT',contractType:'LinearPerpetual',isPreListing:false})),nextPageCursor:''};
 if(u.pathname.endsWith('/tickers'))result={list:Array.from({length:50},(_,i)=>({symbol:symbol(i),turnover24h:String(1e9-i*1e6)}))};
 if(u.pathname.endsWith('/kline')){const sym=u.searchParams.get('symbol'),ms=Number(u.searchParams.get('interval'))*60000,close=Number(u.searchParams.get('end'))+1,base=sym==='BTCUSDT'?65000:sym==='ETHUSDT'?3000:sym==='SOLUSDT'?150:100,amp=base*(sym==='ETHUSDT'?.00001:.0007);
 result={list:Array.from({length:500},(_,i)=>{let c=base+(i%2?amp:0),o=c-amp/4;if(i===499&&sym==='BTCUSDT'){o=base;c=base*1.009;}if(i===499&&sym==='ETHUSDT'){o=base;c=base*1.0009;}if(i===499&&sym==='SOLUSDT'){o=base;c=base*.98;}return [String(close-(500-i)*ms),String(o),String(Math.max(o,c)+amp),String(Math.min(o,c)-amp),String(c),'10','1000'];}).reverse()};}
 return {ok:true,status:200,json:async()=>({retCode:0,time:now,result})};};
 const wait=ms=>new Promise(r=>realSetTimeout(r,ms));
 async function completed(){for(let i=0;i<500;i++){if(!elements.get('scan').disabled&&elements.get('scan-status').textContent.includes('Hoàn tất'))return;await wait(50);}throw new Error('Scan timed out');}
 await import('../app.js');assert.equal(requests,0,'opening with auto scan off must not call market APIs');await elements.get('settings').emit('submit');await completed();
 assert.equal(elements.get('signal-count').textContent,'2');assert.equal(elements.get('history-count').textContent,'2');assert.equal(elements.get('over-count').textContent,'1');assert.equal(elements.get('under-count').textContent,'1');assert.ok(!elements.get('signals').textContent.includes('ETHUSDT'));
 await elements.get('settings').emit('submit');await completed();assert.equal(elements.get('history-count').textContent,'2');
 elements.get('filterLeverage').checked=false;await elements.get('filterLeverage').emit('change');await elements.get('settings').emit('submit');await completed();assert.equal(elements.get('signal-count').textContent,'3');assert.equal(elements.get('history-count').textContent,'3');
 await presets[1].emit('click');assert.equal(Number(elements.get('resetUpper').value),70);assert.equal(Number(elements.get('resetLower').value),30);
 await elements.get('test-alert').emit('click');assert.ok(notificationCalls>=1);assert.ok(elements.get('toasts').textContent.includes('Kiểm tra cảnh báo thành công'));
 // Simulate background timers not firing: only an incoming WebSocket event wakes scanning.
 class Socket{static instances=[];readyState=0;sent=[];constructor(url){this.url=url;Socket.instances.push(this);}send(data){this.sent.push(JSON.parse(data));}close(){this.readyState=3;this.onclose?.();}}
 globalThis.WebSocket=Socket;
 elements.get('auto').checked=true;await elements.get('auto').emit('change');
 for(let i=0;i<50&&!Socket.instances.length;i++)await wait(20);
 const ws=Socket.instances.at(-1);assert.ok(ws.url.endsWith('/v5/public/linear'));ws.readyState=1;ws.onopen();
 assert.deepEqual(ws.sent[0].args,['kline.5.BTCUSDT']);
 ws.onmessage({data:JSON.stringify({op:'subscribe',success:true})});
 assert.ok(elements.get('alert-status').textContent.includes('Quét nền: đã kết nối'));
 const realNow=Date.now;document.visibilityState='hidden';
 const before=requests,beforeNotifications=notificationCalls;
 try{
  now+=593000;Date.now=()=>realNow()+593000;
  ws.onmessage({data:'invalid JSON'});assert.equal(requests,before);
  ws.onmessage({data:JSON.stringify({topic:'kline.15.BTCUSDT',data:[]})});assert.equal(requests,before);
  const closedStart=Math.floor((now-300000)/300000)*300000;
  ws.onmessage({data:JSON.stringify({topic:'kline.5.BTCUSDT',data:[{start:closedStart,confirm:true}]})});
  assert.equal(elements.get('scan').disabled,true);await completed();assert.ok(requests>before);
  assert.ok(notificationCalls>beforeNotifications,'hidden scan sends a NEW system notification while all page timers are stalled');
  const after=requests;ws.onmessage({data:JSON.stringify({topic:'kline.5.BTCUSDT',data:[{start:closedStart,confirm:true}]})});assert.equal(requests,after,'repeat message does not repeat scan');
  elements.get('auto').checked=false;await elements.get('auto').emit('change');assert.equal(ws.readyState,3);
 }finally{Date.now=realNow;document.visibilityState='visible';}
 const saved=JSON.parse(stored.get('bybit-rsi-radar-v1'));assert.ok(saved.history.length>=3);assert.ok(requests>=150);assert.equal(saved.settings.upper,80);
});
