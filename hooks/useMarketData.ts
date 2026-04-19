'use client'

import { useQuery } from '@tanstack/react-query'
import { Candle, Quote, Timeframe, TickerInfo } from '@/types/market'

// ─── Fetchers ────────────────────────────────────────────────────────────────

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

async function fetchQuote(symbol: string): Promise<Quote> {
  const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}`)
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Failed to fetch quote')
  }
  return res.json()
}

async function fetchMultipleQuotes(symbols: string[]): Promise<Quote[]> {
  const res = await fetch(`/api/market/quote?symbols=${encodeURIComponent(symbols.join(','))}`)
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Failed to fetch quotes')
  }
  return res.json()
}

async function fetchTickerSearch(query: string): Promise<TickerInfo[]> {
  const res = await fetch(`/api/market/search?query=${encodeURIComponent(query)}`)
  if (!res.ok) {
    const { error } = await res.json()
    throw new Error(error ?? 'Failed to search tickers')
  }
  return res.json()
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

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

export function useQuote(symbol: string) {
  return useQuery<Quote, Error>({
    queryKey: ['quote', symbol],
    queryFn: () => fetchQuote(symbol),
    enabled: Boolean(symbol),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  })
}

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

export function useTickerSearch(query: string) {
  return useQuery<TickerInfo[], Error>({
    queryKey: ['search', query],
    queryFn: () => fetchTickerSearch(query),
    enabled: query.trim().length >= 1,
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
