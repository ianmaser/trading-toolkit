FILE: app/providers.tsx
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Creates and provides the single shared TanStack Query cache to the entire React component
tree. Every `useQuery` and `useMutation` hook anywhere in the app connects to this one
central cache — so data fetched on one page is still available when navigating to another
without a new network request.

HOW IT WORKS (step by step):
1. `useState` with a factory function (`() => new QueryClient(...)`) creates one QueryClient
   instance the first time the Providers component mounts. The factory syntax is critical —
   without it, `new QueryClient()` would run on every render, wiping the cache each time.
2. The QueryClient is configured with default options applied to all queries in the app:
   - `staleTime: 60_000` — fetched data is considered fresh for 60 seconds. TanStack Query
     will not re-fetch in the background until this window expires. Individual hooks can
     override this (e.g., `useCandles` sets 24 hours for daily bars).
   - `retry: 1` — failed requests are retried once before surfacing an error. The default
     is 3 retries, which is too aggressive for market data APIs where failures (bad symbol,
     rate limit) are usually persistent.
3. `QueryClientProvider` wraps all `{children}` and injects the QueryClient instance into
   React context. Any component in the tree can then call `useQuery`/`useMutation` without
   receiving the client as a prop.

KEY CONCEPTS USED:
- **TanStack Query (React Query)**: A data-fetching and server-state caching library. Unlike
  `useEffect + fetch`, it handles loading/error states, background re-fetching, deduplication,
  and stale-while-revalidate — all automatically. The QueryClient is its central cache manager.
- **QueryClient singleton via useState factory**: Creating the QueryClient inside a `useState`
  lazy initializer (`useState(() => new ...)`) guarantees it is created exactly once per
  component mount and is never replaced, even across re-renders.
- **QueryClientProvider**: A React context provider that makes the QueryClient available to
  all descendant components without prop drilling.
- **staleTime**: The window during which TanStack Query treats cached data as "fresh" and
  skips background re-fetching. Setting it globally to 60s prevents noisy re-fetches for
  standard queries; high-frequency data (quotes) can override it per hook.

INPUTS AND OUTPUTS:
- Input: `children` — the entire Next.js page/layout tree
- Output: the same tree wrapped in a QueryClientProvider, making the cache available globally
- No network calls, no props beyond children — this is pure infrastructure wiring

WHAT TO CHECK IF SOMETHING BREAKS:
- Data not updating after mutation: check that the relevant `useMutation` calls
  `queryClient.invalidateQueries(...)` on success to bust the stale cache entry.
- Cache persisting across user sessions unexpectedly: the QueryClient is tied to the
  component lifecycle; on page refresh it is recreated fresh. If stale data appears mid-session,
  check `staleTime` settings in the specific hook.
- All queries failing immediately: ensure `QueryClientProvider` is wrapping the tree at or
  above the component that calls `useQuery`. If a hook is used outside this Provider, it
  will throw a "No QueryClient set" error.

DEPENDENCIES:
- `@tanstack/react-query` (QueryClient, QueryClientProvider): TanStack Query core — the cache
  manager and its React context provider.
- `react` (useState): React hook used to create the QueryClient exactly once per mount.
