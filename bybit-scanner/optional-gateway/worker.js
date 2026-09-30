// OPTIONAL public-market-only gateway for a deployment that needs CORS handling.
// Not used by default. No keys, signed endpoints, arbitrary URLs, or trading.
const PATHS=new Set(['/v5/market/time','/v5/market/tickers','/v5/market/instruments-info','/v5/market/kline']);
export default {
 async fetch(request,env={}){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'';
  if(!allowed)return new Response('Set ALLOWED_ORIGIN to your Pages origin.',{status:503});
  const cors={'Access-Control-Allow-Origin':allowed,'Vary':'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
  if(origin&&origin!==allowed)return new Response('Origin not allowed',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(request.method!=='GET')return new Response('GET only',{status:405,headers:cors});
  const input=new URL(request.url);if(!PATHS.has(input.pathname))return new Response('Public market path only',{status:404,headers:cors});
  const upstream=new URL('https://api.bybit.com'+input.pathname);
  const valid=new Set(['category','symbol','interval','limit','end','cursor','status']);
  for(const [key,value] of input.searchParams){if(!valid.has(key))return new Response('Invalid parameter',{status:400,headers:cors});upstream.searchParams.set(key,value);}
  if(input.pathname!=='/v5/market/time')upstream.searchParams.set('category','linear');
  if(input.searchParams.has('limit')&&(!/^\d+$/.test(input.searchParams.get('limit'))||Number(input.searchParams.get('limit'))>1000))return new Response('Invalid limit',{status:400,headers:cors});
  try{const response=await fetch(upstream,{signal:AbortSignal.timeout(10000)});const body=await response.text();JSON.parse(body);return new Response(body,{status:response.status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});}catch{return Response.json({retCode:-1,retMsg:'Public Bybit API unavailable from this gateway.'},{status:502,headers:cors});}
 }
};
