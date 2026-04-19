import { Redis } from "@upstash/redis";
import {
  Candle,
  MarketDataError,
  Quote,
  Timeframe,
  TickerInfo,
} from "@/types/market";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Cache TTLs (seconds) ────────────────────────────────────────────────────

const TTL_QUOTE = 60;
const TTL_INTRADAY = 5 * 60;
const TTL_DAILY = 24 * 60 * 60;
const TTL_SEARCH = 24 * 60 * 60;

// ─── Timeframe helpers ───────────────────────────────────────────────────────

function isIntraday(tf: Timeframe): boolean {
  return tf !== "1D";
}

function cacheTTL(tf: Timeframe): number {
  return isIntraday(tf) ? TTL_INTRADAY : TTL_DAILY;
}

function polygonMultiplierAndSpan(tf: Timeframe): {
  multiplier: number;
  timespan: string;
} {
  switch (tf) {
    case "5M":
      return { multiplier: 5, timespan: "minute" };
    case "15M":
      return { multiplier: 15, timespan: "minute" };
    case "1H":
      return { multiplier: 1, timespan: "hour" };
    case "4H":
      return { multiplier: 4, timespan: "hour" };
    case "1D":
      return { multiplier: 1, timespan: "day" };
  }
}

function twelvedataInterval(tf: Timeframe): string {
  switch (tf) {
    case "5M":
      return "5min";
    case "15M":
      return "15min";
    case "1H":
      return "1h";
    case "4H":
      return "4h";
    case "1D":
      return "1day";
  }
}

// ─── Polygon ─────────────────────────────────────────────────────────────────

async function polygonGetCandles(
  symbol: string,
  tf: Timeframe,
  from: string,
  to: string,
): Promise<Candle[]> {
  const { multiplier, timespan } = polygonMultiplierAndSpan(tf);
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${process.env.POLYGON_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Polygon candles ${res.status}`);

  const json = await res.json();
  if (json.status === "ERROR" || !json.results?.length) {
    throw new Error(`Polygon candles: ${json.error ?? "no results"}`);
  }

  return json.results.map(
    (r: {
      t: number;
      o: number;
      h: number;
      l: number;
      c: number;
      v: number;
    }) => ({
      timestamp: Math.floor(r.t / 1000), // ms → s
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v,
    }),
  );
}

async function polygonGetQuote(symbol: string): Promise<Quote> {
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${process.env.POLYGON_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Polygon quote ${res.status}`);

  const json = await res.json();
  const t = json.ticker;
  if (!t) throw new Error("Polygon quote: no ticker data");

  return {
    symbol: t.ticker,
    price: t.day?.c ?? t.lastTrade?.p ?? 0,
    change: t.todaysChange ?? 0,
    changePercent: t.todaysChangePerc ?? 0,
    volume: t.day?.v ?? 0,
    updatedAt: Date.now(),
  };
}

async function polygonSearchTickers(query: string): Promise<TickerInfo[]> {
  const url = `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&limit=10&apiKey=${process.env.POLYGON_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Polygon search ${res.status}`);

  const json = await res.json();
  return (json.results ?? []).map(
    (r: {
      ticker: string;
      name: string;
      primary_exchange: string;
      type: string;
    }) => ({
      symbol: r.ticker,
      name: r.name,
      exchange: r.primary_exchange,
      type: r.type,
    }),
  );
}

// ─── Twelve Data ─────────────────────────────────────────────────────────────

