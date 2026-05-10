FILE: hooks/useWatchlist.ts
LAST UPDATED: 2026-05-05

WHAT THIS FILE DOES:
Provides a single `useWatchlist` hook that bundles reading the user's watchlist,
adding a ticker, and removing a ticker — all in one import. Unlike the market data
hooks that go through Next.js API routes, this hook talks to Supabase directly from
the browser because the `watchlist` table has Row Level Security (RLS) configured,
which means the database itself enforces that users can only touch their own rows.

HOW IT WORKS (step by step):
1. `fetchWatchlist` calls Supabase directly using the browser client. RLS filters the
   results to the logged-in user automatically — no userId is passed explicitly.
2. `useQuery` wraps `fetchWatchlist` and caches the result under the key `['watchlist']`.
   No `staleTime` is set, so TanStack uses its default of 0ms (always considered stale).
   This means the list re-fetches on every mount — acceptable since the watchlist is
   small and should always be current.
3. `addMutation` uses `useMutation` to handle adding a symbol. It first calls
   `supabase.auth.getUser()` to retrieve the logged-in user's ID, then inserts a new
   row into the `watchlist` table with that userId. The userId is required on insert
   even though RLS reads it from the session — the column has a NOT NULL constraint.
4. `removeMutation` deletes the matching row by symbol. The DELETE doesn't filter by
   `user_id` in the query because RLS does it at the database level automatically.
5. Both mutations call `queryClient.invalidateQueries({ queryKey: ['watchlist'] })`
   in their `onSuccess` callback. This tells TanStack to immediately re-fetch the
   watchlist cache, so the UI reflects the add/remove without a manual refresh.
6. `removeMutation.variables` holds the symbol argument passed to the last `.mutate()`
   call. Exposing it as `removingSymbol` lets UI components show a per-row spinner
   on exactly the item being removed.

KEY CONCEPTS USED:
- **Supabase RLS (Row Level Security)**: Postgres-level rules that filter queries to
  only the authenticated user's rows. Defined in SQL migrations. Because RLS runs at
  the database layer, there's no risk of a bug in application code exposing other users'
  data — the database rejects disallowed queries outright.
- **`useMutation`**: TanStack's hook for write operations. Doesn't auto-run; you call
  `.mutate(args)` to trigger it. Provides `isPending`, `isError`, `isSuccess` states.
- **`queryClient.invalidateQueries`**: Manually marks a cache entry as stale after a
  write. TanStack immediately re-fetches the invalidated query in the background.
- **`mutation.variables`**: TanStack stores the argument last passed to `.mutate()`.
  Useful for identifying which specific item is mid-mutation in a list.

INPUTS AND OUTPUTS:
- Inputs: none for reads. `addTicker(symbol: string)` and `removeTicker(symbol: string)`
  for writes.
- Outputs: `{ watchlist, isLoading, error, addTicker, removeTicker, isAdding, removingSymbol }`

WHAT TO CHECK IF SOMETHING BREAKS:
- Add/remove not reflecting in the UI: check that `invalidateQueries` is firing. If the
  queryKey in `invalidateQueries` doesn't exactly match the `queryKey` in `useQuery`,
  the cache won't be invalidated and the list won't re-fetch.
- "Not authenticated" error on add: the user's Supabase session cookie is missing or
  expired. Check that middleware is refreshing sessions correctly.
- RLS blocking a legitimate read/write: check the RLS policies in
  `supabase/migrations/001_initial.sql` — they must allow SELECT/INSERT/DELETE for
  `auth.uid() = user_id`.

DEPENDENCIES:
- `@tanstack/react-query` (useQuery, useMutation, useQueryClient): data fetching and
  cache management.
- `@/lib/supabase/client`: browser-side Supabase client that reads the session from cookies.
