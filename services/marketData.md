FILE: services/marketData.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Provides all market data reads for the app: candlestick bars, real-time quotes, ticker
search, and ticker details. It sits between the API routes and two external providers
(Polygon.io primary, Twelve Data fallback), adding a Redis caching layer so each unique
request is only fetched from the provider once per TTL window. All functions are
server-side only — they are never called from the browser.

HOW IT WORKS (step by step):
1. A Redis client is created at module load using the Upstash REST credentials from
   env vars. This client is reused across all function calls in the module.
2. TTL constants define how long each data type stays cached: quotes 60s, intraday
   bars 5m, daily bars 24h, search results 24h.
3. Two sets of private fetcher functions exist — one for Polygon and one for Twelve Data.
   They have the same signatures but call different APIs and parse different response shapes.
   Both normalise their results into the same internal types (Candle, Quote, TickerInfo).
4. The public functions (getCandles, getQuote, etc.) all follow the same 4-step pattern:
   a. Build a cache key and check Redis — return immediately on a cache hit.
   b. Call the Polygon fetcher inside a try block.
   c. If Polygon throws, call the Twelve Data fetcher inside a nested try block.
   d. If both throw, throw a MarketDataError with the symbol and "both" as the provider.
   e. On success from either provider, write to Redis with the TTL and return the data.
5. `getMultipleQuotes` uses `Promise.allSettled` (not `Promise.all`) to fetch a batch
   of quotes in parallel. allSettled never rejects — each result has a `status` of
   "fulfilled" or "rejected". Failed symbols are filtered out silently so one bad ticker
   doesn't kill the whole watchlist.

KEY CONCEPTS USED:
- **Provider fallback pattern**: Polygon is tried first; on any error, Twelve Data is
  tried next; on two failures, a typed error is thrown. This makes the data layer
  resilient to single-provider outages or rate limits without any manual intervention.
- **Redis cache-aside**: "Cache-aside" means the application checks the cache first,
  then fetches from the source on a miss, then writes back to the cache. Redis stores
  the data as JSON with an expiry (`ex` in seconds). On the next request within that
  window, the cached version is returned and no provider API call is made.
- **`next: { revalidate: 0 }`**: Next.js 15 automatically caches `fetch()` calls at the
  framework level. Setting `revalidate: 0` disables this per-call so our Redis cache
  is the single source of truth — no risk of two separate cache layers disagreeing.
- **Response normalisation**: Polygon and Twelve Data return differently shaped objects.
  The `.map()` calls in each fetcher translate provider-specific field names into our
  internal types (e.g. Polygon's `r.t` in milliseconds → `timestamp` in seconds).
- **`Promise.allSettled`**: Resolves when all promises complete regardless of whether
  they fulfilled or rejected. The type predicate in `.filter()` narrows each element
  so TypeScript knows the `.value` field exists on fulfilled results.

INPUTS AND OUTPUTS:
- All functions take symbol string(s), optional timeframe/date range.
- All return typed data: `Candle[]`, `Quote`, `Quote[]`, `TickerInfo`, `TickerInfo[]`.
- On failure: throws `MarketDataError` (from types/market.ts) with symbol and provider.

WHAT TO CHECK IF SOMETHING BREAKS:
- Cache returning stale data: check the TTL constants and confirm the Redis key structure
  matches what you expect (`candles:AAPL:1D:2026-05-05`, `quote:AAPL`, etc.).
- Both providers failing: check `POLYGON_API_KEY` and `TWELVE_DATA_API_KEY` env vars.
  Also check if the symbol is valid — both providers return errors for unknown tickers.
- Timestamp mismatches on the chart: Polygon returns milliseconds, Twelve Data returns
  ISO strings. Both must be converted to Unix seconds for lightweight-charts. Check the
  `/1000` and `new Date(...).getTime() / 1000` conversions in the fetchers.
- `getMultipleQuotes` returning fewer items than expected: one symbol failed and was
  filtered out. Enable verbose logging or check individual `getQuote` calls to find which.

DEPENDENCIES:
- `@upstash/redis` (Redis): serverless Redis client for caching API responses.
- Polygon.io REST API: primary market data provider.
- Twelve Data REST API: fallback market data provider.
