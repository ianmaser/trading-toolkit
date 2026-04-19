// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// ─── Mock Supabase client ─────────────────────────────────────────────────────

const mockWatchlist = [
  { id: 'id-1', user_id: 'user-1', symbol: 'AAPL', added_at: '2026-01-01T00:00:00Z' },
  { id: 'id-2', user_id: 'user-1', symbol: 'NVDA', added_at: '2026-01-02T00:00:00Z' },
]

const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockEq = vi.fn().mockResolvedValue({ error: null })
const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
const mockOrder = vi.fn().mockResolvedValue({ data: mockWatchlist, error: null })
const mockSelect = vi.fn().mockReturnValue({ order: mockOrder })
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, insert: mockInsert, delete: mockDelete })
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}))

import { useWatchlist } from '@/hooks/useWatchlist'

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useWatchlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrder.mockResolvedValue({ data: mockWatchlist, error: null })
    mockInsert.mockResolvedValue({ error: null })
    mockEq.mockResolvedValue({ error: null })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('fetches and returns watchlist items', async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.watchlist).toHaveLength(2)
    expect(result.current.watchlist[0].symbol).toBe('AAPL')
    expect(result.current.watchlist[1].symbol).toBe('NVDA')
  })

  it('returns empty array while loading', () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper: createWrapper() })
    expect(result.current.watchlist).toEqual([])
  })

  it('exposes error when fetch fails', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'DB error' } })

    const { result } = renderHook(() => useWatchlist(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error?.message).toBe('DB error')
  })

  it('addTicker calls insert with symbol and user_id', async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.addTicker('TSLA')
    })

    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockInsert).toHaveBeenCalledWith({ symbol: 'TSLA', user_id: 'user-1' })
  })

  it('addTicker uppercases the symbol', async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.addTicker('tsla')
    })

    await waitFor(() => expect(mockInsert).toHaveBeenCalled())
    expect(mockInsert).toHaveBeenCalledWith({ symbol: 'TSLA', user_id: 'user-1' })
  })

  it('removeTicker calls delete with correct symbol', async () => {
    const { result } = renderHook(() => useWatchlist(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.removeTicker('AAPL')
    })

    await waitFor(() => expect(mockEq).toHaveBeenCalled())
    expect(mockEq).toHaveBeenCalledWith('symbol', 'AAPL')
  })

  it('addTicker throws when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { result } = renderHook(() => useWatchlist(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      result.current.addTicker('TSLA')
    })

    await waitFor(() => expect(mockInsert).not.toHaveBeenCalled())
  })
})
