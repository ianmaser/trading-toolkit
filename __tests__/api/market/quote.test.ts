import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { MarketDataError } from '@/types/market'

// ─── Mock the service layer ───────────────────────────────────────────────────

const mockGetQuote = vi.fn()
const mockGetMultipleQuotes = vi.fn()

vi.mock('@/services/marketData', () => ({
  getQuote: mockGetQuote,
  getMultipleQuotes: mockGetMultipleQuotes,
  getCandles: vi.fn(),
  searchTickers: vi.fn(),
}))

const { GET } = await import('@/app/api/market/quote/route')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`)
}

const mockQuote = {
  symbol: 'AAPL',
  price: 150,
  change: 2.5,
  changePercent: 1.69,
  volume: 1_000_000,
  updatedAt: 1_700_000_000_000,
}

// ─── Single quote ─────────────────────────────────────────────────────────────

describe('GET /api/market/quote — single', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with quote data for valid symbol', async () => {
    mockGetQuote.mockResolvedValue(mockQuote)

    const res = await GET(req('/api/market/quote?symbol=AAPL'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.symbol).toBe('AAPL')
    expect(body.price).toBe(150)
  })

  it('uppercases the symbol before fetching', async () => {
    mockGetQuote.mockResolvedValue(mockQuote)

    await GET(req('/api/market/quote?symbol=aapl'))

    expect(mockGetQuote).toHaveBeenCalledWith('AAPL')
  })

  it('returns 400 when symbol is missing', async () => {
    const res = await GET(req('/api/market/quote'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when symbol exceeds 10 characters', async () => {
    const res = await GET(req('/api/market/quote?symbol=TOOLONGSYMBOL'))
    expect(res.status).toBe(400)
  })

  it('returns 502 when MarketDataError is thrown', async () => {
    mockGetQuote.mockRejectedValue(
      new MarketDataError('Both providers failed', 'AAPL', 'both')
    )

    const res = await GET(req('/api/market/quote?symbol=AAPL'))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.error).toContain('Both providers failed')
  })

  it('returns 500 for unexpected errors', async () => {
    mockGetQuote.mockRejectedValue(new Error('Unexpected'))

    const res = await GET(req('/api/market/quote?symbol=AAPL'))

    expect(res.status).toBe(500)
  })
})

// ─── Batch quotes ─────────────────────────────────────────────────────────────

describe('GET /api/market/quote — batch', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with array of quotes', async () => {
    const quotes = [
      { ...mockQuote, symbol: 'AAPL' },
      { ...mockQuote, symbol: 'NVDA' },
    ]
    mockGetMultipleQuotes.mockResolvedValue(quotes)

    const res = await GET(req('/api/market/quote?symbols=AAPL,NVDA'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
  })

  it('uppercases all symbols', async () => {
    mockGetMultipleQuotes.mockResolvedValue([mockQuote])

    await GET(req('/api/market/quote?symbols=aapl,nvda'))

    expect(mockGetMultipleQuotes).toHaveBeenCalledWith(['AAPL', 'NVDA'])
  })


})
