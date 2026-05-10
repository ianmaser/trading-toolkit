'use client'

// TanStack Query requires a single QueryClient instance to be shared across the entire
// component tree. QueryClient is the central cache manager — it holds all fetched data,
// tracks stale/fresh state, and orchestrates background re-fetches.
// QueryClientProvider makes this instance available to every useQuery/useMutation hook
// in the tree via React context, without any component needing to import it directly.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  // `useState` with a factory function (lazy initializer) creates the QueryClient
  // exactly once per component mount. Without the factory function syntax, `new QueryClient()`
  // would be called on every render — creating a new instance and wiping the cache
  // each time the Providers component re-renders.
  // The destructured array has no setter ([queryClient]) because we never replace the client.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Default staleTime for all queries: 60 seconds.
            // Individual hooks can override this — useCandles sets it to 24h for daily bars.
            // This default prevents aggressive re-fetching for any query that doesn't
            // specify its own staleTime.
            staleTime: 60 * 1000,
            // Retry failed requests once before surfacing an error to the component.
            // Default without this is 3 retries — too many for market data APIs
            // where failures are usually persistent (bad symbol, rate limit, etc.).
            retry: 1,
          },
        },
      })
  )

  // QueryClientProvider injects the queryClient into React context.
  // All useQuery/useMutation hooks anywhere in {children} will automatically
  // connect to this shared client and its cache.
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
