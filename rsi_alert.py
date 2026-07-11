#!/usr/bin/env python3
"""OKX RSI 15m Telegram alert — no third-party packages required."""

from __future__ import annotations
import html
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

OKX_API = "https://www.okx.com/api/v5"
TOP_N = 50
RSI_PERIOD = 14
OVERBOUGHT = 70.0
OVERSOLD = 30.0
BAR = "15m"
TIMEOUT = 20


def get_json(url: str) -> list[dict[str, Any]] | list[list[str]]:
    request = urllib.request.Request(url, headers={"User-Agent": "OKX-RSI-Scanner/2.0"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("code") != "0":
        raise RuntimeError(payload.get("msg") or f"OKX error {payload.get('code')}")
    return payload["data"]


def post_form(url: str, fields: dict[str, str]) -> dict[str, Any]:
    data = urllib.parse.urlencode(fields).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={"User-Agent": "OKX-RSI-Scanner/2.0"})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def rsi_series(closes: list[float], period: int = RSI_PERIOD) -> list[float | None]:
    """Wilder RSI values aligned to closes."""
    out: list[float | None] = [None] * len(closes)
    if len(closes) < period + 1:
        return out
    gain = loss = 0.0
    for i in range(1, period + 1):
        delta = closes[i] - closes[i - 1]
        gain += max(delta, 0.0)
        loss += max(-delta, 0.0)
    avg_gain, avg_loss = gain / period, loss / period

    def calc() -> float:
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - 100.0 / (1.0 + rs)

    out[period] = calc()
    for i in range(period + 1, len(closes)):
        delta = closes[i] - closes[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(delta, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-delta, 0.0)) / period
        out[i] = calc()
    return out


def top_contracts() -> list[dict[str, Any]]:
    rows = get_json(f"{OKX_API}/market/tickers?instType=SWAP")
    ranked: list[dict[str, Any]] = []
    for row in rows:
        inst_id = str(row.get("instId", ""))
        if not inst_id.endswith("-USDT-SWAP"):
            continue
        try:
            last = float(row["last"])
            base_volume = float(row.get("volCcy24h") or 0)
        except (KeyError, TypeError, ValueError):
            continue
        if last <= 0:
            continue
        row["quoteVolumeEstimate"] = last * base_volume
        ranked.append(row)
    ranked.sort(key=lambda x: x["quoteVolumeEstimate"], reverse=True)
    return ranked[:TOP_N]


def contract_signal(ticker: dict[str, Any]) -> dict[str, Any] | None:
    inst_id = ticker["instId"]
    params = urllib.parse.urlencode({"instId": inst_id, "bar": BAR, "limit": "100"})
    candles = get_json(f"{OKX_API}/market/candles?{params}")

    # OKX returns newest first. Index 8 = 1 means confirmed/closed candle.
    confirmed = [row for row in candles if str(row[8]) == "1"]
    confirmed.reverse()
    closes = [float(row[4]) for row in confirmed]
    timestamps = [int(row[0]) for row in confirmed]
    values = rsi_series(closes)
    valid = [(i, value) for i, value in enumerate(values) if value is not None]
    if len(valid) < 2:
        return None

    prev_i, prev_rsi = valid[-2]
    curr_i, curr_rsi = valid[-1]
    direction = None
    if prev_rsi <= OVERBOUGHT < curr_rsi:
        direction = "up"
    elif prev_rsi >= OVERSOLD > curr_rsi:
        direction = "down"
    if direction is None:
        return None

    return {
        "instId": inst_id,
        "symbol": inst_id.replace("-USDT-SWAP", "USDT.P").replace("-", ""),
        "direction": direction,
        "previousRsi": prev_rsi,
        "currentRsi": curr_rsi,
        "price": closes[curr_i],
        "candleTime": datetime.fromtimestamp(timestamps[curr_i] / 1000, tz=timezone.utc),
    }


def fmt_price(value: float) -> str:
    if value >= 1000:
        return f"{value:,.2f}"
    if value >= 1:
        return f"{value:,.4f}".rstrip("0").rstrip(".")
    return f"{value:.8f}".rstrip("0").rstrip(".")


def telegram_credentials() -> tuple[str, str]:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        raise RuntimeError("Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong GitHub Secrets.")
    return token, chat_id


def send_telegram(text: str) -> None:
    token, chat_id = telegram_credentials()
    result = post_form(
        f"https://api.telegram.org/bot{token}/sendMessage",
        {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": "true",
        },
    )
    if not result.get("ok"):
        raise RuntimeError(f"Telegram error: {result}")


def test_message() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    send_telegram(
        "✅ <b>OKX RSI Scanner 2.0 đã kết nối</b>\n\n"
        "Bot sẽ quét top 50 hợp đồng USDT perpetual sau mỗi nến 15 phút đóng.\n"
        "• Báo khi RSI vừa cắt lên 70\n"
        "• Báo khi RSI vừa cắt xuống 30\n\n"
        f"Thời gian kiểm tra: <code>{now}</code>"
    )


def main() -> int:
    if os.getenv("TEST_ONLY", "").lower() == "true":
        test_message()
        print("Telegram test sent.")
        return 0

    tickers = top_contracts()
    signals: list[dict[str, Any]] = []
    for index, ticker in enumerate(tickers, start=1):
        try:
            signal = contract_signal(ticker)
            if signal:
                signals.append(signal)
        except Exception as exc:
            print(f"Warning {ticker.get('instId')}: {exc}", file=sys.stderr)
        if index % 8 == 0:
            time.sleep(0.35)

    if not signals:
        print(f"No RSI crossing signals among {len(tickers)} contracts.")
        return 0

    signals.sort(key=lambda x: x["currentRsi"], reverse=True)
    lines = ["🔔 <b>OKX RSI 15m ALERT</b>", ""]
    for s in signals:
        if s["direction"] == "up":
            icon, label = "🔴", "CẮT LÊN 70"
        else:
            icon, label = "🟢", "CẮT XUỐNG 30"
        lines.extend(
            [
                f"{icon} <b>{html.escape(s['symbol'])}</b> — {label}",
                f"RSI: <code>{s['previousRsi']:.1f} → {s['currentRsi']:.1f}</code>",
                f"Giá: <code>{fmt_price(s['price'])}</code>",
                "",
            ]
        )
    lines.append("Dữ liệu lấy từ nến OKX đã đóng. Không phải khuyến nghị đầu tư.")
    send_telegram("\n".join(lines))
    print(f"Sent {len(signals)} signal(s).")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Fatal error: {exc}", file=sys.stderr)
        raise
