'use client'
// 'use client' tells Next.js this module only runs in the browser.
// TanStack Query hooks use React state internally, so they cannot run on the server.

// TanStack Query (formerly React Query) is a data-fetching and caching library.
// It wraps your fetch calls and automatically manages: loading states, error states,
// caching results, deduplicating concurrent requests for the same data, and
// re-fetching stale data in the background. You never write loading/error booleans
// by hand — useQuery returns them for you.
import { useQuery } from '@tanstack/react-query'
import { Candle, Quote, Timeframe, TickerInfo } from '@/types/market'

// ─── Fetchers ────────────────────────────────────────────────────────────────
// Plain async functions that hit our Next.js API routes and return typed data.
// They throw on failure — TanStack Query catches the thrown error and exposes it
// as `query.error` on the hook's return value.

// Fetches OHLCV candlestick data for a symbol over a date range and timeframe.
// Builds a URLSearchParams object (which serialises to "symbol=AAPL&timeframe=1D&...")
// and appends it to the API route URL as a query string.
async function fetchCandles(
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string
): Promise<Candle[]> {
  const params = new URLSearchParams({ symbol, timeframe, from, to })
  const res = await fetch(`/api/market/candles?${params}`)
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Failed to fetch candles')
  }
  return res.json()
}

// Fetches the current real-time quote (price, change, volume) for a single symbol.
// encodeURIComponent prevents special characters in the symbol from breaking the URL.
async function fetchQuote(symbol: string): Promise<Quote> {
  const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Failed to fetch quote')
  }
  return res.json()
}

// Fetches quotes for multiple symbols in a single API call (used by the watchlist).
// Joins the array into a comma-separated string, then encodes it for safe URL inclusion.
async function fetchMultipleQuotes(symbols: string[]): Promise<Quote[]> {
  const res = await fetch(`/api/market/quote?symbols=${encodeURIComponent(symbols.join(','))}`)
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Failed to fetch quotes')
  }
  return res.json()
}

// Fetches ticker search results matching a user-typed query string.
async function fetchTickerSearch(query: string): Promise<TickerInfo[]> {
  const res = await fetch(`/api/market/search?query=${encodeURIComponent(query)}`)
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Failed to search tickers')
  }
  return res.json()
}

// ─── Hooks ───────────────────────────────────────────────────────────────────
// Each hook is a thin wrapper around useQuery. Key config fields explained below:
//
// queryKey   — TanStack's cache identifier. An array of values that uniquely describe
//              this request. If any value in the array changes (e.g. symbol switches
//              from "AAPL" to "MSFT"), TanStack treats it as a new request and fetches
//              fresh data. All components using the same queryKey share one cached result.
//
// enabled    — A boolean gate. When false, TanStack will not fetch at all. Used to
//              prevent fetches with empty/incomplete parameters (e.g. no symbol yet).
//
// staleTime  — How long (in ms) TanStack considers the cached data "fresh". During this
//              window, no re-fetch happens even if the component re-mounts or the window
//              is re-focused. After it expires, the data is "stale" and TanStack will
//              fetch fresh data in the background on the next access.
//
// refetchOnWindowFocus — When true, TanStack refetches stale queries automatically
//              whenever the user switches back to the browser tab. Good for live data;
//              disabled for static data that doesn't change (ticker details, search).
//
// refetchInterval — Fires a background refetch every N milliseconds regardless of
//              user interaction. Used for watchlist quotes to keep prices current.

// Candlestick data for charts. staleTime varies by timeframe:
//   - Daily bars (1D): cache for 24 hours — today's daily bar doesn't change during market hours.
//   - Intraday bars (1H, 4H, etc.): cache for 5 minutes — these update frequently.
export function useCandles(
  symbol: string,
  timeframe: Timeframe,
  from: string,
  to: string
) {
  return useQuery<Candle[], Error>({
    queryKey: ['candles', symbol, timeframe, from, to],
    queryFn: () => fetchCandles(symbol, timeframe, from, to),
    enabled: Boolean(symbol && timeframe && from && to),
    staleTime: timeframe === '1D' ? 24 * 60 * 60 * 1000 : 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

// Single ticker quote (current price, change %). Stale after 60 seconds.
export function useQuote(symbol: string) {
  return useQuery<Quote, Error>({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol),
    enabled: Boolean(symbol),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

// Batch quotes for every symbol on the watchlist. Polls every 60s so prices stay live
// without the user having to manually refresh. staleTime matches the poll interval.
export function useWatchlistQuotes(symbols: string[]) {
  return useQuery<Quote[], Error>({
    queryKey: ['quotes', symbols],
    queryFn: () => fetchMultipleQuotes(symbols),
    enabled: symbols.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // poll every 60s
    refetchOnWindowFocus: true,
  })
}

// Static company/ticker details (name, sector, market cap). Cached for 24 hours —
// this data rarely changes. refetchOnWindowFocus disabled to avoid unnecessary calls.
export function useTickerDetails(symbol: string) {
  return useQuery<TickerInfo, Error>({
    queryKey: ['details', symbol],
    queryFn: async () => {
      const res = await fetch(`/api/market/details?symbol=${encodeURIComponent(symbol)}`)
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'Failed to fetch ticker details')
      }
      return res.json()
    },
    enabled: Boolean(symbol),
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

// Ticker symbol search results. Only runs when the query is at least 1 character.
// Cached for 24 hours — the set of available tickers doesn't change during the day.
export function useTickerSearch(query: string) {
  return useQuery<TickerInfo[], Error>({
    queryKey: ['search', query],
    queryFn: () => fetchTickerSearch(query),
    enabled: query.trim().length >= 1,
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
