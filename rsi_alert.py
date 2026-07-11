#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

OKX_API = "https://www.okx.com/api/v5"
TOP_N = 50
BAR = "15m"
RSI_PERIOD = 14
OVERBOUGHT = 70.0
OVERSOLD = 30.0
TIMEOUT_SECONDS = 25


def log(message: str) -> None:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    print(f"[{now}] {message}", flush=True)


def get_json(url: str) -> list[Any]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "OKX-RSI-Scanner/4.1.1"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if payload.get("code") != "0":
        raise RuntimeError(payload.get("msg") or f"OKX error {payload.get('code')}")
    return payload["data"]


def post_form(url: str, fields: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(fields).encode("utf-8"),
        headers={"User-Agent": "OKX-RSI-Scanner/4.1.1"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def confirmed_candles(inst_id: str, limit: int = 100) -> list[list[str]]:
    query = urllib.parse.urlencode(
        {"instId": inst_id, "bar": BAR, "limit": str(limit)}
    )
    rows = get_json(f"{OKX_API}/market/candles?{query}")
    closed = [row for row in rows if len(row) > 8 and str(row[8]) == "1"]
    closed.reverse()
    return closed


def latest_candle_id() -> str:
    rows = confirmed_candles("BTC-USDT-SWAP", 5)
    if not rows:
        raise RuntimeError("Không tìm thấy nến BTC 15m đã xác nhận.")
    return str(rows[-1][0])


def rsi_series(closes: list[float], period: int = RSI_PERIOD) -> list[float | None]:
    values: list[float | None] = [None] * len(closes)
    if len(closes) < period + 1:
        return values

    gain = 0.0
    loss = 0.0

    for index in range(1, period + 1):
        delta = closes[index] - closes[index - 1]
        gain += max(delta, 0.0)
        loss += max(-delta, 0.0)

    avg_gain = gain / period
    avg_loss = loss / period

    def current_rsi() -> float:
        if avg_loss == 0:
            return 100.0
        ratio = avg_gain / avg_loss
        return 100.0 - 100.0 / (1.0 + ratio)

    values[period] = current_rsi()

    for index in range(period + 1, len(closes)):
        delta = closes[index] - closes[index - 1]
        avg_gain = (avg_gain * (period - 1) + max(delta, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-delta, 0.0)) / period
        values[index] = current_rsi()

    return values


def top_contracts() -> list[dict[str, Any]]:
    tickers = get_json(f"{OKX_API}/market/tickers?instType=SWAP")
    ranked: list[dict[str, Any]] = []

    for ticker in tickers:
        inst_id = str(ticker.get("instId", ""))
        if not inst_id.endswith("-USDT-SWAP"):
            continue

        try:
            last_price = float(ticker["last"])
            base_volume = float(ticker.get("volCcy24h") or 0)
        except (KeyError, TypeError, ValueError):
            continue

        if last_price <= 0:
            continue

        ticker["estimated_quote_volume"] = last_price * base_volume
        ranked.append(ticker)

    ranked.sort(
        key=lambda row: row["estimated_quote_volume"],
        reverse=True,
    )
    return ranked[:TOP_N]


def inspect_contract(ticker: dict[str, Any]) -> dict[str, Any] | None:
    inst_id = str(ticker["instId"])
    candles = confirmed_candles(inst_id, 100)
    closes = [float(row[4]) for row in candles]
    rsi_values = rsi_series(closes)
    valid = [
        (index, value)
        for index, value in enumerate(rsi_values)
        if value is not None
    ]

    if len(valid) < 2:
        return None

    _, previous_rsi = valid[-2]
    current_index, current_rsi = valid[-1]

    direction: str | None = None
    if previous_rsi <= OVERBOUGHT < current_rsi:
        direction = "up"
    elif previous_rsi >= OVERSOLD > current_rsi:
        direction = "down"

    return {
        "inst_id": inst_id,
        "symbol": inst_id.replace("-USDT-SWAP", "USDT.P").replace("-", ""),
        "previous_rsi": float(previous_rsi),
        "current_rsi": float(current_rsi),
        "price": closes[current_index],
        "direction": direction,
    }


def telegram_credentials() -> tuple[str, str]:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()

    if not token or not chat_id:
        raise RuntimeError(
            "Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong GitHub Secrets."
        )
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


def format_price(value: float) -> str:
    if value >= 1000:
        return f"{value:,.2f}"
    if value >= 1:
        return f"{value:,.4f}".rstrip("0").rstrip(".")
    return f"{value:.8f}".rstrip("0").rstrip(".")


def send_test_message() -> None:
    send_telegram(
        "✅ <b>OKX RSI Scanner v4.1.1 Stable đã kết nối</b>\n\n"
        "• GitHub kiểm tra mỗi 5 phút\n"
        "• Mỗi nến 15 phút chỉ xử lý một lần\n"
        "• Chỉ dùng nến OKX đã xác nhận\n"
        "• Báo khi RSI cắt lên 70 hoặc cắt xuống 30"
    )


def scan_market() -> None:
    candle_id = latest_candle_id()
    candle_open = datetime.fromtimestamp(int(candle_id) / 1000, tz=timezone.utc)
    candle_close = datetime.fromtimestamp(
        int(candle_id) / 1000 + 15 * 60,
        tz=timezone.utc,
    )

    log(
        "Processing confirmed candle: "
        f"{candle_open:%Y-%m-%d %H:%M}-{candle_close:%H:%M} UTC"
    )

    tickers = top_contracts()
    log(f"Loaded top contracts: {len(tickers)}")

    inspected: list[dict[str, Any]] = []
    signals: list[dict[str, Any]] = []

    for index, ticker in enumerate(tickers, start=1):
        try:
            result = inspect_contract(ticker)
            if result is not None:
                inspected.append(result)
                if result["direction"] is not None:
                    signals.append(result)
        except Exception as exc:
            log(f"WARNING {ticker.get('instId')}: {exc}")

        if index % 8 == 0:
            time.sleep(0.35)

    overbought_count = sum(
        1 for row in inspected if row["current_rsi"] > OVERBOUGHT
    )
    oversold_count = sum(
        1 for row in inspected if row["current_rsi"] < OVERSOLD
    )

    log(f"Scanned successfully: {len(inspected)}/{len(tickers)}")
    log(
        "Current zones: "
        f"RSI>70={overbought_count}, RSI<30={oversold_count}"
    )
    log(f"Fresh crossings: {len(signals)}")

    if not signals:
        log("No Telegram alert required for this candle.")
        return

    signals.sort(
        key=lambda row: row["current_rsi"],
        reverse=True,
    )

    lines = [
        "🔔 <b>OKX RSI 15m — NẾN VỪA ĐÓNG</b>",
        f"<code>{candle_open:%H:%M}-{candle_close:%H:%M} UTC</code>",
        "",
    ]

    for signal in signals:
        if signal["direction"] == "up":
            icon = "🔴"
            label = "CẮT LÊN 70"
        else:
            icon = "🟢"
            label = "CẮT XUỐNG 30"

        lines.extend(
            [
                f"{icon} <b>{html.escape(signal['symbol'])}</b> — {label}",
                (
                    "RSI: "
                    f"<code>{signal['previous_rsi']:.1f} → "
                    f"{signal['current_rsi']:.1f}</code>"
                ),
                f"Giá: <code>{format_price(signal['price'])}</code>",
                "",
            ]
        )

    lines.append("Chỉ báo kỹ thuật, không phải khuyến nghị đầu tư.")
    send_telegram("\n".join(lines))
    log(f"Telegram sent: {len(signals)} signal(s).")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--candle-id", action="store_true")
    parser.add_argument("--test", action="store_true")
    args = parser.parse_args()

    if args.candle_id:
        print(latest_candle_id())
        return

    if args.test:
        send_test_message()
        log("Telegram test sent.")
        return

    scan_market()


if __name__ == "__main__":
    main()
