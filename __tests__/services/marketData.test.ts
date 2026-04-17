import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarketDataError } from '@/types/market'

// ─── Mock Redis (hoisted — covers module-level `new Redis()`) ────────────────
// vi.hoisted ensures mockRedis is defined before vi.mock's factory runs

const mockRedis = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function () { return mockRedis }),
}))

// ─── Mock fetch globally ─────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Import service AFTER mocks are in place ─────────────────────────────────

const { getQuote, getCandles, searchTickers, getMultipleQuotes } = await import(
  '@/services/marketData'
)

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockQuote = {
  symbol: 'AAPL',
  price: 150,
  change: 2.5,
  changePercent: 1.69,
  volume: 1_000_000,
  updatedAt: 1_700_000_000_000,
}

const mockCandle = {
  timestamp: 1_704_067_200,
  open: 148,
  high: 152,
  low: 147,
  close: 150,
  volume: 1_000_000,
}

const mockTicker = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  exchange: 'XNAS',
  type: 'CS',
}

// ─── Response builders ───────────────────────────────────────────────────────

function ok(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(data) } as Response
}

function err(status = 500): Response {
  return { ok: false, status, json: () => Promise.resolve({}) } as Response
}

const polygonQuote = {
  ticker: {
    ticker: 'AAPL',
    day: { c: 150, v: 1_000_000 },
    todaysChange: 2.5,
    todaysChangePerc: 1.69,
  },
}

const polygonCandles = {
  status: 'OK',
  results: [{ t: 1_704_067_200_000, o: 148, h: 152, l: 147, c: 150, v: 1_000_000 }],
}

const polygonSearch = {
  results: [{ ticker: 'AAPL', name: 'Apple Inc.', primary_exchange: 'XNAS', type: 'CS' }],
}

const twelvedataQuote = {
  symbol: 'AAPL',
  close: '150',
  change: '2.5',
  percent_change: '1.69',
  volume: '1000000',
}

const twelvedataCandles = {
  values: [{ datetime: '2024-01-01', open: '148', high: '152', low: '147', close: '150', volume: '1000000' }],
}

const twelvedataSearch = {
  data: [{ symbol: 'AAPL', instrument_name: 'Apple Inc.', exchange: 'NASDAQ', instrument_type: 'CS' }],
}

// ─── getQuote ────────────────────────────────────────────────────────────────

describe('getQuote', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
  })

  it('returns cached value without calling fetch', async () => {
    mockRedis.get.mockResolvedValue(mockQuote)

    const result = await getQuote('AAPL')

    expect(result).toEqual(mockQuote)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches from Polygon on cache miss, caches result', async () => {
    mockFetch.mockResolvedValue(ok(polygonQuote))

    const result = await getQuote('AAPL')

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(String(mockFetch.mock.calls[0][0])).toContain('polygon.io')
    expect(result.symbol).toBe('AAPL')
    expect(result.price).toBe(150)
    expect(mockRedis.set).toHaveBeenCalledOnce()
  })

  it('falls back to Twelve Data when Polygon returns error status', async () => {
    mockFetch
      .mockResolvedValueOnce(err(500))
      .mockResolvedValueOnce(ok(twelvedataQuote))

    const result = await getQuote('AAPL')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(String(mockFetch.mock.calls[1][0])).toContain('twelvedata.com')
    expect(result.symbol).toBe('AAPL')
  })

  it('throws MarketDataError when both providers fail', async () => {
    mockFetch
      .mockResolvedValueOnce(err(500))
      .mockResolvedValueOnce(err(500))

    const p = getQuote('AAPL')
    await expect(p).rejects.toBeInstanceOf(MarketDataError)
    await expect(p).rejects.toMatchObject({ symbol: 'AAPL', provider: 'both' })
  })

  it('does not cache when both providers fail', async () => {
    mockFetch.mockResolvedValue(err(500))

    await expect(getQuote('AAPL')).rejects.toThrow(MarketDataError)
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})

// ─── getCandles ──────────────────────────────────────────────────────────────

