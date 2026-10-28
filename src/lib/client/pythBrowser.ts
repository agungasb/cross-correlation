import {
  MarketBar,
  PYTH_XAUUSD_SYMBOL,
  TimeframeId,
  TRIAD_CONFIGS,
  TriadPairId,
} from "@/types/market";
import {
  generateFallbackTimeframe,
  TIMEFRAME_CONFIG,
} from "@/lib/server/yahoo";
import { fetchYahooSymbolBrowser } from "@/lib/client/yahooBrowser";

const PYTH_STORAGE_KEY = "triad_pyth_api_key";
const DEFAULT_PYTH_API_KEY =
  process.env.NEXT_PUBLIC_PYTH_API_KEY ||
  "pyth_F54fzbgrpkxUuAEhGr8LrsZWD7cJ47FzxEqPRfWxyram7S2Qhw";

// Pyth Lazer numeric feed IDs entitled on Pyth Pro
const PYTH_LAZER_XAU_ID = 346; // Metal.XAU/USD
const PYTH_LAZER_EUR_ID = 327; // FX.EUR/USD
const PYTH_LAZER_JPY_ID = 340; // FX.USD/JPY

// CORS-enabled Pyth Lazer Router endpoints (return Access-Control-Allow-Origin: * on OPTIONS & POST)
const PYTH_LAZER_ROUTERS = [
  "https://pyth-lazer-0.dourolabs.app/v1/price",
  "https://pyth-lazer-1.dourolabs.app/v1/price",
  "https://pyth-lazer-2.dourolabs.app/v1/price",
];
const PYTH_LAZER_LATEST_URL =
  "https://pyth-lazer.dourolabs.app/v1/latest_price";

export function getPythApiKey(): string {
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(PYTH_STORAGE_KEY)?.trim();
      if (saved) return saved;
    } catch {
      // ignore storage errors
    }
  }
  return DEFAULT_PYTH_API_KEY;
}

