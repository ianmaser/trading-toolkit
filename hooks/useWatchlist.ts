'use client'

// useQuery — for reading data (auto-fetches on mount, caches, re-fetches when stale)
// useMutation — for writing data (does NOT auto-run; you call `.mutate()` explicitly)
// useQueryClient — gives access to the central TanStack cache so we can manually
//   invalidate (expire) a cached query after a write operation
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// The browser-side Supabase client. Watchlist reads and writes go directly to Supabase
// from the browser — no need for a Next.js API route because Supabase RLS (Row Level
// Security) ensures users can only see and modify their own rows at the database level.
import { createClient } from '@/lib/supabase/client'
import { WatchlistItem } from '@/types/watchlist'

// Fetches the current user's watchlist directly from Supabase.
// RLS on the `watchlist` table automatically filters to only the logged-in user's rows,
// so we don't need to pass a userId — Supabase reads it from the auth session cookie.
async function fetchWatchlist(): Promise<WatchlistItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .order('added_at', { ascending: false }) // newest additions appear first
  if (error) throw new Error(error.message)
  return data ?? [] // Supabase returns null for empty tables; normalise to empty array
}

export function useWatchlist() {
  // useQueryClient() returns a reference to the single shared QueryClient instance
  // that was set up in app/providers.tsx. We need it here to manually invalidate
  // the cached watchlist after an add or remove, triggering a re-fetch.
  const queryClient = useQueryClient()
  const supabase = createClient()

  // Read the watchlist. No staleTime set — uses TanStack's default (0ms, always stale).
  // This means the list re-fetches on every mount, keeping it fresh without polling.
  const query = useQuery<WatchlistItem[], Error>({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist,
  })

  // useMutation wraps a write operation. Unlike useQuery, it does nothing until
  // `addMutation.mutate(symbol)` is called explicitly (usually on a button click).
  // TanStack tracks isPending, isError, isSuccess states for you automatically.
  const addMutation = useMutation({
    mutationFn: async (symbol: string) => {
      // Explicitly fetch the current user to attach their ID to the new row.
      // This is required because the `user_id` column has a NOT NULL constraint —
      // Supabase won't infer it automatically on insert (only RLS reads use it implicitly).
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('watchlist')
        .insert({ symbol: symbol.toUpperCase(), user_id: user.id })
      if (error) throw new Error(error.message)
    },
    // onSuccess runs after a successful mutation. invalidateQueries marks the
    // 'watchlist' cache entry as stale, which causes TanStack to immediately
    // re-fetch the watchlist — so the UI shows the new item without a manual refresh.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (symbol: string) => {
      // No user_id filter needed here — RLS on the `watchlist` table enforces
      // "DELETE WHERE user_id = auth.uid()" at the database level, so a user
      // can never accidentally delete another user's row even without the filter.
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('symbol', symbol.toUpperCase())
      if (error) throw new Error(error.message)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  })

  return {
    watchlist: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    addTicker: (symbol: string) => addMutation.mutate(symbol),
    removeTicker: (symbol: string) => removeMutation.mutate(symbol),
    isAdding: addMutation.isPending,
    // removeMutation.variables holds the argument that was passed to the last
    // `.mutate()` call. By exposing it as `removingSymbol`, components can show
    // a per-row loading spinner on exactly the symbol being removed, not all rows.
    removingSymbol: removeMutation.isPending ? removeMutation.variables : null,
  }
}
