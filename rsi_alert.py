#!/usr/bin/env python3
from __future__ import annotations
import html, json, os, sys, time, urllib.parse, urllib.request
from datetime import datetime, timezone
from typing import Any

OKX_API="https://www.okx.com/api/v5"
TOP_N=50
RSI_PERIOD=14
OVERBOUGHT=70.0
OVERSOLD=30.0
BAR="15m"
TIMEOUT=25

def log(message:str)->None:
    print(f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {message}", flush=True)

def get_json(url:str):
    request=urllib.request.Request(url,headers={"User-Agent":"OKX-RSI-Scanner/4.0"})
    with urllib.request.urlopen(request,timeout=TIMEOUT) as response:
        payload=json.loads(response.read().decode("utf-8"))
    if payload.get("code")!="0":
        raise RuntimeError(payload.get("msg") or f"OKX error {payload.get('code')}")
    return payload["data"]

def post_form(url:str,fields:dict[str,str]):
    data=urllib.parse.urlencode(fields).encode("utf-8")
    request=urllib.request.Request(url,data=data,headers={"User-Agent":"OKX-RSI-Scanner/4.0"})
    with urllib.request.urlopen(request,timeout=TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))

def rsi_series(closes:list[float],period:int=RSI_PERIOD):
    out=[None]*len(closes)
    if len(closes)<period+1:return out
    gain=loss=0.0
    for i in range(1,period+1):
        delta=closes[i]-closes[i-1]
        gain+=max(delta,0.0);loss+=max(-delta,0.0)
    avg_gain,avg_loss=gain/period,loss/period
    def calc():
        if avg_loss==0:return 100.0
        return 100.0-100.0/(1.0+avg_gain/avg_loss)
    out[period]=calc()
    for i in range(period+1,len(closes)):
        delta=closes[i]-closes[i-1]
        avg_gain=(avg_gain*(period-1)+max(delta,0.0))/period
        avg_loss=(avg_loss*(period-1)+max(-delta,0.0))/period
        out[i]=calc()
    return out

def top_contracts():
    rows=get_json(f"{OKX_API}/market/tickers?instType=SWAP")
    ranked=[]
    for row in rows:
        inst=str(row.get("instId",""))
        if not inst.endswith("-USDT-SWAP"):continue
        try:last=float(row["last"]);base=float(row.get("volCcy24h") or 0)
        except (KeyError,TypeError,ValueError):continue
        if last<=0:continue
        row["quoteVolumeEstimate"]=last*base
        ranked.append(row)
    ranked.sort(key=lambda x:x["quoteVolumeEstimate"],reverse=True)
    return ranked[:TOP_N]

def inspect_contract(ticker:dict[str,Any]):
    inst=ticker["instId"]
    params=urllib.parse.urlencode({"instId":inst,"bar":BAR,"limit":"100"})
    candles=get_json(f"{OKX_API}/market/candles?{params}")
    # Chỉ dùng nến đã xác nhận: confirm == 1. API trả nến mới nhất trước.
    closed=[row for row in candles if str(row[8])=="1"]
    closed.reverse()
    closes=[float(row[4]) for row in closed]
    values=rsi_series(closes)
    valid=[(i,v) for i,v in enumerate(values) if v is not None]
    if len(valid)<2:return None
    prev_i,prev=valid[-2];curr_i,curr=valid[-1]
    direction=None
    if prev<=OVERBOUGHT<curr:direction="up"
    elif prev>=OVERSOLD>curr:direction="down"
    return {"inst":inst,"symbol":inst.replace("-USDT-SWAP","USDT.P").replace("-",""),
            "previous":prev,"current":curr,"price":closes[curr_i],"direction":direction,
            "closedTs":int(closed[curr_i][0])}

def credentials():
    token=os.getenv("TELEGRAM_BOT_TOKEN","").strip();chat=os.getenv("TELEGRAM_CHAT_ID","").strip()
    if not token or not chat:raise RuntimeError("Thiếu Telegram Secrets")
    return token,chat

def send_telegram(text:str):
    token,chat=credentials()
    result=post_form(f"https://api.telegram.org/bot{token}/sendMessage",{
        "chat_id":chat,"text":text,"parse_mode":"HTML","disable_web_page_preview":"true"})
    if not result.get("ok"):raise RuntimeError(f"Telegram error: {result}")

def fmt_price(value:float):
    if value>=1000:return f"{value:,.2f}"
    if value>=1:return f"{value:,.4f}".rstrip("0").rstrip(".")
    return f"{value:.8f}".rstrip("0").rstrip(".")

def send_test():
    send_telegram("✅ <b>OKX RSI Scanner 4.0 đã kết nối</b>\n\nLịch quét: khoảng 1 phút sau mỗi nến 15 phút đóng.\nBot chỉ dùng nến OKX đã xác nhận.")

def main():
    if os.getenv("TEST_ONLY","").lower()=="true":
        send_test();log("Telegram test sent");return
    log("Starting 15m closed-candle scan")
    tickers=top_contracts();log(f"Loaded {len(tickers)} top USDT perpetual contracts")
    inspected=[];signals=[]
    for index,ticker in enumerate(tickers,1):
        try:
            row=inspect_contract(ticker)
            if row:
                inspected.append(row)
                if row["direction"]:signals.append(row)
        except Exception as exc:
            log(f"WARNING {ticker.get('instId')}: {exc}")
        if index%8==0:time.sleep(.35)
    over=sum(1 for x in inspected if x["current"]>OVERBOUGHT)
    under=sum(1 for x in inspected if x["current"]<OVERSOLD)
    log(f"Scanned {len(inspected)}/{len(tickers)} contracts")
    log(f"Current zones: RSI>70={over}, RSI<30={under}")
    log(f"Fresh crossings: {len(signals)}")
    if not signals:
        log("No Telegram alert needed");return
    lines=["🔔 <b>OKX RSI 15m — NẾN VỪA ĐÓNG</b>",""]
    for signal in sorted(signals,key=lambda x:x["current"],reverse=True):
        icon,label=("🔴","CẮT LÊN 70") if signal["direction"]=="up" else ("🟢","CẮT XUỐNG 30")
        closed=datetime.fromtimestamp(signal["closedTs"]/1000,tz=timezone.utc).strftime("%H:%M UTC")
        lines += [f"{icon} <b>{html.escape(signal['symbol'])}</b> — {label}",
                  f"RSI: <code>{signal['previous']:.1f} → {signal['current']:.1f}</code>",
                  f"Giá: <code>{fmt_price(signal['price'])}</code>",f"Nến: <code>{closed}</code>",""]
    lines.append("Chỉ báo kỹ thuật, không phải khuyến nghị đầu tư.")
    send_telegram("\n".join(lines));log(f"Telegram sent: {len(signals)} signal(s)")

if __name__=="__main__":
    try:main()
    except Exception as exc:
        log(f"FATAL: {exc}");raise
