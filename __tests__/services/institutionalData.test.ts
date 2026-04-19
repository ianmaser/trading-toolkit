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

const { getInstitutionalData } = await import('@/services/institutionalData')

// ─── Fixtures ────────────────────────────────────────────────────────────────

const uwOptionsResponse = {
  data: [
    // volumeRatio = 600/100 = 6 → included
    {
      expiry: '2026-05-02',
      strike_price: 200,
      put_call: 'call',
      volume: 600,
      open_interest: 100,
      total_premium: 120000,
      created_at: '2026-04-19T10:00:00Z',
    },
    // volumeRatio = 2/100 = 0.02 → excluded (< 3)
    {
      expiry: '2026-05-02',
      strike_price: 195,
      put_call: 'put',
      volume: 2,
      open_interest: 100,
      total_premium: 500,
      created_at: '2026-04-19T10:00:00Z',
    },
  ],
}

const uwShortResponse = {
  data: [
    { short_float: 0.05, updated_at: '2026-04-19T00:00:00Z' },
    { short_float: 0.04, updated_at: '2026-04-12T00:00:00Z' },
  ],
}

const uwDarkPoolResponse = {
  data: [
    // notional = 2_000_000 → included
    { price: 200, size: 10000, notional: 2_000_000, executed_at: '2026-04-19T09:30:00Z', exchange: 'FINRA' },
    // notional = 500_000 → excluded (< $1M)
    { price: 100, size: 5000, notional: 500_000, executed_at: '2026-04-19T09:31:00Z', exchange: 'FINRA' },
  ],
}

const tradierExpirationsResponse = {
  expirations: { date: ['2026-04-25', '2026-05-02'] },
}

const tradierChainResponse = {
  options: {
    option: [
      // volumeRatio = 450/100 = 4.5 → included
      { strike: 200, option_type: 'call', volume: 450, open_interest: 100, last: 2.5 },
      // volumeRatio = 1/100 = 0.01 → excluded
      { strike: 195, option_type: 'put', volume: 1, open_interest: 100, last: 1.0 },
    ],
  },
}

function ok(data: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(data) } as Response
}

