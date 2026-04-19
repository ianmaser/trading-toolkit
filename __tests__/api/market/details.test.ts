import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { MarketDataError } from '@/types/market'

// ─── Mock service layer ───────────────────────────────────────────────────────

const mockGetTickerDetails = vi.fn()

vi.mock('@/services/marketData', () => ({
  getTickerDetails: mockGetTickerDetails,
  getQuote: vi.fn(),
  getMultipleQuotes: vi.fn(),
  getCandles: vi.fn(),
  searchTickers: vi.fn(),
}))

const { GET } = await import('@/app/api/market/details/route')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function req(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`)
}

const mockTickerInfo = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  exchange: 'XNAS',
  type: 'CS',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/market/details', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with ticker info for a valid symbol', async () => {
    mockGetTickerDetails.mockResolvedValue(mockTickerInfo)

    const res = await GET(req('/api/market/details?symbol=AAPL'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.symbol).toBe('AAPL')
    expect(body.name).toBe('Apple Inc.')
  })

  it('returns 400 when symbol param is missing', async () => {
    const res = await GET(req('/api/market/details'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when symbol is empty string', async () => {
    const res = await GET(req('/api/market/details?symbol='))
    expect(res.status).toBe(400)
  })

  it('returns 400 when symbol exceeds 10 characters', async () => {
    const res = await GET(req('/api/market/details?symbol=TOOLONGSYMBOL'))
    expect(res.status).toBe(400)
  })

  it('returns 502 when service throws MarketDataError', async () => {
    mockGetTickerDetails.mockRejectedValue(
      new MarketDataError('Provider failed', 'AAPL', 'both')
    )

    const res = await GET(req('/api/market/details?symbol=AAPL'))
    const body = await res.json()

    expect(res.status).toBe(502)
    expect(body.error).toContain('Provider failed')
  })

  it('returns 500 for unexpected errors', async () => {
    mockGetTickerDetails.mockRejectedValue(new Error('Unexpected'))

    const res = await GET(req('/api/market/details?symbol=AAPL'))

    expect(res.status).toBe(500)
  })

  it('calls getTickerDetails with the provided symbol', async () => {
    mockGetTickerDetails.mockResolvedValue(mockTickerInfo)

    await GET(req('/api/market/details?symbol=NVDA'))

    expect(mockGetTickerDetails).toHaveBeenCalledWith('NVDA')
  })
})
