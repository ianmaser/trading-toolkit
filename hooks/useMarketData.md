FILE: hooks/useMarketData.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Provides five React hooks for fetching market data from our Next.js API routes.
Each hook wraps a fetch call in TanStack Query's `useQuery`, which handles caching,
loading/error states, background re-fetching, and deduplication automatically.
The `staleTime` on each hook is tuned to how often that specific type of data changes
in the real world — daily candles cache for 24 hours, live quotes cache for 60 seconds.

HOW IT WORKS (step by step):
1. Each "fetcher" function (fetchCandles, fetchQuote, etc.) is a plain async function
   that hits a Next.js API route and returns typed data. If the response is not OK,
   it throws an Error — TanStack Query catches this and puts it in `query.error`.
2. Each exported hook calls `useQuery` with three key fields: `queryKey`, `queryFn`,
   and cache timing options (`staleTime`, `refetchInterval`, etc.).
3. `queryKey` is an array that uniquely identifies this request. TanStack uses it as
   a cache key — if two components call `useCandles('AAPL', '1D', ...)` with the same
   args, they share a single cached result and a single network request.
4. If any value in `queryKey` changes (e.g. the user switches from AAPL to MSFT),
   TanStack detects the new key, treats it as a different request, and fetches fresh data.
5. `enabled: false` prevents fetching when required parameters are missing (empty symbol,
   empty date range). Without this, TanStack would fetch immediately with bad params.
6. After `staleTime` milliseconds, TanStack marks the data as stale. The next time the
   component mounts or the window is re-focused, it fetches fresh data in the background
   while still showing the stale data — no loading flash for the user.
7. `refetchInterval` on `useWatchlistQuotes` causes TanStack to re-fetch every 60 seconds
   automatically, keeping watchlist prices live without any user action.

KEY CONCEPTS USED:
- **TanStack Query `useQuery`**: Declarative data-fetching hook. You describe WHAT data
  you need (via queryFn) and HOW LONG it stays fresh (staleTime). TanStack handles the
  rest — caching, deduplication, background re-fetch, loading/error states.
- **queryKey deduplication**: Multiple components can call the same hook with the same
  args. TanStack ensures only one network request fires and all consumers share the result.
- **staleTime tuning**: The cache TTLs are intentionally matched to data volatility:
  daily candles (24h), intraday candles (5m), quotes (60s), static details (24h).
- **`enabled` guard**: Prevents fetching with incomplete parameters. Essential when
  symbol state starts as null or empty string on initial render.

INPUTS AND OUTPUTS:
- Inputs: symbol strings, timeframe, date range strings (ISO format), search query string.
- Outputs: each hook returns the standard TanStack Query result object:
  `{ data, isLoading, isFetching, isError, error }`.

WHAT TO CHECK IF SOMETHING BREAKS:
- Data not updating after symbol changes: check that symbol is included in `queryKey`.
  If it's missing from the key, TanStack won't detect the change and will serve stale data.
- Hook not fetching at all: check the `enabled` condition. If any required parameter is
  falsy, the fetch is suppressed.
- Stale data showing after a write elsewhere: this file only reads data. If a write
  operation should invalidate these queries, add `queryClient.invalidateQueries` in the
  mutation's `onSuccess` handler.

DEPENDENCIES:
- `@tanstack/react-query` (useQuery): data-fetching and caching library for React.
  Replaces manual useState/useEffect fetch patterns with declarative, cache-aware hooks.
