FILE: app/api/market/details/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Returns static ticker metadata (company name, exchange, asset type) for a given symbol.
Polygon-only — no Twelve Data fallback for reference data. Cached 24 hours.

HOW IT WORKS (step by step):
1. Validates `?symbol=` query param.
2. Calls `getTickerDetails` which checks Redis, then calls Polygon's reference endpoint.
3. Returns a TickerInfo object.

KEY CONCEPTS USED:
- Standard validate → service → error-handle pattern.
- No Twelve Data fallback — `getTickerDetails` throws MarketDataError if Polygon fails.

INPUTS AND OUTPUTS:
- Query param: `?symbol=AAPL`
- Success: 200 `TickerInfo` object
- Validation failure: 400
- Polygon failure: 502

WHAT TO CHECK IF SOMETHING BREAKS:
- 502: Polygon reference API is down or the symbol doesn't exist in their database.
  Note: some OTC or foreign-listed tickers may not be in Polygon's reference data.

DEPENDENCIES:
- `@/services/marketData` (getTickerDetails): Polygon reference data with Redis caching.
