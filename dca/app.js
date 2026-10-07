import {DEFAULTS,normalizeCandles,analyzeCandles,latestClosedStart,nextScanAt} from './core.js';
import {amounts,parameters} from './sizing.js';
import {setupPWA,alertSignals} from './pwa.js';
const $=id=>document.getElementById(id),MS=300000,KEY='okx-dca-mobile-equity-v1';
let rows=[],busy=false,offset=0,timer=null,autoSlot=null,audio=null,queue=Promise.resolve();
try{$('equity').value=localStorage.getItem(KEY)||'';}catch{}
const seenKey='okx-dca-seen-v2';
let seen=new Set();try{seen=new Set(JSON.parse(localStorage.getItem(seenKey)||'[]'));}catch{}
const now=()=>Date.now()+offset,wait=ms=>new Promise(r=>setTimeout(r,ms));
function failure(message){$('error').hidden=!message;$('error').textContent=message;}
async function api(path,params={}){
 let last;for(let attempt=0;attempt<3;attempt++){
  const turn=queue.then(()=>wait(140));queue=turn.catch(()=>{});await turn;
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),10000);
  try{const res=await fetch('https://www.okx.com/api/v5/'+path+'?'+new URLSearchParams(params),{signal:ctl.signal,credentials:'omit',cache:'no-store'});
   if(!res.ok){const e=Error('OKX HTTP '+res.status);e.retry=res.status===429||res.status>=500;throw e;}
   const data=await res.json();if(data.code!=='0'){const e=Error('OKX '+data.code+': '+data.msg);e.retry=data.code==='50011';throw e;}return data.data;
  }catch(e){last=e;if(e.retry===false||attempt===2)break;await wait(500*(attempt+1));}finally{clearTimeout(timeout);}
 }throw Error(last?.name==='AbortError'?'OKX phản hồi quá chậm.':last?.message||'Không kết nối được OKX.');
}
function render(){
 let money;try{money=amounts(Number($('equity').value));$('budget').textContent=`Ngân sách/bot ${money.budget.toFixed(2)} USDT · tối đa 2 bot.`;}catch{$('budget').textContent='Nhập tổng vốn để tính tiền entry và SO.';}
 $('signals').replaceChildren();for(const r of rows){const stale=now()>=r.closeTime+MS;const tr=document.createElement('tr');if(stale)tr.className='stale';
  const coin=document.createElement('td'),name=document.createElement('strong');name.textContent=r.symbol.replace('-USDT-SWAP','');coin.append(name);
  const info=document.createElement('small');info.className=r.kind==='overbought'?'short':'long';info.textContent=`${r.kind==='overbought'?'SHORT':'LONG'} · RSI ${r.rsi.toFixed(1)}`;coin.append(info);
  const t=document.createElement('small');t.textContent=new Date(r.closeTime).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})+(stale?' · đã cũ':'');coin.append(t);tr.append(coin);
  const pct=x=>x.toFixed(4).replace(/0+$/,'').replace(/\.$/,'')+'%';
  const fields=[r.leverage+'×',money?money.entry.toFixed(2):'—',money?money.so.toFixed(2):'—',pct(r.stepPct),pct(r.tpPct),pct(r.slPct)];
  for(const value of fields){const td=document.createElement('td');td.textContent=stale?'—':value;tr.append(td);}$('signals').append(tr);
 }$('empty').hidden=rows.length>0;
}
function sound(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
function beep(){if(!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=880;g.gain.value=.12;o.connect(g);g.connect(audio.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.3);o.stop(audio.currentTime+.3);}
function schedule(){
 clearTimeout(timer);
 if(document.hidden||navigator.onLine===false||busy||!(Number($('equity').value)>0))return;
 timer=setTimeout(()=>{
  const slot=latestClosedStart(now(),'5')+MS;
  if(autoSlot===slot){schedule();return;}
  autoSlot=slot;scan();
 },Math.max(500,nextScanAt(now(),'5')-now()));
}
async function scan(){
 if(busy)return;if(navigator.onLine===false){failure('Đang mất mạng. Kết nối lại rồi bấm Quét ngay hoặc đợi M5 đóng.');return;}try{amounts(Number($('equity').value));}catch(e){failure(e.message);return;}
 clearTimeout(timer);busy=true;$('scan').disabled=true;$('scan').textContent='Đang quét';$('progress').hidden=false;$('progress').value=0;failure('');let done=0,errors=[],completed=0;
 try{
  $('status').textContent='Đang lấy giờ OKX và Top 50…';const sent=Date.now();const clock=await api('public/time');const remote=Number(clock[0]?.ts);if(!Number.isFinite(remote))throw Error('Không đọc được giờ OKX.');offset=remote-(sent+Date.now())/2;
  const expected=latestClosedStart(now(),'5'),slot=expected+MS;
  const [instruments,tickers]=await Promise.all([api('public/instruments',{instType:'SWAP'}),api('market/tickers',{instType:'SWAP'})]);
  const info=new Map(instruments.filter(i=>i.state==='live'&&i.ctType==='linear'&&i.settleCcy==='USDT'&&i.instId.endsWith('-USDT-SWAP')).map(i=>[i.instId,i]));
  const top=tickers.filter(t=>info.has(t.instId)&&Number(t.last)>0&&Number(t.volCcy24h)>0).sort((a,b)=>Number(b.volCcy24h)*Number(b.last)-Number(a.volCcy24h)*Number(a.last)||a.instId.localeCompare(b.instId)).slice(0,50);
  if(!top.length)throw Error('Không đọc được danh sách Top 50.');rows=[];render();let cursor=0;
  async function worker(){while(cursor<top.length){const rank=cursor++,symbol=top[rank].instId;try{
    let raw=await api('market/candles',{instId:symbol,bar:'5m',limit:'300'});
    if(raw.length>=300){const oldest=Math.min(...raw.map(r=>Number(r[0])));raw.push(...await api('market/candles',{instId:symbol,bar:'5m',limit:'200',after:String(oldest)}));}
    const candles=normalizeCandles(raw.filter(r=>r[8]==='1'),now(),'5').filter(r=>r.time<=expected);
    const signal=analyzeCandles(candles,DEFAULTS,expected);completed++;
    if(signal){const p=parameters(signal,info.get(symbol));if(p){rows.push({...signal,...p,symbol,rank});rows.sort((a,b)=>a.rank-b.rank);render();}}
   }catch(e){errors.push(symbol+': '+e.message);}finally{done++;$('progress').value=done;$('status').textContent=`Đã quét ${done}/${top.length} · ${rows.length} tín hiệu`;}}
  }await Promise.all(Array.from({length:4},worker));
  if(!completed)throw Error('Không quét được coin nào. '+(errors[0]||''));const fresh=rows.filter(r=>!seen.has([r.symbol,r.candleTime,r.kind].join('|')));
  for(const r of fresh)seen.add([r.symbol,r.candleTime,r.kind].join('|'));
  seen=new Set([...seen].slice(-300));try{localStorage.setItem(seenKey,JSON.stringify([...seen]));}catch{}
  await alertSignals(fresh,beep);
  $('status').textContent=`${rows.length} tín hiệu · ${completed}/${top.length} mã · nến ${new Date(slot).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'})}`;
  if(errors.length)failure(`${errors.length} mã chưa quét được (thiếu lịch sử hoặc lỗi dữ liệu). ${errors.slice(0,2).join(' · ')}`);
 }catch(e){failure(e.message+' Nếu trình duyệt chặn kết nối OKX, trang không có dữ liệu để tính.');$('status').textContent='Quét chưa hoàn tất';}
 finally{busy=false;$('scan').disabled=false;$('scan').textContent='Quét ngay';$('progress').hidden=true;render();schedule();}
}
$('form').addEventListener('submit',e=>{e.preventDefault();sound();scan();});
$('equity').addEventListener('input',()=>{try{localStorage.setItem(KEY,$('equity').value);}catch{}render();schedule();});
document.addEventListener('visibilitychange',schedule);
window.addEventListener('online',schedule);
window.addEventListener('offline',()=>clearTimeout(timer));
setInterval(()=>{const left=Math.max(0,Math.ceil((nextScanAt(now(),'5')-now())/1000));$('countdown').textContent=Number($('equity').value)>0?`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`:'';render();},1000);
setupPWA(sound);render();schedule();

