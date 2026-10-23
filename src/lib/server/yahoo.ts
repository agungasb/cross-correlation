import { MarketBar, TimeframeId, TimeframeMeta } from "@/types/market";

export const TIMEFRAME_CONFIG: Record<TimeframeId, TimeframeMeta> = {
  "1m": {
    id: "1m",
    interval: "1m",
    range: "1d",
    ttl: 20,
    label: "1 Minute (1 Day)",
    intervalSec: 60,
  },
  "5m": {
    id: "5m",
    interval: "5m",
    range: "5d",
    ttl: 60,
    label: "5 Minutes (5 Days)",
    intervalSec: 300,
  },
  "15m": {
    id: "15m",
    interval: "15m",
    range: "1mo",
    ttl: 120,
    label: "15 Minutes (1 Month)",
    intervalSec: 900,
  },
  "1h": {
    id: "1h",
    interval: "1h",
    range: "3mo",
    ttl: 300,
    label: "1 Hour (3 Months)",
    intervalSec: 3600,
  },
  "1d": {
    id: "1d",
    interval: "1d",
    range: "1y",
    ttl: 900,
    label: "Daily (1 Year)",
    intervalSec: 86400,
  },
};

interface CacheEntry {
  data: MarketBar[];
  lastFetch: number;
}

const DATA_CACHE: Partial<Record<TimeframeId, CacheEntry>> = {};

