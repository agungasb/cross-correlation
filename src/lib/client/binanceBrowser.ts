import {
  MarketBar,
  TimeframeId,
  TRIAD_CONFIGS,
  TriadPairId,
} from "@/types/market";
import {
  generateFallbackTimeframe,
  TIMEFRAME_CONFIG,
} from "@/lib/server/yahoo";
import { fetchYahooSymbolBrowser } from "@/lib/client/yahooBrowser";

interface BinanceBrowserCacheEntry {
  data: MarketBar[];
  lastFetch: number;
}

const BINANCE_BROWSER_CACHE: Record<string, BinanceBrowserCacheEntry> = {};

function formatBarTimestamp(unixSec: number, isDaily: boolean): string {
  const d = new Date(unixSec * 1000);
  if (isDaily) {
    return d.toISOString().slice(0, 10);
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

async function fetchBinanceVisionKlines(
  symbol: string,
  interval: TimeframeId,
  intervalSec: number,
  limit = 500
): Promise<Map<number, number>> {
  const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(
    symbol
  )}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

  try {
    const resp = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(7500),
    });
    if (!resp.ok) return new Map();

    const rows = await resp.json();
    if (!Array.isArray(rows)) return new Map();

    const barMap = new Map<number, number>();
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 5) continue;
      const openTimeMs = Number(row[0]);
      const closePrice = Number(row[4]);
      if (
        Number.isFinite(openTimeMs) &&
        openTimeMs > 0 &&
        Number.isFinite(closePrice) &&
        closePrice > 0
      ) {
        const unixSec = Math.floor(openTimeMs / 1000);
        const bucketTs =
          interval === "1d"
            ? unixSec
            : Math.floor(unixSec / intervalSec) * intervalSec;
        barMap.set(bucketTs, closePrice);
      }
    }
    return barMap;
  } catch {
    return new Map();
  }
}

export async function getMarketBarsBinanceClient(
  tf: TimeframeId,
  pair: TriadPairId,
  force = false
): Promise<MarketBar[]> {
  const cfg = TIMEFRAME_CONFIG[tf] ?? TIMEFRAME_CONFIG["1m"];
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const cacheKey = `${pair}_${tf}`;
  const nowSec = Date.now() / 1000;

  const cached = BINANCE_BROWSER_CACHE[cacheKey];
  if (
    cached &&
    !force &&
    cached.data[0]?.source === "binance" &&
    nowSec - cached.lastFetch < cfg.ttl
  ) {
    return cached.data;
  }

  // Fetch 24/7 real-time Spot Gold proxy (PAXGUSDT) from Binance Vision CDN
  // For EUR, fetch native EURUSDT from Binance Vision; for other G10 FX, pair with live FX
  const [paxgBars, fxBarsResult] = await Promise.all([
    fetchBinanceVisionKlines("PAXGUSDT", tf, cfg.intervalSec, 500),
    pair === "EUR"
      ? fetchBinanceVisionKlines("EURUSDT", tf, cfg.intervalSec, 500).then(
          (bars) => ({ bars, metaPrice: undefined })
        )
      : fetchYahooSymbolBrowser(
          triad.yahooFxSymbol,
          cfg.interval,
          cfg.range,
          cfg.intervalSec,
          force
        ),
  ]);

  const fxBars = fxBarsResult.bars;

  if (paxgBars.size === 0 || fxBars.size === 0) {
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    const fallback = generateFallbackTimeframe(tf, pair);
    BINANCE_BROWSER_CACHE[cacheKey] = { data: fallback, lastFetch: nowSec };
    return fallback;
  }

  const aligned: MarketBar[] = [];

  if (cfg.interval === "1d") {
    const xauDates = new Map<string, [number, number]>();
    const fxDates = new Map<string, [number, number]>();

    for (const [t, c] of paxgBars.entries()) {
      xauDates.set(formatBarTimestamp(t, true), [t, c]);
    }
    for (const [t, c] of fxBars.entries()) {
      fxDates.set(formatBarTimestamp(t, true), [t, c]);
    }

    const sortedXauDates = Array.from(xauDates.keys()).sort();
    const sortedFxDates = Array.from(fxDates.keys()).sort();
    let fxIdx = 0;
    let lastKnownFx =
      sortedFxDates.length > 0
        ? fxDates.get(sortedFxDates[0])![1]
        : fxBarsResult.metaPrice ?? triad.defaultFxRate;

    for (const d of sortedXauDates) {
      while (fxIdx < sortedFxDates.length && sortedFxDates[fxIdx] <= d) {
        lastKnownFx = fxDates.get(sortedFxDates[fxIdx])![1];
        fxIdx++;
      }
      const [tBar, xau] = xauDates.get(d)!;
      const fx = fxDates.get(d)?.[1] ?? lastKnownFx;
      const synthCross =
        triad.quoteMode === "CCY_USD" ? xau / fx : xau * fx;

      aligned.push({
        timestamp: tBar,
        datetime: d,
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(fx.toFixed(triad.yDecimals + 1)),
        xaueur: Number(synthCross.toFixed(triad.xDecimals)),
        usdeur: Number((1.0 / fx).toFixed(6)),
        source: "binance",
      });
    }
  } else {
    const xauTimestamps = Array.from(paxgBars.keys()).sort((a, b) => a - b);
    const fxEntries = Array.from(fxBars.entries()).sort((a, b) => a[0] - b[0]);

    let fxIdx = 0;
    let lastKnownFx =
      fxEntries[0]?.[1] ?? fxBarsResult.metaPrice ?? triad.defaultFxRate;
    let lastKnownFxTs = fxEntries[0]?.[0] ?? 0;

    for (let i = 0; i < xauTimestamps.length; i++) {
      const t = xauTimestamps[i];
      const xau = paxgBars.get(t)!;

      while (fxIdx < fxEntries.length && fxEntries[fxIdx][0] <= t) {
        lastKnownFx = fxEntries[fxIdx][1];
        lastKnownFxTs = fxEntries[fxIdx][0];
        fxIdx++;
      }

      let fx = fxBars.get(t) ?? lastKnownFx;
      if (
        fxBarsResult.metaPrice &&
        (i === xauTimestamps.length - 1 || t - lastKnownFxTs > 6 * 3600)
      ) {
        fx = fxBarsResult.metaPrice;
      }

      const synthCross =
        triad.quoteMode === "CCY_USD" ? xau / fx : xau * fx;

      aligned.push({
        timestamp: t,
        datetime: formatBarTimestamp(t, false),
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(fx.toFixed(triad.yDecimals + 1)),
        xaueur: Number(synthCross.toFixed(triad.xDecimals)),
        usdeur: Number((1.0 / fx).toFixed(6)),
        source: "binance",
      });
    }
  }

  if (aligned.length === 0) {
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    const fallback = generateFallbackTimeframe(tf, pair);
    BINANCE_BROWSER_CACHE[cacheKey] = { data: fallback, lastFetch: nowSec };
    return fallback;
  }

  const trimmed = aligned.length > 500 ? aligned.slice(-500) : aligned;
  BINANCE_BROWSER_CACHE[cacheKey] = { data: trimmed, lastFetch: nowSec };
  return trimmed;
}

