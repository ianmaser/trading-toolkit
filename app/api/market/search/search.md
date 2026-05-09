FILE: app/api/market/search/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
A simple route handler that proxies ticker symbol search queries to the marketData
service. Results are cached 24 hours in Redis. Used by the WatchlistSearch component
as the user types.

HOW IT WORKS (step by step):
1. Validates the `?query=` parameter — must be 1-50 characters.
2. Calls `searchTickers` which checks Redis, then Polygon → Twelve Data fallback.
3. Returns up to 10 matching TickerInfo objects.

KEY CONCEPTS USED:
- Standard validate → service → error-handle pattern shared by all market routes.
- 502 for MarketDataError (provider failure), 500 for unexpected errors.

INPUTS AND OUTPUTS:
- Query param: `?query=AAPL`
- Success: 200 `TickerInfo[]` (up to 10 results)
- Validation failure: 400
- Provider failure: 502

WHAT TO CHECK IF SOMETHING BREAKS:
- Empty results: the query may not match any active US stock tickers on Polygon/Twelve Data.
- 502: check API keys in env vars.

DEPENDENCIES:
- `@/services/marketData` (searchTickers): cached provider search with fallback.
