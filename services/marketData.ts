// This service runs server-side only (called from API routes, never from the browser).
// It abstracts two market data providers behind a unified interface and handles:
//   1. Redis caching — avoids hitting paid APIs repeatedly for the same data
//   2. Provider fallback — if Polygon fails, Twelve Data is tried automatically
import { Redis } from "@upstash/redis";
import {
  Candle,
  MarketDataError,
  Quote,
  Timeframe,
  TickerInfo,
} from "@/types/market";

// Server-side Redis client for caching API responses. Same Upstash connection as
// the rate limiter but used for data caching here, not request counting.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── Cache TTLs (seconds) ────────────────────────────────────────────────────
// How long each data type stays cached in Redis before we re-fetch from the provider.
// Tuned to match how frequently each type of data actually changes:

const TTL_QUOTE = 60;           // Live price — refresh every minute
const TTL_INTRADAY = 5 * 60;   // Intraday bars (5M/15M/1H/4H) — refresh every 5 min
const TTL_DAILY = 24 * 60 * 60; // Daily bars + ticker details — once per day is enough
const TTL_SEARCH = 24 * 60 * 60; // Search results — ticker names don't change intraday

// ─── Timeframe helpers ───────────────────────────────────────────────────────

function isIntraday(tf: Timeframe): boolean {
  return tf !== "1D";
}

function cacheTTL(tf: Timeframe): number {
  return isIntraday(tf) ? TTL_INTRADAY : TTL_DAILY;
}

// Polygon's aggregates API describes bar size as a (multiplier, timespan) pair.
// e.g. "4H" = multiplier:4, timespan:"hour" → /range/4/hour/...
// This translation is required because Polygon doesn't accept "4H" as a string directly.
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

// Twelve Data uses a completely different interval naming convention from Polygon.
// This maps our internal Timeframe type to Twelve Data's expected string format.
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
// Polygon.io is the primary market data provider. These functions call Polygon's
// REST API directly and normalise the responses into our internal types.

async function polygonGetCandles(
  symbol: string,
  tf: Timeframe,
  from: string,
  to: string,
): Promise<Candle[]> {
  const { multiplier, timespan } = polygonMultiplierAndSpan(tf);
  // `adjusted=true` means splits and dividends are adjusted into historical prices.
  // `sort=asc` returns bars oldest-first (required by lightweight-charts).
  // `limit=5000` is Polygon's max per request.
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=true&sort=asc&limit=5000&apiKey=${process.env.POLYGON_API_KEY}`;

  // `next: { revalidate: 0 }` disables Next.js's built-in fetch cache for this call.
  // Next.js 15 caches fetch() by default; since we manage our own Redis cache, we
  // don't want Next.js adding a second layer that could serve stale data.
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Polygon candles ${res.status}`);

  const json = await res.json();
  if (json.status === "ERROR" || !json.results?.length) {
    throw new Error(`Polygon candles: ${json.error ?? "no results"}`);
  }

  // Normalise Polygon's response shape into our internal Candle type.
  // Polygon uses single-letter keys (t=timestamp, o=open, h=high, l=low, c=close, v=volume).
  // Timestamps from Polygon are in milliseconds; lightweight-charts expects seconds.
  return json.results.map(
    (r: {
      t: number; // timestamp in milliseconds
      o: number; // open
      h: number; // high
      l: number; // low
      c: number; // close
      v: number; // volume
    }) => ({
      timestamp: Math.floor(r.t / 1000), // convert ms → seconds
      open: r.o,
      high: r.h,
      low: r.l,
      close: r.c,
      volume: r.v,
    }),
  );
}