export function setPythApiKey(key: string): void {
  if (typeof window !== "undefined") {
    try {
      const clean = key.trim();
      if (clean) {
        window.localStorage.setItem(PYTH_STORAGE_KEY, clean);
      } else {
        window.localStorage.removeItem(PYTH_STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }
}

interface PythBrowserCacheEntry {
  data: MarketBar[];
  lastFetch: number;
}

interface PythMultiFeedSeries {
  xauBars: Map<number, number>;
  eurBars: Map<number, number>;
  jpyBars: Map<number, number>;
  lastFetch: number;
}

export interface PythSpotQuote {
  xauusd: number;
  eurusd: number;
  usdjpy: number;
  fx: number;
  publishTime: number;
}

const PYTH_BROWSER_CACHE: Record<string, PythBrowserCacheEntry> = {};
const PYTH_MULTI_FEED_CACHE: Partial<Record<TimeframeId, PythMultiFeedSeries>> =
  {};

const PYTH_RESOLUTION_MAP: Record<TimeframeId, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "1d": "1D",
};

const PYTH_LOOKBACK_SECONDS: Record<TimeframeId, number> = {
  "1m": 2 * 86400,
  "5m": 5 * 86400,
  "15m": 30 * 86400,
  "1h": 90 * 86400,
  "1d": 365 * 86400,
};

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

function parsePythTradingViewHistory(
  rawText: string,
  interval: string,
  intervalSec: number
): Map<number, number> | null {
  const jsonStart = rawText.indexOf("{");
  const jsonEnd = rawText.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd <= jsonStart) return null;

  try {
    const json = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
    if (json?.s !== "ok" || !Array.isArray(json.t) || !Array.isArray(json.c)) {
      return null;
    }

    const timestamps: number[] = json.t;
    const closes: number[] = json.c;
    const len = Math.min(timestamps.length, closes.length);
    const barMap = new Map<number, number>();

    for (let i = 0; i < len; i++) {
      const t = Number(timestamps[i]);
      const c = Number(closes[i]);
      if (Number.isFinite(t) && Number.isFinite(c) && c > 0) {
        const bucketTs =
          interval === "1d" ? t : Math.floor(t / intervalSec) * intervalSec;
        barMap.set(bucketTs, c);
      }
    }

    return barMap.size > 0 ? barMap : null;
  } catch {
    return null;
  }
}

/**
 * In local Next.js dev mode (`localhost`), uses the same-origin `/pyth-pro` rewrite
 * to fetch full UDF OHLCV history in 1 request per symbol.
 */
async function tryLocalDevUdfHistory(
  tf: TimeframeId,
  intervalSec: number
): Promise<PythMultiFeedSeries | null> {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const fromSec = nowSec - (PYTH_LOOKBACK_SECONDS[tf] ?? 2 * 86400);
  const resolution = PYTH_RESOLUTION_MAP[tf] ?? "1";
  const apiKey = getPythApiKey();

  const fetchSym = async (sym: string): Promise<Map<number, number> | null> => {
    const url = `/pyth-pro/v1/fixed_rate@1000ms/history?symbol=${encodeURIComponent(
      sym
    )}&from=${fromSec}&to=${nowSec}&resolution=${encodeURIComponent(resolution)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    return parsePythTradingViewHistory(await resp.text(), tf, intervalSec);
  };

  try {
    const [xauBars, eurBars, jpyBars] = await Promise.all([
      fetchSym(PYTH_XAUUSD_SYMBOL),
      fetchSym("FX.EUR/USD"),
      fetchSym("FX.USD/JPY"),
    ]);
    if (xauBars && eurBars && jpyBars && xauBars.size > 0) {
      return { xauBars, eurBars, jpyBars, lastFetch: nowSec };
    }
  } catch {
    // fall through to CORS-enabled Pyth Lazer Router
  }
  return null;
}

interface LazerPriceFeedItem {
  priceFeedId: number;
  price?: string | number | null;
  exponent?: number | null;
}

function decodeLazerFeeds(feeds: LazerPriceFeedItem[] | undefined): {
  xau: number;
  eur: number;
  jpy: number;
} {
  let xau = 0;
  let eur = 0;
  let jpy = 0;
  if (!Array.isArray(feeds)) return { xau, eur, jpy };

  for (const item of feeds) {
    if (item.price == null || item.exponent == null) continue;
    const val = Number(item.price) * Math.pow(10, Number(item.exponent));
    if (!Number.isFinite(val) || val <= 0) continue;

    if (item.priceFeedId === PYTH_LAZER_XAU_ID) {
      xau = val;
    } else if (item.priceFeedId === PYTH_LAZER_EUR_ID) {
      eur = val;
    } else if (item.priceFeedId === PYTH_LAZER_JPY_ID) {
      jpy = val;
    }
  }
  return { xau, eur, jpy };
}

/**
 * Queries CORS-enabled Pyth Lazer Routers (`https://pyth-lazer-{0,1,2}.dourolabs.app/v1/price`)
 * which return `Access-Control-Allow-Origin: *` directly in browsers and provide co-temporal
 * XAU/USD (346), EUR/USD (327), and USD/JPY (340) in a single request per timestamp.
 */
async function fetchPythLazerMultiSeries(
  tf: TimeframeId,
  intervalSec: number,
  force = false
): Promise<PythMultiFeedSeries> {
  const nowSec = Math.floor(Date.now() / 1000);
  const existing = PYTH_MULTI_FEED_CACHE[tf];

  if (existing && !force && nowSec - existing.lastFetch < 10) {
    return existing;
  }

  // Try same-origin UDF history if in local dev
  if (!existing) {
    const devSeries = await tryLocalDevUdfHistory(tf, intervalSec);
    if (devSeries) {
      PYTH_MULTI_FEED_CACHE[tf] = devSeries;
      return devSeries;
    }
  }

  const apiKey = getPythApiKey();
  const xauBars = new Map<number, number>(existing?.xauBars ?? []);
  const eurBars = new Map<number, number>(existing?.eurBars ?? []);
  const jpyBars = new Map<number, number>(existing?.jpyBars ?? []);

  // Determine target bar timestamps (60 bars initially; only missing new buckets on incremental refresh)
  const targetCount = 60;
  const latestCompleteBucket =
    Math.floor((nowSec - 2) / intervalSec) * intervalSec;
  const timestampsToFetch: number[] = [];

  for (let i = targetCount - 1; i >= 0; i--) {
    const bucketTs = latestCompleteBucket - i * intervalSec;
    if (!xauBars.has(bucketTs)) {
      timestampsToFetch.push(bucketTs);
    }
  }

  if (timestampsToFetch.length > 0) {
    const requests = timestampsToFetch.map(async (bucketTs, idx) => {
      const routerUrl = PYTH_LAZER_ROUTERS[idx % PYTH_LAZER_ROUTERS.length];
      try {
        const resp = await fetch(routerUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            priceFeedIds: [
              PYTH_LAZER_XAU_ID,
              PYTH_LAZER_EUR_ID,
              PYTH_LAZER_JPY_ID,
            ],
            properties: ["price", "exponent"],
            formats: [],
            channel: "fixed_rate@1000ms",
            parsed: true,
            timestamp: bucketTs * 1_000_000,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(7500),
        });
        if (!resp.ok) return;

        const json = await resp.json();
        const { xau, eur, jpy } = decodeLazerFeeds(json?.parsed?.priceFeeds);
        if (xau > 0) xauBars.set(bucketTs, xau);
        if (eur > 0) eurBars.set(bucketTs, eur);
        if (jpy > 0) jpyBars.set(bucketTs, jpy);
      } catch {
        // ignore individual bucket timeout
      }
    });

    await Promise.all(requests);
  }

  if (xauBars.size > 0) {
    const updated: PythMultiFeedSeries = {
      xauBars,
      eurBars,
      jpyBars,
      lastFetch: nowSec,
    };
    PYTH_MULTI_FEED_CACHE[tf] = updated;
    return updated;
  }

  return existing ?? { xauBars, eurBars, jpyBars, lastFetch: nowSec };
}

/**
 * Fetches real-time spot prices from Pyth Lazer (`POST https://pyth-lazer.dourolabs.app/v1/latest_price`)
 * which returns `Access-Control-Allow-Origin: *` and supports 6,000 requests/min.
 */
export async function fetchPythLatestSpot(
  pair: TriadPairId,
  fallbackFxRate?: number
): Promise<PythSpotQuote | null> {
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const apiKey = getPythApiKey();

  try {
    const resp = await fetch(PYTH_LAZER_LATEST_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        priceFeedIds: [
          PYTH_LAZER_XAU_ID,
          PYTH_LAZER_EUR_ID,
          PYTH_LAZER_JPY_ID,
        ],
        properties: ["price", "exponent"],
        formats: [],
        channel: "fixed_rate@1000ms",
        parsed: true,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return null;

    const json = await resp.json();
    const { xau, eur, jpy } = decodeLazerFeeds(json?.parsed?.priceFeeds);
    if (xau <= 0) return null;

    const tsUs = Number(json?.parsed?.timestampUs);
    const publishTime =
      Number.isFinite(tsUs) && tsUs > 0
        ? Math.floor(tsUs / 1_000_000)
        : Math.floor(Date.now() / 1000);

    let fx = fallbackFxRate && fallbackFxRate > 0 ? fallbackFxRate : triad.defaultFxRate;
    if (pair === "EUR" && eur > 0) {
      fx = eur;
    } else if (pair === "JPY" && jpy > 0) {
      fx = jpy;
    }

    return {
      xauusd: xau,
      eurusd: eur > 0 ? eur : TRIAD_CONFIGS.EUR.defaultFxRate,
      usdjpy: jpy > 0 ? jpy : TRIAD_CONFIGS.JPY.defaultFxRate,
      fx,
      publishTime,
    };
  } catch {
    return null;
  }
}

export async function getMarketBarsPythClient(
  tf: TimeframeId,
  pair: TriadPairId,
  force = false
): Promise<MarketBar[]> {
  const cfg = TIMEFRAME_CONFIG[tf] ?? TIMEFRAME_CONFIG["1m"];
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const cacheKey = `${pair}_${tf}`;
  const nowSec = Date.now() / 1000;

  const cached = PYTH_BROWSER_CACHE[cacheKey];
  if (
    cached &&
    !force &&
    cached.data[0]?.source === "pyth" &&
    nowSec - cached.lastFetch < cfg.ttl
  ) {
    return cached.data;
  }

  const isNativePythFx = pair === "EUR" || pair === "JPY";

  const [multiSeries, externalFxResult, latestSpot] = await Promise.all([
    fetchPythLazerMultiSeries(tf, cfg.intervalSec, force),
    isNativePythFx
      ? Promise.resolve(null)
      : fetchYahooSymbolBrowser(
          triad.yahooFxSymbol,
          cfg.interval,
          cfg.range,
          cfg.intervalSec,
          force
        ),
    fetchPythLatestSpot(pair),
  ]);

  const xauBars = new Map(multiSeries.xauBars);
  const fxBars = new Map<number, number>(
    pair === "EUR"
      ? multiSeries.eurBars
      : pair === "JPY"
        ? multiSeries.jpyBars
        : externalFxResult?.bars ?? []
  );

  // Merge real-time Lazer spot quote into the active bucket
  if (latestSpot && latestSpot.xauusd > 0) {
    const spotBucket =
      cfg.interval === "1d"
        ? Math.floor(latestSpot.publishTime / 86400) * 86400
        : Math.floor(latestSpot.publishTime / cfg.intervalSec) *
          cfg.intervalSec;
    xauBars.set(spotBucket, latestSpot.xauusd);
    const liveFx =
      isNativePythFx
        ? latestSpot.fx
        : externalFxResult?.metaPrice ?? latestSpot.fx;
    if (liveFx > 0) {
      fxBars.set(spotBucket, liveFx);
    }
  }

  if (xauBars.size === 0 || fxBars.size === 0) {
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    const fallback = generateFallbackTimeframe(tf, pair);
    PYTH_BROWSER_CACHE[cacheKey] = { data: fallback, lastFetch: nowSec };
    return fallback;
  }

  const aligned: MarketBar[] = [];

  if (cfg.interval === "1d") {
    const xauDates = new Map<string, [number, number]>();
    const fxDates = new Map<string, [number, number]>();

    for (const [t, c] of xauBars.entries()) {
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
        : externalFxResult?.metaPrice ?? latestSpot?.fx ?? triad.defaultFxRate;

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
        source: "pyth",
      });
    }
  } else {
    const xauTimestamps = Array.from(xauBars.keys()).sort((a, b) => a - b);
    const fxEntries = Array.from(fxBars.entries()).sort((a, b) => a[0] - b[0]);

    let fxIdx = 0;
    let lastKnownFx =
      fxEntries[0]?.[1] ??
      externalFxResult?.metaPrice ??
      latestSpot?.fx ??
      triad.defaultFxRate;

    for (let i = 0; i < xauTimestamps.length; i++) {
      const t = xauTimestamps[i];
      const xau = xauBars.get(t)!;

      while (fxIdx < fxEntries.length && fxEntries[fxIdx][0] <= t) {
        lastKnownFx = fxEntries[fxIdx][1];
        fxIdx++;
      }

      const fx = fxBars.get(t) ?? lastKnownFx;
      const synthCross =
        triad.quoteMode === "CCY_USD" ? xau / fx : xau * fx;

      aligned.push({
        timestamp: t,
        datetime: formatBarTimestamp(t, false),
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(fx.toFixed(triad.yDecimals + 1)),
        xaueur: Number(synthCross.toFixed(triad.xDecimals)),
        usdeur: Number((1.0 / fx).toFixed(6)),
        source: "pyth",
      });
    }
  }

  if (aligned.length === 0) {
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    const fallback = generateFallbackTimeframe(tf, pair);
    PYTH_BROWSER_CACHE[cacheKey] = { data: fallback, lastFetch: nowSec };
    return fallback;
  }

  const trimmed = aligned.length > 500 ? aligned.slice(-500) : aligned;
  PYTH_BROWSER_CACHE[cacheKey] = { data: trimmed, lastFetch: nowSec };
  return trimmed;
}

/**
 * Polls Pyth Lazer real-time endpoint (`POST https://pyth-lazer.dourolabs.app/v1/latest_price`)
 * every 2.5s to stream live Spot XAU/USD + FX updates with `Access-Control-Allow-Origin: *`.
 */
export function subscribePythLiveStream(
  pair: TriadPairId,
  tf: TimeframeId,
  onBarUpdate: (bar: MarketBar) => void,
  getLastKnownFx?: () => number
): () => void {
  const triad = TRIAD_CONFIGS[pair] ?? TRIAD_CONFIGS.EUR;
  const cfg = TIMEFRAME_CONFIG[tf] ?? TIMEFRAME_CONFIG["1m"];
  let closed = false;

  const poll = async () => {
    if (closed || (typeof document !== "undefined" && document.hidden)) {
      return;
    }
    const fallbackFx = getLastKnownFx ? getLastKnownFx() : triad.defaultFxRate;
    const spot = await fetchPythLatestSpot(pair, fallbackFx);
    if (!spot || closed) return;

    const bucketTs =
      tf === "1d"
        ? Math.floor(spot.publishTime / 86400) * 86400
        : Math.floor(spot.publishTime / cfg.intervalSec) * cfg.intervalSec;

    const synthCross =
      triad.quoteMode === "CCY_USD"
        ? spot.xauusd / spot.fx
        : spot.xauusd * spot.fx;

    onBarUpdate({
      timestamp: bucketTs,
      datetime: formatBarTimestamp(bucketTs, tf === "1d"),
      xauusd: Number(spot.xauusd.toFixed(2)),
      eurusd: Number(spot.fx.toFixed(triad.yDecimals + 1)),
      xaueur: Number(synthCross.toFixed(triad.xDecimals)),
      usdeur: Number((1.0 / spot.fx).toFixed(6)),
      source: "pyth",
    });
  };

  const timer = setInterval(poll, 2500);
  return () => {
    closed = true;
    clearInterval(timer);
  };
}
