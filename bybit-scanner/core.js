export const DEFAULTS = Object.freeze({interval:'5',period:14,upper:70,lower:30,resetUpper:60,resetLower:40,maxLeverage:30,filterLeverage:true,auto:true,sound:true});
export function validateSettings(s){
 const allowed=['1','3','5','15','30','60','120','240','360','720','D'];
 if(!allowed.includes(s.interval))throw new Error('Khung nến không hợp lệ.');
 for(const k of ['upper','lower','resetUpper','resetLower'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>100)throw new Error('Các mốc RSI phải nằm trong 0–100.');
 if(!(s.lower<s.resetLower&&s.resetLower<=s.resetUpper&&s.resetUpper<s.upper))throw new Error('Cần: quá bán < mốc nạp quá bán ≤ mốc nạp quá mua < quá mua.');
 if(!Number.isFinite(s.maxLeverage)||s.maxLeverage<=0)throw new Error('Trần đòn bẩy phải lớn hơn 0.');
 return s;
}
export function duration(interval){return interval==='D'?86400000:Number(interval)*60000;}
export function latestClosedStart(now,interval,buffer=2000){const ms=duration(interval);return Math.floor((now-buffer)/ms)*ms-ms;}
export function nextScanAt(now,interval,buffer=2000){const ms=duration(interval);return (Math.floor((now-buffer)/ms)+1)*ms+buffer;}
export function normalizeCandles(list,now,interval){
 const ms=duration(interval),map=new Map();
 for(const row of list){const a=row.slice(0,5).map(Number);if(a.length!==5||!a.every(Number.isFinite)||a[0]<0||a.slice(1).some(x=>x<=0)||a[2]<Math.max(a[1],a[4])||a[3]>Math.min(a[1],a[4])||a[2]<a[3])continue;if(a[0]+ms<=now-2000)map.set(a[0],{time:a[0],open:a[1],high:a[2],low:a[3],close:a[4]});}
 return [...map.values()].sort((a,b)=>a.time-b.time);
}
export function wilderRsi(closes,period=14){
 const out=Array(closes.length).fill(null);if(closes.length<=period)return out;
 let gain=0,loss=0;
 for(let i=1;i<=period;i++){const d=closes[i]-closes[i-1];gain+=Math.max(d,0);loss+=Math.max(-d,0);}
 gain/=period;loss/=period;
 const value=()=>gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);
 out[period]=value();
 for(let i=period+1;i<closes.length;i++){const d=closes[i]-closes[i-1];gain=(gain*(period-1)+Math.max(d,0))/period;loss=(loss*(period-1)+Math.max(-d,0))/period;out[i]=value();}
 return out;
}
export function classifySignal(rsi,s){
 let armedUp=false,armedDown=false,last=null;
 for(let i=0;i<rsi.length;i++){
  const v=rsi[i];if(!Number.isFinite(v)){armedUp=false;armedDown=false;last=null;continue;}
  if(v<=s.resetUpper)armedUp=true;if(v>=s.resetLower)armedDown=true;
  let signal=null;const prev=rsi[i-1];
  if(Number.isFinite(prev)&&prev<=s.upper&&v>s.upper){if(armedUp)signal='overbought';armedUp=false;}
  if(Number.isFinite(prev)&&prev>=s.lower&&v<s.lower){if(armedDown)signal='oversold';armedDown=false;}
  last=signal;
 }
 return last;
}
export function analyzeCandles(candles,s,expected){
 if(candles.length<Math.max(s.period+2,10))throw new Error('Chưa đủ nến cho RSI.');
 const ms=duration(s.interval),last=candles.at(-1);if(last.time!==expected)throw new Error('Nến vừa đóng chưa sẵn sàng.');
 // Never compute RSI or a crossing across a missing candle.
 let start=0;for(let i=1;i<candles.length;i++)if(candles[i].time-candles[i-1].time!==ms)start=i;
 const contiguous=candles.slice(start);if(contiguous.length<s.period+2)throw new Error('Dữ liệu nến bị gián đoạn.');
 const rsi=wilderRsi(contiguous.map(c=>c.close),s.period),kind=classifySignal(rsi,s);if(!kind)return null;
 const step=Math.max(...contiguous.slice(-10).map(c=>Math.abs(c.close-c.open)));
 const slPct=100*step/last.close;if(!(slPct>0))return null;const leverage=10/slPct;
 if(s.filterLeverage&&leverage>s.maxLeverage)return null;
 return {kind,rsi:rsi.at(-1),leverage,slPct,step,close:last.close,candleTime:last.time,closeTime:last.time+ms};
}
export function topContracts(tickers,instruments,n=50){
 const allowed=new Set(instruments.filter(x=>x.status==='Trading'&&x.quoteCoin==='USDT'&&x.settleCoin==='USDT'&&x.contractType==='LinearPerpetual'&&!x.isPreListing).map(x=>x.symbol));
 return tickers.filter(t=>allowed.has(t.symbol)&&Number.isFinite(Number(t.turnover24h))&&Number(t.turnover24h)>0).sort((a,b)=>Number(b.turnover24h)-Number(a.turnover24h)||a.symbol.localeCompare(b.symbol)).slice(0,n);
}
export function settingsKey(s){return [s.interval,s.period,s.upper,s.lower,s.resetUpper,s.resetLower].join(':');}
export function eventId(symbol,result,s){return [symbol,result.candleTime,result.kind,settingsKey(s)].join('|');}
