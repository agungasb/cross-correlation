#!/usr/bin/env python3
"""
Real-time 3D Phase Space Server: XAUEUR vs EURUSD vs Time
Supports multiple timeframes: 1m (1D), 5m (5D), 15m (1M), 1h (3M), 1d (1Y).
Fetches live data from Yahoo Finance (GC=F for Gold USD, EURUSD=X for EURUSD)
and calculates synthetic XAUEUR, triangular cross-rate arbitrage, and rolling statistics.
"""

import http.server
import socketserver
import json
import urllib.request
import urllib.error
import urllib.parse
import threading
import time
import math
import random
import os
import sys
from datetime import datetime, timezone

PORT = 8080
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

TIMEFRAME_CONFIG = {
    "1m": {"interval": "1m", "range": "1d", "ttl": 20, "label": "1 Minute (1 Day)"},
    "5m": {"interval": "5m", "range": "5d", "ttl": 60, "label": "5 Minutes (5 Days)"},
    "15m": {"interval": "15m", "range": "1mo", "ttl": 120, "label": "15 Minutes (1 Month)"},
    "1h": {"interval": "1h", "range": "3mo", "ttl": 300, "label": "1 Hour (3 Months)"},
    "1d": {"interval": "1d", "range": "1y", "ttl": 900, "label": "Daily (1 Year)"},
}

DATA_CACHE = {}
CACHE_LOCK = threading.Lock()

