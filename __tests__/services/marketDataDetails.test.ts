import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Redis ───────────────────────────────────────────────────────────────

const mockRedis = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function () { return mockRedis }),
}))

// ─── Mock fetch globally ─────────────────────────────────────────────────────

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ─── Import service AFTER mocks ───────────────────────────────────────────────

const { getTickerDetails } = await import('@/services/marketData')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const mockTickerInfo = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  exchange: 'XNAS',
  type: 'CS',
}

const polygonDetails = {
  results: {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    primary_exchange: 'XNAS',
    type: 'CS',
  },
}

function ok(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(data) } as Response
}

function err(status = 500): Response {
  return { ok: false, status, json: () => Promise.resolve({}) } as Response
}

// ─── getTickerDetails ─────────────────────────────────────────────────────────

describe('getTickerDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
  })

  it('returns cached value without calling fetch', async () => {
    mockRedis.get.mockResolvedValue(mockTickerInfo)

    const result = await getTickerDetails('AAPL')

    expect(result).toEqual(mockTickerInfo)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uppercases symbol for cache key and Polygon request', async () => {
    mockFetch.mockResolvedValue(ok(polygonDetails))

    await getTickerDetails('aapl')

    expect(String(mockFetch.mock.calls[0][0])).toContain('/AAPL')
    expect(mockRedis.get).toHaveBeenCalledWith('details:AAPL')
  })

  it('fetches from Polygon on cache miss and returns TickerInfo', async () => {
    mockFetch.mockResolvedValue(ok(polygonDetails))

    const result = await getTickerDetails('AAPL')

    expect(mockFetch).toHaveBeenCalledOnce()
    expect(String(mockFetch.mock.calls[0][0])).toContain('polygon.io')
    expect(result).toEqual(mockTickerInfo)
  })

  it('caches the result after a successful fetch', async () => {
    mockFetch.mockResolvedValue(ok(polygonDetails))

    await getTickerDetails('AAPL')

    expect(mockRedis.set).toHaveBeenCalledWith('details:AAPL', mockTickerInfo, { ex: 86400 })
  })

  it('throws when Polygon returns a non-ok response', async () => {
    mockFetch.mockResolvedValue(err(404))

    await expect(getTickerDetails('AAPL')).rejects.toThrow('Polygon ticker details 404')
  })

  it('throws when Polygon returns no results', async () => {
    mockFetch.mockResolvedValue(ok({ results: null }))

    await expect(getTickerDetails('AAPL')).rejects.toThrow('Polygon ticker details: no results')
  })

  it('does not cache when fetch fails', async () => {
    mockFetch.mockResolvedValue(err(500))

    await expect(getTickerDetails('AAPL')).rejects.toThrow()
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})
