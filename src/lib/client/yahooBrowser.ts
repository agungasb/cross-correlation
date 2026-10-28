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

interface BrowserCacheEntry {
  data: MarketBar[];
  lastFetch: number;
}

interface SymbolSeriesCacheEntry {
  series: YahooSymbolSeries;
  lastFetch: number;
}

interface YahooSymbolSeries {
  bars: Map<number, number>;
  metaPrice?: number;
  metaTime?: number;
}

const BROWSER_CACHE: Record<string, BrowserCacheEntry> = {};
const SYMBOL_CACHE: Record<string, SymbolSeriesCacheEntry> = {};

let skipLocalRewriteProxy = false;

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

function parseYahooPayload(
  rawText: string,
  interval: string,
  intervalSec: number
): YahooSymbolSeries | null {
  const jsonStart = rawText.indexOf('{"chart":');
  const jsonEnd = rawText.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd <= jsonStart) return null;

  const json = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const closes: (number | null)[] =
    result.indicators?.quote?.[0]?.close ?? [];

  const barMap = new Map<number, number>();
  const len = Math.min(timestamps.length, closes.length);
  for (let i = 0; i < len; i++) {
    const t = timestamps[i];
    const c = closes[i];
    if (
      typeof t === "number" &&
      typeof c === "number" &&
      Number.isFinite(c) &&
      c > 0
    ) {
      const bucketTs =
        interval === "1d" ? t : Math.floor(t / intervalSec) * intervalSec;
      barMap.set(bucketTs, c);
    }
  }

  const metaPrice = Number(result.meta?.regularMarketPrice);
  const metaTime = Number(result.meta?.regularMarketTime);
  const validMetaPrice =
    Number.isFinite(metaPrice) && metaPrice > 0 ? metaPrice : undefined;
  const validMetaTime =
    Number.isFinite(metaTime) && metaTime > 0 ? metaTime : undefined;

  if (validMetaPrice !== undefined && validMetaTime !== undefined) {
    const metaBucket =
      interval === "1d"
        ? validMetaTime
        : Math.floor(validMetaTime / intervalSec) * intervalSec;
    barMap.set(metaBucket, validMetaPrice);
  }

  if (barMap.size === 0) return null;

  return {
    bars: barMap,
    metaPrice: validMetaPrice,
    metaTime: validMetaTime,
  };
}

export async function fetchYahooSymbolBrowser(
  symbol: string,
  interval: string,
  rangeStr: string,
  intervalSec: number,
  force = false
): Promise<YahooSymbolSeries> {
  const symCacheKey = `${symbol}_${interval}_${rangeStr}`;
  const nowSec = Date.now() / 1000;
  const cachedSym = SYMBOL_CACHE[symCacheKey];
  if (cachedSym && !force && nowSec - cachedSym.lastFetch < 10) {
    return cachedSym.series;
  }

  const cacheBuster = Math.floor(Date.now() / 15000);
  const queryPath = `v8/finance/chart/${symbol}?interval=${interval}&range=${rangeStr}&_t=${cacheBuster}`;
  const yahooUrl1 = `https://query1.finance.yahoo.com/${queryPath}`;
  const yahooUrl2 = `https://query2.finance.yahoo.com/${queryPath}`;

  const candidateUrls: string[] = [];
  if (!skipLocalRewriteProxy) {
    candidateUrls.push(`/yahoo-proxy/${queryPath}`);
  }
  // Simple GET CORS relays (no custom headers -> zero OPTIONS preflight)
  candidateUrls.push(
    `https://r.jina.ai/${yahooUrl1}`,
    `https://r.jina.ai/${yahooUrl2}`
  );

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8500),
      });
      if (!resp.ok) continue;

      const contentType = resp.headers.get("content-type") ?? "";
      if (url.startsWith("/yahoo-proxy") && contentType.includes("text/html")) {
        // Running on static Firebase Spark hosting (SPA fallback); skip local proxy on future polls
        skipLocalRewriteProxy = true;
        continue;
      }

      const rawText = await resp.text();
      const parsed = parseYahooPayload(rawText, interval, intervalSec);
      if (parsed && parsed.bars.size > 0) {
        SYMBOL_CACHE[symCacheKey] = { series: parsed, lastFetch: nowSec };
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  if (cachedSym && cachedSym.series.bars.size > 0) {
    return cachedSym.series;
  }

  return { bars: new Map() };
}

