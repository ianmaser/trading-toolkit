FILE: hooks/useInstitutionalData.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Provides a single hook for fetching institutional flow data (dark pool prints, options
activity, unusual volume) for a given ticker symbol. The hook hits our Next.js API route,
which in turn calls Unusual Whales (primary) or Tradier (fallback) and caches the result
in Upstash Redis for 15 minutes. The client-side `staleTime` is deliberately set to
match that 15-minute server TTL — no point re-fetching more often than the server refreshes.

HOW IT WORKS (step by step):
1. `fetchInstitutionalData` calls `/api/institutional/[symbol]` and returns the typed
   `InstitutionalData` object on success.
2. The `.catch(() => ({ error: 'Unknown error' }))` on `res.json()` is a safety net:
   if the server returns a non-JSON body (e.g. a gateway timeout HTML page), parsing it
   would throw a second error that would hide the original problem. The catch prevents
   that by falling back to a generic error object.
3. `useInstitutionalData` wraps the fetcher in `useQuery` with:
   - `enabled: Boolean(symbol)` — suppresses the fetch until a symbol is provided.
   - `staleTime: 15 * 60 * 1000` — data is considered fresh for 15 minutes.
   - `refetchOnWindowFocus: false` — switching browser tabs doesn't trigger a re-fetch
     since institutional flow data doesn't change meaningfully on that timescale.

KEY CONCEPTS USED:
- **Aligned client/server cache TTLs**: The server caches Unusual Whales responses in
  Redis for 15 minutes. The client sets `staleTime` to the same value. This means a
  user re-visiting the ticker page within 15 minutes sees instant data from the
  TanStack cache, and beyond 15 minutes the server cache has also expired so a fresh
  API call is warranted.
- **Defensive JSON parse**: `.catch(() => fallback)` on `.json()` prevents double-throw
  when a non-JSON error response body arrives. A common pattern when calling external
  APIs that may return HTML error pages under failure conditions.

INPUTS AND OUTPUTS:
- Inputs: `symbol` string (e.g. "AAPL").
- Outputs: TanStack Query result `{ data: InstitutionalData | undefined, isLoading, isError, error }`.

WHAT TO CHECK IF SOMETHING BREAKS:
- Always returns loading / never resolves: check that `symbol` is non-empty (the `enabled`
  guard suppresses the fetch if symbol is falsy).
- Stale data not refreshing: the 15-minute staleTime means TanStack won't re-fetch within
  that window. If you need to force a refresh, call `queryClient.invalidateQueries(['institutional', symbol])`.
- API route returning errors: check the Unusual Whales and Tradier API keys in env vars,
  and inspect the server logs for the fallback logic in `services/institutionalData.ts`.

DEPENDENCIES:
- `@tanstack/react-query` (useQuery): data-fetching and caching hook.