async function polygonGetQuote(symbol: string): Promise<Quote> {
  // The snapshot endpoint returns the most recent complete trading day data
  // plus the last trade price — the closest thing to a real-time quote on free/basic plans.
  const url = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}?apiKey=${process.env.POLYGON_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Polygon quote ${res.status}`);

  const json = await res.json();
  const t = json.ticker;
  if (!t) throw new Error("Polygon quote: no ticker data");

  return {
    symbol: t.ticker,
    // Prefer today's closing price; fall back to last trade if market is open.
    price: t.day?.c ?? t.lastTrade?.p ?? 0,
    change: t.todaysChange ?? 0,
    changePercent: t.todaysChangePerc ?? 0,
    volume: t.day?.v ?? 0,
    updatedAt: Date.now(),
  };
}

async function polygonSearchTickers(query: string): Promise<TickerInfo[]> {
  // `active=true` excludes delisted tickers. `market=stocks` excludes ETFs, crypto, forex.
  const url = `https://api.polygon.io/v3/reference/tickers?search=${encodeURIComponent(query)}&active=true&market=stocks&limit=10&apiKey=${process.env.POLYGON_API_KEY}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Polygon search ${res.status}`);

  const json = await res.json();
  // Normalise Polygon's field names into our TickerInfo shape.
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
// Twelve Data is the fallback provider. Its API shape differs from Polygon's:
//   - OHLCV values are returned as strings, not numbers (need parseFloat/parseInt)
//   - Timestamps are ISO datetime strings, not milliseconds
//   - Results are under `json.values`, not `json.results`
// The normalisation maps below handle all of these differences.

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

  // Twelve Data returns OHLCV as strings and timestamps as ISO datetime strings.
  // We parse them into numbers and convert the datetime to Unix seconds.
  return json.values.map(
    (r: {
      datetime: string; // e.g. "2024-01-15 09:30:00"
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

  // Twelve Data quote fields are also strings — parse to numbers before returning.
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
  // Twelve Data uses `instrument_name` and `instrument_type` where Polygon uses `name` and `type`.
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

// Ticker details (company name, exchange, type) only come from Polygon — Twelve Data
// doesn't have a comparable reference data endpoint. This is fine because ticker
// details are cached for 24 hours and rarely needed fresh.
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
// These are the only functions imported by API routes. Each follows the same pattern:
//   1. Check Redis for a cached result — return immediately if found (cache hit)
//   2. Try the primary provider (Polygon)
//   3. If Polygon throws, try the fallback (Twelve Data)
//   4. If both fail, throw a MarketDataError with enough context to debug
//   5. On success, write the result to Redis with the appropriate TTL

export async function getCandles(
  symbol: string,
  tf: Timeframe,
  from: string,
  to: string,
): Promise<Candle[]> {
  // Cache key includes today's date so daily bars naturally expire at midnight
  // and intraday bars are scoped to the current trading session.
  const today = new Date().toISOString().slice(0, 10);
  const cacheKey = `candles:${symbol}:${tf}:${today}`;
  const ttl = cacheTTL(tf);

  const cached = await redis.get<Candle[]>(cacheKey);
  if (cached) return cached;

  let candles: Candle[];
  try {
    candles = await polygonGetCandles(symbol, tf, from, to);
  } catch {
    // Polygon failed — try Twelve Data before giving up.
    try {
      candles = await twelvedataGetCandles(symbol, tf, from, to);
    } catch {
      // Both providers failed. MarketDataError is a custom error class (types/market.ts)
      // that carries `symbol` and `provider` fields for structured error logging.
      throw new MarketDataError(
        `Unable to fetch candles for ${symbol} — both providers failed`,
        symbol,
        "both",
      );
    }
  }

  // `ex: ttl` sets the Redis key's expiry in seconds (Upstash uses `ex`, not `EX`).
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

// Fetches quotes for multiple symbols in parallel. Uses Promise.allSettled instead
// of Promise.all so that a failure for one symbol (e.g. a delisted ticker) doesn't
// abort the entire batch. Failed symbols are silently dropped from the result —
// the watchlist shows whatever it can rather than failing completely.
export async function getMultipleQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.allSettled(symbols.map(getQuote));
  // The type predicate `(r): r is PromiseFulfilledResult<Quote>` narrows the type
  // inside the filter callback so TypeScript knows `r.value` is a Quote.
  return results
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function getTickerDetails(symbol: string): Promise<TickerInfo> {
  const cacheKey = `details:${symbol.toUpperCase()}`;

  const cached = await redis.get<TickerInfo>(cacheKey);
  if (cached) return cached;

  // Ticker details only come from Polygon — no Twelve Data fallback here.
  const details = await polygonGetTickerDetails(symbol.toUpperCase());
  await redis.set(cacheKey, details, { ex: TTL_DAILY });
  return details;
}

export async function searchTickers(query: string): Promise<TickerInfo[]> {
  // Normalise the cache key so "AAPL", "aapl", and " AAPL " all hit the same entry.
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