def fetch_yahoo_chart(symbol: str, interval: str, range_str: str):
    """Fetch raw bars from Yahoo Finance chart endpoint."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={range_str}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=7) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            result = data.get("chart", {}).get("result", [])
            if not result:
                return {}
            chart = result[0]
            timestamps = chart.get("timestamp", [])
            indicators = chart.get("indicators", {}).get("quote", [{}])[0]
            closes = indicators.get("close", [])
            
            bar_map = {}
            for t, c in zip(timestamps, closes):
                if c is not None and not math.isnan(c) and c > 0:
                    bar_map[t] = float(c)
            return bar_map
    except Exception as e:
        print(f"[WARN] Failed fetching {symbol} ({interval}/{range_str}): {e}", file=sys.stderr)
        return {}

def generate_fallback_timeframe(tf: str):
    """Generate realistic synthetic history if Yahoo Finance is unreachable."""
    cfg = TIMEFRAME_CONFIG.get(tf, TIMEFRAME_CONFIG["1m"])
    interval_sec = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400}.get(tf, 60)
    count = {"1m": 250, "5m": 250, "15m": 300, "1h": 300, "1d": 200}.get(tf, 250)
    
    now = int(time.time())
    curr_xauusd = 2720.0
    curr_eurusd = 1.0850
    start_time = now - (count * interval_sec)
    
    vol_scale = math.sqrt(interval_sec / 60.0)
    data = []
    
    for i in range(count):
        t = start_time + (i * interval_sec)
        z1 = random.gauss(0, 1)
        z2 = 0.35 * z1 + math.sqrt(1 - 0.35**2) * random.gauss(0, 1)
        
        curr_xauusd *= math.exp(0.00015 * vol_scale * z1)
        curr_eurusd *= math.exp(0.00008 * vol_scale * z2)
        
        xaueur = curr_xauusd / curr_eurusd
        usdeur = 1.0 / curr_eurusd
        
        if tf == "1d":
            dt_str = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
        else:
            dt_str = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
            
        data.append({
            "timestamp": t,
            "datetime": dt_str,
            "xauusd": round(curr_xauusd, 2),
            "eurusd": round(curr_eurusd, 5),
            "xaueur": round(xaueur, 2),
            "usdeur": round(usdeur, 5),
            "source": "simulated"
        })
    return data

def get_or_update_timeframe(tf: str, force: bool = False):
    """Retrieve synchronized bars for the given timeframe, fetching from Yahoo if stale."""
    if tf not in TIMEFRAME_CONFIG:
        tf = "1m"
    cfg = TIMEFRAME_CONFIG[tf]
    
    with CACHE_LOCK:
        cached = DATA_CACHE.get(tf)
        now = time.time()
        if cached and not force and (now - cached["last_fetch"] < cfg["ttl"]):
            return cached["data"]

    # Fetch fresh bars from Yahoo Finance
    gc_bars = fetch_yahoo_chart("GC=F", cfg["interval"], cfg["range"])
    eu_bars = fetch_yahoo_chart("EURUSD=X", cfg["interval"], cfg["range"])
    
    if not gc_bars or not eu_bars:
        with CACHE_LOCK:
            if cached:
                return cached["data"]
            fallback = generate_fallback_timeframe(tf)
            DATA_CACHE[tf] = {"data": fallback, "last_fetch": time.time()}
            return fallback

    aligned = []
    if cfg["interval"] == "1d":
        # Group by UTC calendar date
        gc_dates = {datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d"): (t, c) for t, c in gc_bars.items()}
        eu_dates = {datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d"): (t, c) for t, c in eu_bars.items()}
        common_dates = sorted(set(gc_dates.keys()) & set(eu_dates.keys()))
        
        for d in common_dates:
            t_bar = gc_dates[d][0]
            xau = gc_dates[d][1]
            eur = eu_dates[d][1]
            aligned.append({
                "timestamp": t_bar,
                "datetime": d,
                "xauusd": round(xau, 2),
                "eurusd": round(eur, 5),
                "xaueur": round(xau / eur, 2),
                "usdeur": round(1.0 / eur, 5),
                "source": "yahoo"
            })
    else:
        # Intraday: exact timestamp match
        common_ts = sorted(set(gc_bars.keys()) & set(eu_bars.keys()))
        for t in common_ts:
            xau = gc_bars[t]
            eur = eu_bars[t]
            dt_str = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
            aligned.append({
                "timestamp": t,
                "datetime": dt_str,
                "xauusd": round(xau, 2),
                "eurusd": round(eur, 5),
                "xaueur": round(xau / eur, 2),
                "usdeur": round(1.0 / eur, 5),
                "source": "yahoo"
            })
            
    if not aligned:
        with CACHE_LOCK:
            if cached:
                return cached["data"]
            aligned = generate_fallback_timeframe(tf)

    with CACHE_LOCK:
        DATA_CACHE[tf] = {"data": aligned, "last_fetch": time.time()}
        
    print(f"[OK] Timeframe {tf} updated: {len(aligned)} synchronized bars. Latest: XAUUSD={aligned[-1]['xauusd']}, EURUSD={aligned[-1]['eurusd']}")
    return aligned

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if parsed.path == "/api/history":
            tf = params.get("timeframe", ["1m"])[0]
            data = get_or_update_timeframe(tf)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            resp = {
                "timeframe": tf,
                "label": TIMEFRAME_CONFIG.get(tf, {}).get("label", tf),
                "count": len(data),
                "data": data
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        elif parsed.path == "/api/live":
            tf = params.get("timeframe", ["1m"])[0]
            data = get_or_update_timeframe(tf)
            latest = data[-1] if data else None
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "timeframe": tf,
                "latest": latest,
                "server_time": time.time()
            }).encode("utf-8"))
            return

        elif parsed.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            with CACHE_LOCK:
                cached_tfs = {k: len(v["data"]) for k, v in DATA_CACHE.items()}
            self.wfile.write(json.dumps({
                "status": "online",
                "timeframes": TIMEFRAME_CONFIG,
                "cached": cached_tfs
            }).encode("utf-8"))
            return

        return super().do_GET()

def prefill_cache():
    """Initial population for default timeframes in background."""
    print("[INFO] Initializing cache for timeframes (1m, 5m, 15m, 1h, 1d)...")
    for tf in ["1m", "5m", "15m", "1h", "1d"]:
        try:
            get_or_update_timeframe(tf)
        except Exception as e:
            print(f"[WARN] Error pre-populating {tf}: {e}", file=sys.stderr)

def run_server():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    
    # Pre-populate 1m first so server is immediately ready
    get_or_update_timeframe("1m")
    
    # Pre-populate other timeframes in background thread
    t = threading.Thread(target=prefill_cache, daemon=True)
    t.start()
    
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        print(f"\n=======================================================")
        print(f"🚀 Real-Time 3D Triad Phase Space Server active at:")
        print(f"   http://localhost:{PORT}")
        print(f"   Timeframes: 1m, 5m, 15m, 1h, 1d")
        print(f"=======================================================\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    run_server()
