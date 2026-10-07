let installEvent=null,registration=null,enabled=false;
const key='okx-dca-notify-v2',$=id=>document.getElementById(id);
try{enabled=localStorage.getItem(key)==='true';}catch{}
export function setupPWA(unlockSound){
 if('serviceWorker' in navigator)registration=navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).catch(()=>null);
 const installed=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone;
 const label=()=>{$('notify').textContent=enabled?'Tắt thông báo':'Bật thông báo';$('notify-status').textContent=enabled?(globalThis.Notification?.permission==='granted'?'Đã bật · chỉ báo khi đang quét.':'Âm thanh đã bật · giữ ứng dụng mở.'):'Báo tín hiệu khi ứng dụng đang mở.';};label();
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;});
 window.addEventListener('appinstalled',()=>{$('install').hidden=true;installEvent=null;});
 if(installed())$('install').hidden=true;
 $('install').onclick=async()=>{if(installEvent){await installEvent.prompt();installEvent=null;}else{$('install-help').hidden=false;$('install-help').textContent=/iPad|iPhone|iPod/.test(navigator.userAgent)?'iPhone: mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính. Sau đó mở biểu tượng RSI DCA.':'Mở bằng Chrome/Edge → menu ⋮ → Cài đặt ứng dụng hoặc Thêm vào màn hình chính.';}};
 $('notify').onclick=async()=>{
  if(enabled){enabled=false;}else{
   unlockSound();enabled=true;
   if('Notification' in globalThis){try{if(Notification.permission==='default')await Notification.requestPermission();}catch{}}
  }
  try{localStorage.setItem(key,String(enabled));}catch{}label();
  if(enabled&&globalThis.Notification?.permission==='denied')$('notify-status').textContent='Quyền thông báo bị chặn; dùng âm thanh khi mở ứng dụng. Có thể đổi quyền trong trình duyệt.';
  else if(enabled&&/iPad|iPhone|iPod/.test(navigator.userAgent)&&!installed())$('notify-status').textContent='Trên iPhone, cài vào màn hình chính rồi mở ứng dụng để bật quyền thông báo. Âm thanh dùng khi đang mở.';
 };
}
export async function alertSignals(rows,beep){
 if(!enabled||!rows.length)return;beep();
 if(globalThis.Notification?.permission!=='granted'||!registration)return;
 const body=rows.slice(0,3).map(r=>`${r.symbol.replace('-USDT-SWAP','')} ${r.kind==='overbought'?'SHORT':'LONG'} ${r.leverage}× · TP ${r.tpPct.toFixed(2)}% · SL ${r.slPct.toFixed(2)}%`).join('\n')+(rows.length>3?`\n+${rows.length-3} tín hiệu khác`:'');
 try{const reg=await registration;if(reg)await reg.showNotification(`RSI DCA · ${rows.length} tín hiệu mới`,{body,icon:'icons/icon-192.png',tag:'okx-dca-'+rows[0].closeTime});}catch{}
}
