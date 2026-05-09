FILE: app/api/market/quote/route.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Handles both single-quote and batch-quote requests on the same endpoint by detecting
which query parameter is present. Used by the ticker page (single) and the watchlist
(batch) so both can share one cached route.

HOW IT WORKS (step by step):
1. The handler checks whether `?symbols=` (batch) or `?symbol=` (single) is present
   in the query string, and branches to different schemas and service calls.
2. For batch: `multiSchema` uses Zod's `.transform()` to split the comma-separated
   string into an array as part of validation. After parse, `data.symbols` is already
   `string[]`, not a string.
3. `getMultipleQuotes` is called without a try/catch because it uses `Promise.allSettled`
   internally — it never throws. Failed symbols are silently dropped.
4. For single: standard safeParse → getQuote → error handling pattern.

KEY CONCEPTS USED:
- **Dual-schema routing on one endpoint**: Rather than creating two separate routes,
  the handler branches on which query param is present. This keeps the API surface
  small and lets both the watchlist and ticker page share one URL pattern.
- **Zod `.transform()`**: Runs a transformation function on the value as part of
  schema validation, converting `"AAPL,MSFT"` → `["AAPL", "MSFT"]` in one step.
- **No try/catch for batch**: `getMultipleQuotes` is designed to never throw — it
  returns partial results. A try/catch would be dead code.

INPUTS AND OUTPUTS:
- Single: `?symbol=AAPL` → 200 `Quote` object
- Batch: `?symbols=AAPL,MSFT,TSLA` → 200 `Quote[]` (may be shorter than input if some fail)
- Validation failure: 400

WHAT TO CHECK IF SOMETHING BREAKS:
- Batch returning fewer items than expected: one symbol failed `getQuote`. Check that
  all symbols are valid and that Polygon/Twelve Data keys are working.
- 400 on batch request: check the `symbols` param is a non-empty comma-separated string.

DEPENDENCIES:
- `@/services/marketData` (getQuote, getMultipleQuotes): cached market data fetching.