async function twelvedataGetCandles(
  symbol: string,
  tf: Timeframe,
  from: string,
  to: string,
): Promise<Candle[]> {
  const interval = twelvedataInterval(tf);
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&start_date=${from}&end_date=${to}&order=ASC&outputsize=5000&apikey=${process.env.TWELVE_DATA_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Twelve Data candles ${res.status}`);

  const json = await res.json();
  if (json.status === "error" || !json.values?.length) {
    throw new Error(`Twelve Data candles: ${json.message ?? "no results"}`);
  }

  return json.values.map(
    (r: {
      datetime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume: string;
    }) => ({
      timestamp: Math.floor(new Date(r.datetime).getTime() / 1000),
      open: parseFloat(r.open),
      high: parseFloat(r.high),
      low: parseFloat(r.low),
      close: parseFloat(r.close),
      volume: parseInt(r.volume, 10),
    }),
  );
}

async function twelvedataGetQuote(symbol: string): Promise<Quote> {
  const url = `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Twelve Data quote ${res.status}`);

  const json = await res.json();
  if (json.status === "error")
    throw new Error(`Twelve Data quote: ${json.message}`);

  return {
    symbol: json.symbol,
    price: parseFloat(json.close),
    change: parseFloat(json.change),
    changePercent: parseFloat(json.percent_change),
    volume: parseInt(json.volume, 10),
    updatedAt: Date.now(),
  };
}

async function twelvedataSearchTickers(query: string): Promise<TickerInfo[]> {
  const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=10&apikey=${process.env.TWELVE_DATA_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Twelve Data search ${res.status}`);

  const json = await res.json();
  return (json.data ?? []).map(
    (r: {
      symbol: string;
      instrument_name: string;
      exchange: string;
      instrument_type: string;
    }) => ({
      symbol: r.symbol,
      name: r.instrument_name,
      exchange: r.exchange,
      type: r.instrument_type,
    }),
  );
}

async function polygonGetTickerDetails(symbol: string): Promise<TickerInfo> {
  const url = `https://api.polygon.io/v3/reference/tickers/${symbol}?apiKey=${process.env.POLYGON_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Polygon ticker details ${res.status}`);

  const json = await res.json();
  const r = json.results;
  if (!r) throw new Error("Polygon ticker details: no results");

  return {
    symbol: r.ticker,
    name: r.name,
    exchange: r.primary_exchange ?? "",
    type: r.type ?? "",
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function getCandles(
  symbol: string,
  tf: Timeframe,
  from: string,
  to: string,
): Promise<Candle[]> {
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `candles:${symbol}:${tf}:${today}`;
  const ttl = cacheTTL(tf);

  const cached = await redis.get<Candle[]>(cacheKey);
  if (cached) return cached;

  let candles: Candle[];
  try {
    candles = await polygonGetCandles(symbol, tf, from, to);
  } catch {
    try {
      candles = await twelvedataGetCandles(symbol, tf, from, to);
    } catch {
      throw new MarketDataError(
        `Unable to fetch candles for ${symbol} — both providers failed`,
        symbol,
        "both",
      );
    }
  }

  await redis.set(cacheKey, candles, { ex: ttl });
  return candles;
}

export async function getQuote(symbol: string): Promise<Quote> {
  const cacheKey = `quote:${symbol}`;

  const cached = await redis.get<Quote>(cacheKey);
  if (cached) return cached;

  let quote: Quote;
  try {
    quote = await polygonGetQuote(symbol);
  } catch {
    try {
      quote = await twelvedataGetQuote(symbol);
    } catch {
      throw new MarketDataError(
        `Unable to fetch quote for ${symbol} — both providers failed`,
        symbol,
        "both",
      );
    }
  }

  await redis.set(cacheKey, quote, { ex: TTL_QUOTE });
  return quote;
}

export async function getMultipleQuotes(symbols: string[]): Promise<Quote[]> {
  // Fetch all in parallel — each call handles its own cache
  const results = await Promise.allSettled(symbols.map(getQuote));
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function getTickerDetails(symbol: string): Promise<TickerInfo> {
  const cacheKey = `details:${symbol.toUpperCase()}`;

  const cached = await redis.get<TickerInfo>(cacheKey);
  if (cached) return cached;

  const details = await polygonGetTickerDetails(symbol.toUpperCase());
  await redis.set(cacheKey, details, { ex: TTL_DAILY });
  return details;
}

export async function searchTickers(query: string): Promise<TickerInfo[]> {
  const cacheKey = `search:${query.toLowerCase().trim()}`;

  const cached = await redis.get<TickerInfo[]>(cacheKey);
  if (cached) return cached;

  let results: TickerInfo[];
  try {
    results = await polygonSearchTickers(query);
  } catch {
    try {
      results = await twelvedataSearchTickers(query);
    } catch {
      throw new MarketDataError(
        `Unable to search tickers for "${query}" — both providers failed`,
        query,
        "both",
      );
    }
  }

  await redis.set(cacheKey, results, { ex: TTL_SEARCH });
  return results;
}
