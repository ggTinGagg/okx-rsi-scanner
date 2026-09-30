const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const ctx=await browser.newContext({viewport:{width:1440,height:1050}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const now=Math.floor(Date.now()/300000)*300000+10000;
 let topN=50,scanRound=0;const requests=[];
 const symbol=i=>['BTCUSDT','ETHUSDT','SOLUSDT'][i]||`TEST${i}USDT`;
 await page.route('https://api.bybit.com/**',async route=>{const u=new URL(route.request().url());requests.push(u.pathname);let result={};
  if(u.pathname.endsWith('/time')){scanRound++;result={timeSecond:String(Math.floor(now/1000))};}
  if(u.pathname.endsWith('/instruments-info'))result={list:Array.from({length:topN},(_,i)=>({symbol:symbol(i),status:'Trading',quoteCoin:'USDT',settleCoin:'USDT',contractType:'LinearPerpetual',isPreListing:false})),nextPageCursor:''};
  if(u.pathname.endsWith('/tickers'))result={list:Array.from({length:topN},(_,i)=>({symbol:symbol(i),turnover24h:String(1e9-i*1e6)}))};
  if(u.pathname.endsWith('/kline')){const sym=u.searchParams.get('symbol'),step=Number(u.searchParams.get('interval'))*60000,close=Number(u.searchParams.get('end'))+1,base=sym==='BTCUSDT'?65000:sym==='ETHUSDT'?3000:sym==='SOLUSDT'?150:100;
   const amp=base*(sym==='ETHUSDT'?.00001:.0007);const list=Array.from({length:500},(_,j)=>{const t=close-(500-j)*step;let c=base+(j%2?amp:0),op=c-amp/4;if(j===499&&sym==='BTCUSDT'){c=base*1.009;op=base;}if(j===499&&sym==='ETHUSDT'){c=base*1.0009;op=base;}if(j===499&&sym==='SOLUSDT'){c=base*.98;op=base;}return [String(t),String(op),String(Math.max(op,c)+amp),String(Math.min(op,c)-amp),String(c),'10','1000'];}).reverse();result={list};}
  await route.fulfill({json:{retCode:0,time:now,result}});
 });
 await page.goto('http://127.0.0.1:8765/');await page.waitForFunction(()=>document.querySelector('#scan-status').textContent.includes('Hoàn tất'),{timeout:30000});
 assert.equal(await page.locator('#signal-count').textContent(),'2');assert.equal(await page.locator('#history-count').textContent(),'2');assert.equal(await page.locator('#over-count').textContent(),'1');assert.equal(await page.locator('#under-count').textContent(),'1');assert.ok(!(await page.locator('#signals').textContent()).includes('ETHUSDT'),'ETH high leverage should be excluded');
 await page.locator('#scan').click();await page.waitForFunction(()=>!document.querySelector('#scan').disabled);assert.equal(await page.locator('#history-count').textContent(),'2','manual repeat must not duplicate history');
 await page.locator('#filterLeverage').uncheck();await page.locator('#scan').click();await page.waitForFunction(()=>!document.querySelector('#scan').disabled);assert.equal(await page.locator('#signal-count').textContent(),'3');assert.equal(await page.locator('#history-count').textContent(),'3');
 await page.locator('[data-upper="80"]').click();assert.equal(await page.locator('#resetUpper').inputValue(),'70');assert.equal(await page.locator('#resetLower').inputValue(),'30');
 await page.locator('[data-upper="70"]').click();await page.locator('#filterLeverage').check();await page.locator('#scan').click();await page.waitForFunction(()=>!document.querySelector('#scan').disabled);
 await page.screenshot({path:'preview-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'preview-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page overflow');
 assert.deepEqual(errors,[]);
 // Local state must survive refresh.
 await page.reload();await page.waitForFunction(()=>document.querySelector('#scan-status').textContent.includes('Hoàn tất'));assert.equal(await page.locator('#history-count').textContent(),'3');
 console.log(JSON.stringify({checks:10,signalRows:2,historyRows:3,apiCalls:requests.length,scans:scanRound,errors,mockData:true}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