/**
 * Polls Binance Vision real-time ticker every 2.5s for zero-key live PAXGUSDT + EURUSDT updates.
 */
export function subscribeBinanceLiveStream(
  pair: TriadPairId,
  tf: TimeframeId,
  getLastKnownFx: () => number,
  onBarUpdate: (bar: MarketBar) => void
): () => void {
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const cfg = TIMEFRAME_CONFIG[tf] ?? TIMEFRAME_CONFIG["1m"];
  let closed = false;

  const poll = async () => {
    if (closed || (typeof document !== "undefined" && document.hidden)) {
      return;
    }
    try {
      const symbolsParam =
        pair === "EUR" ? '["PAXGUSDT","EURUSDT"]' : '["PAXGUSDT"]';
      const url = `https://data-api.binance.vision/api/v3/ticker/price?symbols=${encodeURIComponent(
        symbolsParam
      )}`;
      const resp = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(4000),
      });
      if (!resp.ok || closed) return;

      const list: Array<{ symbol: string; price: string }> = await resp.json();
      let xau = 0;
      let fx = getLastKnownFx() || triad.defaultFxRate;

      for (const item of list) {
        if (item.symbol === "PAXGUSDT") {
          xau = Number(item.price);
        } else if (item.symbol === "EURUSDT" && pair === "EUR") {
          fx = Number(item.price);
        }
      }

      if (!Number.isFinite(xau) || xau <= 0 || !Number.isFinite(fx) || fx <= 0) {
        return;
      }

      const nowSec = Math.floor(Date.now() / 1000);
      const bucketTs =
        tf === "1d"
          ? Math.floor(nowSec / 86400) * 86400
          : Math.floor(nowSec / cfg.intervalSec) * cfg.intervalSec;

      const synthCross =
        triad.quoteMode === "CCY_USD" ? xau / fx : xau * fx;

      onBarUpdate({
        timestamp: bucketTs,
        datetime: formatBarTimestamp(bucketTs, tf === "1d"),
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(fx.toFixed(triad.yDecimals + 1)),
        xaueur: Number(synthCross.toFixed(triad.xDecimals)),
        usdeur: Number((1.0 / fx).toFixed(6)),
        source: "binance",
      });
    } catch {
      // ignore transient errors
    }
  };

  const timer = setInterval(poll, 2500);
  return () => {
    closed = true;
    clearInterval(timer);
  };
}
