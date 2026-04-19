# Session — 04-18-2026 — Phase 2: Watchlist

## Who worked on this
Ian

## What was built

### Pre-phase fixes
- **DB migration applied** — `supabase/migrations/001_initial.sql` run against live Supabase project. All 7 tables confirmed in Table Editor.
- **Port 3000 conflict** (carried over from Phase 1) — resolved by killing the occupying process with `lsof -ti:3000 | xargs kill -9`.
- **`middleware.ts` → `proxy.ts` rename** — Next.js 16 deprecates `middleware.ts`. Renamed file and updated exported function name from `middleware` to `proxy`. Auth protection on `/dashboard` routes now works correctly.

### Phase 2 — Watchlist (Prompt 7, complete ✅)

**`app/providers.tsx`** (new)
- `QueryClientProvider` wrapper — was missing entirely, TanStack Query hooks would not have worked without it
- Wrapped root layout in `app/layout.tsx`

**`types/watchlist.ts`** (new)
- `WatchlistItem` interface: `id`, `user_id`, `symbol`, `added_at`

**`services/marketData.ts`** (updated)
- Added `getTickerDetails(symbol)` — hits Polygon `/v3/reference/tickers/{symbol}`, returns `TickerInfo` with company name
- Cached 24h in Redis (`details:{symbol}` key)

**`app/api/market/details/route.ts`** (new)
- `GET /api/market/details?symbol=` — Zod-validated, proxies to `getTickerDetails`

**`hooks/useMarketData.ts`** (updated)
- Added `useTickerDetails(symbol)` — 24h stale time, no refetch on window focus

**`hooks/useWatchlist.ts`** (new)
- `useWatchlist()` — TanStack Query fetch from Supabase + `useMutation` for add/remove
- Add mutation explicitly passes `user_id` from `supabase.auth.getUser()` — required for RLS INSERT policy to pass
- Exposes: `watchlist`, `isLoading`, `error`, `addTicker`, `removeTicker`, `isAdding`, `removingSymbol`

**`components/features/TickerCard.tsx`** (new)
- Displays: symbol, company name (via `useTickerDetails`), price, change% (green/red), volume
- Remove button (appears on hover), clickable → `/dashboard/ticker/[symbol]`
- `TickerCardSkeleton` exported for loading state

**`components/features/WatchlistSearch.tsx`** (new)
- Debounced search input (300ms) using `useTickerSearch`
- Dropdown results filtered to exclude already-watchlisted symbols
- Closes on outside click

**`app/dashboard/watchlist/page.tsx`** (new)
- Loading skeleton grid (8 cards)
- Empty state with star icon and prompt
- Responsive grid: 2 → 3 → 4 → 5 columns across breakpoints
- Live prices via `useWatchlistQuotes` (60s poll), matched to cards by `quote.symbol`

## Bugs fixed during session
- **403 on watchlist INSERT** — Supabase RLS `with check (auth.uid() = user_id)` requires `user_id` to be passed explicitly in the insert. Fixed in `useWatchlist.ts` by calling `supabase.auth.getUser()` before insert.
- **`middleware.ts` not running** — Next.js 16 silently ignores `middleware.ts`. Renamed to `proxy.ts` and updated function export name to `proxy`.
- **No `QueryClientProvider`** — TanStack Query hooks were wired up but the provider was never added to the app. Added `app/providers.tsx` and wrapped root layout.

## Console errors (non-issues)
- `Uncaught (in promise) Error: Params are not set` — originates from `mf.js` (MetaMask browser extension). Not our code.
- `A listener indicated an asynchronous response...` — also a browser extension error. Not our code.

## What is NOT finished yet
- Nothing — Phase 2 is fully complete, verified, and tested ✅

## Left off at
- Phase 2 complete ✅
- **Next session starts at Phase 3, Prompt 8 — Candlestick Chart**
- Build `<CandlestickChart>` component using `lightweight-charts`
- Read `PLAN.MD` Prompt 8 before starting

## Tests written
- `__tests__/services/marketDataDetails.test.ts` — 7 tests for `getTickerDetails` (cache hit, uppercase, Polygon fetch, caching, error cases)
- `__tests__/api/market/details.test.ts` — 7 tests for `GET /api/market/details` (200, 400, 502, 500, call args)
- `__tests__/hooks/useWatchlist.test.ts` — 7 tests for `useWatchlist` (fetch, loading, error, add with user_id, uppercase, remove, unauthenticated guard)
- **75/75 tests passing across 8 test files** ✅

## Decisions made
- Company name fetched via `getTickerDetails` (Polygon reference endpoint) rather than storing in DB — avoids schema changes, correctly cached 24h in Redis
- `user_id` must always be passed explicitly on Supabase inserts when the table has a NOT NULL FK and RLS `with check` on that column

## Open questions
- Tests for Phase 2 not yet written — consider writing before or after Phase 3
- `proxy.ts` matcher covers all routes including API routes — verify this doesn't cause issues as more API routes are added
