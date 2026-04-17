import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { MarketDataError } from '@/types/market'

// ─── Mock the service layer ───────────────────────────────────────────────────

const mockSearchTickers = vi.fn()

vi.mock('@/services/marketData', () => ({
  getQuote: vi.fn(),
  getMultipleQuotes: vi.fn(),
  getCandles: vi.fn(),
  searchTickers: mockSearchTickers,
}))

const { GET } = await import('@/app/api/market/search/route')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`)
}

const mockTickers = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'XNAS', type: 'CS' },
  { symbol: 'AAPLX', name: 'Apple Growth Fund', exchange: 'BATS', type: 'ETF' },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/market/search', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with ticker array for valid query', async () => {
    mockSearchTickers.mockResolvedValue(mockTickers)

    const res = await GET(req('/api/market/search?query=apple'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].symbol).toBe('AAPL')
  })

  it('passes query to service unchanged', async () => {
    mockSearchTickers.mockResolvedValue(mockTickers)

    await GET(req('/api/market/search?query=nvidia'))

    expect(mockSearchTickers).toHaveBeenCalledWith('nvidia')
  })

  it('returns 400 when query is missing', async () => {
    const res = await GET(req('/api/market/search'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when query is empty string', async () => {
    const res = await GET(req('/api/market/search?query='))
    expect(res.status).toBe(400)
  })

  it('returns 400 when query exceeds 50 characters', async () => {
    const longQuery = 'a'.repeat(51)
    const res = await GET(req(`/api/market/search?query=${longQuery}`))
    expect(res.status).toBe(400)
  })

  it('returns 502 when MarketDataError is thrown', async () => {
    mockSearchTickers.mockRejectedValue(
      new MarketDataError('Both providers failed', 'apple', 'both')
    )

    const res = await GET(req('/api/market/search?query=apple'))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.error).toContain('Both providers failed')
  })

  it('returns 500 for unexpected errors', async () => {
    mockSearchTickers.mockRejectedValue(new Error('Unexpected'))

    const res = await GET(req('/api/market/search?query=apple'))

    expect(res.status).toBe(500)
  })

  it('returns empty array when service returns no results', async () => {
    mockSearchTickers.mockResolvedValue([])

    const res = await GET(req('/api/market/search?query=zzzzz'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
  })
})
