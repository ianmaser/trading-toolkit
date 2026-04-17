import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { MarketDataError } from '@/types/market'

// ─── Mock the service layer ───────────────────────────────────────────────────

const mockGetCandles = vi.fn()

vi.mock('@/services/marketData', () => ({
  getQuote: vi.fn(),
  getMultipleQuotes: vi.fn(),
  getCandles: mockGetCandles,
  searchTickers: vi.fn(),
}))

const { GET } = await import('@/app/api/market/candles/route')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`)
}

const validParams = 'symbol=NVDA&timeframe=1D&from=2024-01-01&to=2024-12-31'

const mockCandle = {
  timestamp: 1_704_067_200,
  open: 148,
  high: 152,
  low: 147,
  close: 150,
  volume: 1_000_000,
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/market/candles', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with candle array for valid params', async () => {
    mockGetCandles.mockResolvedValue([mockCandle])

    const res = await GET(req(`/api/market/candles?${validParams}`))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].close).toBe(150)
  })

  it('uppercases the symbol', async () => {
    mockGetCandles.mockResolvedValue([mockCandle])

    await GET(req('/api/market/candles?symbol=nvda&timeframe=1D&from=2024-01-01&to=2024-12-31'))

    expect(mockGetCandles).toHaveBeenCalledWith('NVDA', '1D', '2024-01-01', '2024-12-31')
  })

  it('accepts all valid timeframes', async () => {
    mockGetCandles.mockResolvedValue([mockCandle])

    for (const tf of ['1D', '4H', '1H', '15M', '5M']) {
      const res = await GET(req(`/api/market/candles?symbol=AAPL&timeframe=${tf}&from=2024-01-01&to=2024-12-31`))
      expect(res.status).toBe(200)
    }
  })

  it('returns 400 when symbol is missing', async () => {
    const res = await GET(req('/api/market/candles?timeframe=1D&from=2024-01-01&to=2024-12-31'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid timeframe', async () => {
    const res = await GET(req('/api/market/candles?symbol=AAPL&timeframe=2D&from=2024-01-01&to=2024-12-31'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const res = await GET(req('/api/market/candles?symbol=AAPL&timeframe=1D&from=01-01-2024&to=2024-12-31'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when any required param is missing', async () => {
    const cases = [
      '/api/market/candles?timeframe=1D&from=2024-01-01&to=2024-12-31',   // no symbol
      '/api/market/candles?symbol=AAPL&from=2024-01-01&to=2024-12-31',    // no timeframe
      '/api/market/candles?symbol=AAPL&timeframe=1D&to=2024-12-31',       // no from
      '/api/market/candles?symbol=AAPL&timeframe=1D&from=2024-01-01',     // no to
    ]

    for (const path of cases) {
      const res = await GET(req(path))
      expect(res.status).toBe(400)
    }
  })

  it('returns 502 when MarketDataError is thrown', async () => {
    mockGetCandles.mockRejectedValue(
      new MarketDataError('Both providers failed', 'NVDA', 'both')
    )

    const res = await GET(req(`/api/market/candles?${validParams}`))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.error).toContain('Both providers failed')
  })

  it('returns 500 for unexpected errors', async () => {
    mockGetCandles.mockRejectedValue(new Error('Unexpected'))

    const res = await GET(req(`/api/market/candles?${validParams}`))

    expect(res.status).toBe(500)
  })
})