function err(status = 500): Response {
  return { ok: false, status, json: () => Promise.resolve({}) } as Response
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getInstitutionalData', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
    mockRedis.get.mockResolvedValue(null)
    mockRedis.set.mockResolvedValue('OK')
  })

  // ── Cache ──────────────────────────────────────────────────────────────────

  it('returns cached data without calling fetch', async () => {
    const cached = { unusualOptions: [], shortInterest: null, darkPool: null }
    mockRedis.get.mockResolvedValue(cached)

    const result = await getInstitutionalData('AAPL')

    expect(result).toEqual(cached)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uses uppercase symbol as cache key', async () => {
    vi.stubEnv('UNUSUAL_WHALES_API_KEY', 'uw-key')
    mockFetch
      .mockResolvedValueOnce(ok(uwOptionsResponse))
      .mockResolvedValueOnce(ok(uwShortResponse))
      .mockResolvedValueOnce(ok(uwDarkPoolResponse))

    await getInstitutionalData('aapl')

    expect(mockRedis.get).toHaveBeenCalledWith('institutional:AAPL')
    expect(mockRedis.set).toHaveBeenCalledWith(
      'institutional:AAPL',
      expect.anything(),
      { ex: 900 }
    )
  })

  // ── Unusual Whales (primary) ───────────────────────────────────────────────

  it('returns full InstitutionalData and caches on UW success', async () => {
    vi.stubEnv('UNUSUAL_WHALES_API_KEY', 'uw-key')
    mockFetch
      .mockResolvedValueOnce(ok(uwOptionsResponse))
      .mockResolvedValueOnce(ok(uwShortResponse))
      .mockResolvedValueOnce(ok(uwDarkPoolResponse))

    const result = await getInstitutionalData('AAPL')

    expect(result.unusualOptions).toHaveLength(1) // only volumeRatio > 3
    expect(result.shortInterest).not.toBeNull()
    expect(result.darkPool).toHaveLength(1)        // only notional > $1M
    expect(mockRedis.set).toHaveBeenCalledOnce()
  })

  it('filters options flow to volumeRatio > 3 only', async () => {
    vi.stubEnv('UNUSUAL_WHALES_API_KEY', 'uw-key')
    mockFetch
      .mockResolvedValueOnce(ok(uwOptionsResponse))
      .mockResolvedValueOnce(ok(uwShortResponse))
      .mockResolvedValueOnce(ok(uwDarkPoolResponse))

    const result = await getInstitutionalData('AAPL')
    const flow = result.unusualOptions!

    expect(flow).toHaveLength(1)
    expect(flow[0].volumeRatio).toBeGreaterThan(3)
    expect(flow[0].strike).toBe(200)
    expect(flow[0].type).toBe('call')
  })

  it('filters dark pool prints to notional > $1M only', async () => {
    vi.stubEnv('UNUSUAL_WHALES_API_KEY', 'uw-key')
    mockFetch
      .mockResolvedValueOnce(ok(uwOptionsResponse))
      .mockResolvedValueOnce(ok(uwShortResponse))
      .mockResolvedValueOnce(ok(uwDarkPoolResponse))

    const result = await getInstitutionalData('AAPL')
    const prints = result.darkPool!

    expect(prints).toHaveLength(1)
    expect(prints[0].notionalUsd).toBeGreaterThanOrEqual(1_000_000)
  })

  it('maps short interest fields correctly', async () => {
    vi.stubEnv('UNUSUAL_WHALES_API_KEY', 'uw-key')
    mockFetch
      .mockResolvedValueOnce(ok(uwOptionsResponse))
      .mockResolvedValueOnce(ok(uwShortResponse))
      .mockResolvedValueOnce(ok(uwDarkPoolResponse))

    const result = await getInstitutionalData('AAPL')
    const si = result.shortInterest!

    expect(si.shortFloat).toBe(0.05)
    expect(si.shortFloatPrevWeek).toBe(0.04)
    expect(si.changeVsPrevWeek).toBeCloseTo(0.01)
  })

  // ── Tradier fallback ───────────────────────────────────────────────────────

  it('falls back to Tradier when UW key is not set', async () => {
    vi.stubEnv('TRADIER_API_KEY', 'tradier-key')
    mockFetch
      .mockResolvedValueOnce(ok(tradierExpirationsResponse))
      .mockResolvedValueOnce(ok(tradierChainResponse))

    const result = await getInstitutionalData('AAPL')

    expect(result.unusualOptions).toHaveLength(1)
    expect(result.shortInterest).toBeNull()
    expect(result.darkPool).toBeNull()
  })

  it('falls back to Tradier when UW fetch fails', async () => {
    vi.stubEnv('UNUSUAL_WHALES_API_KEY', 'uw-key')
    vi.stubEnv('TRADIER_API_KEY', 'tradier-key')
    // Promise.all fires all 3 UW calls simultaneously — mock all 3 as failures
    // before the 2 Tradier calls so the queue is correct
    mockFetch
      .mockResolvedValueOnce(err(500)) // UW options
      .mockResolvedValueOnce(err(500)) // UW short interest
      .mockResolvedValueOnce(err(500)) // UW dark pool
      .mockResolvedValueOnce(ok(tradierExpirationsResponse))
      .mockResolvedValueOnce(ok(tradierChainResponse))

    const result = await getInstitutionalData('AAPL')

    expect(result.shortInterest).toBeNull()
    expect(result.darkPool).toBeNull()
    expect(result.unusualOptions).not.toBeNull()
  })

  it('returns all-null when no API keys are set', async () => {
    const result = await getInstitutionalData('AAPL')

    expect(result).toEqual({ unusualOptions: null, shortInterest: null, darkPool: null })
    expect(mockFetch).not.toHaveBeenCalled()
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('returns all-null when both providers fail', async () => {
    vi.stubEnv('UNUSUAL_WHALES_API_KEY', 'uw-key')
    vi.stubEnv('TRADIER_API_KEY', 'tradier-key')
    mockFetch
      .mockResolvedValueOnce(err(500)) // UW fails
      .mockResolvedValueOnce(err(500)) // Tradier expirations fails

    const result = await getInstitutionalData('AAPL')

    expect(result).toEqual({ unusualOptions: null, shortInterest: null, darkPool: null })
    expect(mockRedis.set).not.toHaveBeenCalled()
  })
})
