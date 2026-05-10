FILE: app/api/market/candles/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
A Next.js API route handler that validates query string parameters and returns OHLCV
candlestick data for a given symbol, timeframe, and date range. It is a thin validation
layer that delegates all data fetching and caching to the marketData service.

HOW IT WORKS (step by step):
1. The exported `GET` function is called by Next.js whenever a GET request hits
   /api/market/candles. Next.js matches the HTTP method to the exported function name.
2. `request.nextUrl.searchParams` parses the URL query string into a key-value map.
3. `schema.safeParse()` validates all four required parameters at once. If any field is
   missing, wrong type, or fails a constraint (e.g. date not in YYYY-MM-DD format),
   `parsed.success` is false and a 400 response is returned with Zod's error details.
4. On valid input, `getCandles()` is called. This function checks Redis first, then
   falls back to Polygon → Twelve Data (see services/marketData.ts).
5. If `getCandles` throws a `MarketDataError`, a 502 is returned — indicating the
   upstream provider failed, not our code. Any other error returns a generic 500.

KEY CONCEPTS USED:
- **Next.js Route Handler**: Exporting a function named `GET` from a `route.ts` file
  inside `app/api/` creates an API endpoint. No Express or custom server needed.
- **`safeParse` vs `parse`**: `parse` throws on invalid input; `safeParse` returns a
  result object. We use `safeParse` so we control the error response shape (400 JSON)
  rather than getting an unhandled exception.
- **`satisfies` type assertion**: Zod's `z.enum()` requires a non-empty tuple type.
  `satisfies [Timeframe, ...Timeframe[]]` tells TypeScript the array literal is that
  type without widening it to `string[]`.
- **502 vs 500**: 502 "Bad Gateway" signals that our server is healthy but an upstream
  service (Polygon/Twelve Data) failed. More informative than a generic 500.

INPUTS AND OUTPUTS:
- Query params: `symbol` (string), `timeframe` (enum), `from` (YYYY-MM-DD), `to` (YYYY-MM-DD)
- Success: 200 JSON array of `Candle` objects
- Validation failure: 400 `{ error: { fieldErrors, formErrors } }`
- Provider failure: 502 `{ error: string }`

WHAT TO CHECK IF SOMETHING BREAKS:
- 400 on valid-looking requests: check that `from`/`to` are exactly YYYY-MM-DD format
  with no time component. The regex is strict.
- 502 with "both providers failed": both Polygon and Twelve Data returned errors.
  Check API keys in env vars and whether the symbol is valid and has historical data.

DEPENDENCIES:
- `next/server` (NextRequest): Next.js server request type with URL parsing helpers.
- `zod` (z): input validation.
- `@/services/marketData` (getCandles): data fetching with Redis caching and provider fallback.
