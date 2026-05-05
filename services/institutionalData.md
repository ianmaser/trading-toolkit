FILE: services/institutionalData.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Assembles institutional flow data for a given ticker: unusual options activity, short
interest, and dark pool prints. It calls Unusual Whales (primary, full suite) or Tradier
(fallback, options chain approximation only), caches the result in Redis for 15 minutes,
and returns null fields gracefully when all providers are unavailable rather than
throwing an error.

HOW IT WORKS (step by step):
1. `getInstitutionalData(symbol)` is the only exported function. It starts with a Redis
   cache check — if data exists, it returns immediately without calling any provider.
2. If no cache hit and `UNUSUAL_WHALES_API_KEY` is set, it fires all three UW fetches
   in parallel using `Promise.all`: options flow, short interest, and dark pool.
   Parallel execution means total latency is ~1× the slowest call, not the sum of all three.
3. Each UW fetcher applies its own filter before returning data:
   - Options flow: volume-to-open-interest ratio > 3 (only "unusual" flow makes the cut)
   - Dark pool: notional value ≥ $1M (filters out small retail-size prints)
4. If UW throws for any reason (rate limit, API error, bad response), execution falls
   through to the Tradier block. The `catch {}` is intentional — we don't re-throw.
5. If `TRADIER_API_KEY` is set, Tradier is called as a degraded fallback. Tradier doesn't
   offer pre-filtered unusual flow or dark pool data, so we fetch the nearest-expiry
   options chain and apply the same volume/OI filter manually. Short interest and dark
   pool are returned as null because Tradier can't provide them.
6. If both providers fail (or neither key is set), the function returns an object with
   all three data fields set to null. This is not an error — institutional data is
   supplemental, and the ticker page renders normally with null values.

KEY CONCEPTS USED:
- **Volume-to-open-interest ratio**: Open interest is the total number of existing
  outstanding contracts for a given strike. Volume is how many contracts traded today.
  When volume >> open interest, new money is entering (new positions being opened),
  which is directionally meaningful. A ratio > 3 means today's trading is more than
  3× the standing float — a signal of institutional intent.
- **Dark pool**: An off-exchange trading venue where large institutions execute block
  trades privately to avoid moving the public market price. Significant dark pool
  prints near key price levels can foreshadow directional moves.
- **`Promise.all` for parallel fetches**: Unlike `Promise.allSettled`, `Promise.all`
  rejects immediately if any promise rejects. This is what we want here — if UW
  returns bad data for one endpoint, we don't want to partially display data from
  the others. We either get the full UW picture or fall through to Tradier entirely.
- **Graceful null return**: Institutional data is complementary context, not core app
  functionality. Returning null fields (rather than throwing) means the ticker page
  always loads — components check for null and show an empty state.
- **Provider key guards** (`if (process.env.UNUSUAL_WHALES_API_KEY)`): Allows the
  app to run in development without all API keys configured.

INPUTS AND OUTPUTS:
- Input: `symbol` string (any case — normalised to uppercase internally).
- Output: `InstitutionalData` — always returns, never throws.
  Shape: `{ unusualOptions: UnusualOptionsFlow[] | null, shortInterest: ShortInterest | null, darkPool: DarkPoolPrint[] | null }`

WHAT TO CHECK IF SOMETHING BREAKS:
- All fields returning null: check that `UNUSUAL_WHALES_API_KEY` and `TRADIER_API_KEY`
  are set in env vars. If both are missing, the function skips straight to the null return.
- Options flow empty when data is expected: the volumeRatio > 3 filter may be too
  aggressive for the current symbol/market conditions. Check raw API responses by logging
  before the filter.
- Dark pool list empty: the $1M notional filter may be too high for lower-price stocks.
  The filter is intentional but can be adjusted per use case.
- Tradier returning no expiry: `getNearestTradierExpiry` returned null, meaning the
  expirations endpoint failed or the symbol has no listed options.

DEPENDENCIES:
- `@upstash/redis` (Redis): serverless Redis for 15-minute response caching.
- Unusual Whales API: institutional-grade options flow, short interest, and dark pool data.
- Tradier API: brokerage API used as a degraded fallback for options chain data only.