describe('getCandles', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
  })

  it('returns cached candles without calling fetch', async () => {
    mockRedis.get.mockResolvedValue([mockCandle])

    const result = await getCandles('NVDA', '1D', '2024-01-01', '2024-12-31')

    expect(result).toEqual([mockCandle])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches from Polygon on cache miss', async () => {
    mockFetch.mockResolvedValue(ok(polygonCandles))

    const result = await getCandles('NVDA', '1D', '2024-01-01', '2024-12-31')

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(String(mockFetch.mock.calls[0][0])).toContain('polygon.io')
    expect(result[0].close).toBe(150)
    expect(result[0].timestamp).toBe(1_704_067_200) // ms → s
  })

  it('falls back to Twelve Data when Polygon fails', async () => {
    mockFetch
      .mockResolvedValueOnce(err(500))
      .mockResolvedValueOnce(ok(twelvedataCandles))

    const result = await getCandles('NVDA', '1D', '2024-01-01', '2024-12-31')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result[0].close).toBe(150)
  })

  it('throws MarketDataError when both providers fail', async () => {
    mockFetch.mockResolvedValue(err(500))

    const p = getCandles('NVDA', '1D', '2024-01-01', '2024-12-31')
    await expect(p).rejects.toBeInstanceOf(MarketDataError)
    await expect(p).rejects.toMatchObject({ symbol: 'NVDA', provider: 'both' })
  })

  it('maps all timeframes to correct Polygon params', async () => {
    mockFetch.mockResolvedValue(ok(polygonCandles))

    const cases: Array<[string, string, string]> = [
      ['5M',  '5',  'minute'],
      ['15M', '15', 'minute'],
      ['1H',  '1',  'hour'],
      ['4H',  '4',  'hour'],
      ['1D',  '1',  'day'],
    ]

    for (const [tf, multiplier, timespan] of cases) {
      vi.resetAllMocks()
      mockRedis.get.mockResolvedValue(null)
      mockFetch.mockResolvedValue(ok(polygonCandles))

      await getCandles('AAPL', tf as '1D', '2024-01-01', '2024-12-31')
      const url = String(mockFetch.mock.calls[0][0])
      expect(url).toContain(`/range/${multiplier}/${timespan}/`)
    }
  })
})

// ─── searchTickers ───────────────────────────────────────────────────────────

describe('searchTickers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
  })

  it('returns cached results without calling fetch', async () => {
    mockRedis.get.mockResolvedValue([mockTicker])

    const result = await searchTickers('apple')

    expect(result).toEqual([mockTicker])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches from Polygon on cache miss', async () => {
    mockFetch.mockResolvedValue(ok(polygonSearch))

    const result = await searchTickers('apple')

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(String(mockFetch.mock.calls[0][0])).toContain('polygon.io')
    expect(result[0].symbol).toBe('AAPL')
    expect(result[0].exchange).toBe('XNAS')
  })

  it('falls back to Twelve Data when Polygon fails', async () => {
    mockFetch
      .mockResolvedValueOnce(err(500))
      .mockResolvedValueOnce(ok(twelvedataSearch))

    const result = await searchTickers('apple')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result[0].symbol).toBe('AAPL')
  })

  it('throws MarketDataError when both providers fail', async () => {
    mockFetch.mockResolvedValue(err(500))

    const p = searchTickers('apple')
    await expect(p).rejects.toBeInstanceOf(MarketDataError)
    await expect(p).rejects.toMatchObject({ symbol: 'apple', provider: 'both' })
  })
})

// ─── getMultipleQuotes ───────────────────────────────────────────────────────

describe('getMultipleQuotes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRedis.set.mockResolvedValue('OK')
  })

  it('returns all quotes when all symbols succeed (cache hits)', async () => {
    mockRedis.get.mockResolvedValue(mockQuote)

    const result = await getMultipleQuotes(['AAPL', 'NVDA', 'TSLA'])

    expect(result).toHaveLength(3)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('silently excludes symbols where both providers fail', async () => {
    const aapl = { ...mockQuote, symbol: 'AAPL' }
    const tsla = { ...mockQuote, symbol: 'TSLA' }

    mockRedis.get
      .mockResolvedValueOnce(aapl)  // AAPL: cache hit
      .mockResolvedValueOnce(null)  // NVDA: cache miss → will fail
      .mockResolvedValueOnce(tsla)  // TSLA: cache hit

    mockFetch.mockResolvedValue(err(500)) // NVDA: both providers fail

    const result = await getMultipleQuotes(['AAPL', 'NVDA', 'TSLA'])

    expect(result).toHaveLength(2)
    expect(result.map((q) => q.symbol)).toContain('AAPL')
    expect(result.map((q) => q.symbol)).toContain('TSLA')
    expect(result.map((q) => q.symbol)).not.toContain('NVDA')
  })

  it('returns empty array when all symbols fail', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockFetch.mockResolvedValue(err(500))

    const result = await getMultipleQuotes(['AAPL', 'NVDA'])

    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty input', async () => {
    const result = await getMultipleQuotes([])
    expect(result).toHaveLength(0)
  })
})