function formatUtcTimestamp(unixSec: number, isDaily: boolean): string {
  const iso = new Date(unixSec * 1000).toISOString();
  if (isDaily) {
    return iso.slice(0, 10);
  }
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

async function fetchYahooChart(
  symbol: string,
  interval: string,
  rangeStr: string
): Promise<Map<number, number>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=${interval}&range=${rangeStr}`;

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      signal: AbortSignal.timeout(6500),
      next: { revalidate: 20 },
    });

    if (!resp.ok) {
      return new Map();
    }

    const json = await resp.json();
    const result = json?.chart?.result?.[0];
    if (!result) return new Map();

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
        barMap.set(t, c);
      }
    }
    return barMap;
  } catch {
    return new Map();
  }
}

/**
 * Deterministic-seeded Box-Muller Gaussian generator for realistic fallback bars
 */
function createSeededGaussian(seedInit: number): () => number {
  let seed = seedInit >>> 0;
  const nextUniform = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed + 0.5) / 4294967296;
  };
  return () => {
    const u1 = Math.max(1e-9, nextUniform());
    const u2 = nextUniform();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  };
}

export function generateFallbackTimeframe(tf: TimeframeId): MarketBar[] {
  const cfg = TIMEFRAME_CONFIG[tf] ?? TIMEFRAME_CONFIG["1m"];
  const countMap: Record<TimeframeId, number> = {
    "1m": 300,
    "5m": 300,
    "15m": 320,
    "1h": 320,
    "1d": 225,
  };
  const count = countMap[tf] ?? 250;
  const now = Math.floor(Date.now() / 1000);
  const alignedNow = now - (now % cfg.intervalSec);
  const startTime = alignedNow - count * cfg.intervalSec;

  let currXauusd = 2720.0;
  let currEurusd = 1.085;
  const volScale = Math.sqrt(cfg.intervalSec / 60.0);
  const randn = createSeededGaussian(1337 + cfg.intervalSec);

  const rho = 0.35;
  const rhoComp = Math.sqrt(1 - rho * rho);
  const bars: MarketBar[] = [];

  for (let i = 0; i < count; i++) {
    const t = startTime + i * cfg.intervalSec;
    const z1 = randn();
    const z2 = rho * z1 + rhoComp * randn();
    const basisNoise = randn() * 0.15;

    currXauusd *= Math.exp(0.00015 * volScale * z1);
    currEurusd *= Math.exp(0.00008 * volScale * z2);

    const syntheticXaueur = currXauusd / currEurusd;
    const marketXaueur = syntheticXaueur + basisNoise;
    const usdeur = 1.0 / currEurusd;

    bars.push({
      timestamp: t,
      datetime: formatUtcTimestamp(t, tf === "1d"),
      xauusd: Number(currXauusd.toFixed(2)),
      eurusd: Number(currEurusd.toFixed(5)),
      xaueur: Number(syntheticXaueur.toFixed(2)),
      marketXaueur: Number(marketXaueur.toFixed(2)),
      usdeur: Number(usdeur.toFixed(5)),
      source: "simulated",
    });
  }

  return bars;
}

export async function getOrUpdateTimeframe(
  rawTf: string,
  force = false
): Promise<MarketBar[]> {
  const tf: TimeframeId =
    rawTf in TIMEFRAME_CONFIG ? (rawTf as TimeframeId) : "1m";
  const cfg = TIMEFRAME_CONFIG[tf];
  const nowSec = Date.now() / 1000;

  const cached = DATA_CACHE[tf];
  if (cached && !force && nowSec - cached.lastFetch < cfg.ttl) {
    return cached.data;
  }

  const [gcBars, euBars, xauEurBars] = await Promise.all([
    fetchYahooChart("GC=F", cfg.interval, cfg.range),
    fetchYahooChart("EURUSD=X", cfg.interval, cfg.range),
    fetchYahooChart("XAUEUR=X", cfg.interval, cfg.range),
  ]);

  if (gcBars.size === 0 || euBars.size === 0) {
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    const fallback = generateFallbackTimeframe(tf);
    DATA_CACHE[tf] = { data: fallback, lastFetch: nowSec };
    return fallback;
  }

  const aligned: MarketBar[] = [];

  if (cfg.interval === "1d") {
    const gcDates = new Map<string, [number, number]>();
    const euDates = new Map<string, [number, number]>();
    const xeDates = new Map<string, number>();

    for (const [t, c] of gcBars.entries()) {
      gcDates.set(formatUtcTimestamp(t, true), [t, c]);
    }
    for (const [t, c] of euBars.entries()) {
      euDates.set(formatUtcTimestamp(t, true), [t, c]);
    }
    for (const [t, c] of xauEurBars.entries()) {
      xeDates.set(formatUtcTimestamp(t, true), c);
    }

    const commonDates = Array.from(gcDates.keys())
      .filter((d) => euDates.has(d))
      .sort();

    for (const d of commonDates) {
      const [tBar, xau] = gcDates.get(d)!;
      const [, eur] = euDates.get(d)!;
      const mktXe = xeDates.get(d);
      const synthXe = xau / eur;

      aligned.push({
        timestamp: tBar,
        datetime: d,
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(eur.toFixed(5)),
        xaueur: Number(synthXe.toFixed(2)),
        marketXaueur: mktXe !== undefined ? Number(mktXe.toFixed(2)) : undefined,
        usdeur: Number((1.0 / eur).toFixed(5)),
        source: "yahoo",
      });
    }
  } else {
    const commonTs = Array.from(gcBars.keys())
      .filter((t) => euBars.has(t))
      .sort((a, b) => a - b);

    for (const t of commonTs) {
      const xau = gcBars.get(t)!;
      const eur = euBars.get(t)!;
      const mktXe = xauEurBars.get(t);
      const synthXe = xau / eur;

      aligned.push({
        timestamp: t,
        datetime: formatUtcTimestamp(t, false),
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(eur.toFixed(5)),
        xaueur: Number(synthXe.toFixed(2)),
        marketXaueur: mktXe !== undefined ? Number(mktXe.toFixed(2)) : undefined,
        usdeur: Number((1.0 / eur).toFixed(5)),
        source: "yahoo",
      });
    }
  }

  if (aligned.length === 0) {
    if (cached && cached.data.length > 0) {
      return cached.data;
    }
    const fallback = generateFallbackTimeframe(tf);
    DATA_CACHE[tf] = { data: fallback, lastFetch: nowSec };
    return fallback;
  }

  DATA_CACHE[tf] = { data: aligned, lastFetch: nowSec };
  return aligned;
}

export function getCacheSummary(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(DATA_CACHE)) {
    if (v) out[k] = v.data.length;
  }
  return out;
}
