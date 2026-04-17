// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ─── Mock fetch globally ─────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
  useCandles,
  useQuote,
  useWatchlistQuotes,
  useTickerSearch,
} from '@/hooks/useMarketData'

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function fetchOk(data: unknown) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response)
}

function fetchErr(message = 'error') {
  return Promise.resolve({
    ok: false,
    json: () => Promise.resolve({ error: message }),
  } as Response)
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockQuote = {
  symbol: 'AAPL',
  price: 150,
  change: 2.5,
  changePercent: 1.69,
  volume: 1_000_000,
  updatedAt: 1_700_000_000_000,
}

const mockCandles = [
  { timestamp: 1_704_067_200, open: 148, high: 152, low: 147, close: 150, volume: 1_000_000 },
]

const mockTickers = [
  { symbol: 'NVDA', name: 'Nvidia Corp', exchange: 'XNAS', type: 'CS' },
]

// ─── useQuote ─────────────────────────────────────────────────────────────────

describe('useQuote', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is disabled when symbol is empty', () => {
    const { result } = renderHook(() => useQuote(''), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches and returns quote data', async () => {
    mockFetch.mockResolvedValue(fetchOk(mockQuote))

    const { result } = renderHook(() => useQuote('AAPL'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.symbol).toBe('AAPL')
    expect(result.current.data?.price).toBe(150)
  })

  it('exposes error when fetch fails', async () => {
    mockFetch.mockResolvedValue(fetchErr('Both providers failed'))

    const { result } = renderHook(() => useQuote('AAPL'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toContain('Both providers failed')
  })
})

// ─── useCandles ───────────────────────────────────────────────────────────────

describe('useCandles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is disabled when symbol is empty', () => {
    const { result } = renderHook(
      () => useCandles('', '1D', '2024-01-01', '2024-12-31'),
      { wrapper: createWrapper() }
    )
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches and returns candle data', async () => {
    mockFetch.mockResolvedValue(fetchOk(mockCandles))

    const { result } = renderHook(
      () => useCandles('NVDA', '1D', '2024-01-01', '2024-12-31'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].close).toBe(150)
  })

  it('exposes error when fetch fails', async () => {
    mockFetch.mockResolvedValue(fetchErr('Both providers failed'))

    const { result } = renderHook(
      () => useCandles('NVDA', '1D', '2024-01-01', '2024-12-31'),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

// ─── useWatchlistQuotes ───────────────────────────────────────────────────────

describe('useWatchlistQuotes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is disabled when symbols array is empty', () => {
    const { result } = renderHook(() => useWatchlistQuotes([]), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches quotes for provided symbols', async () => {
    const quotes = [
      { ...mockQuote, symbol: 'AAPL' },
      { ...mockQuote, symbol: 'NVDA' },
    ]
    mockFetch.mockResolvedValue(fetchOk(quotes))

    const { result } = renderHook(
      () => useWatchlistQuotes(['AAPL', 'NVDA']),
      { wrapper: createWrapper() }
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
  })
})

// ─── useTickerSearch ──────────────────────────────────────────────────────────

describe('useTickerSearch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is disabled when query is empty', () => {
    const { result } = renderHook(() => useTickerSearch(''), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when query is only whitespace', () => {
    const { result } = renderHook(() => useTickerSearch('   '), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches and returns search results', async () => {
    mockFetch.mockResolvedValue(fetchOk(mockTickers))

    const { result } = renderHook(() => useTickerSearch('nvidia'), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].symbol).toBe('NVDA')
  })
})
