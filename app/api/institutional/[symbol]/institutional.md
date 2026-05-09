FILE: app/api/institutional/[symbol]/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Returns institutional flow data (options flow, short interest, dark pool) for a ticker.
Uses a Next.js dynamic route segment so the symbol is part of the URL path rather than
a query parameter: /api/institutional/AAPL instead of /api/institutional?symbol=AAPL.

HOW IT WORKS (step by step):
1. The `[symbol]` directory name creates a dynamic URL segment. Next.js passes the
   matched value as `params.symbol` to the handler.
2. In Next.js 15, `params` is a Promise and must be awaited before use.
3. The symbol is validated with a regex to ensure it's letters-only, preventing
   path traversal or injection via the URL parameter.
4. `getInstitutionalData` is called — it never throws (returns null fields on failure),
   so the try/catch is a last-resort safety net only.

KEY CONCEPTS USED:
- **Dynamic route segment `[symbol]`**: Brackets in the directory name tell Next.js
  this path segment is a variable. Any URL matching the pattern populates `params`.
- **`params` as a Promise (Next.js 15)**: Breaking change from Next.js 14 where params
  was a plain object. Always await it in Next.js 15+ route handlers.
- **`_req` underscore convention**: Prefix signals the parameter is required by the
  function signature (Next.js enforces it) but intentionally unused in the body.
- **No 502 response**: `getInstitutionalData` handles all provider failures internally
  and returns null fields — it never throws a MarketDataError.

INPUTS AND OUTPUTS:
- URL path param: `/api/institutional/AAPL`
- Success: 200 `InstitutionalData` (some fields may be null if providers unavailable)
- Invalid symbol: 400
- Unexpected error: 500

WHAT TO CHECK IF SOMETHING BREAKS:
- All fields null: check `UNUSUAL_WHALES_API_KEY` and `TRADIER_API_KEY` env vars.
- Data not refreshing: check the 15-minute Redis TTL in services/institutionalData.ts.

DEPENDENCIES:
- `@/services/institutionalData` (getInstitutionalData): Unusual Whales + Tradier with caching.
