import {DEFAULTS,validateSettings,duration,latestClosedStart,nextScanAt,normalizeCandles,analyzeCandles,topContracts,eventId,settingsKey} from './core.js';
const $=id=>document.getElementById(id);
const STORE='bybit-rsi-radar-v1';
const formatTime=(n,full=false)=>new Date(n).toLocaleString('vi-VN',full?{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}:{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
// Round display only; retain the exact leverage for filtering and saved signals.
const evenLeverage=n=>Math.max(2,Math.round(n/2)*2);
const price=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:n>=100?2:n>=1?4:8});
let stream=null,streamInterval='',streamPing=null,streamRetry=null,streamFailures=0,streamState='chưa kết nối',lastAutoClosed=null,pendingStreamClose=null,streamCloseTimer=null,lastStreamAttempt=0,pageOpenedAt=Date.now(),scheduledCloseAt=null;
let settings={...DEFAULTS},history=[],rows=[],busy=false,serverOffset=0,synced=false,timer=null,lastSettings='',audio=null,instruments=[],instrumentTime=0;
try{const raw=JSON.parse(localStorage.getItem(STORE)||'{}');settings=validateSettings({...DEFAULTS,...raw.settings,period:14});history=(raw.history||[]).filter(x=>x&&typeof x.symbol==='string'&&Number.isFinite(x.rsi)&&Number.isFinite(x.closeTime)&&typeof x.id==='string').slice(0,1000);}catch{settings={...DEFAULTS};}
const seen=new Set(history.map(x=>x.id));
function save(){try{localStorage.setItem(STORE,JSON.stringify({settings,history}));}catch{$('alert-status').textContent='Bộ nhớ thiết bị đã đầy; lịch sử phiên này vẫn hiển thị nhưng có thể không lưu được.';}}
function toast(title,message){const div=document.createElement('div');div.className='toast';const strong=document.createElement('strong');strong.textContent=title;const p=document.createElement('p');p.textContent=message;div.append(strong,p);$('toasts').prepend(div);while($('toasts').children.length>6)$('toasts').lastChild.remove();setTimeout(()=>div.remove(),10000);}
function readSettings(){return validateSettings({...settings,interval:$('interval').value,upper:Number($('upper').value),lower:Number($('lower').value),resetUpper:Number($('resetUpper').value),resetLower:Number($('resetLower').value),maxLeverage:Number($('maxLeverage').value),filterLeverage:$('filterLeverage').checked,auto:$('auto').checked,sound:$('sound').checked,period:14});}
function fillForm(){for(const k of ['interval','upper','lower','resetUpper','resetLower','maxLeverage'])$(k).value=settings[k];for(const k of ['auto','filterLeverage','sound'])$(k).checked=settings[k];updateRule();}
function updateRule(){$('rule-text').textContent=`RSI ≤${$('resetUpper').value} → lần đầu vượt ${$('upper').value}. RSI ≥${$('resetLower').value} → lần đầu xuống dưới ${$('lower').value}.`;}
function error(text){$('error').hidden=!text;$('error').textContent=text;}
function fmtInterval(i){return i==='D'?'D1':Number(i)<60?'M'+i:'H'+Number(i)/60;}
function makeRow(r,hist=false){const tr=document.createElement('tr');const values=[r.symbol,r.rsi.toFixed(2),evenLeverage(r.leverage)+'×',r.slPct.toFixed(3)+'%',price(r.close),r.kind==='overbought'?'Quá mua':'Quá bán',formatTime(r.closeTime)];for(let i=0;i<values.length;i++){const td=document.createElement('td');if(i===0){const strong=document.createElement('strong');strong.textContent=values[i];td.append(strong);const small=document.createElement('small');small.textContent=hist?`${fmtInterval(r.interval)} · ${r.upper}/${r.lower}`:`#${r.rank} · Top 50`;td.append(small);}else if(i===5){const tag=document.createElement('span');tag.className='tag '+(r.kind==='overbought'?'buy':'sell');tag.textContent=values[i];td.append(tag);}else{td.textContent=values[i];if(i===1)td.className=r.kind==='overbought'?'rsi-high numeric':'rsi-low numeric';if(i===2){td.className='lev numeric';td.title=`Đòn bẩy công thức: ${r.leverage.toFixed(4)}×; hiển thị số chẵn gần nhất (tối thiểu 2×). Bộ lọc dùng giá trị chưa làm tròn.`;}if(i===3||i===4)td.className='numeric';}tr.append(td);}return tr;}
function render(){$('signals').replaceChildren(...rows.map(x=>makeRow(x)));$('empty').hidden=rows.length>0;$('signal-count').textContent=rows.length;$('over-count').textContent=rows.filter(x=>x.kind==='overbought').length;$('under-count').textContent=rows.filter(x=>x.kind==='oversold').length;$('history').replaceChildren(...history.slice(0,200).map(x=>makeRow(x,true)));$('history-count').textContent=history.length;$('history-empty').hidden=history.length>0;}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const configured=String(window.SCANNER_CONFIG?.apiBase||'').trim();
const hosts=configured?[configured.replace(/\/$/,'')]:['https://api.bybit.com','https://api.bytick.com'];
async function api(path,params={}){
 let last;
 for(const host of hosts){
  for(let attempt=0;attempt<2;attempt++){
   // Five scan workers bound concurrency; do not queue each fetch behind a timer.
   // Hidden-tab timer throttling must not block normal successful requests.
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
   try{const response=await fetch(host+path+'?'+new URLSearchParams(params),{signal:controller.signal,credentials:'omit',cache:'no-store'});if(response.status===429){await wait(1000*(attempt+1));continue;}if(!response.ok)throw new Error('HTTP '+response.status);const data=await response.json();if(data.retCode===10006){await wait(1000*(attempt+1));continue;}if(data.retCode!==0)throw new Error(data.retMsg||'Bybit trả lỗi dữ liệu');return data;
   }catch(e){last=e;if(attempt===0)await wait(400);}finally{clearTimeout(timeout);}
  }
 }
 throw new Error(last?.name==='AbortError'?'Kết nối Bybit quá thời gian.':`Không lấy được dữ liệu Bybit (${last?.message||'giới hạn truy cập'}).`);
}
async function syncClock(){const sent=Date.now();const data=await api('/v5/market/time');const remote=Number(data.time)||Number(data.result?.timeSecond)*1000;if(!Number.isFinite(remote))throw new Error('Không xác định được giờ Bybit.');serverOffset=remote-(sent+Date.now())/2;synced=true;}
async function getInstruments(){if(instruments.length&&Date.now()-instrumentTime<3600000)return instruments;let cursor='',all=[];for(let page=0;page<20;page++){const data=await api('/v5/market/instruments-info',{category:'linear',limit:'1000',status:'Trading',...(cursor?{cursor}:{})});all.push(...data.result.list);cursor=data.result.nextPageCursor||'';if(!cursor){instruments=all;instrumentTime=Date.now();return all;}}throw new Error('Danh sách hợp đồng chưa tải đủ.');}
function unlockAudio(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}updateAlertState();}
function tone(){if(!settings.sound||!audio||audio.state!=='running')return;const base=audio.currentTime;[740,988,1244].forEach((freq,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(0,base+i*.14);g.gain.linearRampToValueAtTime(.16,base+i*.14+.02);g.gain.exponentialRampToValueAtTime(.001,base+i*.14+.18);o.connect(g);g.connect(audio.destination);o.start(base+i*.14);o.stop(base+i*.14+.19);});}
let swReady=null;
if('serviceWorker'in navigator)swReady=navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready).catch(()=>null);
async function systemNotify(title,body){if(!('Notification'in window)||Notification.permission!=='granted')return false;try{const registration=swReady?await Promise.race([swReady,wait(4000).then(()=>null)]):null;if(registration){await registration.showNotification(title,{body,icon:'./favicon.svg',tag:'bybit-rsi-'+Date.now()});return true;}const n=new Notification(title,{body,icon:'./favicon.svg'});n.onclick=()=>{window.focus();n.close();};return true;}catch{return false;}}
function updateAlertState(){const status=!('Notification'in window)?'Thiết bị dùng thông báo trong trang':Notification.permission==='granted'?'Thông báo hệ thống: đã bật':Notification.permission==='denied'?'Thông báo hệ thống: bị chặn trong cài đặt trình duyệt':'Thông báo hệ thống: chưa cấp quyền';const sound=settings.sound?(audio?.state==='running'?'âm thanh: sẵn sàng':'âm thanh: cần bấm bật/kiểm tra'):'âm thanh: tắt';$('alert-status').textContent=status+' · '+sound+' · Quét nền: '+streamState+'.';}
async function enableAlerts(){unlockAudio();if('Notification'in window&&Notification.permission==='default'){try{await Notification.requestPermission();}catch{}}updateAlertState();}
async function alertSignals(fresh){if(!fresh.length)return;tone();fresh.slice(0,5).forEach(r=>toast(`${r.symbol} · ${r.kind==='overbought'?'Quá mua':'Quá bán'}`,`RSI ${r.rsi.toFixed(2)} · SL ${r.slPct.toFixed(3)}% · ${evenLeverage(r.leverage)}× · ${fmtInterval(r.interval)}`));if(fresh.length>5)toast('Thêm tín hiệu mới',`Có thêm ${fresh.length-5} hợp đồng. Xem danh sách phía trên.`);await systemNotify(`${fresh.length} tín hiệu RSI mới`,fresh.slice(0,4).map(r=>`${r.symbol} ${r.rsi.toFixed(1)}`).join(' · '));}
function setBusy(value){busy=value;$('scan').disabled=value;$('scan').innerHTML=value?'Đang quét…':'<span>↻</span> Quét ngay';for(const k of ['interval','upper','lower','resetUpper','resetLower','maxLeverage','filterLeverage'])$(k).disabled=value;document.querySelectorAll('[data-upper]').forEach(b=>b.disabled=value);$('progress').hidden=!value;}
// The public stream supplies network events even when the background timer is delayed.
// BTC provides a market-wide candle clock; each scan still ranks and analyzes all Top 50.
function stopStream(){
 clearInterval(streamPing);clearTimeout(streamRetry);clearTimeout(streamCloseTimer);streamCloseTimer=null;pendingStreamClose=null;streamPing=null;streamRetry=null;
 const old=stream;stream=null;streamInterval='';if(old){old.onclose=null;old.close();}
 streamState=settings.auto?'chưa kết nối':'đã tắt';updateAlertState();
}
function ensureStream(){
 if(!settings.auto){stopStream();return;}
 if(typeof WebSocket==='undefined'){streamState='thiết bị không hỗ trợ';updateAlertState();return;}
 if(stream&&streamInterval===settings.interval&&stream.readyState<=1)return;
 stopStream();streamInterval=settings.interval;
 let ws;try{ws=new WebSocket('wss://stream.bybit.com/v5/public/linear');}catch{streamState='không kết nối được; dùng lịch dự phòng';updateAlertState();streamRetry=setTimeout(ensureStream,30000);return;}stream=ws;
 streamState='đang kết nối';updateAlertState();
 ws.onopen=()=>{if(stream!==ws)return;ws.send(JSON.stringify({op:'subscribe',args:[`kline.${streamInterval}.BTCUSDT`]}));streamPing=setInterval(()=>{if(ws.readyState===1)ws.send(JSON.stringify({op:'ping'}));},20000);};
 ws.onmessage=e=>{
  if(stream!==ws||!settings.auto)return;let data;try{data=JSON.parse(e.data);}catch{return;}
  if(data.op==='subscribe'){
   if(data.success!==true){streamState='không đăng ký được; dùng lịch dự phòng';updateAlertState();ws.close();return;}
   streamState='đã kết nối';streamFailures=0;updateAlertState();
  }
  if(data.topic!==`kline.${settings.interval}.BTCUSDT`||!Array.isArray(data.data))return;
  const ms=duration(settings.interval),now=Date.now()+serverOffset;
  for(const candle of data.data){
   const start=Number(candle.start),closeAt=start+ms,readyAt=closeAt+2000;
   if(candle.confirm!==true||!Number.isFinite(start)||start%ms!==0||start<Math.floor(pageOpenedAt/ms)*ms||scheduledCloseAt===null||readyAt<scheduledCloseAt)continue;
   pendingStreamClose=start;
   clearTimeout(streamCloseTimer);
   streamCloseTimer=setTimeout(checkStreamClose,Math.max(0,closeAt+2000-now));
  }
  // Further stream updates can release a pending close if a background timer was throttled.
  checkStreamClose();
 };

 ws.onerror=()=>{if(stream===ws){streamState='kết nối gián đoạn; dùng lịch dự phòng';updateAlertState();ws.close();}};
 ws.onclose=()=>{if(stream!==ws)return;stream=null;clearInterval(streamPing);streamPing=null;streamState='đang kết nối lại; dùng lịch dự phòng';updateAlertState();if(settings.auto)streamRetry=setTimeout(ensureStream,Math.min(60000,10000*++streamFailures));};
}
function checkStreamClose(){if(!settings.auto||!synced||busy||pendingStreamClose===null||pendingStreamClose===lastAutoClosed)return;const readyAt=pendingStreamClose+duration(settings.interval)+2000;if(Date.now()+serverOffset<readyAt)return;const now=Date.now();if(now-lastStreamAttempt<15000)return;lastStreamAttempt=now;scan('auto');}
function schedule(){clearTimeout(timer);scheduledCloseAt=null;if(!settings.auto||!synced)return;const now=Date.now()+serverOffset;scheduledCloseAt=nextScanAt(now,settings.interval);const delay=Math.max(250,scheduledCloseAt-now);timer=setTimeout(()=>scan('auto'),delay);}
async function scan(source='manual'){
 if(busy)return;try{settings=readSettings();save();}catch(e){error(e.message);return;}
 const snapshot={...settings};setBusy(true);error('');$('progress-fill').style.width='0%';$('scan-status').textContent='Đồng bộ giờ Bybit và chọn Top 50…';
 try{
  await syncClock();const now=Date.now()+serverOffset,expected=latestClosedStart(now,snapshot.interval),expectedClose=expected+duration(snapshot.interval);
  const [info,tick]=await Promise.all([getInstruments(),api('/v5/market/tickers',{category:'linear'})]);const top=topContracts(tick.result.list,info);if(!top.length)throw new Error('Không có hợp đồng USDT perpetual đủ điều kiện.');
  const successes=[],failures=[];let next=0,done=0;
  async function worker(){while(next<top.length){const rank=next++,symbol=top[rank].symbol;try{let result,finished=false;for(let attempt=0;attempt<3;attempt++){const data=await api('/v5/market/kline',{category:'linear',symbol,interval:snapshot.interval,limit:'500',end:String(expectedClose-1)});const candles=normalizeCandles(data.result.list,Date.now()+serverOffset,snapshot.interval);try{result=analyzeCandles(candles,snapshot,expected);finished=true;break;}catch(e){if(attempt===2)throw e;await wait(700);}}if(finished)successes.push({symbol,rank:rank+1,result});}catch(e){failures.push({symbol,message:e.message});}finally{done++;$('progress-fill').style.width=(done/top.length*100)+'%';$('scan-status').textContent=`Đã quét ${done}/${top.length} hợp đồng · nến đóng ${formatTime(expectedClose)}${failures.length?' · lỗi '+failures.length:''}`;}}}
  await Promise.all(Array.from({length:5},worker));if(successes.length===0)throw new Error(`Không quét thành công hợp đồng nào. ${failures[0]?.message||''}`);
  rows=successes.filter(x=>x.result).map(x=>({...x.result,symbol:x.symbol,rank:x.rank,interval:snapshot.interval,upper:snapshot.upper,lower:snapshot.lower,detectedAt:Date.now(),id:eventId(x.symbol,x.result,snapshot)})).sort((a,b)=>a.rank-b.rank);
  const fresh=rows.filter(r=>!seen.has(r.id));for(const r of fresh)seen.add(r.id);history=[...fresh,...history].sort((a,b)=>b.closeTime-a.closeTime||a.rank-b.rank).slice(0,1000);save();render();lastSettings=settingsKey(snapshot);lastAutoClosed=expected;
  document.body.classList.add('connected');$('connection').textContent='Đã kết nối Bybit';$('signal-caption').textContent=`${fmtInterval(snapshot.interval)} · nến đóng ${formatTime(expectedClose)} · ${snapshot.upper}/${snapshot.lower} · ${fresh.length} tín hiệu mới`;
  $('scan-status').textContent=`Hoàn tất ${successes.length}/${top.length} · ${formatTime(Date.now(),true)} · lần quét ${source==='auto'?'tự động':source==='initial'?'khi mở trang':'thủ công'}.`;
  if(failures.length)error(`Không lấy được ${failures.length} hợp đồng: ${failures.slice(0,8).map(x=>x.symbol).join(', ')}. Danh sách chỉ gồm các mã đã quét thành công; lịch sử đã lưu vẫn còn.`);
  await alertSignals(fresh);
 }catch(e){error(e.message+' Bấm Quét ngay để thử lại. Có thể mạng hoặc khu vực đang hạn chế Bybit.');document.body.classList.remove('connected');$('connection').textContent='Kết nối gián đoạn';$('scan-status').textContent='Quét chưa thành công; danh sách cũ (nếu có) chưa được cập nhật.';}
 finally{setBusy(false);ensureStream();if(!synced&&settings.auto){clearTimeout(timer);timer=setTimeout(prepareAuto,30000);}else schedule();}
}
function applySettings(){try{settings=readSettings();save();error('');rows=[];render();$('signal-caption').textContent='Bộ lọc đã đổi. Bấm Quét ngay để cập nhật.';lastAutoClosed=null;pendingStreamClose=null;lastStreamAttempt=0;ensureStream();schedule();}catch(e){error(e.message);}updateRule();}
$('settings').addEventListener('submit',e=>{e.preventDefault();unlockAudio();scan();});
for(const k of ['interval','resetUpper','resetLower','maxLeverage','filterLeverage'])$(k).addEventListener('change',applySettings);
for(const k of ['upper','lower'])$(k).addEventListener('change',()=>{const u=Number($('upper').value),l=Number($('lower').value);$('resetUpper').value=u-10;$('resetLower').value=l+10;applySettings();});
document.querySelectorAll('[data-upper]').forEach(button=>button.addEventListener('click',()=>{$('upper').value=button.dataset.upper;$('lower').value=button.dataset.lower;$('resetUpper').value=Number(button.dataset.upper)-10;$('resetLower').value=Number(button.dataset.lower)+10;applySettings();}));
$('auto').addEventListener('change',()=>{settings.auto=$('auto').checked;save();if(settings.auto)prepareAuto();else{clearTimeout(timer);stopStream();}schedule();});$('sound').addEventListener('change',()=>{settings.sound=$('sound').checked;if(settings.sound)unlockAudio();save();updateAlertState();});
$('notify').addEventListener('click',enableAlerts);
$('test-alert').addEventListener('click',async()=>{await enableAlerts();tone();toast('Kiểm tra cảnh báo thành công','Đây là thông báo thử. Âm thanh sẽ phát nếu thiết bị đã cho phép.');const sent=await systemNotify('RSI Radar · thông báo thử','Thông báo trên thiết bị đã hoạt động.');if(!sent)$('alert-status').textContent+=' Thông báo trong trang hoạt động; thông báo hệ thống chưa được gửi.';});
$('clear-history').addEventListener('click',()=>{if(confirm('Xóa lịch sử đã lưu trên thiết bị này?')){history=[];save();render();}});
function clock(){if(!settings.auto){$('countdown').textContent='Tạm dừng';$('next-time').textContent='Bạn vẫn có thể quét thủ công';return;}if(!synced){$('countdown').textContent='—:—';return;}const now=Date.now()+serverOffset,t=nextScanAt(now,settings.interval),left=Math.max(0,Math.ceil((t-now)/1000));$('countdown').textContent=left>=3600?`${Math.floor(left/3600)}:${String(Math.floor(left%3600/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`:`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;$('next-time').textContent=busy?'Đang quét nến đã đóng':formatTime(t);}
async function prepareAuto(){if(!settings.auto)return;ensureStream();try{await syncClock();schedule();}catch{streamState='Bybit chưa đồng bộ giờ; đang thử lại';updateAlertState();clearTimeout(timer);timer=setTimeout(prepareAuto,30000);}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&settings.auto){ensureStream();}});window.addEventListener('online',()=>{if(settings.auto){ensureStream();prepareAuto();}});window.addEventListener('pagehide',()=>{clearTimeout(timer);stopStream();});window.addEventListener('pageshow',e=>{if(e.persisted&&settings.auto){prepareAuto();}});
fillForm();render();updateAlertState();if(settings.auto)prepareAuto();else ensureStream();setInterval(clock,1000);