export async function getMarketBarsClient(
  tf: TimeframeId,
  pair: TriadPairId,
  force = false
): Promise<MarketBar[]> {
  const cfg = TIMEFRAME_CONFIG[tf] ?? TIMEFRAME_CONFIG["1m"];
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const cacheKey = `${pair}_${tf}`;
  const nowSec = Date.now() / 1000;

  const cached = BROWSER_CACHE[cacheKey];
  if (
    cached &&
    !force &&
    cached.data[0]?.source === "yahoo" &&
    nowSec - cached.lastFetch < cfg.ttl
  ) {
    return cached.data;
  }

  const [gcSeries, fxSeries] = await Promise.all([
    fetchYahooSymbolBrowser(
      "GC=F",
      cfg.interval,
      cfg.range,
      cfg.intervalSec,
      force
    ),
    fetchYahooSymbolBrowser(
      triad.yahooFxSymbol,
      cfg.interval,
      cfg.range,
      cfg.intervalSec,
      force
    ),
  ]);

  const gcBars = gcSeries.bars;
  const fxBars = fxSeries.bars;

  if (gcBars.size === 0 || fxBars.size === 0) {
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    const fallback = generateFallbackTimeframe(tf, pair);
    BROWSER_CACHE[cacheKey] = { data: fallback, lastFetch: nowSec };
    return fallback;
  }

  const aligned: MarketBar[] = [];

  if (cfg.interval === "1d") {
    const gcDates = new Map<string, [number, number]>();
    const fxDates = new Map<string, [number, number]>();

    for (const [t, c] of gcBars.entries()) {
      gcDates.set(formatBarTimestamp(t, true), [t, c]);
    }
    for (const [t, c] of fxBars.entries()) {
      fxDates.set(formatBarTimestamp(t, true), [t, c]);
    }

    const sortedGcDates = Array.from(gcDates.keys()).sort();
    const sortedFxDates = Array.from(fxDates.keys()).sort();
    let fxIdx = 0;
    let lastKnownFx =
      sortedFxDates.length > 0
        ? fxDates.get(sortedFxDates[0])![1]
        : fxSeries.metaPrice ?? triad.defaultFxRate;

    for (const d of sortedGcDates) {
      while (fxIdx < sortedFxDates.length && sortedFxDates[fxIdx] <= d) {
        lastKnownFx = fxDates.get(sortedFxDates[fxIdx])![1];
        fxIdx++;
      }
      const [tBar, xau] = gcDates.get(d)!;
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
        source: "yahoo",
      });
    }
  } else {
    // Intraday: Bucketed causal forward-fill (asof join) so Sunday/Monday open & live bars are retained
    const gcTimestamps = Array.from(gcBars.keys()).sort((a, b) => a - b);
    const fxEntries = Array.from(fxBars.entries()).sort((a, b) => a[0] - b[0]);

    let fxIdx = 0;
    let lastKnownFx = fxEntries[0]?.[1] ?? fxSeries.metaPrice ?? triad.defaultFxRate;
    let lastKnownFxTs = fxEntries[0]?.[0] ?? 0;

    for (let i = 0; i < gcTimestamps.length; i++) {
      const t = gcTimestamps[i];
      const xau = gcBars.get(t)!;

      while (fxIdx < fxEntries.length && fxEntries[fxIdx][0] <= t) {
        lastKnownFx = fxEntries[fxIdx][1];
        lastKnownFxTs = fxEntries[fxIdx][0];
        fxIdx++;
      }

      // If FX chart bars had a weekend gap (>6h) while live FX metaPrice is active, use live FX spot
      let fx = lastKnownFx;
      if (
        fxSeries.metaPrice &&
        (i === gcTimestamps.length - 1 || t - lastKnownFxTs > 6 * 3600)
      ) {
        fx = fxSeries.metaPrice;
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
        source: "yahoo",
      });
    }
  }

  if (aligned.length === 0) {
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    const fallback = generateFallbackTimeframe(tf, pair);
    BROWSER_CACHE[cacheKey] = { data: fallback, lastFetch: nowSec };
    return fallback;
  }

  const trimmed = aligned.length > 500 ? aligned.slice(-500) : aligned;
  BROWSER_CACHE[cacheKey] = { data: trimmed, lastFetch: nowSec };
  return trimmed;
}
