#!/usr/bin/env python3
from __future__ import annotations
import argparse, html, json, os, time, urllib.parse, urllib.request
from datetime import datetime, timezone

OKX_API="https://www.okx.com/api/v5"
TOP_N=50
BAR="15m"
PERIOD=14
OVERBOUGHT=70.0
OVERSOLD=30.0
TIMEOUT=25

def log(msg):
    print(f"[{datetime.now(timezone.utc).isoformat(timespec='seconds')}] {msg}", flush=True)

def get_json(url):
    req=urllib.request.Request(url,headers={"User-Agent":"OKX-RSI-Scanner/4.1"})
    with urllib.request.urlopen(req,timeout=TIMEOUT) as r:
        payload=json.loads(r.read().decode("utf-8"))
    if payload.get("code")!="0":
        raise RuntimeError(payload.get("msg") or payload.get("code"))
    return payload["data"]

def post_form(url,fields):
    req=urllib.request.Request(url,data=urllib.parse.urlencode(fields).encode(),headers={"User-Agent":"OKX-RSI-Scanner/4.1"})
    with urllib.request.urlopen(req,timeout=TIMEOUT) as r:
        return json.loads(r.read().decode("utf-8"))

def confirmed_candles(inst_id,limit=100):
    q=urllib.parse.urlencode({"instId":inst_id,"bar":BAR,"limit":str(limit)})
    rows=get_json(f"{OKX_API}/market/candles?{q}")
    rows=[x for x in rows if len(x)>8 and str(x[8])=="1"]
    rows.reverse()
    return rows

def latest_candle_id():
    rows=confirmed_candles("BTC-USDT-SWAP",5)
    if not rows: raise RuntimeError("Không tìm thấy nến BTC 15m đã xác nhận")
    return str(rows[-1][0])

def rsi_series(closes,period=PERIOD):
    out=[None]*len(closes)
    if len(closes)<period+1:return out
    gain=loss=0.0
    for i in range(1,period+1):
        d=closes[i]-closes[i-1]
        gain+=max(d,0); loss+=max(-d,0)
    ag,al=gain/period,loss/period
    def calc(): return 100.0 if al==0 else 100-100/(1+ag/al)
    out[period]=calc()
    for i in range(period+1,len(closes)):
        d=closes[i]-closes[i-1]
        ag=(ag*(period-1)+max(d,0))/period
        al=(al*(period-1)+max(-d,0))/period
        out[i]=calc()
    return out

def top_contracts():
    rows=get_json(f"{OKX_API}/market/tickers?instType=SWAP")
    ranked=[]
    for row in rows:
        inst=str(row.get("instId",""))
        if not inst.endswith("-USDT-SWAP"): continue
        try:
            last=float(row["last"]); base=float(row.get("volCcy24h") or 0)
        except (KeyError,TypeError,ValueError):
            continue
        if last<=0: continue
        row["rank_volume"]=last*base
        ranked.append(row)
    ranked.sort(key=lambda x:x["rank_volume"],reverse=True)
    return ranked[:TOP_N]

def inspect(ticker):
    inst=ticker["instId"]
    candles=confirmed_candles(inst,100)
    closes=[float(x[4]) for x in candles]
    vals=rsi_series(closes)
    valid=[(i,v) for i,v in enumerate(vals) if v is not None]
    if len(valid)<2:return None
    pi,prev=valid[-2]; ci,curr=valid[-1]
    direction=None
    if prev<=OVERBOUGHT<curr: direction="up"
    elif prev>=OVERSOLD>curr: direction="down"
    return {"inst":inst,"symbol":inst.replace("-USDT-SWAP","USDT.P").replace("-",""),
            "prev":float(prev),"curr":float(curr),"price":closes[ci],"direction":direction}

def creds():
    token=os.getenv("TELEGRAM_BOT_TOKEN","").strip()
    chat=os.getenv("TELEGRAM_CHAT_ID","").strip()
    if not token or not chat: raise RuntimeError("Thiếu Telegram Secrets")
    return token,chat

def send(text):
    token,chat=creds()
    result=post_form(f"https://api.telegram.org/bot{token}/sendMessage",
                     {"chat_id":chat,"text":text,"parse_mode":"HTML","disable_web_page_preview":"true"})
    if not result.get("ok"): raise RuntimeError(str(result))

def fmt_price(v):
    if v>=1000:return f"{v:,.2f}"
    if v>=1:return f"{v:,.4f}".rstrip("0").rstrip(".")
    return f"{v:.8f}".rstrip("0").rstrip(".")

def test_message():
    send("✅ <b>OKX RSI Scanner v4.1 Stable đã kết nối</b>\n\n• Kiểm tra mỗi 5 phút\n• Mỗi nến 15 phút chỉ xử lý một lần\n• Chỉ dùng nến OKX đã xác nhận")

def scan():
    cid=latest_candle_id()
    opened=datetime.fromtimestamp(int(cid)/1000,tz=timezone.utc)
    closed=datetime.fromtimestamp(int(cid)/1000+900,tz=timezone.utc)
    log(f"Processing candle {opened:%H:%M}-{closed:%H:%M} UTC")
    tickers=top_contracts()
    log(f"Loaded top contracts: {len(tickers)}")
    inspected=[]; signals=[]
    for i,t in enumerate(tickers,1):
        try:
            row=inspect(t)
            if row:
                inspected.append(row)
                if row["direction"]: signals.append(row)
        except Exception as e:
            log(f"WARNING {t.get('instId')}: {e}")
        if i%8==0: time.sleep(.35)
    over=sum(1 for x in inspected if x["curr"]>OVERBOUGHT)
    under=sum(1 for x in inspected if x["curr"]<OVERSOLD)
    log(f"Scanned {len(inspected)}/{len(tickers)}")
    log(f"Current zones: RSI>70={over}, RSI<30={under}")
    log(f"Fresh crossings: {len(signals)}")
    if not signals:
        log("No Telegram alert required")
        return
    lines=["🔔 <b>OKX RSI 15m — NẾN VỪA ĐÓNG</b>",f"<code>{opened:%H:%M}-{closed:%H:%M} UTC</code>",""]
    for s in sorted(signals,key=lambda x:x["curr"],reverse=True):
        icon,label=("🔴","CẮT LÊN 70") if s["direction"]=="up" else ("🟢","CẮT XUỐNG 30")
        lines += [f"{icon} <b>{html.escape(s['symbol'])}</b> — {label}",
                  f"RSI: <code>{s['prev']:.1f} → {s['curr']:.1f}</code>",
                  f"Giá: <code>{fmt_price(s['price'])}</code>",""]
    lines.append("Chỉ báo kỹ thuật, không phải khuyến nghị đầu tư.")
    send("\n".join(lines))
    log(f"Telegram sent: {len(signals)} signal(s)")

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--candle-id",action="store_true")
    p.add_argument("--test",action="store_true")
    a=p.parse_args()
    if a.candle_id:
        print(latest_candle_id()); return
    if a.test:
        test_message(); log("Telegram test sent"); return
    scan()

if __name__=="__main__":
    main()
